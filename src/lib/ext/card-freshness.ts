// Cálculo de tempo desde a última atualização de um cartão do Pipeline.

export const FRESH_MAX_DAYS = 2;
export const STALE_ALERT_DAYS = 5;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type FreshnessLevel = "fresh" | "warning" | "stale" | "neutral";

export type CardFreshness = {
  label: string;
  title: string;
  level: FreshnessLevel;
  days: number;
};

// Devolve o timestamp mais recente dentre os informados, ignorando nulos e inválidos.
export function resolveLastUpdatedAt(
  timestamps: readonly (string | null | undefined)[],
): string | null {
  let bestTs: string | null = null;
  let bestMs = -Infinity;
  for (const ts of timestamps) {
    if (!ts) continue;
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      bestTs = ts;
    }
  }
  return bestTs;
}

function formatExactDateTime(ms: number): string {
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Fortaleza",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
  return `Última atualização em ${formatted.replace(", ", " às ")}`;
}

// Classifica o tempo decorrido desde a última atualização do cartão:
// até 2 dias = recente; 3 a 5 dias = atenção; mais de 5 dias = alerta vermelho.
export function describeCardFreshness(
  lastUpdatedAt: string | null | undefined,
  options?: { now?: number; status?: string },
): CardFreshness | null {
  if (!lastUpdatedAt) return null;
  const updatedMs = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(updatedMs)) return null;

  const nowMs = options?.now ?? Date.now();
  const diffMs = Math.max(0, nowMs - updatedMs);
  const diffMinutes = Math.floor(diffMs / MINUTE_MS);
  const diffHours = Math.floor(diffMs / HOUR_MS);
  const diffDays = Math.floor(diffMs / DAY_MS);

  const isClosed = Boolean(options?.status && options.status !== "open");
  const level: FreshnessLevel = isClosed
    ? "neutral"
    : diffDays > STALE_ALERT_DAYS
      ? "stale"
      : diffDays > FRESH_MAX_DAYS
        ? "warning"
        : "fresh";

  let label: string;
  if (diffMinutes < 1) {
    label = "Atualizado agora";
  } else if (diffMinutes < 60) {
    label = `Atualizado há ${diffMinutes} min`;
  } else if (diffHours < 24) {
    label = `Atualizado há ${diffHours}h`;
  } else if (diffDays === 1) {
    label = "Atualizado há 1 dia";
  } else if (level === "stale") {
    label = `Sem atualização há ${diffDays} dias`;
  } else {
    label = `Atualizado há ${diffDays} dias`;
  }

  return {
    label,
    title: formatExactDateTime(updatedMs),
    level,
    days: diffDays,
  };
}