import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";
import { compareSchoolNames } from "@/lib/school-order";

type Group = { school: string; items: { label: string; count: number }[] };

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

function toGroups(m: Map<string, Map<string, number>>): Group[] {
  return [...m.entries()]
    .map(([school, g]) => ({
      school,
      items: [...g.entries()].map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => compareSchoolNames(a.school, b.school));
}

// Cards abertos parados na 1ª etapa (por funil) e tarefas atrasadas
// da Central de Informações (responsável dos cards de LEADS).
export const getDashboardBacklog = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ schoolIds: z.array(z.string().uuid()).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
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
    const notStarted = new Map<string, Map<string, number>>();
    for (const o of opps) {
      if (firstStage.get(o.funnel_id) !== o.stage_id) continue;
      const school = o.schools?.name ?? "—";
      const g = notStarted.get(school) ?? new Map<string, number>();
      const label = o.funnels?.name ?? "Funil";
      g.set(label, (g.get(label) ?? 0) + 1);
      notStarted.set(school, g);
    }

    const leadOpps = opps.filter((o) => o.submissions?.list_type === "leads");
    const byId = new Map(leadOpps.map((o) => [o.id as string, o]));
    const ids = [...byId.keys()];
    const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    const tasks: { opportunity_id: string; due_date: string }[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const chunk = ids.slice(i, i + 150);
      tasks.push(...await fetchAll<any>((a, b) => db.from("crm_tasks").select("opportunity_id, due_date")
        .in("opportunity_id", chunk).eq("done", false).lt("due_date", today).order("id").range(a, b)));
    }
    const ownerIds = [...new Set(tasks.map((t) => byId.get(t.opportunity_id)?.owner_id).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: profs } = await db.from("profiles").select("id, full_name").in("id", ownerIds);
      for (const p of (profs ?? []) as { id: string; full_name: string | null }[]) names.set(p.id, p.full_name?.trim() || "Sem nome");
    }
    const overdue = new Map<string, Map<string, number>>();
    for (const t of tasks) {
      const o = byId.get(t.opportunity_id);
      if (!o) continue;
      const school = o.schools?.name ?? "—";
      const label = o.owner_id ? names.get(o.owner_id) ?? "Sem nome" : "Sem responsável";
      const g = overdue.get(school) ?? new Map<string, number>();
      g.set(label, (g.get(label) ?? 0) + 1);
      overdue.set(school, g);
    }
    return { notStarted: toGroups(notStarted), overdueTasks: toGroups(overdue) };
  });
