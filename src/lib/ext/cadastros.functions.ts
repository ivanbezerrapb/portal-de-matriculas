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
      context.supabase.from("submission_values").select("*").eq("submission_id", data.id),
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

    const allowed =
      perms.isAdmin || perms.managerSchools.includes(submission.school_id);
    if (!allowed) {
      throw new Error("Você não tem permissão para editar este cadastro.");
    }

    const { data: current } = await context.supabase
      .from("submission_values")
      .select("field_id, value")
      .eq("submission_id", data.id);
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
          { submission_id: data.id, field_id: fieldId, value: after },
          { onConflict: "submission_id,field_id" },
        );
      if (upsertError) throw new Error(upsertError.message);
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

    const allowed =
      perms.isAdmin || perms.managerSchools.includes(submission.school_id);
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
  .handler(async ({ context }) => {
    const { data: submissions, error } = await context.supabase
      .from("submissions")
      .select("id, school_id, created_at, schools(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = submissions ?? [];
    const bySchool = new Map<string, { name: string; count: number }>();
    for (const row of rows) {
      const name = (row.schools as { name?: string } | null)?.name ?? "—";
      const entry = bySchool.get(row.school_id) ?? { name, count: 0 };
      entry.count += 1;
      bySchool.set(row.school_id, entry);
    }
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return {
      total: rows.length,
      last7days: rows.filter((r) => r.created_at >= weekAgo).length,
      bySchool: [...bySchool.values()],
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
