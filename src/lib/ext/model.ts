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
  | "phone";

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
};

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
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  school_manager: "Gestor de escola",
  print_operator: "Operador de impressão",
  submission_editor: "Editor de cadastros",
};
