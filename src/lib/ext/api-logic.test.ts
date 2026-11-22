import { describe, expect, it } from "vitest";
import { bearer, findSchool, matchOption, phoneKey, sha256Hex, newKeyValue, KEY_PREFIX } from "./api-logic";

describe("API pública", () => {
  it("lê a chave do cabeçalho Bearer", () => {
    expect(bearer("Bearer abc")).toBe("abc");
    expect(bearer("Basic abc")).toBeNull();
    expect(bearer(null)).toBeNull();
  });
  it("telefone com ou sem 55 e 9 extra é o mesmo lead", () => {
    expect(phoneKey("+55 (83) 99876-5432")).toBe(phoneKey("83 9876-5432"));
  });
  it("série só aceita opção existente do formulário", () => {
    expect(matchOption("1º em", ["1º EF", "1º EM"])).toBe("1º EM");
    expect(matchOption("10º EM", ["1º EM"])).toBeNull();
  });
  it("escola por nome sem acento", () => {
    const s = [{ id: "a", name: "Expedicionários" }, { id: "b", name: "Centro" }];
    expect(findSchool(s, "expedicionarios")?.id).toBe("a");
    expect(findSchool(s, "Recife")).toBeNull();
  });
  it("chave nova tem prefixo e hash estável", async () => {
    const k = newKeyValue();
    expect(k.startsWith(KEY_PREFIX)).toBe(true);
    expect(await sha256Hex(k)).toBe(await sha256Hex(k));
  });
});
