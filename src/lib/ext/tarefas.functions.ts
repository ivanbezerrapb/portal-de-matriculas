import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { CrmTask } from "./model";

export type TaskRow = CrmTask & {
  opportunities: {
    id: string;
    name: string;
    school_id: string;
    funnel_id: string;
    owner_id: string | null;
    funnels: { name: string } | null;
    schools: { name: string } | null;
    owner: { id: string; full_name: string | null } | null;
  } | null;
};

// Lista tarefas; sem filtro de oportunidade devolve as de todas as
// oportunidades visíveis para o usuário (RLS cuida do escopo).
export const listTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        opportunity_id: z.string().uuid().optional(),
        done: z.boolean().optional(),
        school_id: z.string().uuid().optional(),
        funnel_id: z.string().uuid().optional(),
        owner_id: z.string().uuid().optional(),
        unassigned: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_tasks")
      .select(
        "*, opportunities!inner(id, name, school_id, funnel_id, owner_id, funnels(name), schools(name), owner:profiles!opportunities_owner_id_fkey(id, full_name))",
      )
      .order("done")
      .order("due_date", { nullsFirst: false })
      .order("created_at");
    if (data.opportunity_id) q = q.eq("opportunity_id", data.opportunity_id);
    if (data.done !== undefined) q = q.eq("done", data.done);
    if (data.school_id) q = q.eq("opportunities.school_id", data.school_id);
    if (data.funnel_id) q = q.eq("opportunities.funnel_id", data.funnel_id);
    if (data.owner_id) q = q.eq("opportunities.owner_id", data.owner_id);
    if (data.unassigned) q = q.is("opportunities.owner_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TaskRow[];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        title: z.string().min(1),
        due_date: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_tasks").insert({
      opportunity_id: data.opportunity_id,
      title: data.title.trim(),
      due_date: data.due_date || null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTaskDone = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("crm_tasks")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
