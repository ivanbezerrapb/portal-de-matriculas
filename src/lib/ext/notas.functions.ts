import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

export type CrmNote = {
  id: string;
  opportunity_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: string;
};

// Histórico de informações de uma oportunidade (mais recente primeiro).
export const listNotes = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ opportunity_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("crm_notes")
      .select("*")
      .eq("opportunity_id", data.opportunity_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmNote[];
  });

export const createNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        opportunity_id: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { extAdmin } = await import("./server");
    const { data: profile } = await extAdmin()
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const authorName =
      ((profile?.full_name as string | null) ?? (profile?.email as string | null)) || "Usuário";
    const { error } = await context.supabase.from("crm_notes").insert({
      opportunity_id: data.opportunity_id,
      author_id: context.userId,
      author_name: authorName,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNote = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("crm_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
