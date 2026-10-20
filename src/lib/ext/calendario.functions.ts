import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export type CalendarEvent = {
  id: string;
  type: "visita" | "matricula";
  at: string;
  title: string;
  school_id: string;
  school_name: string;
  phone: string | null;
  funnel_id: string | null;
  detail: string | null;
};

function norm(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export const listCalendarEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms, extAdmin } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const admin = extAdmin();
    const all = perms.isAdmin || perms.isDirecao;
    const own = [...new Set([...perms.managerSchools, ...perms.infoSchools, ...perms.operatorSchools])];

    let schoolsQ = admin.from("schools").select("id, name").order("name");
    if (!all) schoolsQ = schoolsQ.in("id", own.length ? own : ["00000000-0000-0000-0000-000000000000"]);
    const { data: schools } = await schoolsQ;
    const schoolList = (schools ?? []) as { id: string; name: string }[];
    const schoolIds = schoolList.map((s) => s.id);
    const schoolName = new Map(schoolList.map((s) => [s.id, s.name]));
    if (schoolIds.length === 0) return { schools: [], events: [] as CalendarEvent[] };

    // Visitas: respeita o acesso do usuário aos cartões.
    const { data: opps } = await context.supabase
      .from("opportunities")
      .select("id, name, phone, visit_at, school_id, funnel_id, submission_id, submissions(public_id)")
      .not("visit_at", "is", null)
      .gte("visit_at", data.from)
      .lt("visit_at", data.to);
    type Opp = {
      id: string; name: string; phone: string | null; visit_at: string; school_id: string;
      funnel_id: string; submission_id: string | null; submissions: { public_id: string } | null;
    };
    const oppRows = ((opps ?? []) as unknown as Opp[]).filter((o) => schoolIds.includes(o.school_id));

    // Matrículas (visitantes) e check-ins (LEADS).
    const { data: enrolled } = await admin
      .from("submissions")
      .select("id, public_id, school_id, form_id, enrolled_at, enrollment_count")
      .eq("enrolled", true)
      .eq("list_type", "visitantes")
      .in("school_id", schoolIds)
      .gte("enrolled_at", data.from)
      .lt("enrolled_at", data.to);
    const { data: checks } = await admin
      .from("audit_log")
      .select("submission_id, created_at")
      .eq("action", "check_in")
      .gte("created_at", data.from)
      .lt("created_at", data.to);
    const checkIds = [...new Set(((checks ?? []) as { submission_id: string }[]).map((c) => c.submission_id))];
    const { data: checkSubs } = checkIds.length
      ? await admin.from("submissions").select("id, public_id, school_id, form_id").in("id", checkIds).in("school_id", schoolIds)
      : { data: [] };
    type Sub = { id: string; public_id: string; school_id: string; form_id: string; enrolled_at?: string; enrollment_count?: number | null };
    const subs = [...((enrolled ?? []) as Sub[]), ...((checkSubs ?? []) as Sub[])];

    // Nomes dos clientes.
    const allSubIds = [...new Set([...subs.map((s) => s.id), ...oppRows.map((o) => o.submission_id).filter(Boolean) as string[]])];
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    if (allSubIds.length) {
      const { data: subForms } = await admin.from("submissions").select("id, form_id").in("id", allSubIds);
      const formBySub = new Map(((subForms ?? []) as { id: string; form_id: string }[]).map((s) => [s.id, s.form_id]));
      const formIds = [...new Set(formBySub.values())];
      const [{ data: dests }, { data: fields }] = await Promise.all([
        admin.from("form_destinations").select("form_id, name_field_id, phone_field_id").in("form_id", formIds),
        admin.from("form_fields").select("id, form_id, label, type").in("form_id", formIds),
      ]);
      const nameField = new Map<string, string>();
      const phoneField = new Map<string, string>();
      for (const d of (dests ?? []) as { form_id: string; name_field_id: string | null; phone_field_id: string | null }[]) {
        if (d.name_field_id) nameField.set(d.form_id, d.name_field_id);
        if (d.phone_field_id) phoneField.set(d.form_id, d.phone_field_id);
      }
      for (const f of (fields ?? []) as { id: string; form_id: string; label: string; type: string }[]) {
        if (!nameField.get(f.form_id) && f.type !== "children" && f.type !== "address" && norm(f.label).startsWith("nome"))
          nameField.set(f.form_id, f.id);
        if (!phoneField.get(f.form_id) && f.type === "phone") phoneField.set(f.form_id, f.id);
      }
      const wanted = [...new Set([...nameField.values(), ...phoneField.values()])];
      if (wanted.length) {
        const { data: vals } = await admin
          .from("submission_values")
          .select("submission_id, field_id, value")
          .in("submission_id", allSubIds)
          .in("field_id", wanted)
          .eq("part", "");
        for (const v of (vals ?? []) as { submission_id: string; field_id: string; value: string | null }[]) {
          const form = formBySub.get(v.submission_id);
          if (!form || !v.value?.trim()) continue;
          if (nameField.get(form) === v.field_id) names.set(v.submission_id, v.value.trim());
          if (phoneField.get(form) === v.field_id) phones.set(v.submission_id, v.value.trim());
        }
      }
    }
    const label = (publicId: string, subId: string, fallback?: string) => {
      const n = names.get(subId) ?? fallback;
      return n ? `${publicId} · ${n}` : publicId;
    };

    const events: CalendarEvent[] = [];
    for (const o of oppRows) {
      events.push({
        id: `v-${o.id}`,
        type: "visita",
        at: o.visit_at,
        title: o.submissions?.public_id && o.submission_id ? label(o.submissions.public_id, o.submission_id, o.name) : o.name,
        school_id: o.school_id,
        school_name: schoolName.get(o.school_id) ?? "",
        phone: o.phone ?? (o.submission_id ? phones.get(o.submission_id) ?? null : null),
        funnel_id: o.funnel_id,
        detail: null,
      });
    }
    for (const s of (enrolled ?? []) as Sub[]) {
      events.push({
        id: `m-${s.id}`, type: "matricula", at: s.enrolled_at!, title: label(s.public_id, s.id),
        school_id: s.school_id, school_name: schoolName.get(s.school_id) ?? "",
        phone: phones.get(s.id) ?? null, funnel_id: null,
        detail: `Matrícula efetivada${s.enrollment_count ? ` (${s.enrollment_count})` : ""}`,
      });
    }
    const checkSubMap = new Map(((checkSubs ?? []) as Sub[]).map((s) => [s.id, s]));
    for (const c of (checks ?? []) as { submission_id: string; created_at: string }[]) {
      const s = checkSubMap.get(c.submission_id);
      if (!s) continue;
      events.push({
        id: `c-${s.id}`, type: "matricula", at: c.created_at, title: label(s.public_id, s.id),
        school_id: s.school_id, school_name: schoolName.get(s.school_id) ?? "",
        phone: phones.get(s.id) ?? null, funnel_id: null, detail: "Check-in (LEADS)",
      });
    }
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { schools: schoolList, events };
  });
