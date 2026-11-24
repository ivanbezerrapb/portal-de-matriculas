// Funções ampliadas da API pública: leads (lista/edição/histórico), calendário, pipeline, tarefas e apoio.
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, cardView, findCard, fmtWhen, log, moveTo } from "./api.server";
import { cardName, findSchool, formatPhone, matchOption, needsEnrollmentCount, norm, pageParams, phoneKey, taskState, todayLocal } from "./api-logic";
import { pickWonStage } from "./won-stage";

type Ref = { card_id?: string | undefined; codigo?: string | undefined; telefone?: string | undefined; escola?: string | undefined };
const toRef = (r: Ref) => ({ id: r.card_id, codigo: r.codigo, telefone: r.telefone, escola: r.escola });

async function schoolId(db: SupabaseClient, ref: string | null | undefined) {
  if (!ref) return null;
  const { data } = await db.from("schools").select("id, name");
  const s = findSchool((data ?? []) as { id: string; name: string }[], ref);
  if (!s) throw new ApiError(422, "escola_invalida", `Escola "${ref}" não encontrada.`);
  return s.id;
}

async function funnelIds(db: SupabaseClient, ref: string | null | undefined, school: string | null) {
  if (!ref) return null;
  let q = db.from("funnels").select("id, name");
  if (school) q = q.eq("school_id", school);
  const { data } = await q;
  const n = norm(ref);
  const hit = ((data ?? []) as { id: string; name: string }[]).filter((f) => f.id === ref || norm(f.name) === n || norm(f.name).includes(n));
  if (!hit.length) throw new ApiError(422, "funil_invalido", `Funil "${ref}" não encontrado.`);
  return hit.map((f) => f.id);
}

async function userByRef(db: SupabaseClient, ref: string) {
  const { data } = await db.from("profiles").select("id, full_name");
  const n = norm(ref);
  const list = (data ?? []) as { id: string; full_name: string | null }[];
  return list.find((u) => u.id === ref) ?? list.find((u) => norm(u.full_name ?? "") === n) ?? list.find((u) => norm(u.full_name ?? "").includes(n)) ?? null;
}

async function names(db: SupabaseClient, ids: (string | null | undefined)[]) {
  const u = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const m = new Map<string, string | null>();
  if (!u.length) return m;
  const { data } = await db.from("profiles").select("id, full_name").in("id", u);
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) m.set(p.id, p.full_name);
  return m;
}

type CardRow = {
  id: string; name: string; phone: string | null; email: string | null; status: string; visit_at: string | null;
  owner_id: string | null; created_at: string; updated_at: string; school_id: string; funnel_id: string; stage_id: string;
  schools: { name: string } | null; funnels: { name: string } | null; funnel_stages: { name: string } | null;
  submissions: { id: string; public_id: string | null; list_type: string | null; created_at: string } | null;
};
const CARD_SEL = "id, name, phone, email, status, visit_at, owner_id, created_at, updated_at, school_id, funnel_id, stage_id, schools(name), funnels(name), funnel_stages(name), submissions!inner(id, public_id, list_type, created_at)";

function shape(c: CardRow, owners: Map<string, string | null>, camps: Record<string, string> = {}) {
  return {
    campanha: camps[c.id] ?? null,
    card_id: c.id, codigo: c.submissions?.public_id ?? null, nome: c.name, telefone: c.phone, email: c.email,
    tipo: c.submissions?.list_type === "leads" ? "leads" : "visitantes",
    escola: c.schools?.name ?? null, funil: c.funnels?.name ?? null, funil_id: c.funnel_id, etapa: c.funnel_stages?.name ?? null, etapa_id: c.stage_id,
    situacao: c.status, agendamento: c.visit_at,
    responsavel: c.owner_id ? { id: c.owner_id, nome: owners.get(c.owner_id) ?? null } : null,
    cadastrado_em: c.submissions?.created_at ?? c.created_at, atualizado_em: c.updated_at,
  };
}

async function submissionsByFieldValue(db: SupabaseClient, labelRe: RegExp, value: string) {
  const { data: fields } = await db.from("form_fields").select("id, label");
  const ids = ((fields ?? []) as { id: string; label: string }[]).filter((f) => labelRe.test(norm(f.label))).map((f) => f.id);
  if (!ids.length) return [];
  const { data } = await db.from("submission_values").select("submission_id").in("field_id", ids).ilike("value", `%${value}%`).limit(2000);
  return [...new Set(((data ?? []) as { submission_id: string }[]).map((r) => r.submission_id))];
}

// ---------- Leads / cards: lista ----------
export async function listCards(db: SupabaseClient, sp: URLSearchParams, forcedType?: "leads") {
  const pg = pageParams(sp);
  const school = await schoolId(db, sp.get("escola"));
  const funnels = await funnelIds(db, sp.get("funil"), school);
  let q = db.from("opportunities").select(CARD_SEL, { count: "exact" }).order("created_at", { ascending: false });
  if (school) q = q.eq("school_id", school);
  if (funnels) q = q.in("funnel_id", funnels);
  const tipo = forcedType ?? sp.get("tipo");
  if (tipo === "leads") q = q.eq("submissions.list_type", "leads");
  else if (tipo === "visitantes") q = q.neq("submissions.list_type", "leads");
  const sit = sp.get("situacao");
  if (sit) {
    if (!["open", "won", "lost"].includes(sit)) throw new ApiError(422, "dados_invalidos", "situacao deve ser open, won ou lost.");
    q = q.eq("status", sit);
  }
  const etapa = sp.get("etapa");
  if (etapa) {
    let sq = db.from("funnel_stages").select("id, name, funnel_id");
    if (funnels) sq = sq.in("funnel_id", funnels);
    const { data: st } = await sq;
    const n = norm(etapa);
    const ids = ((st ?? []) as { id: string; name: string }[]).filter((s) => s.id === etapa || norm(s.name) === n).map((s) => s.id);
    if (!ids.length) throw new ApiError(422, "etapa_invalida", `Etapa "${etapa}" não encontrada.`);
    q = q.in("stage_id", ids);
  }
  const resp = sp.get("responsavel");
  if (resp === "nenhum") q = q.is("owner_id", null);
  else if (resp) {
    const u = await userByRef(db, resp);
    if (!u) throw new ApiError(422, "usuario_invalido", `Responsável "${resp}" não encontrado.`);
    q = q.eq("owner_id", u.id);
  }
  const de = sp.get("cadastro_de"), ate = sp.get("cadastro_ate");
  if (de) q = q.gte("created_at", de);
  if (ate) q = q.lte("created_at", ate.length === 10 ? `${ate}T23:59:59-03:00` : ate);
  const busca = sp.get("busca")?.trim();
  if (busca) {
    const digits = busca.replace(/\D/g, "");
    q = digits.length >= 8 ? q.ilike("phone", `%${digits.slice(-4)}%`) : q.ilike("name", `%${busca}%`);
  }
  for (const [param, re] of [["origem", /origem/], ["serie", /^serie/]] as const) {
    const v = sp.get(param);
    if (v) {
      const subs = await submissionsByFieldValue(db, re, v);
      q = q.in("submission_id", subs.length ? subs : ["00000000-0000-0000-0000-000000000000"]);
    }
  }
  const { data, count, error } = await q.range(pg.from, pg.to);
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as unknown as CardRow[];
  if (busca && busca.replace(/\D/g, "").length >= 8) rows = rows.filter((r) => r.phone && phoneKey(r.phone) === phoneKey(busca));
  const owners = await names(db, rows.map((r) => r.owner_id));
  const camps = await (await import("./campaign.server")).readCampaigns(db);
  return { ok: true, pagina: pg.pagina, limite: pg.limite, total: count ?? rows.length, itens: rows.map((r) => shape(r, owners, camps)) };
}

// ---------- Lead: detalhe completo ----------
export async function cardDetail(db: SupabaseClient, ref: Ref) {
  const c = await findCard(db, toRef(ref));
  const { data } = await db.from("opportunities").select(CARD_SEL).eq("id", c.id).maybeSingle();
  const row = data as unknown as CardRow;
  const owners = await names(db, [row.owner_id]);
  const respostas: Record<string, string> = {};
  if (row.submissions?.id) {
    const { data: vals } = await db.from("submission_values").select("value, form_fields(label)").eq("submission_id", row.submissions.id);
    for (const v of (vals ?? []) as unknown as { value: string | null; form_fields: { label: string } | null }[]) {
      if (v.form_fields?.label && v.value) respostas[v.form_fields.label] = v.value;
    }
  }
  const { data: tasks } = await db.from("crm_tasks").select("id, title, due_date, done, done_at, created_at").eq("opportunity_id", c.id).order("created_at");
  const today = todayLocal();
  return {
    ok: true,
    card: {
      ...shape(row, owners, await (await import("./campaign.server")).readCampaigns(db)), respostas,
      tarefas: ((tasks ?? []) as { id: string; title: string; due_date: string | null; done: boolean; done_at: string | null }[])
        .map((t) => ({ id: t.id, titulo: t.title, vencimento: t.due_date, situacao: taskState(t, today), concluida_em: t.done_at })),
    },
  };
}

export async function cardHistory(db: SupabaseClient, ref: Ref) {
  const c = await findCard(db, toRef(ref));
  const { data } = await db.from("crm_notes").select("id, author_name, body, created_at").eq("opportunity_id", c.id).order("created_at", { ascending: false }).limit(500);
  return { ok: true, card: await cardView(db, c), historico: ((data ?? []) as { id: string; author_name: string | null; body: string; created_at: string }[]).map((n) => ({ id: n.id, autor: n.author_name, texto: n.body, data: n.created_at })) };
}

// ---------- Lead: edição ----------
export type EditInput = Ref & { nome?: string | undefined; novo_telefone?: string | undefined; email?: string | undefined; serie?: string[] | undefined; origem?: string | undefined; responsavel?: string | undefined; observacao?: string | undefined; campanha?: string | undefined };
export async function editLead(db: SupabaseClient, who: string, input: EditInput) {
  const c = await findCard(db, toRef(input));
  const code = c.submissions?.public_id ?? null;
  const upd: Record<string, unknown> = {};
  const changes: string[] = [];
  if (input.nome) { upd["name"] = cardName(code, input.nome); changes.push(`nome: ${input.nome}`); }
  if (input.novo_telefone) {
    if (phoneKey(input.novo_telefone).length < 10) throw new ApiError(422, "telefone_invalido", "Telefone precisa ter DDD + número.");
    upd["phone"] = formatPhone(input.novo_telefone); changes.push(`telefone: ${upd["phone"]}`);
  }
  if (input.email) { upd["email"] = input.email; changes.push(`e-mail: ${input.email}`); }
  if (input.responsavel !== undefined) {
    if (input.responsavel === "") { upd["owner_id"] = null; upd["owner_confirmed_at"] = null; changes.push("responsável removido"); }
    else {
      const u = await userByRef(db, input.responsavel);
      if (!u) throw new ApiError(422, "usuario_invalido", `Responsável "${input.responsavel}" não encontrado. Consulte GET /usuarios.`);
      const { isUserIdInactive } = await import("./server");
      if (await isUserIdInactive(db, u.id)) {
        throw new ApiError(422, "usuario_inativo", `Responsável "${u.full_name ?? input.responsavel}" está inativo.`);
      }
      upd["owner_id"] = u.id; upd["owner_confirmed_at"] = null; changes.push(`responsável: ${u.full_name}`);
    }
  }
  if (input.campanha !== undefined) {
    const { setCampaign } = await import("./campaign.server");
    const v = await setCampaign(db, c.id, input.campanha);
    changes.push(v ? `campanha: ${v}` : "campanha removida");
  }
  // Campos do formulário (nome, telefone, e-mail, série, origem).
  if (c.submission_id) {
    const { data: sub } = await db.from("submissions").select("form_id").eq("id", c.submission_id).maybeSingle();
    const { data: fields } = sub ? await db.from("form_fields").select("id, label, type, options").eq("form_id", sub.form_id) : { data: [] };
    const fl = (fields ?? []) as { id: string; label: string; type: string; options: string[] | null }[];
    const set: { field_id: string; value: string }[] = [];
    for (const f of fl) {
      const l = norm(f.label);
      if (/^nome/.test(l) && input.nome) set.push({ field_id: f.id, value: input.nome });
      else if (/telefone|whats|celular/.test(l) && input.novo_telefone) set.push({ field_id: f.id, value: formatPhone(input.novo_telefone) });
      else if (/e-?mail/.test(l) && input.email) set.push({ field_id: f.id, value: input.email });
      else if (/origem/.test(l) && input.origem) {
        const o = matchOption(input.origem, f.options);
        if (!o) throw new ApiError(422, "origem_invalida", `Origem "${input.origem}" não existe. Opções: ${(f.options ?? []).join(", ")}`);
        set.push({ field_id: f.id, value: o }); changes.push(`origem: ${o}`);
      } else if (/^serie/.test(l) && input.serie?.length) {
        const picked = input.serie.map((s) => { const m = matchOption(s, f.options); if (!m) throw new ApiError(422, "serie_invalida", `Série "${s}" não existe. Opções: ${(f.options ?? []).join(", ")}`); return m; });
        set.push({ field_id: f.id, value: f.type === "multiple_choice" ? JSON.stringify(picked) : picked[0]! }); changes.push(`série: ${picked.join(", ")}`);
      }
    }
    for (const s of set) {
      await db.from("submission_values").delete().eq("submission_id", c.submission_id).eq("field_id", s.field_id);
      await db.from("submission_values").insert({ submission_id: c.submission_id, field_id: s.field_id, part: "", value: s.value });
    }
    if (set.length) await db.from("submissions").update({ updated_at: new Date().toISOString() }).eq("id", c.submission_id);
  }
  if (!changes.length && !input.observacao) throw new ApiError(422, "dados_invalidos", "Nenhum campo para alterar.");
  if (Object.keys(upd).length) {
    upd["updated_at"] = new Date().toISOString();
    const { error } = await db.from("opportunities").update(upd).eq("id", c.id);
    if (error) throw new Error(error.message);
  }
  const body = [changes.length ? `Dados atualizados pela integração — ${changes.join("; ")}.` : "", input.observacao ?? ""].filter(Boolean).join(" ");
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body });
  await log(db, who, `Lead editado pela API: ${code ?? c.name}`, { alteracoes: changes }, c.school_id);
  return cardDetail(db, { card_id: c.id });
}

// ---------- Calendário ----------
export async function listCalendar(db: SupabaseClient, sp: URLSearchParams) {
  const pg = pageParams(sp);
  const de = sp.get("de"), ate = sp.get("ate");
  if (!de || !ate) throw new ApiError(422, "dados_invalidos", "Informe de e ate (YYYY-MM-DD ou ISO 8601).");
  const school = await schoolId(db, sp.get("escola"));
  let q = db.from("opportunities").select(CARD_SEL, { count: "exact" }).not("visit_at", "is", null)
    .gte("visit_at", de.length === 10 ? `${de}T00:00:00-03:00` : de)
    .lte("visit_at", ate.length === 10 ? `${ate}T23:59:59-03:00` : ate)
    .order("visit_at");
  if (school) q = q.eq("school_id", school);
  const tipo = sp.get("tipo");
  if (tipo === "visita") q = q.eq("submissions.list_type", "leads");
  else if (tipo === "matricula") q = q.neq("submissions.list_type", "leads");
  const sit = sp.get("situacao");
  if (sit === "agendado") q = q.eq("status", "open");
  else if (sit === "realizado") q = q.eq("status", "won");
  else if (sit === "cancelado") q = q.eq("status", "lost");
  const at = sp.get("atendente");
  if (at) { const u = await userByRef(db, at); if (!u) throw new ApiError(422, "usuario_invalido", `Atendente "${at}" não encontrado.`); q = q.eq("owner_id", u.id); }
  const { data, count, error } = await q.range(pg.from, pg.to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as CardRow[];
  const owners = await names(db, rows.map((r) => r.owner_id));
  const by = new Map<string, string>();
  if (rows.length) {
    const { data: notes } = await db.from("crm_notes").select("opportunity_id, author_name, created_at").in("opportunity_id", rows.map((r) => r.id)).ilike("body", "%agendada para%").order("created_at");
    for (const n of (notes ?? []) as { opportunity_id: string; author_name: string | null }[]) if (n.author_name) by.set(n.opportunity_id, n.author_name);
  }
  return {
    ok: true, pagina: pg.pagina, limite: pg.limite, total: count ?? rows.length,
    itens: rows.map((r) => ({
      card_id: r.id, codigo: r.submissions?.public_id ?? null, nome: r.name, telefone: r.phone,
      tipo: r.submissions?.list_type === "leads" ? "visita" : "matricula", data_hora: r.visit_at,
      situacao: r.status === "won" ? "realizado" : r.status === "lost" ? "cancelado" : "agendado",
      escola: r.schools?.name ?? null, funil: r.funnels?.name ?? null, etapa: r.funnel_stages?.name ?? null,
      agendado_por: by.get(r.id) ?? (r.owner_id ? owners.get(r.owner_id) ?? null : null),
      responsavel: r.owner_id ? { id: r.owner_id, nome: owners.get(r.owner_id) ?? null } : null,
    })),
  };
}

export async function cancelSchedule(db: SupabaseClient, who: string, input: Ref & { motivo?: string | undefined }) {
  const c = await findCard(db, toRef(input));
  if (!c.visit_at) throw new ApiError(409, "sem_agendamento", "Este card não tem agendamento.");
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  await db.from("opportunities").update({ visit_at: null, updated_at: new Date().toISOString() }).eq("id", c.id);
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Agendamento de ${fmtWhen(c.visit_at)} cancelado pela integração.${input.motivo ? ` Motivo: ${input.motivo}` : ""}` });
  await log(db, who, `Agendamento cancelado pela API: ${c.submissions?.public_id ?? c.name}`, {}, c.school_id);
  return { ok: true, card: await cardView(db, { ...c, visit_at: null }) };
}

export async function noShow(db: SupabaseClient, who: string, input: Ref) {
  const c = await findCard(db, toRef(input));
  if (!c.visit_at) throw new ApiError(409, "sem_agendamento", "Este card não tem agendamento.");
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  const isVisit = c.submissions?.list_type === "leads";
  const { data: stages } = await db.from("funnel_stages").select("id, name").eq("funnel_id", c.funnel_id);
  const list = (stages ?? []) as { id: string; name: string }[];
  const word = isVisit ? "visita" : "matricula";
  const stage = list.find((s) => norm(s.name).includes("reagend") && norm(s.name).includes(word)) ?? list.find((s) => norm(s.name).includes("reagend"));
  if (!stage) throw new ApiError(422, "etapa_ausente", "O funil não tem a etapa de reagendamento.");
  await moveTo(db, c, stage.id);
  await db.from("opportunities").update({ visit_at: null }).eq("id", c.id);
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Faltou à ${isVisit ? "visita agendada" : "matrícula agendada"} para ${fmtWhen(c.visit_at)}. Aguardando reagendamento.` });
  await log(db, who, `Falta registrada pela API: ${c.submissions?.public_id ?? c.name}`, {}, c.school_id);
  return { ok: true, card: await cardView(db, { ...c, stage_id: stage.id, visit_at: null }) };
}

export async function checkIn(db: SupabaseClient, who: string, input: Ref) {
  const c = await findCard(db, toRef(input));
  if (c.submissions?.list_type !== "leads") throw new ApiError(422, "somente_leads", "Check-in existe só para cards de LEADS. Para Visitantes use POST /pipeline/fechar.");
  if (!c.submission_id) throw new ApiError(422, "sem_cadastro", "Card sem cadastro vinculado.");
  const { data: prev } = await db.from("audit_log").select("id").eq("submission_id", c.submission_id).eq("action", "check_in").limit(1).maybeSingle();
  if (prev) throw new ApiError(409, "checkin_existente", "O check-in deste lead já foi confirmado.");
  const now = new Date().toISOString();
  await db.from("crm_tasks").update({ done: true, done_at: now }).eq("opportunity_id", c.id).eq("done", false);
  const { data: stages } = await db.from("funnel_stages").select("id, name").eq("funnel_id", c.funnel_id);
  const done = ((stages ?? []) as { id: string; name: string }[]).find((s) => /realizad/i.test(s.name));
  await db.from("opportunities").update({ status: "won", ...(done ? { stage_id: done.id } : {}), close_reason_id: null, close_note: "Check-in confirmado (visita realizada).", closed_at: now, updated_at: now }).eq("id", c.id);
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Visita realizada em ${fmtWhen(now)} — check-in pela integração.` });
  await db.from("audit_log").insert({ submission_id: c.submission_id, actor_id: null, actor_email: who, action: "check_in", changes: [{ field_id: "check_in", label: "Check-in", before: "Não", after: "Sim" }, { field_id: "checked_in_at", label: "Data do check-in", before: "", after: now }] });
  await log(db, who, `Check-in pela API: ${c.submissions?.public_id ?? c.name}`, {}, c.school_id);
  return { ok: true, checkin_em: now, card: await cardView(db, { ...c, status: "won", stage_id: done?.id ?? c.stage_id }) };
}

// ---------- Pipeline ----------
export async function listPipelines(db: SupabaseClient, sp: URLSearchParams) {
  const school = await schoolId(db, sp.get("escola"));
  let q = db.from("funnels").select("id, name, school_id, schools(name), funnel_stages(id, name, position)");
  if (school) q = q.eq("school_id", school);
  const { data: fns } = await q;
  const list = (fns ?? []) as unknown as { id: string; name: string; schools: { name: string } | null; funnel_stages: { id: string; name: string; position: number }[] }[];
  const counts = new Map<string, number>();
  const ids = list.map((f) => f.id);
  if (ids.length) {
    for (let from = 0; ; from += 1000) {
      const { data } = await db.from("opportunities").select("stage_id").in("funnel_id", ids).range(from, from + 999);
      for (const r of (data ?? []) as { stage_id: string }[]) counts.set(r.stage_id, (counts.get(r.stage_id) ?? 0) + 1);
      if (!data || data.length < 1000) break;
    }
  }
  return {
    ok: true,
    funis: list.map((f) => ({
      id: f.id, nome: f.name, escola: f.schools?.name ?? null,
      etapas: [...f.funnel_stages].sort((a, b) => a.position - b.position).map((e) => ({ id: e.id, nome: e.name, posicao: e.position, cards: counts.get(e.id) ?? 0 })),
    })),
  };
}

export async function transferCard(db: SupabaseClient, who: string, input: Ref & { funil: string; observacao?: string | undefined }) {
  const c = await findCard(db, toRef(input));
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  const ids = await funnelIds(db, input.funil, c.school_id);
  const targetId = ids?.[0];
  if (!targetId || targetId === c.funnel_id) throw new ApiError(422, "funil_invalido", "Informe outro funil da mesma escola.");
  const { data: first } = await db.from("funnel_stages").select("id").eq("funnel_id", targetId).order("position").limit(1).maybeSingle();
  if (!first) throw new ApiError(422, "funil_sem_etapas", "O funil de destino não tem etapas.");
  const [{ data: src }, { data: dst }] = await Promise.all([
    db.from("funnels").select("name").eq("id", c.funnel_id).maybeSingle(),
    db.from("funnels").select("name").eq("id", targetId).maybeSingle(),
  ]);
  const { count } = await db.from("opportunities").select("id", { count: "exact", head: true }).eq("stage_id", first.id);
  await db.from("opportunities").update({ funnel_id: targetId, stage_id: first.id, position: count ?? 0, owner_confirmed_at: null, updated_at: new Date().toISOString() }).eq("id", c.id);
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Transferido de "${src?.name}" para "${dst?.name}" pela integração.${input.observacao ? ` ${input.observacao}` : ""}` });
  await log(db, who, `Card transferido pela API: ${c.submissions?.public_id ?? c.name} → ${dst?.name}`, {}, c.school_id);
  return cardDetail(db, { card_id: c.id });
}

export async function setOwner(db: SupabaseClient, who: string, input: Ref & { responsavel: string }) {
  return editLead(db, who, { ...input, responsavel: input.responsavel });
}

export async function closeCard(db: SupabaseClient, who: string, input: Ref & { resultado: "ganho" | "perdido"; motivo: string; matriculas?: number | undefined; observacao?: string | undefined }) {
  const c = await findCard(db, toRef(input));
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  const kind = input.resultado === "ganho" ? "won" : "lost";
  const { data: reasons } = await db.from("crm_close_reasons").select("id, kind, label, active").eq("kind", kind);
  const n = norm(input.motivo);
  const reason = ((reasons ?? []) as { id: string; label: string }[]).find((r) => r.id === input.motivo || norm(r.label) === n);
  if (!reason) throw new ApiError(422, "motivo_invalido", `Motivo "${input.motivo}" não existe para ${input.resultado}. Consulte GET /motivos.`);
  const listType = c.submissions?.list_type;
  const needs = kind === "won" && needsEnrollmentCount(listType);
  if (needs && !input.matriculas) throw new ApiError(422, "matriculas_obrigatorias", "Ganho em Visitantes exige matriculas (quantidade de matrículas efetivadas).");
  const { data: stages } = await db.from("funnel_stages").select("id, name").eq("funnel_id", c.funnel_id);
  const list = (stages ?? []) as { id: string; name: string }[];
  const stage = kind === "won" ? pickWonStage(list, listType) : list.find((s) => /^perdid[oa]s?$/.test(norm(s.name)));
  if (kind === "lost" && !stage) throw new ApiError(422, "etapa_ausente", "Este funil não tem a etapa Perdido.");
  const now = new Date().toISOString();
  await db.from("crm_tasks").update({ done: true, done_at: now }).eq("opportunity_id", c.id).eq("done", false);
  const { error } = await db.from("opportunities").update({ ...(stage ? { stage_id: stage.id } : {}), status: kind, close_reason_id: reason.id, close_note: input.observacao?.trim() || null, closed_at: now, updated_at: now }).eq("id", c.id);
  if (error) throw new Error(error.message);
  if (needs && c.submission_id) {
    await db.from("submissions").update({ enrolled: true, enrollment_count: input.matriculas, enrolled_at: now, enrolled_by: null }).eq("id", c.submission_id);
  }
  await db.from("crm_notes").insert({ opportunity_id: c.id, author_id: null, author_name: who, body: `Marcado como ${input.resultado} pela integração — motivo: ${reason.label}${needs ? ` (${input.matriculas} matrícula(s))` : ""}${input.observacao ? `. ${input.observacao}` : ""}` });
  await log(db, who, `Card ${input.resultado} pela API: ${c.submissions?.public_id ?? c.name}`, { motivo: reason.label }, c.school_id);
  return { ok: true, card: await cardView(db, { ...c, status: kind, stage_id: stage?.id ?? c.stage_id }) };
}

// ---------- Tarefas ----------
type TaskRow = { id: string; title: string; due_date: string | null; done: boolean; done_at: string | null; created_at: string; opportunity_id: string; opportunities: { name: string; owner_id: string | null; school_id: string; schools: { name: string } | null; funnels: { name: string } | null; submissions: { public_id: string | null } | null } | null };
const TASK_SEL = "id, title, due_date, done, done_at, created_at, opportunity_id, opportunities!inner(name, owner_id, school_id, funnel_id, schools(name), funnels(name), submissions(public_id))";
function shapeTask(t: TaskRow, owners: Map<string, string | null>, today: string) {
  const o = t.opportunities;
  return {
    id: t.id, titulo: t.title, vencimento: t.due_date, situacao: taskState(t, today), concluida_em: t.done_at, criada_em: t.created_at,
    card: { card_id: t.opportunity_id, codigo: o?.submissions?.public_id ?? null, nome: o?.name ?? null, escola: o?.schools?.name ?? null, funil: o?.funnels?.name ?? null },
    responsavel: o?.owner_id ? { id: o.owner_id, nome: owners.get(o.owner_id) ?? null } : null,
  };
}

export async function listTasksApi(db: SupabaseClient, sp: URLSearchParams) {
  const pg = pageParams(sp);
  const today = todayLocal();
  const school = await schoolId(db, sp.get("escola"));
  let q = db.from("crm_tasks").select(TASK_SEL, { count: "exact" }).order("done").order("due_date", { nullsFirst: false }).order("created_at");
  if (school) q = q.eq("opportunities.school_id", school);
  const funnels = await funnelIds(db, sp.get("funil"), school);
  if (funnels) q = q.in("opportunities.funnel_id", funnels);
  const ref = { card_id: sp.get("card_id") ?? undefined, codigo: sp.get("codigo") ?? undefined, telefone: sp.get("telefone") ?? undefined };
  if (ref.card_id || ref.codigo || ref.telefone) q = q.eq("opportunity_id", (await findCard(db, toRef(ref))).id);
  const resp = sp.get("responsavel");
  if (resp) { const u = await userByRef(db, resp); if (!u) throw new ApiError(422, "usuario_invalido", `Responsável "${resp}" não encontrado.`); q = q.eq("opportunities.owner_id", u.id); }
  const sit = sp.get("situacao");
  if (sit === "concluida") q = q.eq("done", true);
  else if (sit === "pendente") q = q.eq("done", false).or(`due_date.is.null,due_date.gte.${today}`);
  else if (sit === "atrasada") q = q.eq("done", false).lt("due_date", today);
  else if (sit) throw new ApiError(422, "dados_invalidos", "situacao deve ser pendente, atrasada ou concluida.");
  const de = sp.get("vencimento_de"), ate = sp.get("vencimento_ate");
  if (de) q = q.gte("due_date", de);
  if (ate) q = q.lte("due_date", ate);
  const { data, count, error } = await q.range(pg.from, pg.to);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as TaskRow[];
  const owners = await names(db, rows.map((r) => r.opportunities?.owner_id));
  return { ok: true, pagina: pg.pagina, limite: pg.limite, total: count ?? rows.length, itens: rows.map((r) => shapeTask(r, owners, today)) };
}

async function taskById(db: SupabaseClient, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(422, "dados_invalidos", "ID da tarefa inválido.");
  const { data } = await db.from("crm_tasks").select(TASK_SEL).eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "tarefa_nao_encontrada", "Tarefa não encontrada.");
  return data as unknown as TaskRow;
}
async function taskOut(db: SupabaseClient, id: string) {
  const t = await taskById(db, id);
  return { ok: true, tarefa: shapeTask(t, await names(db, [t.opportunities?.owner_id]), todayLocal()) };
}

export async function createTaskApi(db: SupabaseClient, who: string, input: Ref & { titulo: string; vencimento?: string | undefined; responsavel?: string | undefined }) {
  const c = await findCard(db, toRef(input));
  if (c.status !== "open") throw new ApiError(409, "card_fechado", "Card já está ganho ou perdido.");
  if (input.responsavel) await editLead(db, who, { card_id: c.id, responsavel: input.responsavel });
  const { data, error } = await db.from("crm_tasks").insert({ opportunity_id: c.id, title: input.titulo, due_date: input.vencimento ?? null, created_by: null }).select("id").single();
  if (error) throw new Error(error.message);
  await log(db, who, `Tarefa criada pela API: ${c.submissions?.public_id ?? c.name} — ${input.titulo}`, {}, c.school_id);
  return taskOut(db, data.id as string);
}

export async function updateTaskApi(db: SupabaseClient, who: string, id: string, input: { titulo?: string | undefined; vencimento?: string | null | undefined; concluida?: boolean | undefined; observacao?: string | undefined }) {
  const t = await taskById(db, id);
  const upd: Record<string, unknown> = {};
  if (input.titulo) upd["title"] = input.titulo;
  if (input.vencimento !== undefined) upd["due_date"] = input.vencimento;
  if (input.concluida !== undefined) {
    if (input.concluida && !input.observacao) throw new ApiError(422, "observacao_obrigatoria", "Para concluir, envie observacao com o que foi feito (vai para o histórico).");
    upd["done"] = input.concluida; upd["done_at"] = input.concluida ? new Date().toISOString() : null;
  }
  if (!Object.keys(upd).length) throw new ApiError(422, "dados_invalidos", "Nenhum campo para alterar.");
  const { error } = await db.from("crm_tasks").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
  if (input.concluida && input.observacao) await db.from("crm_notes").insert({ opportunity_id: t.opportunity_id, author_id: null, author_name: who, body: `Concluiu ${input.titulo ?? t.title}: ${input.observacao}` });
  return taskOut(db, id);
}

export async function deleteTaskApi(db: SupabaseClient, who: string, id: string) {
  const t = await taskById(db, id);
  await db.from("crm_tasks").delete().eq("id", id);
  await log(db, who, `Tarefa excluída pela API: ${t.title}`, {}, t.opportunities?.school_id ?? null);
  return { ok: true, excluida: id };
}

// ---------- Apoio ----------
const ROLE: Record<string, string> = { admin: "Administrador", direcao: "Direção", school_manager: "Gerente", info_center: "Central de Informações", print_operator: "Coordenação", submission_editor: "Editor" };
export async function listUsersApi(db: SupabaseClient, sp: URLSearchParams) {
  const school = await schoolId(db, sp.get("escola"));
  const { getInactiveUserIds } = await import("./server");
  const [{ data: roles }, inactiveIds] = await Promise.all([
    db.from("user_roles").select("user_id, role, school_id, schools(name)"),
    getInactiveUserIds(db),
  ]);
  const rs = ((roles ?? []) as unknown as { user_id: string; role: string; school_id: string | null; schools: { name: string } | null }[])
    .filter((r) => r.role !== "admin" && r.role !== "direcao" && !inactiveIds.has(r.user_id) && (!school || r.school_id === school));
  const nm = await names(db, rs.map((r) => r.user_id));
  const byUser = new Map<string, { id: string; nome: string | null; perfis: { perfil: string; escola: string | null }[] }>();
  for (const r of rs) {
    const u = byUser.get(r.user_id) ?? { id: r.user_id, nome: nm.get(r.user_id) ?? null, perfis: [] };
    u.perfis.push({ perfil: ROLE[r.role] ?? r.role, escola: r.schools?.name ?? null });
    byUser.set(r.user_id, u);
  }
  return { ok: true, usuarios: [...byUser.values()].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")) };
}

export async function listReasonsApi(db: SupabaseClient) {
  const { data } = await db.from("crm_close_reasons").select("id, kind, label, position, active").eq("active", true).order("position");
  const rs = (data ?? []) as { id: string; kind: string; label: string }[];
  return { ok: true, ganho: rs.filter((r) => r.kind === "won").map((r) => ({ id: r.id, motivo: r.label })), perdido: rs.filter((r) => r.kind === "lost").map((r) => ({ id: r.id, motivo: r.label })) };
}
