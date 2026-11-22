import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { addNote, ApiError, authenticate, CORS, fail, json } from "@/lib/ext/api.server";

const schema = z.object({
  codigo: z.string().trim().max(30).optional(),
  telefone: z.string().trim().max(30).optional(),
  escola: z.string().trim().max(80).optional(),
  texto: z.string().trim().min(1).max(2000),
  autor: z.string().trim().max(120).optional(),
}).refine((v) => v.codigo || v.telefone, { message: "Informe codigo ou telefone." });

export const Route = createFileRoute("/api/public/v1/notas")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          const body = await request.json().catch(() => { throw new ApiError(400, "json_invalido", "Corpo precisa ser JSON."); });
          const p = schema.safeParse(body);
          if (!p.success) throw new ApiError(422, "dados_invalidos", p.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; "));
          return json(await addNote(db, integration, p.data));
        } catch (e) { return fail(e); }
      },
    },
  },
});
