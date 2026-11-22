import { createFileRoute } from "@tanstack/react-router";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { cardHistory } from "@/lib/ext/api2.server";
import { refFromQuery } from "@/lib/ext/api-route";

export const Route = createFileRoute("/api/public/v1/leads/historico")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          return json(await cardHistory(db, refFromQuery(new URL(request.url).searchParams)));
        } catch (e) { return fail(e); }
      },
    },
  },
});
