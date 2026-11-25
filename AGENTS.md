<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Maxbot
- Maxbot settings (per account: conecta/interactivo, tokens, label mapping, imported contact ids) live in the private `integracoes/maxbot.json` storage object on the external DB, read only server-side via `src/lib/ext/maxbot.server.ts` — the external DB has no migration path from here, and tokens must never reach the browser.
- Automatic lead import runs from the managed schedule `maxbot-import-leads` (every 10 min) calling `/api/public/maxbot-import`, authenticated with `authenticateCronRequest`.
- Card↔Maxbot contact links live in the `contacts` map (opportunityId→contactId) of `integracoes/maxbot.json`; cards are registered when opened and by the 10-min cron sweep (no hook in each creation path, since cards are created from many places).

- Public integration API lives under `/api/public/v1/*` authenticated by Bearer keys whose SHA-256 hashes are stored in the private `integracoes/api.json` object on the external DB (managed in Configurações › API); the external DB has no migration path, and raw keys are shown only once.
- Public API v1 routes stay thin (zod + `authenticate`), with logic in `src/lib/ext/api.server.ts`/`api2.server.ts` and docs generated from `src/lib/api-docs.ts` (screen, .md and PDF) — one source keeps docs and behavior in sync.
- Card campaign names live in the private `integracoes/campanhas.json` object (cardId→name) on the external DB, via `src/lib/ext/campaign.server.ts` — the external DB cannot get new columns from here.
- User inactivation uses Supabase Auth `ban_duration` plus `app_metadata.inactive` (helpers in `src/lib/ext/user-status.ts` and `src/lib/ext/server.ts`), keeping `profiles`, roles, funnel links, and all history intact because the external DB cannot get new columns from here.
- Task mutations in the task list and card panels use `refreshTaskViews` to invalidate tasks, pipeline, backlog and notes together because next-task dates also control Kanban badges and ordering; closing a card refreshes its funnel immediately while periodic polling pauses during card editing.
- Pipeline card last-updated badges compute `last_updated_at` in `listPipeline` from the newest timestamp across `opportunities`, `submissions`, `crm_notes`, and `crm_tasks` (in paginated 150-id batches) while note/task mutations also touch `opportunities.updated_at`, so historical cards without touched `opportunities.updated_at` stay accurate.
- Attendance reports resolve freshness from the same opportunity, submission, note and task timestamps as Pipeline using paginated batches; status filters apply only to detail rows while metrics retain the other report filters, so counts and percentages remain comparable.
- Pipeline and Attendance (including print output) share the card-freshness classifier; keep thresholds centralized so badges, counts and filters agree.
- Report print portals use `usePrintDocumentTitle` to set the browser print-job title and restore the page title on afterprint or unmount, keeping filename handling consistent without changing route metadata.
