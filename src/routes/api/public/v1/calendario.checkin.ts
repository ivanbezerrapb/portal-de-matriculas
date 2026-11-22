import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, fail, json } from "@/lib/ext/api.server";
import { checkIn } from "@/lib/ext/api2.server";
import { hasRef, readBody, refMsg, refShape } from "@/lib/ext/api-route";

const schema = z.object(refShape).refine(hasRef, refMsg);

export const Route = createFileRoute("/api/public/v1/calendario/checkin")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await checkIn(db, integration, await readBody(request, schema)));
        } catch (e) { return fail(e); }
      },
    },
  },
});
