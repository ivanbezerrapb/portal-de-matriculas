import type { ChildEntry, FormField } from "@/lib/ext/model";
import {
  MAX_CHILDREN,
  emptyChild,
  parseChildren,
  splitChildOptions,
} from "@/lib/ext/model";
import { Input, Label, Select, Textarea } from "./ui";

// Renderiza um campo do formulário. `value` é string ou string[] (múltipla escolha).
export function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  error?: string | undefined;
}) {
  const strValue = typeof value === "string" ? value : "";
  const arrValue = Array.isArray(value) ? value : [];

  return (
    <div>
      <Label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.help_text && (
        <p className="mb-1 text-xs text-muted-foreground">{field.help_text}</p>
      )}

      {field.type === "short_text" && (
        <Input
          id={field.id}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "long_text" && (
        <Textarea
          id={field.id}
          rows={4}
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "number" && (
        <Input
          id={field.id}
          type="number"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "date" && (
        <Input
          id={field.id}
          type="date"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "email" && (
        <Input
          id={field.id}
          type="email"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "phone" && (
        <Input
          id={field.id}
          type="tel"
          placeholder="(00) 00000-0000"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.type === "yes_no" && (
        <div className="flex gap-3">
          {["Sim", "Não"].map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm ${
                strValue === opt
                  ? "border-primary bg-accent font-medium"
                  : "border-input bg-card"
              }`}
            >
              <input
                type="radio"
                className="accent-[var(--color-primary)]"
                checked={strValue === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === "single_choice" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => (
            <label
              key={opt}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                strValue === opt
                  ? "border-primary bg-accent font-medium"
                  : "border-input bg-card"
              }`}
            >
              <input
                type="radio"
                className="accent-[var(--color-primary)]"
                checked={strValue === opt}
                onChange={() => onChange(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      )}
      {field.type === "multiple_choice" && (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((opt) => {
            const checked = arrValue.includes(opt);
            return (
              <label
                key={opt}
                className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                  checked
                    ? "border-primary bg-accent font-medium"
                    : "border-input bg-card"
                }`}
              >
                <input
                  type="checkbox"
                  className="accent-[var(--color-primary)]"
                  checked={checked}
                  onChange={() =>
                    onChange(
                      checked
                        ? arrValue.filter((v) => v !== opt)
                        : [...arrValue, opt],
                    )
                  }
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

// Formata um valor para exibição/impressão
export function formatValue(field: FormField, raw: string): string {
  if (!raw) return "—";
  if (field.type === "multiple_choice") {
    try {
      const arr = JSON.parse(raw) as string[];
      return Array.isArray(arr) ? arr.join(", ") : raw;
    } catch {
      return raw;
    }
  }
  if (field.type === "date" && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [y, m, d] = raw.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return raw;
}
