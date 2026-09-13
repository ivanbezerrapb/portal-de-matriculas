import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunnelStage, Opportunity } from "./model";

type OpportunityRow = Opportunity & { submissions: { public_id: string } | null };

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
  .inputValidator((data) => z.object({ funnel_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: stages, error } = await context.supabase
      .from("funnel_stages")
      .select("*")
      .eq("funnel_id", data.funnel_id)
      .order("position");
    if (error) throw new Error(error.message);

    const { data: opportunities, error: oppError } = await context.supabase
      .from("opportunities")
      .select("*, submissions(public_id)")
      .eq("funnel_id", data.funnel_id)
      .order("position");
    if (oppError) throw new Error(oppError.message);

    return {
      stages: (stages ?? []) as FunnelStage[],
      opportunities: (opportunities ?? []) as OpportunityRow[],
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
