import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import {
  groupNotStarted,
  groupOverdueTasks,
  type BacklogCard,
} from "./backlog-logic";

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Cards abertos parados na 1ª etapa (por funil) e tarefas atrasadas por
// responsável, separando Central de Informações e Coordenação.
export const getDashboardBacklog = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ schoolIds: z.array(z.string().uuid()).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    {
      const { getPerms } = await import("./server");
      const p = await getPerms(db, context.userId);
      if (!p.isAdmin && !p.isDirecao) {
        const own = [...new Set([...p.managerSchools, ...p.infoSchools, ...p.operatorSchools])];
        const req = data.schoolIds?.length ? data.schoolIds.filter((id) => own.includes(id)) : own;
        data = { ...data, schoolIds: req.length ? req : ["00000000-0000-0000-0000-000000000000"] };
      }
    }
    const opps = await fetchAll<any>((a, b) => {
      let q = db.from("opportunities")
        .select("id, funnel_id, stage_id, owner_id, schools(name), funnels(name), submissions(list_type)")
        .eq("status", "open");
      if (data.schoolIds?.length) q = q.in("school_id", data.schoolIds);
      return q.order("id").range(a, b);
    });
    const funnelIds = [...new Set(opps.map((o) => o.funnel_id as string))];
    const firstStage = new Map<string, string>();
    for (let i = 0; i < funnelIds.length; i += 150) {
      const { data: st } = await db.from("funnel_stages").select("id, funnel_id, position")
        .in("funnel_id", funnelIds.slice(i, i + 150)).order("position", { ascending: true });
      for (const s of (st ?? []) as { id: string; funnel_id: string }[]) if (!firstStage.has(s.funnel_id)) firstStage.set(s.funnel_id, s.id);
    }
    const cards = new Map<string, BacklogCard>();
    for (const o of opps) {
      cards.set(o.id as string, {
        id: o.id as string,
        funnel_id: o.funnel_id as string,
        stage_id: o.stage_id as string,
        owner_id: (o.owner_id as string | null) ?? null,
        school: o.schools?.name ?? "—",
        funnel: o.funnels?.name ?? "Funil",
        listType: (o.submissions?.list_type as string | null) ?? null,
      });
    }
    const notStarted = groupNotStarted([...cards.values()], firstStage);

    const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const ids = [...cards.keys()];
    const tasks: { opportunity_id: string }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      tasks.push(...await fetchAll<any>((a, b) => db.from("crm_tasks").select("opportunity_id, due_date")
        .in("opportunity_id", chunk).eq("done", false).lt("due_date", today).order("id").range(a, b)));
    }
    const ownerIds = [...new Set(tasks.map((t) => cards.get(t.opportunity_id)?.owner_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    for (let i = 0; i < ownerIds.length; i += 200) {
      const { data: profs } = await db.from("profiles").select("id, full_name")
        .in("id", ownerIds.slice(i, i + 200));
      for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) {
        names.set(p.id, p.full_name?.trim() || "Sem nome");
      }
    }
    return { notStarted, overdueTasks: groupOverdueTasks(cards, tasks, names) };
  });
