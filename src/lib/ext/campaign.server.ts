import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCampaign } from "./api-logic";

// Campanha de origem de cada card: mapa cardId → nome, no armazenamento privado do banco externo
// (o banco externo não recebe colunas novas daqui).
const BUCKET = "integracoes";
const PATH = "campanhas.json";
type Store = { cards: Record<string, string> };

export async function readCampaigns(db: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await db.storage.from(BUCKET).download(PATH);
  if (!data) return {};
  try { return ((JSON.parse(await data.text()) as Partial<Store>).cards ?? {}); } catch { return {}; }
}

/** Grava (ou remove, se vazio) a campanha do card. Devolve o valor final ou null. */
export async function setCampaign(db: SupabaseClient, cardId: string, value: string | null | undefined): Promise<string | null> {
  const cards = await readCampaigns(db);
  const v = normalizeCampaign(value);
  if (v) cards[cardId] = v; else delete cards[cardId];
  const { data: buckets } = await db.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) await db.storage.createBucket(BUCKET, { public: false });
  const { error } = await db.storage.from(BUCKET).upload(PATH, new Blob([JSON.stringify({ cards })], { type: "application/json" }), { upsert: true, contentType: "application/json" });
  if (error) throw new Error("Não foi possível salvar a campanha.");
  return v;
}
