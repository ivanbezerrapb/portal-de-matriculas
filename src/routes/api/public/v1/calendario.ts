import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, fail, json, schedule } from "@/lib/ext/api.server";
import { cancelSchedule, listCalendar } from "@/lib/ext/api2.server";
import { hasRef, readBody, refMsg, refShape } from "@/lib/ext/api-route";

const createSchema = z.object({
  ...refShape,
  data_hora: z.string().datetime({ offset: true }),
  atendente: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(1000).optional(),
}).refine(hasRef, refMsg);
const cancelSchema = z.object({ ...refShape, motivo: z.string().trim().max(1000).optional() }).refine(hasRef, refMsg);

export const Route = createFileRoute("/api/public/v1/calendario")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          return json(await listCalendar(db, new URL(request.url).searchParams));
        } catch (e) { return fail(e); }
      },
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          const b = await readBody(request, createSchema);
          return json(await schedule(db, integration, { ...b, ...(b.card_id ? { id: b.card_id } : {}) } as never));
        } catch (e) { return fail(e); }
      },
      DELETE: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await cancelSchedule(db, integration, await readBody(request, cancelSchema)));
        } catch (e) { return fail(e); }
      },
    },
  },
});
