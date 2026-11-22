// Utilitários das rotas da API pública: leitura do corpo e referência ao card.
import { z } from "zod";
import { ApiError } from "./api.server";

export const refShape = {
  card_id: z.string().trim().max(40).optional(),
  codigo: z.string().trim().max(30).optional(),
  telefone: z.string().trim().max(30).optional(),
  escola: z.string().trim().max(80).optional(),
};
export const hasRef = (v: { card_id?: string | undefined; codigo?: string | undefined; telefone?: string | undefined }) => Boolean(v.card_id || v.codigo || v.telefone);
export const refMsg = { message: "Informe card_id, codigo ou telefone." };

export async function readBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  const body = await request.json().catch(() => { throw new ApiError(400, "json_invalido", "Corpo precisa ser JSON."); });
  const p = schema.safeParse(body);
  if (!p.success) throw new ApiError(422, "dados_invalidos", p.error.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; "));
  return p.data;
}

export const refFromQuery = (sp: URLSearchParams) => ({
  card_id: sp.get("card_id") ?? undefined, codigo: sp.get("codigo") ?? undefined,
  telefone: sp.get("telefone") ?? undefined, escola: sp.get("escola") ?? undefined,
});
