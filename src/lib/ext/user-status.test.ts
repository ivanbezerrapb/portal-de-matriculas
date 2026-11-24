import { describe, expect, it } from "vitest";
import { canToggleUserActive, isBannedAuthError, isUserInactive } from "./user-status";

describe("user-status", () => {
  const now = Date.parse("2026-11-24T12:00:00Z");

  it("identifica usuário ativo quando não há bloqueio nem flag", () => {
    expect(isUserInactive({}, now)).toBe(false);
    expect(isUserInactive({ app_metadata: { inactive: false }, banned_until: null }, now)).toBe(false);
    expect(isUserInactive(null, now)).toBe(false);
  });

  it("identifica usuário inativo por app_metadata.inactive", () => {
    expect(isUserInactive({ app_metadata: { inactive: true } }, now)).toBe(true);
  });

  it("identifica usuário inativo por banned_until futuro e ignora passado", () => {
    expect(isUserInactive({ banned_until: "2099-01-01T00:00:00Z" }, now)).toBe(true);
    expect(isUserInactive({ banned_until: "2026-01-01T00:00:00Z" }, now)).toBe(false);
  });

  it("impede o administrador de inativar a si mesmo", () => {
    expect(canToggleUserActive("u1", "u1", false)).toBe("Você não pode inativar a si mesmo.");
    expect(canToggleUserActive("u1", "u2", false)).toBeNull();
    expect(canToggleUserActive("u1", "u1", true)).toBeNull();
  });

  it("reconhece erro de usuário banido no login", () => {
    expect(isBannedAuthError("User is banned")).toBe(true);
    expect(isBannedAuthError("Invalid login credentials")).toBe(false);
  });
});