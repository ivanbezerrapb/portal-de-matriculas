import { createFileRoute } from "@tanstack/react-router";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { listUsersApi } from "@/lib/ext/api2.server";

export const Route = createFileRoute("/api/public/v1/usuarios")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          return json(await listUsersApi(db, new URL(request.url).searchParams));
        } catch (e) { return fail(e); }
      },
    },
  },
});
