import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export const listForms = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("forms")
      .select("*, schools(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getForm = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const [{ data: form, error }, { data: fields }, { data: templates }] =
      await Promise.all([
        context.supabase
          .from("forms")
          .select("*, schools(name)")
          .eq("id", data.id)
          .single(),
        context.supabase
          .from("form_fields")
          .select("*")
          .eq("form_id", data.id)
          .order("position"),
        context.supabase
          .from("print_templates")
          .select("*")
          .eq("form_id", data.id)
          .order("created_at"),
      ]);
    if (error) throw new Error(error.message);
    return { form, fields: fields ?? [], templates: templates ?? [] };
  });

export const createForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        school_id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: created, error } = await context.supabase
      .from("forms")
      .insert({
        school_id: data.school_id,
        title: data.title,
        description: data.description || null,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

export const updateFormInfo = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(2),
        description: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forms")
      .update({ title: data.title, description: data.description || null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFormStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "published", "closed"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forms")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteForm = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("forms")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Campos ----------

const fieldInput = z.object({
  label: z.string().min(1),
  help_text: z.string().optional().nullable(),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "date",
    "single_choice",
    "multiple_choice",
    "yes_no",
    "email",
    "phone",
    "children",
  ]),
  options: z.array(z.string()).optional().nullable(),
  required: z.boolean(),
  internal: z.boolean(),
  position: z.number().int(),
});

export const saveFormFields = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        form_id: z.string().uuid(),
        fields: z.array(fieldInput.merge(z.object({ id: z.string() }))),
        deleted_ids: z.array(z.string()),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    // Remove campos excluídos
    if (data.deleted_ids.length > 0) {
      const { error } = await context.supabase
        .from("form_fields")
        .delete()
        .in("id", data.deleted_ids);
      if (error) throw new Error(error.message);
    }
    for (const field of data.fields) {
      const payload = {
        form_id: data.form_id,
        label: field.label,
        help_text: field.help_text || null,
        type: field.type,
        options: field.options ?? null,
        required: field.required,
        internal: field.internal,
        position: field.position,
      };
      if (field.id.startsWith("new-")) {
        const { error } = await context.supabase
          .from("form_fields")
          .insert(payload);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await context.supabase
          .from("form_fields")
          .update(payload)
          .eq("id", field.id);
        if (error) throw new Error(error.message);
      }
    }
    return { ok: true };
  });

// ---------- Modelos de impressão ----------

const templateInput = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  header_text: z.string().optional().nullable(),
  footer_text: z.string().optional().nullable(),
  show_logo: z.boolean(),
  columns: z.union([z.literal(1), z.literal(2)]),
  page_size: z.enum(["A4", "A5"]),
  show_signature: z.boolean(),
  field_ids: z.array(z.string()),
});

export const savePrintTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().optional(),
        form_id: z.string().uuid(),
      })
      .merge(templateInput)
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      form_id: data.form_id,
      name: data.name,
      title: data.title,
      header_text: data.header_text || null,
      footer_text: data.footer_text || null,
      show_logo: data.show_logo,
      columns: data.columns,
      page_size: data.page_size,
      show_signature: data.show_signature,
      field_ids: data.field_ids,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("print_templates")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("print_templates")
        .insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePrintTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("print_templates")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
