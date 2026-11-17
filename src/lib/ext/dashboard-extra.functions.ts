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

// Visitas dos funis LEADS: agendadas, realizadas (check-in) e taxa de comparecimento.
export const getLeadVisitStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ schoolIds: z.array(z.string().uuid()).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const { summarizeVisits } = await import("./lead-visits-logic");
    const p = await getPerms(context.supabase, context.userId);
    let schoolIds = data.schoolIds ?? [];
    if (!p.isAdmin && !p.isDirecao) {
      const own = [...new Set([...p.managerSchools, ...p.infoSchools, ...p.operatorSchools])];
      schoolIds = schoolIds.length ? schoolIds.filter((id) => own.includes(id)) : own;
      if (!schoolIds.length) return summarizeVisits([], Date.now());
    }
    const admin = extAdmin();
    const opps = await fetchAll<any>((a, b) => {
      let q = admin
        .from("opportunities")
        .select("id, visit_at, submission_id, schools(name), submissions!inner(list_type)")
        .eq("submissions.list_type", "leads");
      if (schoolIds.length) q = q.in("school_id", schoolIds);
      return q.order("id").range(a, b);
    });
    const subIds = opps.map((o) => o.submission_id as string).filter(Boolean);
    const oppIds = opps.map((o) => o.id as string);
    const checks = new Map<string, string>();
    for (let i = 0; i < subIds.length; i += 150) {
      const { data: rows } = await admin
        .from("audit_log").select("submission_id, created_at")
        .eq("action", "check_in").in("submission_id", subIds.slice(i, i + 150));
      for (const r of (rows ?? []) as { submission_id: string; created_at: string }[]) checks.set(r.submission_id, r.created_at);
    }
    const missed: { opportunity_id: string; created_at: string }[] = [];
    for (let i = 0; i < oppIds.length; i += 150) {
      const { data: rows } = await admin
        .from("crm_notes").select("opportunity_id, created_at")
        .like("body", "Faltou à visita agendada%").in("opportunity_id", oppIds.slice(i, i + 150));
      missed.push(...((rows ?? []) as typeof missed));
    }
    const schoolOf = new Map(opps.map((o) => [o.id as string, (o.schools?.name as string) ?? "Sem escola"]));
    const interested = new Map<string, number>();
    for (const s of schoolOf.values()) interested.set(s, (interested.get(s) ?? 0) + 1);
    const recs = [] as { school: string; at: string; done: boolean; missed: boolean }[];
    // 1 registro por lead: agendamento e reagendamentos contam uma vez só.
    const lastMiss = new Map<string, string>();
    for (const m of missed) {
      const prev = lastMiss.get(m.opportunity_id);
      if (!prev || m.created_at > prev) lastMiss.set(m.opportunity_id, m.created_at);
    }
    for (const o of opps) {
      const done = checks.get(o.submission_id);
      const miss = lastMiss.get(o.id as string);
      const at = (o.visit_at as string | null) ?? done ?? miss;
      if (at) recs.push({ school: schoolOf.get(o.id)!, at, done: Boolean(done), missed: !done && !o.visit_at && Boolean(miss) });
    }
    return summarizeVisits(recs, Date.now(), interested);
  });
