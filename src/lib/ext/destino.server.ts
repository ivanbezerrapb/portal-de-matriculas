// Somente servidor: aplica as regras de destino a um cadastro.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  evaluateRules,
  type Destination,
  type DestinationRule,
  type CrmDecision,
} from "./destino";

// Busca o destino configurado e as regras do formulário.
export async function loadDestination(
  supabase: SupabaseClient,
  formId: string,
): Promise<{ destination: Destination | null; rules: DestinationRule[] }> {
  const { data: destination } = await supabase
    .from("form_destinations")
    .select("*")
    .eq("form_id", formId)
    .maybeSingle();
  const { data: rules } = await supabase
    .from("form_destination_rules")
    .select("*")
    .eq("form_id", formId)
    .order("position");
  return {
    destination: (destination as Destination | null) ?? null,
    rules: (rules ?? []) as DestinationRule[],
  };
}

// Sem destino configurado: mantém o comportamento antigo (funil padrão da escola).
async function fallbackStage(
  supabase: SupabaseClient,
  schoolId: string,
): Promise<{ funnel_id: string; stage_id: string } | null> {
  const { data: funnel } = await supabase
    .from("funnels")
    .select("id")
    .eq("school_id", schoolId)
    .eq("is_default", true)
    .maybeSingle();
  if (!funnel) return null;
  const { data: stage } = await supabase
    .from("funnel_stages")
    .select("id")
    .eq("funnel_id", funnel.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!stage) return null;
  return { funnel_id: funnel.id as string, stage_id: stage.id as string };
}

export type ApplyResult = { status: "sent" | "blocked" | "none"; reason: string };

// Decide e, quando for o caso, cria a oportunidade do cadastro.
export async function applyDestination(
  supabase: SupabaseClient,
  args: {
    submissionId: string;
    formId: string;
    schoolId: string;
    publicId: string;
    values: Record<string, string | string[] | null | undefined>;
  },
): Promise<ApplyResult> {
  const { destination, rules } = await loadDestination(supabase, args.formId);

  let decision: CrmDecision = evaluateRules(args.values, rules, destination);
  if (!destination && rules.length === 0) {
    const fb = await fallbackStage(supabase, args.schoolId);
    decision = fb
      ? { send: true, ...fb, reason: "Funil padrão da escola" }
      : { send: false, funnel_id: null, stage_id: null, reason: "Sem funil padrão" };
  }

  if (!decision.send || !decision.stage_id) {
    const status = decision.send ? "none" : "blocked";
    await supabase
      .from("submissions")
      .update({ crm_status: status, crm_reason: decision.reason })
      .eq("id", args.submissionId);
    return { status, reason: decision.reason };
  }

  // Já existe oportunidade para este cadastro?
  const { data: existing } = await supabase
    .from("opportunities")
    .select("id")
    .eq("submission_id", args.submissionId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("submissions")
      .update({ crm_status: "sent", crm_reason: decision.reason })
      .eq("id", args.submissionId);
    return { status: "sent", reason: decision.reason };
  }

  const pick = (fieldId: string | null | undefined): string | null => {
    if (!fieldId) return null;
    const v = args.values[fieldId];
    const text = Array.isArray(v) ? v.join(", ") : (v ?? "");
    return String(text).trim() || null;
  };

  let funnelId = decision.funnel_id;
  if (!funnelId) {
    const { data: stage } = await supabase
      .from("funnel_stages")
      .select("funnel_id")
      .eq("id", decision.stage_id)
      .maybeSingle();
    funnelId = (stage?.funnel_id as string | undefined) ?? null;
  }
  if (!funnelId) {
    await supabase
      .from("submissions")
      .update({ crm_status: "none", crm_reason: "Etapa inválida" })
      .eq("id", args.submissionId);
    return { status: "none", reason: "Etapa inválida" };
  }

  const { data: last } = await supabase
    .from("opportunities")
    .select("position")
    .eq("stage_id", decision.stage_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("opportunities").insert({
    funnel_id: funnelId,
    stage_id: decision.stage_id,
    school_id: args.schoolId,
    submission_id: args.submissionId,
    name: pick(destination?.name_field_id) ?? args.publicId,
    phone: pick(destination?.phone_field_id),
    email: pick(destination?.email_field_id),
    position: ((last?.position as number | undefined) ?? -1) + 1,
  });
  if (error) {
    await supabase
      .from("submissions")
      .update({ crm_status: "none", crm_reason: "Falha ao criar a oportunidade" })
      .eq("id", args.submissionId);
    return { status: "none", reason: "Falha ao criar a oportunidade" };
  }

  await supabase
    .from("submissions")
    .update({ crm_status: "sent", crm_reason: decision.reason })
    .eq("id", args.submissionId);
  return { status: "sent", reason: decision.reason };
}
