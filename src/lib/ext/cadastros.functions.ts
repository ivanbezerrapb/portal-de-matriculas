import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

// ---------- Listagem com busca por ID e filtros ----------

export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        search: z.string().optional(),
        school_id: z.string().uuid().optional(),
        form_id: z.string().uuid().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("submissions")
      .select(
        "*, forms(title), schools(name), attendant:presenters!submissions_attendant_id_fkey(id, name), presenter:presenters!submissions_presenter_id_fkey(id, name), enroller:presenters!submissions_enroller_id_fkey(id, name)",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.search) {
      query = query.ilike("public_id", `%${data.search.trim()}%`);
    }
    if (data.school_id) query = query.eq("school_id", data.school_id);
    if (data.form_id) query = query.eq("form_id", data.form_id);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return rows;

    // Nome do responsável de cada cadastro
    const formIds = [...new Set(rows.map((r) => r.form_id))];
    const { data: ff } = await context.supabase
      .from("form_fields")
      .select("id, form_id, label, type, position")
      .in("form_id", formIds)
      .order("position");

    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

    const fieldByForm = new Map<string, string>();
    for (const f of ff ?? []) {
      if (fieldByForm.has(f.form_id)) continue;
      if (norm(f.label) === "nome do responsavel") fieldByForm.set(f.form_id, f.id);
    }
    for (const f of ff ?? []) {
      if (fieldByForm.has(f.form_id)) continue;
      if (f.type === "short_text") fieldByForm.set(f.form_id, f.id);
    }

    // Campos de "acompanhamento médico/psicológico/psicopedagógico" (alerta de restrição)
    const restrictionFieldIds = new Set<string>();
    for (const f of ff ?? []) {
      const l = norm(f.label);
      if (
        l.includes("acompanhamento") &&
        (l.includes("medico") || l.includes("psicolog") || l.includes("psicopedag"))
      ) {
        restrictionFieldIds.add(f.id);
      }
    }

    const fieldIds = [...new Set([...fieldByForm.values(), ...restrictionFieldIds])];
    const valueMap = new Map<string, string>();
    const restrictedIds = new Set<string>();
    if (fieldIds.length > 0) {
      const { data: vals } = await context.supabase
        .from("submission_values")
        .select("submission_id, field_id, value")
        .eq("part", "")
        .in(
          "submission_id",
          rows.map((r) => r.id),
        )
        .in("field_id", fieldIds);
      for (const v of vals ?? []) {
        valueMap.set(`${v.submission_id}:${v.field_id}`, v.value ?? "");
      }
    }

    // Funil atual de cada cadastro (cartão no CRM).
    const { data: opps } = await context.supabase
      .from("opportunities")
      .select("submission_id, funnel_id, status, funnels(name)")
      .in(
        "submission_id",
        rows.map((r) => r.id),
      );
    const funnelBySubmission = new Map<string, { funnel_id: string; funnel_name: string }>();
    for (const o of (opps ?? []) as unknown as {
      submission_id: string | null;
      funnel_id: string;
      funnels: { name: string } | null;
    }[]) {
      if (!o.submission_id) continue;
      funnelBySubmission.set(o.submission_id, {
        funnel_id: o.funnel_id,
        funnel_name: o.funnels?.name ?? "",
      });
    }

    return rows.map((r) => {
      const fid = fieldByForm.get(r.form_id);
      const name = fid ? valueMap.get(`${r.id}:${fid}`) : "";
      const funnel = funnelBySubmission.get(r.id) ?? null;
      return { ...r, responsible_name: name?.trim() || null, funnel };
    });
  });

// ---------- Detalhe ----------

export const getSubmission = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("*, forms(id, title, school_id), schools(name)")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: fields }, { data: values }, { data: history }] = await Promise.all([
      context.supabase
        .from("form_fields")
        .select("*")
        .eq("form_id", submission.form_id)
        .order("position"),
      context.supabase
        .from("submission_values")
        .select("*")
        .eq("submission_id", data.id)
        .eq("part", ""),
      context.supabase
        .from("audit_log")
        .select("*")
        .eq("submission_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return {
      submission,
      fields: fields ?? [],
      values: values ?? [],
      history: history ?? [],
    };
  });

// ---------- Edição interna (admin, editor, gestor da escola) ----------

export const updateSubmission = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, form_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const allowed = perms.isAdmin || perms.managerSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para editar este cadastro.");
    }

    const { data: current } = await context.supabase
      .from("submission_values")
      .select("field_id, value")
      .eq("submission_id", data.id)
      .eq("part", "");
    const currentMap = new Map((current ?? []).map((v) => [v.field_id, v.value ?? ""]));

    const { data: fields } = await context.supabase
      .from("form_fields")
      .select("id, label, type")
      .eq("form_id", submission.form_id);
    const fieldLabels = new Map((fields ?? []).map((f) => [f.id, f.label]));
    const childrenFieldIds = new Set(
      (fields ?? []).filter((f) => f.type === "children").map((f) => f.id),
    );

    const changes: {
      field_id: string;
      label: string;
      before: string;
      after: string;
    }[] = [];

    for (const [fieldId, raw] of Object.entries(data.values)) {
      const after = Array.isArray(raw) ? JSON.stringify(raw) : raw.trim();
      const before = currentMap.get(fieldId) ?? "";
      if (before === after) continue;
      changes.push({
        field_id: fieldId,
        label: fieldLabels.get(fieldId) ?? fieldId,
        before,
        after,
      });
      const { error: upsertError } = await context.supabase
        .from("submission_values")
        .upsert(
          { submission_id: data.id, field_id: fieldId, part: "", value: after },
          { onConflict: "submission_id,field_id,part" },
        );
      if (upsertError) throw new Error(upsertError.message);

      // Endereço: sincroniza as partes gravadas separadamente.
      const fieldType = (fields ?? []).find((f) => f.id === fieldId)?.type;
      if (fieldType === "address") {
        await context.supabase
          .from("submission_values")
          .delete()
          .eq("submission_id", data.id)
          .eq("field_id", fieldId)
          .neq("part", "");
        if (after) {
          const { addressPartRows } = await import("./model");
          const partRows = addressPartRows(data.id, fieldId, after);
          if (partRows.length > 0) {
            const { error: partsError } = await context.supabase
              .from("submission_values")
              .insert(partRows);
            if (partsError) throw new Error(partsError.message);
          }
        }
      }
    }

    // Recalcula a coluna children_count a partir dos campos "N Filhos" enviados.
    let childrenCount: number | null | undefined;
    for (const fieldId of childrenFieldIds) {
      const raw = data.values[fieldId];
      if (raw == null) continue;
      if (childrenCount === undefined) childrenCount = null;
      const text = Array.isArray(raw) ? JSON.stringify(raw) : raw.trim();
      if (!text) continue;
      const { parseChildren } = await import("./model");
      const n = parseChildren(text).length;
      if (n > 0) childrenCount = Math.max(childrenCount ?? 0, n);
    }

    if (childrenCount !== undefined) {
      const { writeChildrenCountValue } = await import("./server");
      await writeChildrenCountValue(context.supabase, submission.form_id, data.id, childrenCount);
    }

    if (changes.length > 0 || childrenCount !== undefined) {
      await context.supabase
        .from("submissions")
        .update({
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
          ...(childrenCount !== undefined ? { children_count: childrenCount } : {}),
        })
        .eq("id", data.id);
    }

    if (changes.length > 0) {
      await context.supabase.from("audit_log").insert({
        submission_id: data.id,
        actor_id: context.userId,
        actor_email: context.userEmail,
        action: "update",
        changes,
      });
    }

    return { ok: true, changed: changes.length };
  });

// ---------- Matrícula (ganho pela tela de cadastros) ----------

export const setEnrollment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        enrolled: z.boolean(),
        enrollment_count: z.number().int().positive().optional(),
      })
      .superRefine((value, ctx) => {
        if (value.enrolled && value.enrollment_count == null) {
          ctx.addIssue({
            code: "custom",
            path: ["enrollment_count"],
            message: "Informe a quantidade de matrículas efetivadas.",
          });
        }
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, enrolled, enrollment_count")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const allowed =
      perms.isAdmin ||
      perms.managerSchools.includes(submission.school_id) ||
      perms.operatorSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para alterar a matrícula deste cadastro.");
    }

    const now = new Date().toISOString();
    const { error: updError } = await context.supabase
      .from("submissions")
      .update({
        enrolled: data.enrolled,
        enrollment_count: data.enrolled ? data.enrollment_count : 0,
        enrolled_at: data.enrolled ? now : null,
        enrolled_by: data.enrolled ? context.userId : null,
        updated_at: now,
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (updError) throw new Error(updError.message);

    // Sincroniza a oportunidade ligada a este cadastro, quando existir.
    const { data: opportunity } = await context.supabase
      .from("opportunities")
      .select("id, status")
      .eq("submission_id", data.id)
      .maybeSingle();

    if (opportunity) {
      if (data.enrolled) {
        await context.supabase
          .from("crm_tasks")
          .update({ done: true, done_at: now })
          .eq("opportunity_id", opportunity.id)
          .eq("done", false);

        const { data: reason } = await context.supabase
          .from("crm_close_reasons")
          .select("id")
          .eq("kind", "won")
          .eq("label", "Matrícula realizada")
          .maybeSingle();

        await context.supabase
          .from("opportunities")
          .update({
            status: "won",
            close_reason_id: reason?.id ?? null,
            close_note: "Matrícula confirmada na tela de cadastros.",
            closed_at: now,
            updated_at: now,
          })
          .eq("id", opportunity.id);
      } else {
        await context.supabase
          .from("opportunities")
          .update({
            status: "open",
            close_reason_id: null,
            close_note: null,
            closed_at: null,
            updated_at: now,
          })
          .eq("id", opportunity.id);
      }
    }

    await context.supabase.from("audit_log").insert({
      submission_id: data.id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        {
          field_id: "enrolled",
          label: "Matrícula",
          before: submission.enrolled ? "Sim" : "Não",
          after: data.enrolled ? "Sim" : "Não",
        },
        {
          field_id: "enrollment_count",
          label: "Quantidade de matrículas",
          before: String(submission.enrollment_count ?? 0),
          after: String(data.enrolled ? data.enrollment_count : 0),
        },
      ],
    });

    return { ok: true };
  });

// ---------- Envio manual do lead para um funil ----------

export const sendSubmissionToFunnel = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        submission_id: z.string().uuid(),
        funnel_id: z.string().uuid(),
        attendant_name: z.string().trim().min(2).max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, form_id, public_id")
      .eq("id", data.submission_id)
      .single();
    if (error) throw new Error(error.message);

    if (
      !perms.isAdmin &&
      !perms.managerSchools.includes(submission.school_id) &&
      !perms.operatorSchools.includes(submission.school_id)
    ) {
      throw new Error("Você não tem permissão para alterar este cadastro.");
    }

    const { data: funnel } = await context.supabase
      .from("funnels")
      .select("id, school_id, name")
      .eq("id", data.funnel_id)
      .maybeSingle();
    if (!funnel) throw new Error("Funil não encontrado.");
    if (funnel.school_id !== submission.school_id) {
      throw new Error("Este funil é de outra unidade.");
    }

    const { data: stage } = await context.supabase
      .from("funnel_stages")
      .select("id")
      .eq("funnel_id", funnel.id)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (!stage) throw new Error("Este funil ainda não tem etapas.");

    const { data: last } = await context.supabase
      .from("opportunities")
      .select("position")
      .eq("stage_id", stage.id)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = (last?.position ?? -1) + 1;

    const { data: existing } = await context.supabase
      .from("opportunities")
      .select("id")
      .eq("submission_id", submission.id)
      .maybeSingle();

    if (existing) {
      const { error: moveError } = await context.supabase
        .from("opportunities")
        .update({
          funnel_id: funnel.id,
          stage_id: stage.id,
          position,
          status: "open",
          close_reason_id: null,
          close_note: null,
          closed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (moveError) throw new Error(moveError.message);
    } else {
      // Nome do cartão: ID do cadastro + responsável (quando houver).
      const { data: destination } = await context.supabase
        .from("form_destinations")
        .select("name_field_id, phone_field_id, email_field_id")
        .eq("form_id", submission.form_id)
        .maybeSingle();
      const fieldIds = [
        destination?.name_field_id,
        destination?.phone_field_id,
        destination?.email_field_id,
      ].filter(Boolean) as string[];
      const values = new Map<string, string>();
      if (fieldIds.length > 0) {
        const { data: vals } = await context.supabase
          .from("submission_values")
          .select("field_id, value")
          .eq("submission_id", submission.id)
          .eq("part", "")
          .in("field_id", fieldIds);
        for (const v of vals ?? []) values.set(v.field_id, (v.value ?? "").trim());
      }
      const pick = (fieldId: string | null | undefined) =>
        (fieldId ? values.get(fieldId) : "") || null;
      const responsible = pick(destination?.name_field_id);
      const cardName = responsible
        ? `${submission.public_id} · ${responsible}`
        : submission.public_id;

      const { error: insertError } = await context.supabase.from("opportunities").insert({
        funnel_id: funnel.id,
        stage_id: stage.id,
        school_id: submission.school_id,
        submission_id: submission.id,
        name: cardName,
        phone: pick(destination?.phone_field_id),
        email: pick(destination?.email_field_id),
        position,
      });
      if (insertError) throw new Error(insertError.message);
    }

    await context.supabase
      .from("submissions")
      .update({ crm_status: "sent", crm_reason: `Enviado manualmente para ${funnel.name}` })
      .eq("id", submission.id);

    // Atendimento: nome do responsável pelo funil escolhido.
    let attendantId: string | null = null;
    if (data.attendant_name) {
      const name = data.attendant_name.trim();
      const { data: found } = await context.supabase
        .from("presenters")
        .select("id")
        .eq("school_id", submission.school_id)
        .eq("kind", "secretaria")
        .ilike("name", name)
        .maybeSingle();
      if (found) {
        attendantId = found.id;
      } else {
        const { data: created, error: createError } = await context.supabase
          .from("presenters")
          .insert({ school_id: submission.school_id, kind: "secretaria", name })
          .select("id")
          .single();
        if (createError) throw new Error(createError.message);
        attendantId = created.id;
      }
      const { error: updError } = await context.supabase
        .from("submissions")
        .update({
          attendant_id: attendantId,
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        })
        .eq("id", submission.id);
      if (updError) throw new Error(updError.message);
    }

    return { ok: true, funnel_id: funnel.id, attendant_id: attendantId };
  });

// ---------- Quem atendeu / quem apresentou ----------

export const setSubmissionPeople = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        submission_id: z.string().uuid(),
        kind: z.enum(["secretaria", "coordenacao", "efetivacao"]),
        presenter_id: z.string().uuid().nullable().optional(),
        new_name: z.string().trim().min(2).max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, attendant_id, presenter_id, enroller_id")
      .eq("id", data.submission_id)
      .single();
    if (error) throw new Error(error.message);

    if (
      !perms.isAdmin &&
      !perms.managerSchools.includes(submission.school_id) &&
      !perms.operatorSchools.includes(submission.school_id)
    ) {
      throw new Error("Você não tem permissão para alterar este cadastro.");
    }

    let presenterId: string | null = data.presenter_id ?? null;
    if (data.new_name) {
      const { data: created, error: createError } = await context.supabase
        .from("presenters")
        .insert({ school_id: submission.school_id, kind: data.kind, name: data.new_name.trim() })
        .select("id")
        .single();
      if (createError) {
        if (createError.code === "23505") {
          const { data: existing } = await context.supabase
            .from("presenters")
            .select("id")
            .eq("school_id", submission.school_id)
            .eq("kind", data.kind)
            .ilike("name", data.new_name.trim())
            .maybeSingle();
          if (!existing) throw new Error(createError.message);
          presenterId = existing.id;
        } else {
          throw new Error(createError.message);
        }
      } else {
        presenterId = created.id;
      }
    }

    const column =
      data.kind === "secretaria"
        ? "attendant_id"
        : data.kind === "coordenacao"
          ? "presenter_id"
          : "enroller_id";
    const kindLabel =
      data.kind === "secretaria"
        ? "Atendimento"
        : data.kind === "coordenacao"
          ? "Apresentação"
          : "Efetivação";
    const { error: updError } = await context.supabase
      .from("submissions")
      .update({
        [column]: presenterId,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      })
      .eq("id", data.submission_id);
    if (updError) throw new Error(updError.message);

    await context.supabase.from("audit_log").insert({
      submission_id: data.submission_id,
      actor_id: context.userId,
      actor_email: context.userEmail,
      action: "update",
      changes: [
        {
          field_id: column,
          label: kindLabel,
          before: String((submission as unknown as Record<string, string | null>)[column] ?? ""),
          after: String(presenterId ?? ""),
        },
      ],
    });

    return { ok: true, presenter_id: presenterId };
  });

export const deleteSubmission = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("submissions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Dashboard ----------

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ schoolIds: z.array(z.string().uuid()).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Ano de campanha: 01/08 do ano corrente até 31/07 do ano seguinte.
    // Ex.: campanha 2027 = 01/08/2026 a 31/07/2027.
    const now = new Date();
    const campaignYear = now.getMonth() >= 7 ? now.getFullYear() + 1 : now.getFullYear();
    const start = `${campaignYear - 1}-08-01T00:00:00`;
    const end = `${campaignYear}-08-01T00:00:00`;

    let query = context.supabase
      .from("submissions")
      .select(
        "id, form_id, school_id, created_at, enrolled, enrollment_count, schools(name), attendant:presenters!submissions_attendant_id_fkey(name), presenter:presenters!submissions_presenter_id_fkey(name), enroller:presenters!submissions_enroller_id_fkey(name)",
      )
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (data.schoolIds && data.schoolIds.length > 0) {
      query = query.in("school_id", data.schoolIds);
    }
    const { data: submissions, error } = await query;
    if (error) throw new Error(error.message);

    let lossesQuery = context.supabase
      .from("opportunities")
      .select("close_reason_id, crm_close_reasons(label)")
      .eq("status", "lost")
      .gte("closed_at", start)
      .lt("closed_at", end);
    if (data.schoolIds && data.schoolIds.length > 0) {
      lossesQuery = lossesQuery.in("school_id", data.schoolIds);
    }
    const { data: losses, error: lossesError } = await lossesQuery;
    if (lossesError) throw new Error(lossesError.message);

    const rows = submissions ?? [];
    const bySchool = new Map<string, { name: string; visits: number; children: number }>();
    // Série mensal do ano letivo (índice 0 = agosto ... 11 = julho).
    const monthlyVisits = Array.from({ length: 12 }, () => 0);
    const monthlyChildren = Array.from({ length: 12 }, () => 0);
    const submissionMonth = new Map<string, number>();
    for (const row of rows) {
      const name = (row.schools as { name?: string } | null)?.name ?? "—";
      const entry = bySchool.get(row.school_id) ?? { name, visits: 0, children: 0 };
      entry.visits += 1;
      bySchool.set(row.school_id, entry);
      const created = new Date(row.created_at as string);
      if (!Number.isNaN(created.getTime())) {
        const index = (created.getMonth() - 7 + 12) % 12;
        monthlyVisits[index] = (monthlyVisits[index] ?? 0) + 1;
        submissionMonth.set(row.id as string, index);
      }
    }

    const attendantCounts = new Map<string, number>();
    const presenterCounts = new Map<string, number>();
    for (const row of rows) {
      const attendant = (row as unknown as { attendant: { name?: string } | null }).attendant;
      const presenter = (row as unknown as { presenter: { name?: string } | null }).presenter;
      const a = attendant?.name?.trim();
      const p = presenter?.name?.trim();
      if (a) attendantCounts.set(a, (attendantCounts.get(a) ?? 0) + 1);
      if (p) presenterCounts.set(p, (presenterCounts.get(p) ?? 0) + 1);
    }

    const seriesCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    const lossReasonCounts = new Map<string, number>();
    for (const loss of losses ?? []) {
      const reason = loss.crm_close_reasons as { label?: string } | null;
      const label = reason?.label?.trim() || "Sem motivo informado";
      lossReasonCounts.set(label, (lossReasonCounts.get(label) ?? 0) + 1);
    }

    // Soma das crianças e distribuição das respostas dos formulários.
    let children = 0;
    if (rows.length > 0) {
      const { CHILDREN_COUNT_LABEL, parseChildren } = await import("./model");
      const formIds = [...new Set(rows.map((r) => r.form_id))];
      const { data: fields } = await context.supabase
        .from("form_fields")
        .select("id, label, type, options, internal, position")
        .in("form_id", formIds)
        .order("position");

      const normalize = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .trim()
          .toLowerCase();
      const countFieldIds = (fields ?? [])
        .filter((f) => f.internal && f.label === CHILDREN_COUNT_LABEL)
        .map((f) => f.id as string);
      const childrenFields = (fields ?? []).filter((f) => f.type === "children");
      const sourceFields = (fields ?? []).filter((f) =>
        normalize(f.label as string).includes("como conheceu"),
      );

      const responseFieldIds = [
        ...countFieldIds,
        ...childrenFields.map((f) => f.id as string),
        ...sourceFields.map((f) => f.id as string),
      ];
      if (responseFieldIds.length > 0) {
        const submissionIds = rows.map((r) => r.id as string);
        const { data: values } = await context.supabase
          .from("submission_values")
          .select("submission_id, field_id, value, value_number")
          .in("submission_id", submissionIds)
          .in("field_id", responseFieldIds)
          .eq("part", "");

        const countIds = new Set(countFieldIds);
        const childrenIds = new Set(childrenFields.map((f) => f.id as string));
        const sourceIds = new Set(sourceFields.map((f) => f.id as string));
        const submissionSchools = new Map(
          rows.map((row) => [row.id as string, row.school_id as string]),
        );
        for (const v of values ?? []) {
          if (countIds.has(v.field_id as string)) {
            const childCount = Number(v.value_number ?? 0);
            children += childCount;
            const schoolId = submissionSchools.get(v.submission_id as string);
            const schoolEntry = schoolId ? bySchool.get(schoolId) : undefined;
            if (schoolEntry) schoolEntry.children += childCount;
            const month = submissionMonth.get(v.submission_id as string);
            if (month !== undefined) {
              monthlyChildren[month] = (monthlyChildren[month] ?? 0) + childCount;
            }
          }
          if (childrenIds.has(v.field_id as string)) {
            for (const child of parseChildren(v.value)) {
              const label = child.serie.trim();
              if (label) seriesCounts.set(label, (seriesCounts.get(label) ?? 0) + 1);
            }
          }
          if (sourceIds.has(v.field_id as string) && v.value) {
            let answers: string[] = [];
            try {
              const parsed = JSON.parse(v.value);
              answers = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch {
              answers = [v.value];
            }
            for (const answer of answers) {
              const label = answer.trim();
              if (label) sourceCounts.set(label, (sourceCounts.get(label) ?? 0) + 1);
            }
          }
        }
      }
    }

    // Bairros/cidades por unidade (campo do tipo Endereço, gravado em partes).
    type NeighborhoodItem = { label: string; city: string; count: number };
    const neighborhoods: { school: string; items: NeighborhoodItem[] }[] = [];
    if (rows.length > 0) {
      const submissionIds = rows.map((r) => r.id as string);
      const { data: addressValues } = await context.supabase
        .from("submission_values")
        .select("submission_id, part, value")
        .in("submission_id", submissionIds)
        .in("part", ["bairro", "cidade"]);

      const bairroBySub = new Map<string, string>();
      const cidadeBySub = new Map<string, string>();
      for (const v of addressValues ?? []) {
        const text = String(v.value ?? "").trim();
        if (!text) continue;
        if (v.part === "bairro") bairroBySub.set(v.submission_id as string, text);
        else cidadeBySub.set(v.submission_id as string, text);
      }

      const key = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const perSchool = new Map<
        string,
        {
          name: string;
          items: Map<string, { labels: Map<string, number>; city: string; count: number }>;
        }
      >();
      for (const row of rows) {
        const bairro = bairroBySub.get(row.id as string);
        if (!bairro) continue;
        const cidade = cidadeBySub.get(row.id as string) ?? "";
        const schoolId = row.school_id as string;
        const schoolName = (row.schools as { name?: string } | null)?.name ?? "—";
        const school = perSchool.get(schoolId) ?? { name: schoolName, items: new Map() };
        const k = `${key(bairro)}|${key(cidade)}`;
        const entry = school.items.get(k) ?? {
          labels: new Map<string, number>(),
          city: cidade,
          count: 0,
        };
        entry.count += 1;
        entry.labels.set(bairro, (entry.labels.get(bairro) ?? 0) + 1);
        school.items.set(k, entry);
        perSchool.set(schoolId, school);
      }

      for (const school of perSchool.values()) {
        const items = [...school.items.values()]
          .map((entry) => {
            const label = [...entry.labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
            return { label, city: entry.city, count: entry.count };
          })
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
        const top = items.slice(0, 8);
        const rest = items.slice(8).reduce((total, item) => total + item.count, 0);
        if (rest > 0) top.push({ label: "Outros", city: "", count: rest });
        neighborhoods.push({ school: school.name, items: top });
      }
      neighborhoods.sort((a, b) => a.school.localeCompare(b.school, "pt-BR"));
    }

    const enrolled = rows.reduce(
      (total, row) => total + (row.enrolled ? Number(row.enrollment_count ?? 0) : 0),
      0,
    );
    const orderedSeries = [...seriesCounts.entries()].sort(
      ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "pt-BR"),
    );

    return {
      year: campaignYear,
      visits: rows.length,
      children,
      series: orderedSeries.map(([label, count]) => ({ label, count })),
      enrollments: {
        total: enrolled,
        percentage: children > 0 ? Math.round((enrolled / children) * 1000) / 10 : 0,
      },
      sources: [...sourceCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      lossReasons: [...lossReasonCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      attendants: [...attendantCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      presenters: [...presenterCounts.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR")),
      monthly: monthlyVisits.map((visits, month) => ({
        month,
        visits,
        children: monthlyChildren[month] ?? 0,
      })),
      neighborhoods,
      bySchool: [...bySchool.values()].sort(
        (a, b) => b.visits - a.visits || a.name.localeCompare(b.name, "pt-BR"),
      ),
    };
  });

// ---------- Permissões do usuário logado ----------

export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      ...perms,
      email: context.userEmail,
      fullName: profile?.full_name ?? "",
    };
  });
