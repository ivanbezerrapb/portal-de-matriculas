import { createFileRoute } from "@tanstack/react-router";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { listReasonsApi } from "@/lib/ext/api2.server";

export const Route = createFileRoute("/api/public/v1/motivos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          return json(await listReasonsApi(db));
        } catch (e) { return fail(e); }
      },
    },
  },
});
