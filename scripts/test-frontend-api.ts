/**
 * Manual test script — verifies the backend API endpoints that the frontend uses
 * for the style learning feature (vocabulary setup, edit recording, learned rules).
 *
 * What this tests:
 *   1. Vocabulary phrases saved correctly via upsertStyleProfile
 *      (the PUT /style endpoint the wizard calls on "Save Style")
 *   2. Loading vocabulary back from the DB
 *      (the GET /style endpoint that pre-fills the wizard on page load)
 *   3. Learning event recording from an edit
 *      (the POST /style/learn endpoint called when the owner edits a reply)
 *   4. Learned rules listing
 *      (the GET /style/learned-rules endpoint that populates "What I've Learned")
 *   5. Learned rule toggle (active/inactive)
 *      (the PATCH /style/learned-rules/:id endpoint called by the Switch toggle)
 *
 * Run with:
 *   npx ts-node -r tsconfig-paths/register scripts/test-frontend-api.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createHash, randomUUID } from 'crypto';
import { StyleService } from '@/modules/style/style.service';
import { TenantContext } from '@/shared/types/common.types';

// ─── Setup ────────────────────────────────────────────────────────────────────

const pool   = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

function heading(title: string) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ─── 1. Vocabulary phrases are saved correctly ────────────────────────────────
// When the owner completes the "Your Vocabulary" and "Words to Avoid" wizard
// steps and clicks "Save Style", the PUT /style endpoint calls upsertStyleProfile.
// We verify that the vocabularyPreferences JSON field is populated correctly.

async function testVocabularySave() {
  heading('1. Vocabulary phrases saved via upsertStyleProfile');

  const profile = await prisma.styleProfile.findFirst();
  if (!profile) {
    console.log('  ⚠  No style profile in DB — skipping. Run POST /api/v1/style/onboard first.');
    return;
  }

  const ctx: TenantContext = { tenantId: profile.tenantId, userId: 'test', role: 'OWNER' };
  const service = new StyleService();

  const testPhrases = [
    { id: 'test-id-1', text: 'ça roule', context: 'casual confirmation when tone is warm', avoidIn: 'first contact with new customers' },
    { id: 'test-id-2', text: "on s'arrange", context: 'pricing flexibility discussions' },
  ];
  const testAvoid = ['just wanted to', 'actually'];

  // Save style with vocabulary
  await service.upsertStyleProfile(ctx, {
    tone:             'FRIENDLY',
    emojiUsage:       'LIGHT',
    formality:        3,
    signaturePhrases: profile.signaturePhrases,
    conversationGoal: profile.conversationGoal,
    vocabularyPhrases: testPhrases,
    avoidPhrases:      testAvoid,
  });

  // Read back from DB — verify the JSON shape matches what the frontend expects
  const updated = await prisma.styleProfile.findUnique({ where: { tenantId: ctx.tenantId } });
  const vocab = updated?.vocabularyPreferences as any;

  assert(vocab !== null && vocab !== undefined, 'vocabularyPreferences field is populated');
  assert(Array.isArray(vocab?.phrases), 'phrases is an array');
  assert(vocab?.phrases.length === 2, `2 phrases saved (found ${vocab?.phrases?.length})`);
  assert(vocab?.phrases[0]?.text === 'ça roule', 'First phrase text correct');
  assert(vocab?.phrases[0]?.context === 'casual confirmation when tone is warm', 'First phrase context correct');
  assert(vocab?.phrases[0]?.avoidIn === 'first contact with new customers', 'First phrase avoidIn correct');
  assert(vocab?.phrases[1]?.text === "on s'arrange", 'Second phrase text correct');
  assert(vocab?.phrases[1]?.context === 'pricing flexibility discussions', 'Second phrase context correct');
  assert(vocab?.phrases[1]?.avoidIn === undefined, 'Second phrase avoidIn is undefined (not provided)');
  assert(Array.isArray(vocab?.avoid), 'avoid is an array');
  assert(vocab?.avoid.includes('just wanted to'), '"just wanted to" is in avoid list');
  assert(vocab?.avoid.includes('actually'), '"actually" is in avoid list');

  console.log('  (vocabulary saved — profile not restored, it now has test vocabulary)');
}

// ─── 2. Vocabulary loads back correctly ───────────────────────────────────────
// The GET /style endpoint returns the full StyleProfile row.
// The frontend maps `data.vocabularyPreferences.phrases` and `.avoid` back into
// the wizard form. We verify the structure that getStyleProfile returns.

async function testVocabularyLoad() {
  heading('2. Vocabulary loads back from getStyleProfile');

  const profile = await prisma.styleProfile.findFirst();
  if (!profile) {
    console.log('  ⚠  No style profile — skipping.');
    return;
  }

  const ctx: TenantContext = { tenantId: profile.tenantId, userId: 'test', role: 'OWNER' };
  const service = new StyleService();

  const loaded = await service.getStyleProfile(ctx);
  const vocab  = loaded.vocabularyPreferences as any;

  // The frontend does: (data.vocabularyPreferences as any)?.phrases → VocabPhrase[]
  assert(vocab !== null && vocab !== undefined, 'vocabularyPreferences returned by getStyleProfile');
  assert(Array.isArray(vocab?.phrases), 'phrases array is present');
  assert(Array.isArray(vocab?.avoid), 'avoid array is present');

  // Check that the phrase objects have the shape the frontend expects
  if (vocab?.phrases?.length > 0) {
    const p = vocab.phrases[0];
    assert(typeof p.id === 'string', 'Phrase has id field (string)');
    assert(typeof p.text === 'string', 'Phrase has text field (string)');
    // context and avoidIn are optional — just check they're not unexpected types
    assert(p.context === undefined || typeof p.context === 'string', 'Phrase context is string or undefined');
    assert(p.avoidIn === undefined || typeof p.avoidIn === 'string', 'Phrase avoidIn is string or undefined');
  }
}

// ─── 3. Learning event recording (from reply edit) ────────────────────────────
// When the owner edits a reply in the dashboard, the frontend calls
// POST /style/learn with { eventType: 'EDIT', originalReply, editedReply }.
// We verify that:
//   a) The event row is created in the DB with extractedPatterns
//   b) The patterns reflect the real word-level diff (not empty)

async function testLearningEventFromEdit() {
  heading('3. recordLearningEvent stores word-level diff patterns');

  const profile = await prisma.styleProfile.findFirst();
  if (!profile) {
    console.log('  ⚠  No style profile — skipping.');
    return;
  }

  const ctx: TenantContext = { tenantId: profile.tenantId, userId: 'test', role: 'OWNER' };
  const service = new StyleService();

  // Simulate: AI said something formal, owner edited it to something casual
  const originalReply = "I'd be happy to help you find the right option. Please don't hesitate to reach out.";
  const editedReply   = "Sure thing! Let me point you in the right direction — just let me know.";

  const event = await service.recordLearningEvent(ctx, {
    eventType:     'EDIT',
    replyId:       randomUUID(),   // simulates the GeneratedReply.id the frontend passes
    originalReply,
    editedReply,
  });

  // Read back and inspect patterns
  const stored  = await prisma.styleLearningEvent.findUnique({ where: { id: event.id } });
  const patterns = stored?.extractedPatterns as any;

  assert(stored !== null, 'Learning event row created in DB');
  assert(patterns !== null && patterns !== undefined, 'extractedPatterns is populated');
  assert(typeof patterns?.length_change === 'number', 'length_change is a number');
  assert(Array.isArray(patterns?.added_words) && patterns.added_words.length > 0, 'added_words is non-empty');
  assert(Array.isArray(patterns?.removed_words) && patterns.removed_words.length > 0, 'removed_words is non-empty');
  assert(Array.isArray(patterns?.added_phrases), 'added_phrases is an array');
  assert(Array.isArray(patterns?.removed_phrases), 'removed_phrases is an array');

  // The owner replaced formal words ("happy", "hesitate") with casual ("sure", "let")
  assert(patterns?.removed_words.includes('happy'), '"happy" detected as removed word');
  assert(patterns?.added_words.includes('sure') || patterns?.added_words.includes('thing'),
    'Added casual word ("sure" or "thing") detected');

  // Clean up the test event
  await prisma.styleLearningEvent.delete({ where: { id: event.id } });
  console.log('  (test learning event cleaned up)');
}

// ─── 4. Learned rules listing ─────────────────────────────────────────────────
// The GET /style/learned-rules endpoint populates the "What I've Learned" panel.
// We verify that getLearnedRules returns an array with the correct shape.

async function testLearnedRulesListing() {
  heading('4. getLearnedRules returns structured array');

  const profile = await prisma.styleProfile.findFirst();
  if (!profile) {
    console.log('  ⚠  No style profile — skipping.');
    return;
  }

  const ctx: TenantContext = { tenantId: profile.tenantId, userId: 'test', role: 'OWNER' };
  const service = new StyleService();

  const rules = await service.getLearnedRules(ctx);

  assert(Array.isArray(rules), 'getLearnedRules returns an array');

  if (rules.length > 0) {
    const r = rules[0];
    // Check the shape the frontend LearnedRule type expects:
    // { id, rule, ruleType, confidence, exampleCount, active }
    assert(typeof r.id === 'string', 'Rule has id field');
    assert(typeof r.rule === 'string' && r.rule.length > 0, 'Rule has non-empty rule text');
    assert(typeof r.ruleType === 'string', 'Rule has ruleType field');
    assert(typeof r.confidence === 'number', 'Rule has confidence (number)');
    assert(typeof r.exampleCount === 'number', 'Rule has exampleCount (number)');
    assert(typeof r.active === 'boolean', 'Rule has active (boolean)');
    console.log(`  (found ${rules.length} learned rule(s) — listing first: "${r.rule.slice(0, 60)}...")`);
  } else {
    console.log('  (no learned rules yet — listing test passes with empty array)');
    assert(true, 'Empty array is a valid response when no edits have been made yet');
  }
}

// ─── 5. Learned rule toggle ───────────────────────────────────────────────────
// The PATCH /style/learned-rules/:id endpoint is called by the Switch toggle in
// the "What I've Learned" panel. We verify that toggling active = false then
// back to true works correctly.

async function testLearnedRuleToggle() {
  heading('5. patchLearnedRule toggles active status');

  const profile = await prisma.styleProfile.findFirst();
  if (!profile) {
    console.log('  ⚠  No style profile — skipping.');
    return;
  }

  const ctx: TenantContext = { tenantId: profile.tenantId, userId: 'test', role: 'OWNER' };
  const service = new StyleService();
  const ruleText = '[TEST] Avoid ending with a formal closing — use a direct next step instead';
  const normalized = ruleText.toLowerCase().trim().replace(/\s+/g, ' ');
  const ruleHash   = createHash('md5').update(normalized).digest('hex');

  // Clean up any leftover from a previous run
  await prisma.learnedStyleRule.deleteMany({ where: { styleProfileId: profile.id, ruleHash } });

  // Insert a test rule directly (simulates a rule that was learned from edits)
  const testRule = await prisma.learnedStyleRule.create({
    data: {
      styleProfileId: profile.id,
      ruleType:       'tone',
      rule:           ruleText,
      ruleHash,
      confidence:     0.6,
      exampleCount:   3,
      active:         true,
    },
  });

  // Toggle OFF — simulates owner clicking the switch in the dashboard
  const toggled = await service.patchLearnedRule(ctx, testRule.id, { active: false });
  assert(toggled.active === false, 'Rule toggled to inactive (active: false)');

  // Toggle back ON
  const reactivated = await service.patchLearnedRule(ctx, testRule.id, { active: true });
  assert(reactivated.active === true, 'Rule reactivated (active: true)');

  // Verify DB state matches returned value
  const fromDb = await prisma.learnedStyleRule.findUnique({ where: { id: testRule.id } });
  assert(fromDb?.active === true, 'DB state is active: true after reactivation');

  // Clean up
  await prisma.learnedStyleRule.delete({ where: { id: testRule.id } });
  console.log('  (test rule cleaned up)');
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Frontend API — Style Feature Test Suite            ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    await testVocabularySave();
    await testVocabularyLoad();
    await testLearningEventFromEdit();
    await testLearnedRulesListing();
    await testLearnedRuleToggle();
  } catch (err) {
    console.error('\nUnexpected error during tests:', err);
    failed++;
  }

  console.log(`\n${'─'.repeat(56)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('All tests passed ✓');
  } else {
    console.log(`${failed} test(s) FAILED ✗`);
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run();
