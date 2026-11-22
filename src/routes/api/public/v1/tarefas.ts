import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { createTaskApi, listTasksApi } from "@/lib/ext/api2.server";
import { hasRef, readBody, refMsg, refShape } from "@/lib/ext/api-route";

const schema = z.object({
  ...refShape,
  titulo: z.string().trim().min(1).max(200),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD").optional(),
  responsavel: z.string().trim().max(120).optional(),
}).refine(hasRef, refMsg);

export const Route = createFileRoute("/api/public/v1/tarefas")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          return json(await listTasksApi(db, new URL(request.url).searchParams));
        } catch (e) { return fail(e); }
      },
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await createTaskApi(db, integration, await readBody(request, schema)), 201);
        } catch (e) { return fail(e); }
      },
    },
  },
});
