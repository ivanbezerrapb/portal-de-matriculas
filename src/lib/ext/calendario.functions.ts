import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export type CalendarEvent = {
  id: string;
  at: string;
  title: string;
  school_id: string;
  school_name: string;
  phone: string | null;
  funnel_id: string;
  submission_id: string;
  checked_in_at: string | null;
  status: "scheduled" | "done" | "missed";
  can_check_in: boolean;
};

function norm(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Visitas agendadas nos cartões de LEADS, com situação do check-in.
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

    const { data: opps } = await admin
      .from("opportunities")
      .select("id, name, phone, visit_at, school_id, funnel_id, submission_id, submissions!inner(public_id, form_id, list_type)")
      .not("visit_at", "is", null)
      .eq("submissions.list_type", "leads")
      .in("school_id", schoolIds)
      .gte("visit_at", data.from)
      .lt("visit_at", data.to);
    type Opp = {
      id: string; name: string; phone: string | null; visit_at: string; school_id: string;
      funnel_id: string; submission_id: string; submissions: { public_id: string; form_id: string };
    };
    const fullSchools = new Set([...perms.managerSchools, ...perms.operatorSchools]);
    const rows = ((opps ?? []) as unknown as Opp[]).filter((o) => {
      if (all || fullSchools.has(o.school_id)) return true;
      // Central de Informações: apenas os funis atribuídos.
      return perms.infoSchools.includes(o.school_id) && perms.funnelIds.includes(o.funnel_id);
    });
    const subIds = rows.map((o) => o.submission_id);

    const checkIns = new Map<string, string>();
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    if (subIds.length) {
      const { data: checks } = await admin
        .from("audit_log")
        .select("submission_id, created_at")
        .eq("action", "check_in")
        .in("submission_id", subIds);
      for (const c of (checks ?? []) as { submission_id: string; created_at: string }[]) checkIns.set(c.submission_id, c.created_at);

      const formBySub = new Map(rows.map((o) => [o.submission_id, o.submissions.form_id]));
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
          .in("submission_id", subIds)
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

    const now = Date.now();
    const events: CalendarEvent[] = rows.map((o) => {
      const checked = checkIns.get(o.submission_id) ?? null;
      const name = names.get(o.submission_id) ?? o.name;
      const status: CalendarEvent["status"] = checked
        ? "done"
        : new Date(o.visit_at).getTime() < new Date(new Date(now).toDateString()).getTime()
          ? "missed"
          : "scheduled";
      return {
        id: o.id,
        at: o.visit_at,
        title: name && name !== o.submissions.public_id ? `${o.submissions.public_id} · ${name}` : o.submissions.public_id,
        school_id: o.school_id,
        school_name: schoolName.get(o.school_id) ?? "",
        phone: o.phone ?? phones.get(o.submission_id) ?? null,
        funnel_id: o.funnel_id,
        submission_id: o.submission_id,
        checked_in_at: checked,
        status,
        can_check_in:
          !checked && (perms.isAdmin || perms.managerSchools.includes(o.school_id) || perms.operatorSchools.includes(o.school_id)),
      };
    });
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { schools: schoolList, events };
  });
