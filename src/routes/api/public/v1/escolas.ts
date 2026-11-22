import { createFileRoute } from "@tanstack/react-router";
import { authenticate, CORS, fail, json, listSchools } from "@/lib/ext/api.server";

// GET: escolas, séries, origens, funis e etapas aceitos pela API.
export const Route = createFileRoute("/api/public/v1/escolas")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try { const { db } = await authenticate(request); return json({ ok: true, escolas: await listSchools(db) }); }
        catch (e) { return fail(e); }
      },
    },
  },
});
