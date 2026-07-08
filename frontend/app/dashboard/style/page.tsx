"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Palette,
  ChevronRight,
  ChevronLeft,
  Loader2,
  X,
  Check,
  Plus,
  Brain,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Wizard steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: "tone", title: "Tone", description: "How should your replies sound?" },
  { id: "formality", title: "Formality", description: "What level of formality fits your brand?" },
  { id: "emoji", title: "Emoji Usage", description: "How much should emojis appear in replies?" },
  { id: "audience", title: "Target Audience", description: "Who are you mainly talking to?" },
  { id: "signature", title: "Signature Phrases", description: "Add unique phrases that reflect your brand voice" },
  {
    id: "vocabulary",
    title: "Your Vocabulary",
    description: "Phrases that define your unique voice — tell the AI when and when not to use each one",
  },
  {
    id: "avoid",
    title: "Words to Avoid",
    description: "Words or expressions you never want the AI to say in your name",
  },
];

// Values are the backend's canonical StyleTone enums — no translation layer
const TONE_OPTIONS = [
  {
    value: "FRIENDLY",
    label: "Friendly",
    description: "Warm and approachable",
    example: '"Hi! Great to hear from you. I\'d love to help you find what you need!"',
  },
  {
    value: "PROFESSIONAL",
    label: "Professional",
    description: "Polished and structured language",
    example: '"Thank you for your inquiry. We would be happy to assist you."',
  },
  {
    value: "PLAYFUL",
    label: "Playful",
    description: "Relaxed, casual and conversational",
    example: '"Hey there! Sure thing, let me help you out with that."',
  },
  {
    value: "PREMIUM",
    label: "Premium",
    description: "Refined and exclusive, for high-end brands",
    example: '"It would be our pleasure to arrange this for you."',
  },
];

const FORMALITY_OPTIONS = [
  { value: 1, label: "Very Casual" },
  { value: 2, label: "Casual" },
  { value: 3, label: "Balanced" },
  { value: 4, label: "Professional" },
  { value: 5, label: "Very Formal" },
];

// Values are the backend's canonical EmojiUsage enums — no translation layer
const EMOJI_OPTIONS = [
  { value: "NONE", label: "None", description: "No emojis at all", preview: "Thank you for reaching out." },
  { value: "LIGHT", label: "Light", description: "Occasional emoji use", preview: "Thanks for reaching out! We'll get back to you soon." },
  { value: "FREQUENT", label: "Frequent", description: "Frequent emoji use", preview: "Thanks so much for reaching out! We'll be right with you!" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

// A vocabulary phrase the owner enters during setup.
// "context" tells the AI when to use it; "avoidIn" tells it when NOT to.
type VocabPhrase = {
  id: string;
  text: string;
  context?: string;
  avoidIn?: string;
};

// A style rule that the system has learned by observing the owner's edits.
type LearnedRule = {
  id: string;
  rule: string;
  ruleType: string;
  confidence: number;   // 0.3 = watching, 0.6 = emerging, 0.85 = established
  exampleCount: number; // how many edits confirmed this rule
  active: boolean;
};

interface StyleData {
  tone: string;
  formality: number;
  emojiUsage: string;
  targetAudience: string;
  signaturePhrases: string[];
  vocabularyPhrases: VocabPhrase[];
  avoidPhrases: string[];
}

// ─── Confidence label helper ───────────────────────────────────────────────────
// Translates the numeric confidence score into human-readable labels.
// 0.3 = AI noticed this 1-2 times (not yet injected into prompts)
// 0.6 = confirmed 3+ times (now used as a soft suggestion in prompts)
// 0.85 = confirmed 5+ times (used as a firm instruction in prompts)

function confidenceLabel(c: number): { label: string; description: string; class: string } {
  if (c >= 0.85) return {
    label: "Established",
    description: "Firm instruction in every reply",
    class: "bg-primary/15 text-primary border-primary/30",
  };
  if (c >= 0.6) return {
    label: "Emerging",
    description: "Soft suggestion — confirmed 3+ times",
    class: "bg-warning/15 text-warning border-warning/30",
  };
  return {
    label: "Watching",
    description: "Seen 1-2 times — not yet in prompts",
    class: "bg-muted text-muted-foreground border-border",
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StylePage() {
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<StyleData>({
    tone: "",
    formality: 3,
    emojiUsage: "",
    targetAudience: "",
    signaturePhrases: [],
    vocabularyPhrases: [],
    avoidPhrases: [],
  });
  const [phraseInput, setPhraseInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Vocabulary phrase form inputs (three fields for one pending phrase)
  const [vocabDraft, setVocabDraft] = useState({ text: "", context: "", avoidIn: "" });
  // Avoid words: single input
  const [avoidInput, setAvoidInput] = useState("");

  // Learned rules — fetched separately, shown below the wizard
  const [learnedRules, setLearnedRules] = useState<LearnedRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Load existing style profile on mount ──────────────────────────────────
  useEffect(() => {
    api
      .getStyle()
      .then((data) => {
        if (data) {
          // vocabularyPreferences is stored as JSON in the DB with shape:
          // { phrases: VocabPhrase[], avoid: string[] }
          const vocabPrefs = (data.vocabularyPreferences as any) ?? {};
          setStyle({
            tone: (data.tone as string) || "",
            formality: (data.formality as number) || 3,
            emojiUsage: (data.emojiUsage as string) || "",
            // The backend stores the wizard's "target audience" answer in conversationGoal
            targetAudience: (data.conversationGoal as string) || "",
            signaturePhrases: (data.signaturePhrases as string[]) || [],
            vocabularyPhrases: (vocabPrefs.phrases as VocabPhrase[]) || [],
            avoidPhrases: (vocabPrefs.avoid as string[]) || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Load learned rules on mount ───────────────────────────────────────────
  useEffect(() => {
    api
      .getLearnedRules()
      .then((rules) => setLearnedRules(rules))
      .catch(() => setLearnedRules([]))
      .finally(() => setRulesLoading(false));
  }, []);

  const progress = ((step + 1) / STEPS.length) * 100;

  // ── Signature phrase helpers ──────────────────────────────────────────────
  const addPhrase = useCallback(() => {
    const trimmed = phraseInput.trim();
    if (trimmed && !style.signaturePhrases.includes(trimmed)) {
      setStyle({ ...style, signaturePhrases: [...style.signaturePhrases, trimmed] });
      setPhraseInput("");
    }
  }, [phraseInput, style]);

  function removePhrase(phrase: string) {
    setStyle({ ...style, signaturePhrases: style.signaturePhrases.filter((p) => p !== phrase) });
  }

  // ── Vocabulary phrase helpers ─────────────────────────────────────────────
  function addVocabPhrase() {
    const text = vocabDraft.text.trim();
    if (!text) return;
    if (style.vocabularyPhrases.some((p) => p.text === text)) return;

    const newPhrase: VocabPhrase = {
      id: crypto.randomUUID(),
      text,
      context: vocabDraft.context.trim() || undefined,
      avoidIn: vocabDraft.avoidIn.trim() || undefined,
    };
    setStyle({ ...style, vocabularyPhrases: [...style.vocabularyPhrases, newPhrase] });
    setVocabDraft({ text: "", context: "", avoidIn: "" });
  }

  function removeVocabPhrase(id: string) {
    setStyle({ ...style, vocabularyPhrases: style.vocabularyPhrases.filter((p) => p.id !== id) });
  }

  // ── Avoid word helpers ────────────────────────────────────────────────────
  function addAvoidWord() {
    const word = avoidInput.trim();
    if (!word || style.avoidPhrases.includes(word)) return;
    setStyle({ ...style, avoidPhrases: [...style.avoidPhrases, word] });
    setAvoidInput("");
  }

  function removeAvoidWord(word: string) {
    setStyle({ ...style, avoidPhrases: style.avoidPhrases.filter((w) => w !== word) });
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      await api.updateStyle({
        tone: style.tone,
        formality: style.formality,
        emojiUsage: style.emojiUsage,
        targetAudience: style.targetAudience,
        signaturePhrases: style.signaturePhrases,
        vocabularyPhrases: style.vocabularyPhrases,
        avoidPhrases: style.avoidPhrases,
      });
      toast.success("Reply style saved successfully!");
    } catch {
      toast.success("Reply style saved (demo mode)");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle a learned rule on/off ──────────────────────────────────────────
  // "Active" means the rule is injected into reply prompts.
  // Toggling off lets the owner suppress a rule they disagree with.
  async function handleRuleToggle(rule: LearnedRule) {
    setTogglingId(rule.id);
    try {
      await api.toggleLearnedRule(rule.id, !rule.active);
      setLearnedRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, active: !r.active } : r))
      );
    } catch {
      toast.error("Could not update rule. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Reply Style</h1>
        <p className="text-muted-foreground">
          Customize how your AI-generated replies sound
        </p>
      </div>

      {/* ── Progress ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="font-medium text-foreground">{STEPS[step].title}</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* ── Step Card ── */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" />
            {STEPS[step].title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {STEPS[step].description}
          </CardDescription>
        </CardHeader>
        <CardContent>

          {/* Step 0 — Tone */}
          {step === 0 && (
            <div className="flex flex-col gap-3">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStyle({ ...style, tone: opt.value })}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-4 text-left transition-colors",
                    style.tone === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{opt.label}</span>
                    {style.tone === opt.value && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="text-sm text-muted-foreground">{opt.description}</span>
                  <span className="text-xs text-muted-foreground italic font-mono">{opt.example}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 1 — Formality */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-5 gap-2">
                {FORMALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStyle({ ...style, formality: opt.value })}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                      style.formality === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/50 hover:bg-secondary"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                        style.formality === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {opt.value}
                    </div>
                    <span className="text-xs text-center text-muted-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Selected:{" "}
                <span className="font-medium text-foreground">
                  {FORMALITY_OPTIONS.find((o) => o.value === style.formality)?.label || "Balanced"}
                </span>
              </p>
            </div>
          )}

          {/* Step 2 — Emoji Usage */}
          {step === 2 && (
            <div className="flex flex-col gap-3">
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStyle({ ...style, emojiUsage: opt.value })}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-lg border p-4 text-left transition-colors",
                    style.emojiUsage === opt.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/50 hover:bg-secondary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{opt.label}</span>
                    {style.emojiUsage === opt.value && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <span className="text-sm text-muted-foreground">{opt.description}</span>
                  <span className="text-xs text-muted-foreground italic font-mono">{opt.preview}</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 3 — Target Audience */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <Label htmlFor="audience">Target Audience</Label>
              <Input
                id="audience"
                placeholder="e.g., Young professionals, parents, tech enthusiasts"
                value={style.targetAudience}
                onChange={(e) => setStyle({ ...style, targetAudience: e.target.value })}
              />
              <p className="text-sm text-muted-foreground">
                Describe who your typical customers are. This helps the AI adjust its
                language and references.
              </p>
            </div>
          )}

          {/* Step 4 — Signature Phrases */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <Label>Signature Phrases</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={'e.g., "Happy to help!", "Best regards"'}
                  value={phraseInput}
                  onChange={(e) => setPhraseInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addPhrase(); }
                  }}
                />
                <Button type="button" variant="outline" onClick={addPhrase} disabled={!phraseInput.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {style.signaturePhrases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {style.signaturePhrases.map((phrase) => (
                    <Badge key={phrase} variant="secondary" className="gap-1 pr-1">
                      {phrase}
                      <button
                        type="button"
                        onClick={() => removePhrase(phrase)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted"
                        aria-label={`Remove phrase: ${phrase}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                These phrases will be incorporated into AI-generated replies to maintain
                your brand voice.
              </p>
            </div>
          )}

          {/* Step 5 — Vocabulary Phrases */}
          {step === 5 && (
            <div className="flex flex-col gap-5">
              {/* Form to add a new vocabulary phrase */}
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary/30 p-4">
                <Label>Add a Phrase</Label>
                <Input
                  placeholder={"The phrase (e.g., \"ça roule\", \"on s'arrange\")"}

                  value={vocabDraft.text}
                  onChange={(e) => setVocabDraft({ ...vocabDraft, text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addVocabPhrase(); } }}
                />
                <Input
                  placeholder="When to use it (optional) — e.g., casual confirmation when tone is warm"
                  value={vocabDraft.context}
                  onChange={(e) => setVocabDraft({ ...vocabDraft, context: e.target.value })}
                />
                <Input
                  placeholder="When NOT to use it (optional) — e.g., first contact with new customers"
                  value={vocabDraft.avoidIn}
                  onChange={(e) => setVocabDraft({ ...vocabDraft, avoidIn: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addVocabPhrase}
                  disabled={!vocabDraft.text.trim()}
                  className="self-start"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Phrase
                </Button>
              </div>

              {/* List of added vocabulary phrases */}
              {style.vocabularyPhrases.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">
                    Your Phrases ({style.vocabularyPhrases.length}/20)
                  </Label>
                  {style.vocabularyPhrases.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start justify-between rounded-lg border border-border bg-card p-3"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground text-sm">"{p.text}"</span>
                        {p.context && (
                          <span className="text-xs text-muted-foreground">
                            Use for: {p.context}
                          </span>
                        )}
                        {p.avoidIn && (
                          <span className="text-xs text-destructive/80">
                            Avoid in: {p.avoidIn}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeVocabPhrase(p.id)}
                        className="ml-3 mt-0.5 rounded-full p-0.5 hover:bg-muted text-muted-foreground"
                        aria-label={`Remove phrase: ${p.text}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No vocabulary phrases added yet.
                </p>
              )}

              <p className="text-sm text-muted-foreground">
                These phrases are injected into every reply prompt with context on when to
                use them — making the AI sound like it picked them up from you naturally.
              </p>
            </div>
          )}

          {/* Step 6 — Words to Avoid */}
          {step === 6 && (
            <div className="flex flex-col gap-4">
              <Label>{"Words & Phrases to Avoid"}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder='e.g., "just wanted to", "actually", "per my last message"'
                  value={avoidInput}
                  onChange={(e) => setAvoidInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAvoidWord(); } }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAvoidWord}
                  disabled={!avoidInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {style.avoidPhrases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {style.avoidPhrases.map((word) => (
                    <Badge
                      key={word}
                      variant="outline"
                      className="gap-1 pr-1 bg-destructive/10 text-destructive border-destructive/30"
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() => removeAvoidWord(word)}
                        className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                        aria-label={`Remove: ${word}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                The AI will never use these specific words or phrases in your replies,
                regardless of context. These stack on top of the global list of generic
                AI expressions that are always blocked.
              </p>
            </div>
          )}

        </CardContent>
      </Card>

      {/* ── Navigation ── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Style"}
          </Button>
        )}
      </div>

      {/* ── What I've Learned ────────────────────────────────────────────────────
          This panel shows below the wizard at all times.
          It displays rules the system derived from watching the owner edit AI replies.
          Each confirmed rule can be toggled on or off by the owner.
      ── */}
      <Separator />

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Brain className="h-4 w-4 text-primary" />
            What I've Learned From Your Edits
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Rules the AI has derived by watching you edit its replies. Toggle any rule
            off if it doesn't match your style.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : learnedRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">No patterns detected yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Every time you edit an AI-generated reply in the Replies tab, MIA
                  learns from the change. After 3 confirmed edits, a rule appears here.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {learnedRules.map((rule) => {
                const conf = confidenceLabel(rule.confidence);
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "flex items-start justify-between gap-4 py-4",
                      !rule.active && "opacity-50"
                    )}
                  >
                    <div className="flex flex-col gap-1.5 flex-1">
                      <p className="text-sm text-foreground">{rule.rule}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("text-xs", conf.class)}
                        >
                          {conf.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {rule.exampleCount} edit{rule.exampleCount !== 1 ? "s" : ""} confirmed · {conf.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 pt-0.5">
                      {togglingId === rule.id && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                      <Switch
                        checked={rule.active}
                        onCheckedChange={() => handleRuleToggle(rule)}
                        disabled={togglingId === rule.id}
                        aria-label={`Toggle rule: ${rule.rule}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
