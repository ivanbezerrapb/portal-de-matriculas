import { describe, expect, it } from "vitest";
import { postmanCollection } from "./api-postman";
import { ENDPOINTS, MODULOS } from "./api-docs";

describe("coleção Postman", () => {
  it("tem uma pasta por módulo e um item por endpoint, com auth bearer", () => {
    const c = postmanCollection();
    expect(c.item).toHaveLength(MODULOS.length);
    expect(c.item.reduce((n, f) => n + f.item.length, 0)).toBe(ENDPOINTS.length);
    expect(c.auth.type).toBe("bearer");
    expect(c.auth.bearer[0]?.value).toBe("{{api_key}}");
  });
});
