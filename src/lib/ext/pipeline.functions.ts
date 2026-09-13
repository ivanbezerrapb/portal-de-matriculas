import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelStage, Opportunity } from "./model";

type OpportunityRow = Opportunity & {
  submissions: { public_id: string } | null;
  crm_close_reasons: { label: string; kind: "won" | "lost" } | null;
};

async function stageContext(supabase: SupabaseClient, stageId: string) {
  const { data, error } = await supabase
    .from("funnel_stages")
    .select("id, funnel_id, funnels(id, school_id)")
    .eq("id", stageId)
    .single();
  if (error) throw new Error(error.message);
  const funnel = (data as unknown as { funnels: { id: string; school_id: string } }).funnels;
  return { funnel_id: funnel.id, school_id: funnel.school_id };
}

export const listPipeline = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        status: z.enum(["open", "won", "lost"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: stages, error } = await context.supabase
      .from("funnel_stages")
      .select("*")
      .eq("funnel_id", data.funnel_id)
      .order("position");
    if (error) throw new Error(error.message);

    const status = data.status ?? "open";
    const { data: opportunities, error: oppError } = await context.supabase
      .from("opportunities")
      .select("*, submissions(public_id), crm_close_reasons(label, kind)")
      .eq("funnel_id", data.funnel_id)
      .eq("status", status)
      .order(status === "open" ? "position" : "closed_at");
    if (oppError) throw new Error(oppError.message);

    // Próxima atividade pendente de cada oportunidade.
    const ids = ((opportunities ?? []) as { id: string }[]).map((o) => o.id);
    const nextTasks: Record<string, { title: string; due_date: string | null }> = {};
    if (ids.length > 0) {
      const { data: tasks } = await context.supabase
        .from("crm_tasks")
        .select("opportunity_id, title, due_date")
        .in("opportunity_id", ids)
        .eq("done", false)
        .order("due_date", { nullsFirst: false })
        .order("created_at");
      for (const t of (tasks ?? []) as {
        opportunity_id: string;
        title: string;
        due_date: string | null;
      }[]) {
        if (!nextTasks[t.opportunity_id]) {
          nextTasks[t.opportunity_id] = { title: t.title, due_date: t.due_date };
        }
      }
    }

    return {
      stages: (stages ?? []) as FunnelStage[],
      opportunities: (opportunities ?? []) as OpportunityRow[],
      nextTasks,
    };
  });

const opportunityFields = z.object({
  name: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const createOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ stage_id: z.string().uuid() }).merge(opportunityFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = await stageContext(context.supabase, data.stage_id);
    const { data: last } = await context.supabase
      .from("opportunities")
      .select("position")
      .eq("stage_id", data.stage_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("opportunities").insert({
      stage_id: data.stage_id,
      funnel_id: ctx.funnel_id,
      school_id: ctx.school_id,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      position: (last?.position ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid() }).merge(opportunityFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("opportunities")
      .update({
        name: data.name,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        stage_id: z.string().uuid(),
        position: z.number().int().min(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const ctx = await stageContext(context.supabase, data.stage_id);
    const { error } = await context.supabase
      .from("opportunities")
      .update({
        stage_id: data.stage_id,
        funnel_id: ctx.funnel_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Reordena a coluna de destino.
    const { data: list } = await context.supabase
      .from("opportunities")
      .select("id, position")
      .eq("stage_id", data.stage_id)
      .order("position");
    const ids = (list ?? []).map((o: { id: string }) => o.id).filter((id) => id !== data.id);
    ids.splice(Math.min(data.position, ids.length), 0, data.id);
    for (let i = 0; i < ids.length; i++) {
      const { error: posError } = await context.supabase
        .from("opportunities")
        .update({ position: i })
        .eq("id", ids[i]);
      if (posError) throw new Error(posError.message);
    }
    return { ok: true };
  });

export const deleteOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("opportunities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Fecha a oportunidade como ganha ou perdida, guardando motivo e observação.
export const closeOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        result: z.enum(["won", "lost"]),
        reason_id: z.string().uuid(),
        note: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Confere se o motivo existe e é do tipo certo.
    const { data: reason, error: reasonError } = await context.supabase
      .from("crm_close_reasons")
      .select("id, kind")
      .eq("id", data.reason_id)
      .single();
    if (reasonError || !reason) throw new Error("Motivo não encontrado.");
    if (reason.kind !== data.result) throw new Error("Motivo não corresponde ao resultado.");

    const now = new Date().toISOString();
    const { data: updated, error } = await context.supabase
      .from("opportunities")
      .update({
        status: data.result,
        close_reason_id: data.reason_id,
        close_note: data.note?.trim() || null,
        closed_at: now,
        updated_at: now,
      })
      .eq("id", data.id)
      .select("submission_id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    // Ganho no CRM = matrícula realizada no cadastro.
    if (updated?.submission_id) {
      const won = data.result === "won";
      await context.supabase
        .from("submissions")
        .update({
          enrolled: won,
          enrolled_at: won ? now : null,
          enrolled_by: won ? context.userId : null,
        })
        .eq("id", updated.submission_id);
    }
    return { ok: true };
  });

// Reabre uma oportunidade fechada, voltando para a etapa em que estava.
export const reopenOpportunity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("opportunities")
      .update({
        status: "open",
        close_reason_id: null,
        close_note: null,
        closed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
