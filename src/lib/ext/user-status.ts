// Regras de usuário ativo/inativo.
// A inativação bloqueia o acesso no Auth sem remover perfil, papéis ou histórico.

export type UserStatusShape = {
  banned_until?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

export const INACTIVE_BAN_DURATION = "876000h"; // ~100 anos

export function isUserInactive(
  user: UserStatusShape | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!user) return false;
  if (user.app_metadata?.["inactive"] === true) return true;
  if (user.banned_until) {
    const until = Date.parse(user.banned_until);
    if (Number.isFinite(until) && until > nowMs) return true;
  }
  return false;
}

export function canToggleUserActive(
  actorId: string,
  targetId: string,
  nextActive: boolean,
): string | null {
  if (!nextActive && actorId === targetId) {
    return "Você não pode inativar a si mesmo.";
  }
  return null;
}

export function isBannedAuthError(message: string | null | undefined): boolean {
  if (!message) return false;
  return message.toLowerCase().includes("banned");
}