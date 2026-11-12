// Etapa de ganho do funil: Leads → "Visita realizada"; Visitantes → "Matriculado" (ou "Visita realizada").
const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function pickWonStage<T extends { name: string }>(stages: T[], listType: string | null | undefined): T | null {
  const done = stages.find((s) => norm(s.name).includes("realizad")) ?? null;
  if (listType === "leads") return done;
  return stages.find((s) => norm(s.name).includes("matriculad")) ?? done;
}
