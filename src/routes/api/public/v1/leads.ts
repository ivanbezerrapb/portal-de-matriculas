import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, CORS, createLead, fail, json } from "@/lib/ext/api.server";
import { cardDetail, editLead, listCards } from "@/lib/ext/api2.server";
import { hasRef, readBody, refFromQuery, refMsg, refShape } from "@/lib/ext/api-route";

const serie = z.union([z.string().max(30), z.array(z.string().max(30)).max(10)]).optional()
  .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]));

const createSchema = z.object({
  escola: z.string().trim().min(1).max(80),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(160).optional(),
  serie,
  origem: z.string().trim().max(80).optional(),
  observacao: z.string().trim().max(2000).optional(),
});

const editSchema = z.object({
  ...refShape,
  nome: z.string().trim().min(2).max(120).optional(),
  novo_telefone: z.string().trim().min(8).max(30).optional(),
  email: z.string().trim().email().max(160).optional(),
  serie,
  origem: z.string().trim().max(80).optional(),
  responsavel: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(2000).optional(),
}).refine(hasRef, refMsg);

export const Route = createFileRoute("/api/public/v1/leads")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      // Com card_id/codigo/telefone: detalhe de um lead. Sem eles: lista com filtros.
      GET: async ({ request }) => {
        try {
          const { db } = await authenticate(request);
          const sp = new URL(request.url).searchParams;
          const ref = refFromQuery(sp);
          if (hasRef(ref)) return json(await cardDetail(db, ref));
          return json(await listCards(db, sp, "leads"));
        } catch (e) { return fail(e); }
      },
      POST: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          const r = await createLead(db, integration, await readBody(request, createSchema));
          return json(r.body, r.status);
        } catch (e) { return fail(e); }
      },
      PATCH: async ({ request }) => {
        try {
          const { db, integration } = await authenticate(request);
          return json(await editLead(db, integration, await readBody(request, editSchema)));
        } catch (e) { return fail(e); }
      },
    },
  },
});
