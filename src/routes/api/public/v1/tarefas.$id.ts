import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { deleteTaskApi, updateTaskApi } from "@/lib/ext/api2.server";
import { readBody } from "@/lib/ext/api-route";

const schema = z.object({
  titulo: z.string().trim().min(1).max(200).optional(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD").nullable().optional(),
  concluida: z.boolean().optional(),
  observacao: z.string().trim().max(4000).optional(),
});

export const Route = createFileRoute("/api/public/v1/tarefas/$id")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      PATCH: async ({ request, params }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await updateTaskApi(db, integration, params.id, await readBody(request, schema)));
        } catch (e) { return fail(e); }
      },
      DELETE: async ({ request, params }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await deleteTaskApi(db, integration, params.id));
        } catch (e) { return fail(e); }
      },
    },
  },
});
