import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { SupabaseClient } from "@supabase/supabase-js";

async function requireAdmin(supabase: SupabaseClient, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores.");
  return perms;
}

const DEFAULT_STAGES = [
  { name: "Novo contato", color: "#1e40af" },
  { name: "Em atendimento", color: "#0284c7" },
  { name: "Visita agendada", color: "#d97706" },
  { name: "Matriculado", color: "#059669" },
  { name: "Perdido", color: "#dc2626" },
];

export const listFunnels = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: funnels, error } = await context.supabase
      .from("funnels")
      .select("*")
      .order("created_at");
    if (error) throw new Error(error.message);
    const ids = (funnels ?? []).map((f: { id: string }) => f.id);
    let stages: FunnelStage[] = [];
    if (ids.length) {
      const { data, error: stagesError } = await context.supabase
        .from("funnel_stages")
        .select("*")
        .in("funnel_id", ids)
        .order("position");
      if (stagesError) throw new Error(stagesError.message);
      stages = (data ?? []) as FunnelStage[];
    }
    return { funnels: (funnels ?? []) as Funnel[], stages };
  });

const funnelInput = z.object({
  school_id: z.string().uuid(),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

export const createFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => funnelInput.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: created, error } = await context.supabase
      .from("funnels")
      .insert({
        school_id: data.school_id,
        name: data.name,
        description: data.description || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: stagesError } = await context.supabase.from("funnel_stages").insert(
      DEFAULT_STAGES.map((s, i) => ({
        funnel_id: created.id,
        name: s.name,
        color: s.color,
        position: i,
      })),
    );
    if (stagesError) throw new Error(stagesError.message);
    return created;
  });

export const updateFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).merge(funnelInput).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("funnels")
      .update({
        school_id: data.school_id,
        name: data.name,
        description: data.description || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: original, error } = await context.supabase
      .from("funnels")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: copy, error: copyError } = await context.supabase
      .from("funnels")
      .insert({
        school_id: original.school_id,
        name: `${original.name} (cópia)`,
        description: original.description,
      })
      .select()
      .single();
    if (copyError) throw new Error(copyError.message);
    const { data: stages } = await context.supabase
      .from("funnel_stages")
      .select("name, description, color, position")
      .eq("funnel_id", data.id)
      .order("position");
    if (stages?.length) {
      const { error: insertError } = await context.supabase
        .from("funnel_stages")
        .insert(stages.map((s) => ({ ...s, funnel_id: copy.id })));
      if (insertError) throw new Error(insertError.message);
    }
    return copy;
  });

export const deleteFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("funnels").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const stageFields = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().min(4).max(9),
});

export const createStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ funnel_id: z.string().uuid() }).merge(stageFields).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: last } = await context.supabase
      .from("funnel_stages")
      .select("position")
      .eq("funnel_id", data.funnel_id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await context.supabase.from("funnel_stages").insert({
      funnel_id: data.funnel_id,
      name: data.name,
      description: data.description || null,
      color: data.color,
      position: (last?.position ?? -1) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).merge(stageFields).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("funnel_stages")
      .update({
        name: data.name,
        description: data.description || null,
        color: data.color,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        funnel_id: z.string().uuid(),
        ids: z.array(z.string().uuid()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("funnel_stages")
        .update({ position: i })
        .eq("id", data.ids[i])
        .eq("funnel_id", data.funnel_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("funnel_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
