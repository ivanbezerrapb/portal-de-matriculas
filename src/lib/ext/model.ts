// Tipos compartilhados do domínio.
export type FieldType =
  | "short_text"
  | "long_text"
  | "number"
  | "date"
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "email"
  | "phone"
  | "children";

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Texto curto",
  long_text: "Texto longo",
  number: "Número",
  date: "Data",
  single_choice: "Seleção única",
  multiple_choice: "Múltipla escolha",
  yes_no: "Sim/Não",
  email: "E-mail",
  phone: "Telefone",
  children: "N Filhos",
};

// ---------- Campo "N Filhos" ----------

export const MAX_CHILDREN = 5;

export type ChildEntry = {
  nome: string;
  nascimento: string;
  serie: string;
  turno: string;
};

export function emptyChild(): ChildEntry {
  return { nome: "", nascimento: "", serie: "", turno: "" };
}

// Lê o valor gravado (JSON) como lista de crianças.
export function parseChildren(raw: string | null | undefined): ChildEntry[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_CHILDREN).map((c) => ({
      nome: String(c?.nome ?? ""),
      nascimento: String(c?.nascimento ?? ""),
      serie: String(c?.serie ?? ""),
      turno: String(c?.turno ?? ""),
    }));
  } catch {
    return [];
  }
}

// As opções de Série e Turno ficam na mesma coluna `options`,
// prefixadas com "serie:" e "turno:".
export function splitChildOptions(options: string[] | null | undefined): {
  series: string[];
  turnos: string[];
} {
  const series: string[] = [];
  const turnos: string[] = [];
  for (const opt of options ?? []) {
    if (opt.startsWith("serie:")) series.push(opt.slice(6));
    else if (opt.startsWith("turno:")) turnos.push(opt.slice(6));
  }
  return { series, turnos };
}

export function joinChildOptions(series: string[], turnos: string[]): string[] {
  return [...series.map((s) => `serie:${s}`), ...turnos.map((t) => `turno:${t}`)];
}

export type School = {
  id: string;
  name: string;
  logo_url: string | null;
  id_prefix: string;
  id_next_number: number;
  id_digits: number;
};

export type Form = {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  public_slug: string;
  created_at: string;
};

export type FormField = {
  id: string;
  form_id: string;
  label: string;
  help_text: string | null;
  type: FieldType;
  options: string[] | null;
  required: boolean;
  internal: boolean;
  position: number;
};

// Campo interno automático que guarda a quantidade de crianças como resposta.
export const CHILDREN_COUNT_LABEL = "Quantidade de crianças";

export function isChildrenCountField(f: { label: string; internal: boolean }): boolean {
  return f.internal && f.label === CHILDREN_COUNT_LABEL;
}

export type Submission = {
  id: string;
  form_id: string;
  school_id: string;
  public_id: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

export type PrintTemplate = {
  id: string;
  form_id: string;
  name: string;
  title: string;
  header_text: string | null;
  footer_text: string | null;
  show_logo: boolean;
  columns: 1 | 2;
  page_size: "A4" | "A5";
  show_signature: boolean;
  field_ids: string[];
  layout?: unknown;
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  school_manager: "Gestor de escola",
  print_operator: "Operador de impressão",
  submission_editor: "Editor de cadastros",
};

export type Funnel = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type FunnelStage = {
  id: string;
  funnel_id: string;
  name: string;
  description: string | null;
  color: string;
  position: number;
};
