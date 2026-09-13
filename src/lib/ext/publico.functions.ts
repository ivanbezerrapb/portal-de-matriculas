import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// ---------- Área pública (sem login) ----------

// Busca um formulário publicado pelo slug do link público.
// Usa o cliente anônimo: o RLS só expõe formulários com status "published",
// e aqui projetamos apenas campos não-internos.
export const getPublicForm = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { extAnon } = await import("./server");
    const supabase = extAnon();

    const { data: form, error } = await supabase
      .from("forms")
      .select("id, title, description, status, schools(name, logo_url)")
      .eq("public_slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!form) return null;

    const { data: fields, error: fieldsError } = await supabase
      .from("form_fields")
      .select("id, label, help_text, type, options, required, position")
      .eq("form_id", form.id)
      .eq("internal", false)
      .order("position");
    if (fieldsError) throw new Error(fieldsError.message);

    return { form, fields: fields ?? [] };
  });

// Envia um preenchimento público. Valida obrigatórios no servidor,
// gera o ID sequencial da escola e grava tudo.
export const submitPublicForm = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().uuid(),
        values: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { extAdmin } = await import("./server");
    const supabase = extAdmin();

    const { data: form } = await supabase
      .from("forms")
      .select("id, school_id, status")
      .eq("public_slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!form) throw new Error("Formulário não disponível.");

    const { data: fields } = await supabase
      .from("form_fields")
      .select("id, label, type, required")
      .eq("form_id", form.id)
      .eq("internal", false);
    const publicFields = fields ?? [];

    const { MAX_CHILDREN, parseChildren } = await import("./model");

    let childrenCount: number | null = null;

    for (const field of publicFields) {
      const v = data.values[field.id];
      const empty =
        v == null || (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (field.required && empty) {
        throw new Error(`O campo "${field.label}" é obrigatório.`);
      }
      if (field.type === "children" && !empty) {
        const list = parseChildren(typeof v === "string" ? v : "");
        childrenCount = list.length;
        if (list.length === 0 || list.length > MAX_CHILDREN) {
          throw new Error(
            `Informe de 1 a ${MAX_CHILDREN} crianças em "${field.label}".`,
          );
        }
        if (field.required) {
          list.forEach((c, i) => {
            if (!c.nome.trim() || !c.nascimento || !c.serie || !c.turno) {
              throw new Error(
                `Preencha nome, data de nascimento, série e turno da criança ${i + 1} em "${field.label}".`,
              );
            }
          });
        }
      }
    }

    const { data: publicId, error: idError } = await supabase.rpc(
      "next_school_public_id",
      { p_school_id: form.school_id },
    );
    if (idError || !publicId) {
      throw new Error(idError?.message ?? "Falha ao gerar o ID do cadastro.");
    }

    const { data: submission, error: subError } = await supabase
      .from("submissions")
      .insert({
        form_id: form.id,
        school_id: form.school_id,
        public_id: publicId,
        children_count: childrenCount,
      })
      .select("id")
      .single();
    if (subError) throw new Error(subError.message);

    const rows = publicFields
      .filter((f) => data.values[f.id] != null)
      .map((f) => ({
        submission_id: submission.id,
        field_id: f.id,
        value: Array.isArray(data.values[f.id])
          ? JSON.stringify(data.values[f.id])
          : String(data.values[f.id]).trim(),
      }));
    if (rows.length > 0) {
      const { error: valuesError } = await supabase
        .from("submission_values")
        .insert(rows);
      if (valuesError) throw new Error(valuesError.message);
    }

    // Cria a oportunidade no funil padrão da escola (primeira etapa).
    try {
      const { data: funnel } = await supabase
        .from("funnels")
        .select("id")
        .eq("school_id", form.school_id)
        .eq("is_default", true)
        .maybeSingle();
      if (funnel) {
        const { data: stage } = await supabase
          .from("funnel_stages")
          .select("id")
          .eq("funnel_id", funnel.id)
          .order("position")
          .limit(1)
          .maybeSingle();
        if (stage) {
          const valueOf = (type: string) => {
            const field = publicFields.find((f) => f.type === type);
            const v = field ? data.values[field.id] : undefined;
            return typeof v === "string" && v.trim() ? v.trim() : null;
          };
          const { data: last } = await supabase
            .from("opportunities")
            .select("position")
            .eq("stage_id", stage.id)
            .order("position", { ascending: false })
            .limit(1)
            .maybeSingle();
          await supabase.from("opportunities").insert({
            funnel_id: funnel.id,
            stage_id: stage.id,
            school_id: form.school_id,
            submission_id: submission.id,
            name: valueOf("short_text") ?? publicId,
            phone: valueOf("phone"),
            email: valueOf("email"),
            position: (last?.position ?? -1) + 1,
          });
        }
      }
    } catch {
      // O cadastro já foi salvo; falha ao criar a oportunidade não bloqueia o envio.
    }

    if (childrenCount !== null) {
      const { writeChildrenCountValue } = await import("./server");
      await writeChildrenCountValue(
        supabase,
        form.id,
        submission.id,
        childrenCount,
      );
    }

    return { publicId };
  });
