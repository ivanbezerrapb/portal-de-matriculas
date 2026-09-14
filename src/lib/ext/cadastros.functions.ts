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
      .select("*, forms(title), schools(name)")
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

    const fieldIds = [...new Set([...fieldByForm.values()])];
    const valueMap = new Map<string, string>();
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

    return rows.map((r) => {
      const fid = fieldByForm.get(r.form_id);
      const name = fid ? valueMap.get(`${r.id}:${fid}`) : "";
      return { ...r, responsible_name: name?.trim() || null };
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
  .inputValidator((data) => z.object({ id: z.string().uuid(), enrolled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { getPerms } = await import("./server");
    const perms = await getPerms(context.supabase, context.userId);

    const { data: submission, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, enrolled")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    const allowed = perms.isAdmin || perms.managerSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para alterar a matrícula deste cadastro.");
    }

    const now = new Date().toISOString();
    const { error: updError } = await context.supabase
      .from("submissions")
      .update({
        enrolled: data.enrolled,
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
      ],
    });

    return { ok: true };
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
    const year = new Date().getFullYear();
    const start = `${year}-01-01T00:00:00`;
    const end = `${year + 1}-01-01T00:00:00`;

    let query = context.supabase
      .from("submissions")
      .select("id, form_id, school_id, created_at, enrolled, schools(name)")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });
    if (data.schoolIds && data.schoolIds.length > 0) {
      query = query.in("school_id", data.schoolIds);
    }
    const { data: submissions, error } = await query;
    if (error) throw new Error(error.message);

    const rows = submissions ?? [];
    const bySchool = new Map<string, { name: string; count: number }>();
    for (const row of rows) {
      const name = (row.schools as { name?: string } | null)?.name ?? "—";
      const entry = bySchool.get(row.school_id) ?? { name, count: 0 };
      entry.count += 1;
      bySchool.set(row.school_id, entry);
    }

    const seriesCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

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
          .select("field_id, value, value_number")
          .in("submission_id", submissionIds)
          .in("field_id", responseFieldIds)
          .eq("part", "");

        const countIds = new Set(countFieldIds);
        const childrenIds = new Set(childrenFields.map((f) => f.id as string));
        const sourceIds = new Set(sourceFields.map((f) => f.id as string));
        for (const v of values ?? []) {
          if (countIds.has(v.field_id as string)) {
            children += Number(v.value_number ?? 0);
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

    const enrolled = rows.filter((row) => Boolean(row.enrolled)).length;
    const orderedSeries = [...seriesCounts.entries()].sort(
      ([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, "pt-BR"),
    );

    return {
      year,
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
      bySchool: [...bySchool.values()].sort((a, b) => b.count - a.count),
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
