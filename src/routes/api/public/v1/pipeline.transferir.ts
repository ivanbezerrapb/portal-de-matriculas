import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { transferCard } from "@/lib/ext/api2.server";
import { hasRef, readBody, refMsg, refShape } from "@/lib/ext/api-route";

const schema = z.object({ ...refShape, funil: z.string().trim().min(1).max(120), observacao: z.string().trim().max(1000).optional() }).refine(hasRef, refMsg);

export const Route = createFileRoute("/api/public/v1/pipeline/transferir")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await transferCard(db, integration, await readBody(request, schema)));
        } catch (e) { return fail(e); }
      },
    },
  },
});
