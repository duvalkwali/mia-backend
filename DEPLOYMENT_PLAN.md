# MIA — Deployment Plan

Target: take the current prototype (per the backend and frontend audit reports of 2026-07-04) to a publicly deployed, WhatsApp-connected pilot, following the architecture in `MIA_TECHNICAL_SPEC.md`.

Path conventions in this document:
- `BE:` = `mia-backend/` (the nested repo root, e.g. `BE: src/app.ts`)
- `FE:` = `frontend/`
- Audit finding IDs (backend A1, frontend C1, etc.) refer to the two audit reports.

**Rule for the whole plan:** each phase has a verification gate. Do not start phase N+1 until phase N's gate passes.

---

## Phase –1 — Prerequisite: version control (30 min)

The backend repo has ~2 months of uncommitted work (last commit 2026-04-29) and **`frontend/` is not in git at all**. Phases 0–3 rewrite contracts on both sides; doing that without history or rollback is reckless, and Phase 4 deploys from a repo.

| Step | What | Files touched | Needs from you | Verify |
|---|---|---|---|---|
| –1.1 | Commit current backend state as the pre-refactor baseline | `BE:` everything modified (17 files per `git status`) | Nothing | `git status` clean; `git log` shows baseline commit |
| –1.2 | Remove `dump.rdb` from git tracking (backend D: tracked Redis dump, possible PII), add `*.rdb` to `.gitignore` | `BE: .gitignore`, `git rm --cached dump.rdb` | Nothing | `git ls-files \| grep rdb` returns nothing |
| –1.3 | Put `frontend/` under version control — either `git init` in `frontend/` or (recommended) restructure to a single repo containing both | `FE:` all; possibly move directories | **Decision: monorepo vs two repos** (recommend monorepo — one compose file, one deploy unit) | Both codebases have a commit history |

---

## Phase 0 — Contract fixes (joint changes; fixing one side alone reintroduces the bug)

These three items are *pairs* of files that must change in the same commit. Each pair currently ships a bug that survives any one-sided fix.

### 0.1 Business profile / pricing contract (backend C4 + frontend A1)

**The decision to make first (needs you):** how pricing is stored. Recommendation: keep `Business.pricingRanges` as Json but define its shape as `{ text: string }` (free text, matching the frontend's textarea and how the prompt consumes it via `JSON.stringify`). The structured `{min,max,currency}` shape is used nowhere meaningfully today.

**Changes that ship together as one unit:**

| Side | File | Change |
|---|---|---|
| BE | `src/modules/business/business.controller.ts` (`updateProfile`, lines 165–180) | Stop hardcoding `pricingRanges`/`primaryGoals`/`allowedClaims`. Map `pricing` → `pricingRanges: { text }`; only overwrite fields actually present in the request |
| BE | `src/modules/business/business.types.ts` | Add a Zod schema for the profile PUT (currently unvalidated) |
| FE | `app/dashboard/profile/page.tsx` (load: lines 58–63; save: line 79) | Read `pricingRanges.text` and `constraints.targetAudience` from the GET response (the fields it reads today — `pricing`, `targetAudience` — do not exist); send the agreed shape on save |

**Depends on:** nothing external.
**Verify:** round-trip test — set pricing text in the dashboard, save, hard-reload: text reappears. Then check DB (`psql`/Prisma Studio): `pricingRanges` contains the text, `primaryGoals` unchanged from before the save. Finally run one playground reply asking about price and confirm the prompt no longer contains `{"min":0,"max":0}` (log `promptBuilder` output or inspect via LOG_LEVEL=debug).

### 0.2 Style wizard contract (frontend A2 + backend style mapping)

**Decision:** make the frontend speak the backend's canonical enums instead of maintaining a lossy translation layer.

**Changes that ship together as one unit:**

| Side | File | Change |
|---|---|---|
| FE | `app/dashboard/style/page.tsx` | `TONE_OPTIONS` values → `FRIENDLY/PROFESSIONAL/PLAYFUL/PREMIUM`; `EMOJI_OPTIONS` values → `NONE/LIGHT/FREQUENT`; on load, populate `targetAudience` from `data.conversationGoal` (currently reads a nonexistent `data.targetAudience`); formality scale aligned (see decision below) |
| BE | `src/modules/style/style.controller.ts` (lines 43–57) | Keep the legacy value maps for backward compatibility, but **stop defaulting on empty**: if `tone`/`emojiUsage`/`targetAudience` are absent or empty, leave the stored value untouched instead of resetting to `FRIENDLY`/`NONE`/`build_rapport` |
| BE | `src/modules/style/style.types.ts` (`UpdateStyleProfileSchema`) | Make `tone`/`emojiUsage` optional-but-validated enums rather than bare `z.string()` |

**Sub-decision (needs you):** formality is 1–5 in the wizard, 1–10 in the schema comment. Recommend standardizing on 1–5 everywhere (change the schema comment + Zod max), since all existing data came from the wizard.
**Depends on:** nothing external.
**Verify:** create a style profile, reload the wizard — every previously chosen option renders selected. Change *only* the tone and save; confirm in DB that `emojiUsage` and `conversationGoal` kept their old values.

### 0.3 Tenant identity: webhook routing + outbound credentials (backend A1 + A2)

Both fixes hang off the same `Tenant` schema change — do them as one migration + one commit.

**Changes that ship together as one unit:**

| Side | File | Change |
|---|---|---|
| BE | `prisma/schema.prisma` (`Tenant`, lines 13–29) | Add `whatsappPhoneNumberId String? @unique`, `whatsappAccessToken String?` (spec: "OAuth tokens (encrypted)" — for the pilot, store as-is and note encryption as Phase-post-launch debt, or encrypt with a `TOKEN_ENCRYPTION_KEY` env var now — **your call**) |
| BE | new migration via `prisma migrate dev` | Generated |
| BE | `src/modules/webhooks/whatsapp.controller.ts` (`getTenantIdFromPhone`, lines 167–191) | Look up `prisma.tenant.findUnique({ where: { whatsappPhoneNumberId } })` using the `phone_number_id` already extracted at line 173; delete the `findFirst` placeholder |
| BE | `src/modules/webhooks/whatsapp.service.ts` (`sendMessage`, lines 104–127) | Accept tenant context; resolve `phoneNumberId` + access token from the tenant record, falling back to the `WHATSAPP_*` env vars when the tenant has none (keeps the single-tenant pilot working before onboarding UI exists) |
| BE | `src/modules/ai-reply/reply.service.ts` (`approveReply`, line 345) | Pass `ctx` through to `sendMessage` |
| BE | `.env.example` | Document the fallback `WHATSAPP_*` vars (see Phase 2 table) |

**Depends on:** running local Postgres + `DATABASE_URL` (already in your `.env`) for the migration. No external accounts yet — the actual `phone_number_id` value gets seeded in Phase 6.
**Verify:** unit-level — POST two fake webhook payloads with different `metadata.phone_number_id` values against two seeded tenants (script or curl); confirm each creates its Contact under the correct tenant (check `contacts.tenantId` in DB) and that an unknown `phone_number_id` is acked with 200 and logged, creating nothing.

---

## Phase 1 — Stop the failure-masking (before any pilot user, even internal)

All frontend, no backend changes, no external dependencies.

| Step | Finding | Files touched | Change | Verify |
|---|---|---|---|---|
| 1.1 | FE A3 | `app/dashboard/profile/page.tsx` (lines 81–83, 98–102, 122), `app/dashboard/style/page.tsx` (265–266) | Every mutation `catch` → `toast.error` with the real message; delete all "(demo mode)" success toasts; FAQ delete stops swallowing (`.catch(() => {})`) and stops removing the row optimistically on failure | Stop the backend, attempt each save/add/delete → red error toast, no fake row, no success message |
| 1.2 | FE C1 | `app/dashboard/page.tsx` (39–42), `app/dashboard/replies/page.tsx` (77–131), `app/dashboard/signals/page.tsx` (69–125) | Delete all fabricated-data fallbacks; render an error state (retry button) on fetch failure | Stop the backend, load each page → visible error state, zero fake contacts/replies/stats |
| 1.3 | FE B4 | `app/page.tsx` (38–45) | Remove the "Try Demo" button (it mints the fake token that triggers every C1 path). If a demo is wanted later, seed a real demo tenant via `prisma/seed.ts` — separate task, not this step | Landing page has no demo button; `localStorage` never contains `demo-token-xxxx` |
| 1.4 | FE C4 | `app/dashboard/page.tsx` (160–165), `lib/api.ts` | Status pills call the real backend `GET /health` (note: it is *outside* `/api/v1`, so either add a `healthUrl` derived from the API base, or add `/api/v1/health` on the backend — recommend deriving, zero backend change); pills show real up/down. Remove the hardcoded `done` on setup step 1 (135–139) or derive it from `getProfile()` | With backend up: pills green. Kill backend: pills red after refresh |

Also fold into 1.2 (same files, same commit): fix the signals badge maps (FE C3) to the real enums (`LEAD/INTERESTED/NEGOTIATING/CLOSED/CHURNED`, add `HESITANT`, drop `CRITICAL`), since deleting the demo data removes the only data the current maps ever matched.

**Phase gate:** with the backend intentionally stopped, no page anywhere shows data or a success message.

---

## Phase 2 — Security blockers (before any public URL exists)

All backend. No external accounts needed; you supply env values locally.

### 2.1 Webhook signature verification actually rejects (BE B2 + B3)

**Files:** `src/app.ts` (line 53), `src/modules/webhooks/whatsapp.controller.ts` (lines 72–86), `src/shared/types/crypto.ts` (lines 13–16).

- `app.ts`: capture the raw body — `express.json({ verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } })`. Without this, correct verification is impossible (today it compares against re-serialized JSON).
- `crypto.ts`: length-check before `timingSafeEqual` (a malformed attacker header currently throws `RangeError`); return `false` instead of throwing.
- `whatsapp.controller.ts`: when `NODE_ENV=production`, respond **401 and stop** on missing or invalid signature. Keep warn-and-continue only for development.

**Needs from you:** a chosen `WHATSAPP_WEBHOOK_SECRET` value (this is the Meta App Secret — real value arrives in Phase 6; any placeholder works for testing the rejection logic).
**Verify:** three curls against local server with `NODE_ENV=production`: (a) no signature header → 401; (b) garbage/short signature → 401, **no crash, no silent 200**; (c) correct HMAC of the exact raw body (compute with `openssl dgst -sha256 -hmac`) → 200 and processing proceeds.

### 2.2 Redis failure must not kill or silently lobotomize the process (BE B4 + C1)

**Files:** `src/config/redis.ts` (line 26), `src/modules/webhooks/whatsapp.controller.ts` (dedup block, lines 90–104).

- `redis.ts`: `redisClient.connect().catch(err => logger.error(...))` — the unhandled `AggregateError` crash was verified empirically in the audit.
- Webhook dedup: wrap the `SET NX` in its own try/catch (or check `redisClient.isOpen`); on Redis failure, **process the message without dedup** and log loudly, instead of the current path where the outer catch acks 200 and drops the message.

**Needs from you:** nothing.
**Verify:** start the app with Redis stopped → process stays alive past 10s (`/health` responds), a webhook POST still generates a reply (check logs + `generated_replies` table). Start Redis mid-run → dedup resumes (send same `wamid` twice, second is skipped).

### 2.3 Env validation at startup (BE B5 + B6)

**Files:** `src/config/env.ts`, `src/modules/auth/auth.services.ts` (lines 29–32, 175), `src/modules/webhooks/whatsapp.controller.ts` / `whatsapp.service.ts` (switch from raw `process.env.*` to `env.*`), `BE: .env.example`.

- Add to `env.ts`: `jwt: { secret: requireEnv('JWT_SECRET'), expiry }` (and actually *use* `expiry` in `generateToken` — currently hardcoded `'7d'`, BE C6/C4); `whatsapp: { verifyToken, webhookSecret, accessToken, phoneNumberId, apiUrl }` — required in production, optional in dev. Refuse to boot in production if `JWT_SECRET` is missing or equals `change-me`.
- `.env.example`: add every var the audit found missing: `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_URL`, `ALLOWED_ORIGINS`, `API_VERSION`, `LOG_LEVEL`, `OLLAMA_TIMEOUT_MS`, `OLLAMA_KEEP_ALIVE`, `FAQ_EMBEDDING_ENABLED`, `FAQ_EMBEDDING_THRESHOLD`, `MAX_EPHEMERAL_TURNS`, `EPHEMERAL_CONTEXT_TTL`, `PROMPT_CACHE_TTL`.

**Needs from you:** final values for `JWT_SECRET` (generate: `openssl rand -hex 32`) and `WHATSAPP_VERIFY_TOKEN` (any random string — you'll paste the same value into Meta's dashboard in Phase 6).
**Verify:** boot with `JWT_SECRET` unset and `NODE_ENV=production` → immediate exit with a clear message naming the variable. Boot with all vars → clean start. `diff` the var list in `.env.example` against `grep -r "process.env" src/` → no undocumented vars remain.

### 2.4 (Recommended addition, spec bug 6) Webhook rate limiting

The user-supplied phase list omits this, but the spec's bug table requires it and it belongs with the other pre-public-URL work. **Files:** `BE: package.json` (add `express-rate-limit`), `src/app.ts` (mount at 60 req/min on `/api/:v/webhooks/whatsapp`), plus `app.set('trust proxy', 1)` so `req.ip` is real behind nginx (Phase 4). Skip if you want to defer — flag your choice.
**Verify:** 100 rapid curls → 429s after 60.

**Phase gate:** all 2.x verifications pass locally with `NODE_ENV=production`.

---

## Phase 3 — Make it startable on a real host

### 3.1 Backend production start (BE B1)

**Files:** `BE: package.json` (scripts, deps), `BE: tsconfig.json`, delete or update `BE: railway.json` (target is now your VPS; keep only if you also deploy on Railway).

- `build`: `prisma generate && tsc && tsc-alias` (add `tsc-alias` as devDependency — `tsc` alone does not rewrite `@/*` imports, so the current `dist/` output cannot run at all).
- `start`: `node dist/main.js` (with `rootDir: ./src` the output lands at `dist/main.js`; confirm after first build).
- Move `prisma` CLI usage out of `postinstall` (production `npm ci --omit=dev` has no prisma CLI): run `prisma generate` in the Docker build stage instead (Phase 4).

**Needs from you:** nothing.
**Verify:** locally simulate production: `npm run build`, then in a scratch dir `npm ci --omit=dev` against the built artifacts (or in the Phase-4 container) and `node dist/main.js` → server boots, `/health` responds, one authenticated API call works. This exact test is what currently fails.

### 3.2 Frontend API URL via build-time env (FE B1) — paired with backend `ALLOWED_ORIGINS`

**Files:** `FE: lib/api.ts` (line 1), new `FE: .env.example`, backend `.env`/compose env (Phase 4).

- Keep `process.env.NEXT_PUBLIC_API_URL` but **fail the build if unset in production** (throw in `api.ts` when `!API_BASE`, or drop the localhost fallback entirely) so a misconfigured build cannot silently ship pointing at `localhost`.
- Create committed `FE: .env.example` documenting `NEXT_PUBLIC_API_URL=https://api.<your-domain>/api/v1`.
- Record the pairing: backend `ALLOWED_ORIGINS` must contain the frontend's public origin — both values get set for real in Phase 4.

**Needs from you:** your **domain name** (needed to fix both values; blocking for Phase 4's HTTPS as well).
**Verify:** `NEXT_PUBLIC_API_URL=https://example.test/api/v1 npx next build`, then `grep -r "localhost:3000" .next/` (or the export output) → zero hits in client bundles.

### 3.3 Frontend build target (FE B2) — decision + config

**Decision (needs you):** static export vs Node runtime. **Recommendation: static export** (`output: 'export'` in `next.config.mjs`) — every page is a client component, there's no server data fetching, and it removes an entire Node process from the VPS (nginx serves `out/` directly). Choose Node runtime only if you expect to need SSR/middleware soon.

**Files:** `FE: next.config.mjs`.
**Verify:** `next build` produces `out/`; `npx serve out` locally → login page loads, client-side routing to `/dashboard` works on hard refresh (if hard-refresh 404s on subroutes, add nginx `try_files` fallback in Phase 4 — note it now).

### 3.4 Remove TS error-masking (FE B3)

**Files:** `FE: next.config.mjs` (delete `typescript.ignoreBuildErrors`), `FE: app/dashboard/signals/page.tsx` (line 68 — the one real TS2352 the flag hides; likely already rewritten by step 1.2, verify).
**Verify:** `npx tsc --noEmit` → zero errors; `next build` succeeds without the flag.

**Phase gate:** backend runs from compiled JS with prod-only deps; frontend builds with a real API URL and no masked errors.

---

## Phase 4 — Containerize and deploy

**Blocking inputs from you before this phase starts:** VPS/Oracle instance SSH access, the domain name with DNS A-records you control (e.g. `app.<domain>` → VPS, `api.<domain>` → VPS), and a decision on where Postgres data lives (compose volume on the VPS is fine for pilot).

**Note if the VPS is Oracle Ampere (ARM):** all planned images (node, postgres, redis, nginx) have arm64 builds — but build the images on the VPS or with `--platform linux/arm64`, not on your x86 machine, or pulls will fail at runtime.

| Step | What | Files touched (all new) | Needs from you | Verify |
|---|---|---|---|---|
| 4.1 | Backend Dockerfile: multi-stage — build stage runs `npm ci` + `prisma generate` + `npm run build`; runtime stage copies `dist/`, `node_modules` pruned to prod, `prisma/` for migrations | `BE: Dockerfile`, `BE: .dockerignore` | Nothing | `docker build` succeeds; `docker run -e ... /health` responds |
| 4.2 | Frontend build per 3.3: static → build in CI/locally into `out/`, served by the nginx container (no FE container); Node runtime → own Dockerfile | `FE: Dockerfile` *or* nginx config mount | `NEXT_PUBLIC_API_URL` final value | Container/nginx serves the login page |
| 4.3 | `docker-compose.yml`: services `api`, `postgres:16` (volume), `redis:7` (volume + `appendonly yes` — replaces the loose `dump.rdb` workflow), `nginx`. Compose-level `env_file` for all Phase-2 vars. Migrations run as a one-shot command (`npx prisma migrate deploy`) — not on API boot | root: `docker-compose.yml`, `deploy/nginx.conf`, `.env.production` (never committed) | All final env values (see Phase 2/3 lists) | `docker compose up -d` on your machine first: full local stack works end-to-end (login → profile save → playground reply with local Ollama reachable via `host.docker.internal` or skipped) |
| 4.4 | Deploy: clone repo on VPS, copy `.env.production` over SSH (never through git), `docker compose up -d`, run migrate one-shot | — | **VPS SSH login** | `curl http://<vps-ip>/health` from your machine |
| 4.5 | HTTPS: certbot (webroot or dockerized certbot) for `app.` and `api.` subdomains; nginx redirects 80→443; set final `ALLOWED_ORIGINS=https://app.<domain>` and rebuild FE with `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1` | `deploy/nginx.conf` | **Domain + DNS already pointing at VPS** (Let's Encrypt validates over the public internet) | `curl https://api.<domain>/health` → 200 with valid cert (`curl -v` shows issuer); browser loads `https://app.<domain>` with no mixed-content warnings |
| 4.6 | End-to-end public check | — | A second device/network (phone on cellular) | From the phone: register a fresh account, save a business profile, reload, data persists. CORS: browser console shows zero CORS errors |

**Phase gate:** 4.6 passes from a network that is not your dev machine. **Note:** the AI reply path is *expected to fail* at this gate (no Ollama on the VPS yet) — but it must fail with a visible error (Phase 1 guarantee), not fake data. That failure is Phase 5's job.

---

## Phase 5 — Cloud GPU cutover

### 5.1 Audit-informed reality check on "one env var change"

The spec claims pointing `OLLAMA_BASE_URL` at a cloud GPU is a one-line change. From the audited code, that is **almost** true — `env.ollama.baseUrl` is the single source consumed by `src/config/openai.ts` — with three real caveats:

1. **Auth:** `src/config/openai.ts:17` hardcodes `apiKey: 'ollama'`. A RunPod endpoint exposed to the internet must be protected (RunPod proxy auth or a bearer token in front of Ollama). That requires a small code change: read `OLLAMA_API_KEY ?? 'ollama'` from env. **Files:** `BE: src/config/env.ts`, `src/config/openai.ts`, `.env.example`. This is the one code change in this phase — everything else is env/ops.
2. **Models must be pulled on the pod:** `llama3.2` *and* `nomic-embed-text` (the embedding model is easy to forget; `embedding.service.ts` needs it if you ever enable `FAQ_EMBEDDING_ENABLED`).
3. **Timeout/keep-alive tuning:** with a GPU, drop `OLLAMA_TIMEOUT_MS` from 120000 to ~30000 so failures surface fast; set `OLLAMA_KEEP_ALIVE=24h` (the code only sends `keep_alive` when the value differs from `'5m'`, so setting it activates the code path).

**Needs from you:** RunPod (or Lambda) account + credit; the pod's endpoint URL and auth token.

### 5.2 Cutover and test

**Files:** `.env.production` on the VPS only (plus the 5.1 code change, one commit).
**Verify:** from the deployed dashboard's playground, run an extract-signal + generate-reply round trip; reply arrives in < ~5 s (vs 30–120 s CPU). Then `docker compose logs api` — confirm the call went to the RunPod host, not localhost. Negative test: stop the pod → playground shows a clear AI_ERROR toast (Phase 1 guarantee), API stays healthy.

**Phase gate:** deployed app generates real replies from the cloud GPU, and GPU downtime degrades gracefully.

---

## Phase 6 — WhatsApp connection

**Blocking inputs from you:** Meta developer app with WhatsApp product enabled; the **test number's `phone_number_id`**, a **permanent access token** (system user token, not the 24-h temporary one), and the **App Secret** (this is `WHATSAPP_WEBHOOK_SECRET`).

| Step | What | Files touched | Needs from you | Verify |
|---|---|---|---|---|
| 6.1 | Seed tenant identity: set your pilot tenant's `whatsappPhoneNumberId` (+ per-tenant token, or rely on env fallback from 0.3) | DB row update (Prisma Studio / SQL — no code) | `phone_number_id`, access token | `SELECT whatsappPhoneNumberId FROM tenants` shows the real ID |
| 6.2 | Set `WHATSAPP_*` env vars on the VPS, restart api | `.env.production` on VPS | All four Meta values + your `WHATSAPP_VERIFY_TOKEN` | Boot log shows env validation passing |
| 6.3 | Configure the webhook in Meta's dashboard: callback `https://api.<domain>/api/v1/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages` field | Meta dashboard (no code) | Meta app admin access | Meta shows the webhook as Verified (this exercises the GET challenge path, which 403s if the token mismatches) |
| 6.4 | Signature verification against real traffic: send one WhatsApp message to the test number | — | A phone with WhatsApp | `docker compose logs api`: signature validated (not warned), tenant resolved to the *correct* tenant id, wamid dedup key set |
| 6.5 | Full loop, approval mode (auto-reply OFF) | — | Same phone | Message → draft appears in deployed dashboard within seconds → Approve → **reply arrives on the phone** → reply row shows status SENT (not `sendError`) |
| 6.6 | Full loop, auto-reply mode | Dashboard toggle only | Same phone | Message → reply arrives with no dashboard interaction; duplicate-delivery test: no double replies (dedup) |
| 6.7 | Negative tests | — | — | Message from a number while its `phone_number_id` matches no tenant → acked 200, logged, nothing created. Forged webhook POST (no valid signature) from curl → 401 |

**Phase gate / definition of done:** 6.5, 6.6, and 6.7 all pass against the public HTTPS endpoint.

---

## Consolidated "needs from you" checklist (provision in this order)

| Item | Needed by | Notes |
|---|---|---|
| Monorepo vs two-repo decision | Phase –1 | Recommend monorepo |
| Pricing storage shape sign-off | Phase 0.1 | Recommend `pricingRanges: { text }` |
| Formality scale (1–5 vs 1–10) | Phase 0.2 | Recommend 1–5 |
| Token-encryption now vs later | Phase 0.3 | Pilot can defer, note as debt |
| `JWT_SECRET`, `WHATSAPP_VERIFY_TOKEN` values | Phase 2 | Generate once, store in password manager |
| Rate-limiting: include or defer | Phase 2.4 | Recommend include |
| **Domain name + DNS control** | Phase 3.2 / hard-blocks 4.5 | Longest lead time — buy early |
| Static export vs Node runtime | Phase 3.3 | Recommend static |
| **VPS/Oracle SSH access** | Phase 4.4 | Note ARM caveat if Ampere |
| **RunPod account + credit** | Phase 5 | ~$0.2–0.5/hr A10G-class for pilot |
| **Meta app: phone_number_id, permanent token, App Secret** | Phase 6 | Permanent (system-user) token, not the 24-h one |

## Explicitly deferred (from the audits, not blocking deployment)

- BE C2 (conversation-context DB fallback on Redis cache miss — spec bug 5), BE C3 (auth Zod wiring), BE C8 (replies/generate contract), FE C2 ("Save & Approve" doesn't send), FE C5 (`businessName` missing from auth response), backend/frontend D cleanup lists (dead `src/shared/ai/`, unused deps, duplicate hooks, ~45 unused UI components). Schedule as a cleanup pass after Phase 6, before onboarding a second tenant.
- BullMQ job queue (spec Phase 1 architecture): the current fire-and-forget with immediate 200 satisfies the pilot; queue work starts after this plan completes.
