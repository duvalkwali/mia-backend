# MIA — Technical Spec (Prototype → Production)

## What MIA Is

Multi-tenant SaaS that drafts, approves, and sends customer replies across WhatsApp, Instagram, and Facebook. The AI (Llama via Ollama) runs on MIA's own cloud GPU — zero per-message cost. Business owners interact through a mobile app; no server setup required.

**Stack:** Express 5 + TypeScript, Prisma 7 + PostgreSQL, Redis, Ollama (llama3.2 + nomic-embed-text), Next.js dashboard, Meta Cloud API (direct).

---

## Prototype (V0) — Current State

**Working:** WhatsApp receive/reply, signal extraction (rules-based ~70% + AI fallback), reply approval queue, auto-reply mode, FAQ semantic search, style learning, multi-tenant JWT auth, Next.js browser dashboard.

**Not built yet:** Instagram DM, Facebook Messenger, mobile app, async job queue, billing system.

**Deployment today:** Self-hosted — owner installs Node, PostgreSQL, Redis, Ollama, pulls models manually. Acceptable as proof of concept only.

---

## Critical Bugs (must fix before second user)

| Priority | Bug | Fix |
|---|---|---|
| CRITICAL | All webhooks route to first tenant in DB regardless of phone number | Add `whatsappPhoneNumberId` to Tenant model; look up tenant by ID from webhook payload |
| HIGH | No deduplication — duplicate webhooks send duplicate replies | Redis SETNX on `wamid`; skip if already seen |
| HIGH | Webhook holds HTTP connection open for 7–20s during AI inference | BullMQ job queue — return 200 immediately, process async |
| HIGH | Raw customer message injected into LLM prompt (prompt injection risk) | Wrap in XML delimiters, cap at 1,000 chars |
| MEDIUM | Conversation context lost on Redis restart | Fall back to last 10 rows from `GeneratedReply` table on cache miss |
| MEDIUM | No rate limiting on public webhook endpoint | `express-rate-limit` at 60 req/min on webhook route |
| LOW | Dead code in `src/shared/ai/` (3 unused files) | Delete them |

---

## Final Version — What Changes

### AI layer
Ollama moves from the owner's machine to a cloud GPU server (RunPod / Lambda Labs). One env var change — no code changes. Shared across all tenants.

| Tenants | GPU needed | Est. cost/month |
|---|---|---|
| 1–20 | A10G (24GB) | $150–300 |
| 20–100 | 2× A10G | $500–900 |
| 100–500 | A100 80GB | $1,500–3,000 |

Latency drops from 7–20s (CPU) to 1–3s (GPU) automatically.

Model upgrade path: llama3.2 3B now → llama3.2 8B at launch → Llama 3.3 70B at scale → per-tenant LoRA adapters for maximum personalization.

### Architecture (final)
```
Customer message → Meta/Platform API → MIA API Gateway (returns 200 immediately)
  → BullMQ job queue → Signal Extraction Worker → AI Inference Worker (cloud GPU)
  → auto-reply: send immediately | approval mode: push notification to mobile app
  → Owner approves in app → reply sent
```

### Mobile app (React Native + Expo — iOS + Android)
- **Inbox:** swipe right to approve, swipe left to reject, tap to edit
- **Push notifications:** new message arrives → notification within 5s → tap opens reply
- **Onboarding:** OAuth connect WhatsApp/Instagram/Facebook (no manual webhook config), style wizard, FAQ setup
- **Settings:** business profile, FAQs, auto-reply toggles per platform, billing
- **Analytics (paid tiers):** edit rate by signal type, response times, message volume

---

## Feature Roadmap

### Phase 0 — Bug fixes (2–3 weeks)
Fix all 7 bugs above. Deliverable: backend safe for multiple tenants.

### Phase 1 — Platform + cloud GPU (4–6 weeks)
- Provision cloud GPU; point `OLLAMA_BASE_URL` to it
- Instagram DM + Facebook Messenger (receive + reply)
- Unified inbox (single message table with `platform` field)
- OAuth platform connection (replaces manual webhook config)
- Stripe billing (Starter $49 / Growth $99 / Business $199, 14-day free trial)

### Phase 2 — Mobile app (6–10 weeks, overlaps Phase 1)
React Native + Expo, Firebase push notifications, App Store + Google Play submission.

### Phase 3 — Quality + analytics (post-launch)
- Analytics dashboard (edit rate, response time, signal breakdown)
- Google Sheets integration (export contacts + summaries)
- Upgrade to Llama 3.3 70B
- pgvector ANN index for FAQ search
- LoRA fine-tuning pipeline (style data → per-tenant adapter)
- Media handling (image description for context)

### Phase 4 — Outbound + team (6+ months post-launch)
Broadcast campaigns, lead pipeline, automated follow-ups, multi-user access, Slack, Twitter/X.

---

## Key Data Model Additions

- `Tenant`: add `whatsappPhoneNumberId`, `instagramAccountId`, `facebookPageId`, OAuth tokens (encrypted), `stripeCustomerId`, `planTier`
- `IncomingMessage`: add `platform` enum field, `platformMsgId` unique (deduplication)
- New: `PushToken` (FCM device tokens), `UsageEvent` (billing metering)

## Infrastructure (V1 launch)
API server + BullMQ worker + PostgreSQL + Redis on Hetzner/DigitalOcean. GPU server separate on RunPod/Lambda Labs. At 50 tenants × $99 = $4,950 MRR vs ~$300 infra = ~94% gross margin.
