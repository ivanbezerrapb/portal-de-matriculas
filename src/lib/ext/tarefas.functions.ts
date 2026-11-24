import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import type { CrmTask } from "./model";
import { canCreateNewTask, validateCompleteTask } from "./task-flow";

export type TaskRow = CrmTask & {
  opportunities: {
    id: string;
    name: string;
    status: string;
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
        mine: z.boolean().optional(),
        unassigned: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("crm_tasks")
      .select(
        "*, opportunities!inner(id, name, status, school_id, funnel_id, owner_id, funnels(name), schools(name))",
      )
      .order("done")
      .order("due_date", { nullsFirst: false })
      .order("created_at");
    if (data.opportunity_id) q = q.eq("opportunity_id", data.opportunity_id);
    if (data.done !== undefined) q = q.eq("done", data.done);
    if (data.school_id) q = q.eq("opportunities.school_id", data.school_id);
    if (data.funnel_id) q = q.eq("opportunities.funnel_id", data.funnel_id);
    if (data.mine) q = q.eq("opportunities.owner_id", context.userId);
    else if (data.owner_id) q = q.eq("opportunities.owner_id", data.owner_id);
    if (data.unassigned) q = q.is("opportunities.owner_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ownerIds = [
      ...new Set(
        ((rows ?? []) as { opportunities: { owner_id: string | null } | null }[])
          .map((row) => row.opportunities?.owner_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const ownerNames = new Map<string, string | null>();
    if (ownerIds.length > 0) {
      const { extAdmin } = await import("./server");
      const { data: profiles } = await extAdmin()
        .from("profiles")
        .select("id, full_name")
        .in("id", ownerIds);
      for (const profile of (profiles ?? []) as { id: string; full_name: string | null }[]) {
        ownerNames.set(profile.id, profile.full_name);
      }
    }
    return (rows ?? []).map((row: any) => ({
      ...row,
      opportunities: row.opportunities
        ? {
            ...row.opportunities,
            owner: row.opportunities.owner_id
              ? {
                  id: row.opportunities.owner_id,
                  full_name: ownerNames.get(row.opportunities.owner_id) ?? null,
                }
              : null,
          }
        : null,
    })) as TaskRow[];
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
    const { count: openCount, error: countErr } = await context.supabase
      .from("crm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("opportunity_id", data.opportunity_id)
      .eq("done", false);
    if (countErr) throw new Error(countErr.message);
    const check = canCreateNewTask({ openTaskCount: openCount ?? 0 });
    if (!check.allowed) throw new Error(check.reason ?? "Já existe uma tarefa pendente.");

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
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        done: z.boolean(),
        note: z.string().trim().max(4000).optional(),
        next_task: z
          .object({
            title: z.string().trim().min(1).max(160),
            due_date: z.string().trim().min(1),
          })
          .optional()
          .nullable(),
        skip_next: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: task, error: readError } = await context.supabase
      .from("crm_tasks")
      .select("id, title, opportunity_id")
      .eq("id", data.id)
      .single();
    if (readError || !task) throw new Error(readError?.message ?? "Tarefa não encontrada.");

    const [{ data: opp, error: oppErr }, { count: otherOpenCount, error: countErr }] =
      await Promise.all([
        context.supabase
          .from("opportunities")
          .select("status")
          .eq("id", task.opportunity_id)
          .maybeSingle(),
        context.supabase
          .from("crm_tasks")
          .select("id", { count: "exact", head: true })
          .eq("opportunity_id", task.opportunity_id)
          .eq("done", false)
          .neq("id", data.id),
      ]);
    if (oppErr) throw new Error(oppErr.message);
    if (countErr) throw new Error(countErr.message);

    if (!data.done) {
      const reopenCheck = canCreateNewTask({ openTaskCount: otherOpenCount ?? 0 });
      if (!reopenCheck.allowed) {
        throw new Error(
          "Já existe outra tarefa pendente neste cartão. Conclua-a antes de reabrir esta.",
        );
      }
    }

    let validatedNote: string | null = null;
    let nextTaskToCreate: { title: string; due_date: string } | null = null;
    if (data.done) {
      const validated = validateCompleteTask({
        note: data.note,
        cardStatus: (opp?.status as string | undefined) ?? "open",
        otherOpenTaskCount: otherOpenCount ?? 0,
        nextTask: data.next_task ?? null,
        skipNext: Boolean(data.skip_next),
      });
      if (!validated.ok) throw new Error(validated.error);
      validatedNote = validated.note;
      nextTaskToCreate = validated.nextTask;
    }

    const { error } = await context.supabase
      .from("crm_tasks")
      .update({ done: data.done, done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.done && validatedNote) {
      const { extAdmin } = await import("./server");
      const { data: profile } = await extAdmin()
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      const authorName =
        ((profile?.full_name as string | null) ?? "") || context.userEmail || "Usuário";
      const body =
        data.skip_next && !nextTaskToCreate
          ? `Concluiu ${task.title}: ${validatedNote}\nConcluída sem agendar próxima tarefa.`
          : `Concluiu ${task.title}: ${validatedNote}`;
      const { error: noteError } = await context.supabase.from("crm_notes").insert({
        opportunity_id: task.opportunity_id,
        author_id: context.userId,
        author_name: authorName,
        body,
      });
      if (noteError) throw new Error(noteError.message);
    }
    if (data.done && nextTaskToCreate) {
      const { error: nextError } = await context.supabase.from("crm_tasks").insert({
        opportunity_id: task.opportunity_id,
        title: nextTaskToCreate.title,
        due_date: nextTaskToCreate.due_date,
        created_by: context.userId,
      });
      if (nextError) throw new Error(nextError.message);
    }
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
