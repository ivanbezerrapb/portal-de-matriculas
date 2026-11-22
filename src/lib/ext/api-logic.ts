// Regras puras da API pública (sem banco), testáveis.

export const KEY_PREFIX = "gi_live_";

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newKeyValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return KEY_PREFIX + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function bearer(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

// Telefone comparável: DDD + 8 últimos dígitos (ignora 55 e o 9 extra).
export function phoneKey(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
}

export function formatPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

// Casa um texto livre com uma opção do formulário (sem acento/maiúsculas). Null se não existir.
export function matchOption(value: string, options: string[] | null | undefined): string | null {
  if (!options?.length) return value;
  const n = norm(value);
  return options.find((o) => norm(o) === n) ?? null;
}

// Aceita o ID da escola ou o nome (ex.: "Centro", "bessa").
export function findSchool<T extends { id: string; name: string }>(schools: T[], ref: string): T | null {
  const n = norm(ref);
  return schools.find((s) => s.id === ref) ?? schools.find((s) => norm(s.name) === n) ?? schools.find((s) => norm(s.name).includes(n)) ?? null;
}

// Paginação: ?pagina= (1+) e ?limite= (1–200, padrão 50).
export function pageParams(sp: URLSearchParams): { pagina: number; limite: number; from: number; to: number } {
  const p = Math.max(1, Math.floor(Number(sp.get("pagina")) || 1));
  const raw = Math.floor(Number(sp.get("limite")) || 50);
  const l = Math.min(200, Math.max(1, raw));
  return { pagina: p, limite: l, from: (p - 1) * l, to: p * l - 1 };
}

// Situação da tarefa: concluida, atrasada (vencimento antes de hoje) ou pendente.
export function taskState(t: { done: boolean; due_date: string | null }, today: string): "concluida" | "atrasada" | "pendente" {
  if (t.done) return "concluida";
  if (t.due_date && t.due_date.slice(0, 10) < today) return "atrasada";
  return "pendente";
}

// Ganho exige quantidade de matrículas só em Visitantes (LEADS não).
export function needsEnrollmentCount(listType: string | null | undefined): boolean {
  return Boolean(listType) && listType !== "leads" && listType !== "lead";
}

// Nome do card no formato "código · nome", preservando o código existente.
export function cardName(code: string | null | undefined, nome: string): string {
  return code ? `${code} · ${nome.trim()}` : nome.trim();
}

// Data de hoje (YYYY-MM-DD) no fuso da escola.
export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(now);
}
