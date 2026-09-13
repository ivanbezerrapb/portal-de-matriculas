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
  | "children"
  | "address";

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
  address: "Endereço",
};

// ---------- Campo "Endereço" ----------

export type AddressEntry = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export function emptyAddress(): AddressEntry {
  return { cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" };
}

// Lê o valor gravado (JSON) como endereço.
export function parseAddress(raw: string | null | undefined): AddressEntry {
  if (!raw) return emptyAddress();
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return emptyAddress();
    return {
      cep: String(obj["cep"] ?? ""),
      rua: String(obj["rua"] ?? ""),
      numero: String(obj["numero"] ?? ""),
      complemento: String(obj["complemento"] ?? ""),
      bairro: String(obj["bairro"] ?? ""),
      cidade: String(obj["cidade"] ?? ""),
      estado: String(obj["estado"] ?? ""),
    };
  } catch {
    return emptyAddress();
  }
}

export function isAddressEmpty(a: AddressEntry): boolean {
  return !(a.cep || a.rua || a.numero || a.complemento || a.bairro || a.cidade || a.estado);
}

// Texto legível: "Rua X, 123 — Apto 2 — Bairro — Cidade/UF — CEP 00000-000"
export function formatAddress(a: AddressEntry): string {
  const parts: string[] = [];
  const linha = [a.rua.trim(), a.numero.trim()].filter(Boolean).join(", ");
  if (linha) parts.push(linha);
  if (a.complemento.trim()) parts.push(a.complemento.trim());
  if (a.bairro.trim()) parts.push(a.bairro.trim());
  const cidadeUf = [a.cidade.trim(), a.estado.trim()].filter(Boolean).join("/");
  if (cidadeUf) parts.push(cidadeUf);
  if (a.cep.trim()) parts.push(`CEP ${a.cep.trim()}`);
  return parts.join(" — ");
}

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
  school_manager: "Gerente",
  print_operator: "Secretaria",
  info_center: "Central de Informações",
};

export type Funnel = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
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

export type Opportunity = {
  id: string;
  funnel_id: string;
  stage_id: string;
  school_id: string;
  submission_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  details: { label: string; value: string }[];
  position: number;
  status: "open" | "won" | "lost";
  close_reason_id: string | null;
  close_note: string | null;
  closed_at: string | null;
  created_at: string;
};

export type CrmTask = {
  id: string;
  opportunity_id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  created_at: string;
};

export type CloseReason = {
  id: string;
  kind: "won" | "lost";
  label: string;
  position: number;
  active: boolean;
};
