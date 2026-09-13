import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth";

// ---------- Gestão de usuários (somente Administrador) ----------

async function requireAdmin(supabase: any, userId: string) {
  const { getPerms } = await import("./server");
  const perms = await getPerms(supabase, userId);
  if (!perms.isAdmin) throw new Error("Apenas administradores.");
  return perms;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    const { data: authData, error } = await admin.auth.admin.listUsers({
      perPage: 500,
    });
    if (error) throw new Error(error.message);

    const [{ data: roles }, { data: profiles }] = await Promise.all([
      admin.from("user_roles").select("user_id, role, school_id"),
      admin.from("profiles").select("id, full_name"),
    ]);
    const roleMap = new Map<string, { role: string; school_id: string | null }[]>();
    for (const r of roles ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push({ role: r.role, school_id: r.school_id });
      roleMap.set(r.user_id, list);
    }
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      full_name: nameMap.get(u.id) ?? "",
      created_at: u.created_at,
      roles: roleMap.get(u.id) ?? [],
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        role: z.enum([
          "admin",
          "school_manager",
          "print_operator",
          "submission_editor",
        ]),
        school_id: z.string().uuid().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);

    const needsSchool =
      data.role === "school_manager" || data.role === "print_operator";
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: created.user.id,
      role: data.role,
      school_id: needsSchool ? data.school_id : null,
    });
    if (roleError) throw new Error(roleError.message);

    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum([
          "admin",
          "school_manager",
          "print_operator",
          "submission_editor",
        ]),
        school_id: z.string().uuid().optional().nullable(),
        action: z.enum(["add", "remove"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { extAdmin } = await import("./server");
    const admin = extAdmin();

    if (data.action === "add") {
      const needsSchool =
        data.role === "school_manager" || data.role === "print_operator";
      const { error } = await admin.from("user_roles").upsert(
        {
          user_id: data.user_id,
          role: data.role,
          school_id: needsSchool ? data.school_id : null,
        },
        { onConflict: "user_id,role,school_id" },
      );
      if (error) throw new Error(error.message);
    } else {
      let q = admin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      q = data.school_id ? q.eq("school_id", data.school_id) : q.is("school_id", null);
      const { error } = await q;
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Você não pode excluir a si mesmo.");
    }
    const { extAdmin } = await import("./server");
    const admin = extAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
