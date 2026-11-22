import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiError, authenticate, cardView, CORS, createLead, fail, findCard, json } from "@/lib/ext/api.server";

const schema = z.object({
  escola: z.string().trim().min(1).max(80),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(160).optional(),
  serie: z.union([z.string().max(30), z.array(z.string().max(30)).max(10)]).optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v])),
  origem: z.string().trim().max(80).optional(),
  observacao: z.string().trim().max(2000).optional(),
});

export const Route = createFileRoute("/api/public/v1/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Consulta um lead por ?codigo= ou ?telefone= (&escola= opcional).
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          const u = new URL(request.url);
          const card = await findCard(db, {
            codigo: u.searchParams.get("codigo") ?? undefined,
            telefone: u.searchParams.get("telefone") ?? undefined,
            escola: u.searchParams.get("escola") ?? undefined,
          });
          return json({ ok: true, card: await cardView(db, card) });
        } catch (e) { return fail(e); }
      },
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          const body = await request.json().catch(() => { throw new ApiError(400, "json_invalido", "Corpo precisa ser JSON."); });
          const p = schema.safeParse(body);
          if (!p.success) throw new ApiError(422, "dados_invalidos", p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
          const r = await createLead(db, integration, p.data);
          return json(r.body, r.status);
        } catch (e) { return fail(e); }
      },
    },
  },
});
