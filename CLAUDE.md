# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Start dev server with nodemon (hot-reload)
npm run build         # prisma generate + tsc
npm start             # Run compiled server
npm run prisma:migrate  # Apply DB migrations (interactive)
npm run prisma:generate # Regenerate Prisma client after schema changes
```

No test suite is configured. `npm test` will fail. Manual test scripts live in `scripts/` and run via:
```bash
npx ts-node -r tsconfig-paths/register scripts/<file>.ts
```

## Path Alias

`@/*` maps to `src/*`. Always use this alias for imports across module boundaries rather than relative `../../../` chains.

## Architecture

**Repo root is `mia-backend/mia-backend/`** (nested — the outer `mia-backend/` is just a wrapper).

### Request lifecycle

```
HTTP → app.ts (cors/json/logger middleware)
     → requireAuth middleware (JWT → req.tenantContext)
     → *.routes.ts (Zod validation)
     → *.controller.ts (thin — extracts params, calls service)
     → *.service.ts (business logic, Prisma, AI calls)
```

Every authenticated route gets a `TenantContext` injected via `req.tenantContext`:
```typescript
{ tenantId: string, userId: string, role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'SYSTEM' }
```

All DB queries **must** scope to `tenantId`. This is the multi-tenancy boundary — it is never enforced by the DB, only by the application layer.

### AI pipeline

1. **Signal extraction** (`src/modules/signals/extractors/`): Hybrid — rules-based first (free, ~70% coverage); falls back to Ollama when confidence < 0.7. Threshold is `CONFIDENCE_THRESHOLD = 0.7` in `signals.service.ts`.

2. **Reply generation** (`src/modules/ai-reply/reply.service.ts`): Builds a prompt from business profile + FAQ embeddings + conversation history + style profile, calls Ollama, stores result as `GeneratedReply` with status `PENDING`.

3. **Auto-reply** (`Business.autoReplyEnabled`): When true, the webhook handler calls `approveReply` immediately after generation — replies go straight to `SENT`, bypassing the dashboard queue.

### AI client

Despite being named `src/config/openai.ts`, this exports an Ollama client (OpenAI-compatible SDK pointed at `http://localhost:11434/v1`). Switching to real OpenAI requires only changing `OLLAMA_BASE_URL` and the API key. Import as:
```typescript
import ollamaClient, { AI_MODELS, calculateCost } from '@/config/openai';
```
`calculateCost` always returns 0 (local inference has no per-token cost).

### FAQ embeddings

`src/modules/business/embedding.service.ts` uses `nomic-embed-text` via Ollama. Embeddings are stored as `Float[]` on the `FAQ` model and computed lazily (`isEmbedded` flag). Similarity search is an in-memory cosine scan — acceptable up to ~50 FAQs; pgvector is the planned upgrade path.

### Webhook flow

`src/modules/webhooks/whatsapp.controller.ts`:
1. Verifies HMAC signature (logs warning if missing, does not reject — dev-friendly)
2. Deduplicates via Redis key `wamid:<id>` with 24h TTL (SET NX)
3. Routes to first non-SUSPENDED tenant with a business profile (MVP placeholder — not multi-tenant-safe)
4. Responds `200` immediately, processes fire-and-forget

### Redis usage

`src/config/redis.ts` exports a `redis` v4 client. Used for:
- Conversation context TTL cache (30-min TTL, key pattern: consult usage in `reply.service.ts`)
- Webhook deduplication (key pattern: `wamid:<id>`, 24h TTL)

Redis failure is non-fatal — the app starts and logs a warning if Redis is unreachable after 5 retries.

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (defaults to `redis://localhost:6379`) |
| `JWT_SECRET` | Token signing key |
| `OLLAMA_BASE_URL` | Ollama API base (default `http://localhost:11434/v1`) |
| `OLLAMA_DEFAULT_MODEL` | Chat model (default `llama3.2`) |
| `OLLAMA_EMBEDDING_MODEL` | Embedding model (default `nomic-embed-text`) |
| `OLLAMA_KEEP_ALIVE` | How long model stays loaded in VRAM (set `24h` to avoid cold starts) |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook verification token |
| `WHATSAPP_WEBHOOK_SECRET` | HMAC secret for signature verification |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID for outbound sends |
| `WHATSAPP_ACCESS_TOKEN` | Meta permanent system user token |

## Prisma

After any change to `prisma/schema.prisma`, run `npm run prisma:generate` before restarting the dev server. The `@prisma/adapter-pg` is in use (not the default adapter), so the client instantiation in `src/config/database.ts` differs from standard Prisma examples.

Enums in the schema (`Intent`, `Sentiment`, `Urgency`, `FunnelStage`, `Tone`, etc.) are imported from `@prisma/client` directly — do not redefine them as TypeScript enums.

## Module Conventions

Each module follows this file pattern:
- `*.routes.ts` — Express Router, Zod validation via `req.body` parse
- `*.controller.ts` — Extracts validated input, calls service, formats response
- `*.service.ts` — All business logic; returns plain objects, never `res`/`req`
- `*.types.ts` — Zod schemas + inferred TypeScript types

Errors are thrown as `new AppError(httpStatus, 'ERROR_CODE', 'message')` and caught by the centralized handler in `src/middleware/errorHandler.ts`.
