import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ApiError, authenticate, CORS, fail, json, schedule } from "@/lib/ext/api.server";

const schema = z.object({
  codigo: z.string().trim().max(30).optional(),
  telefone: z.string().trim().max(30).optional(),
  escola: z.string().trim().max(80).optional(),
  data_hora: z.string().datetime({ offset: true }),
  atendente: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(1000).optional(),
}).refine((v) => v.codigo || v.telefone, { message: "Informe codigo ou telefone." });

export const Route = createFileRoute("/api/public/v1/agendamentos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          const body = await request.json().catch(() => { throw new ApiError(400, "json_invalido", "Corpo precisa ser JSON."); });
          const p = schema.safeParse(body);
          if (!p.success) throw new ApiError(422, "dados_invalidos", p.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; "));
          return json(await schedule(db, integration, p.data));
        } catch (e) { return fail(e); }
      },
    },
  },
});
