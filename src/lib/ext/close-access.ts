// Regra única de quem pode fechar um cartão do CRM (ganho ou perda).
// Admin sempre pode; Gerente da unidade pode; Central de Informações só pode
// quando está vinculada ao funil do cartão. Direção é somente leitura.

export type CloseAccessPerms = {
  isAdmin: boolean;
  isDirecao: boolean;
  managerSchools: string[];
  infoSchools: string[];
};

export function canCloseOpportunity(
  perms: CloseAccessPerms,
  schoolId: string,
  linkedToFunnel: boolean,
): boolean {
  if (perms.isAdmin) return true;
  if (perms.isDirecao) return false;
  if (perms.managerSchools.includes(schoolId)) return true;
  if (perms.infoSchools.includes(schoolId)) return linkedToFunnel;
  return false;
}

// Leitura da interface: o vínculo ao funil é conferido no servidor.
export function canCloseOpportunityBySchool(
  perms: CloseAccessPerms,
  schoolId: string,
): boolean {
  return canCloseOpportunity(perms, schoolId, true);
}

// Ganho pede/grava matrícula só para cartões da Lista de Visitantes (não para LEADS).
export function asksEnrollment(
  opp: { submission_id: string | null; submissions?: { list_type: string | null } | null } | null,
): boolean {
  if (!opp?.submission_id) return false;
  return opp.submissions?.list_type !== "leads";
}

// Transferência de cartão entre funis: Admin, Gerentes, Coordenação e Central da unidade,
// só para cartão aberto e funil de destino diferente na mesma escola.
export function canTransferBySchool(
  perms: CloseAccessPerms & { operatorSchools?: string[] },
  schoolId: string,
): boolean {
  if (perms.isAdmin) return true;
  if (perms.isDirecao) return false;
  return (
    perms.managerSchools.includes(schoolId) ||
    perms.infoSchools.includes(schoolId) ||
    (perms.operatorSchools ?? []).includes(schoolId)
  );
}

export function canTransferOpportunity(
  perms: CloseAccessPerms & { operatorSchools?: string[] },
  opp: { school_id: string; funnel_id: string; status: string },
  target: { id: string; school_id: string },
  linkedToFunnel: boolean,
): string | null {
  if (opp.status !== "open") return "Só é possível transferir cartões abertos.";
  if (target.id === opp.funnel_id) return "O cartão já está neste funil.";
  if (target.school_id !== opp.school_id) return "O funil de destino precisa ser da mesma unidade.";
  void linkedToFunnel;
  if (!canTransferBySchool(perms, opp.school_id))
    return "Sem permissão para transferir este cartão.";
  return null;
}

// Transferência de carteira (em lote) dentro de um funil: apenas Admin e Gerentes da unidade.
export function canTransferPortfolio(
  perms: CloseAccessPerms & { operatorSchools?: string[] },
  schoolId: string,
): boolean {
  if (perms.isAdmin) return true;
  if (perms.isDirecao) return false;
  return perms.managerSchools.includes(schoolId);
}

export function validatePortfolioTransfer(
  perms: CloseAccessPerms & { operatorSchools?: string[] },
  schoolId: string,
  fromOwnerId: string | null,
  toOwnerId: string,
): string | null {
  if (!canTransferPortfolio(perms, schoolId)) {
    return "Apenas administradores e gerentes desta unidade podem transferir a carteira.";
  }
  if (!toOwnerId) return "Escolha o atendente de destino.";
  if (fromOwnerId && fromOwnerId === toOwnerId) {
    return "O atendente de destino precisa ser diferente do atendente de origem.";
  }
  return null;
}
