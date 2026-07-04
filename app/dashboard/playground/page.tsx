"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  FlaskConical,
  Send,
  Loader2,
  Signal,
  MessageSquare,
  CheckCircle2,
  Pencil,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SignalResult {
  intent?: string;
  sentiment?: string;
  urgency?: string;
  funnelStage?: string;
  [key: string]: unknown;
}

interface ReplyResult {
  generatedText?: string;
  confidence?: number;
  signal?: SignalResult;
  [key: string]: unknown;
}

export default function PlaygroundPage() {
  const [form, setForm] = useState({
    contactExternalId: "",
    platform: "WHATSAPP",
    messageText: "",
  });
  const [step, setStep] = useState<
    "input" | "extracting" | "signal" | "generating" | "result"
  >("input");
  const [signalResult, setSignalResult] = useState<SignalResult | null>(null);
  const [replyResult, setReplyResult] = useState<ReplyResult | null>(null);
  const [replyAction, setReplyAction] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.messageText.trim()) return;

    setStep("extracting");
    setSignalResult(null);
    setReplyResult(null);
    setReplyAction(null);
    setPipelineError(null);

    try {
      // Step 1: Extract signal
      const signal = await api.extractSignal(form);
      setSignalResult(signal as SignalResult);
      setStep("signal");

      // Short delay for visual feedback
      await new Promise((r) => setTimeout(r, 800));

      // Step 2: Generate reply (Ollama on CPU takes 20-60s — be patient)
      setStep("generating");
      const reply = await api.generateTestReply(form);
      setReplyResult(reply as ReplyResult);
      setStep("result");
    } catch (error: any) {
      const msg = error?.message || "Unknown error — check the backend terminal for details";
      setPipelineError(msg);
      setStep("input");
      toast.error(`Pipeline failed: ${msg}`, { duration: 8000 });
    }
  }

  function handleAction(action: string) {
    setReplyAction(action);
    toast.success(
      `Reply ${action === "APPROVED" ? "approved" : action === "EDITED" ? "marked for editing" : "rejected"}`
    );
  }

  function handleReset() {
    setStep("input");
    setSignalResult(null);
    setReplyResult(null);
    setReplyAction(null);
    setPipelineError(null);
    setForm({ contactExternalId: "", platform: "WHATSAPP", messageText: "" });
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Test Playground</h1>
        <p className="text-muted-foreground">
          Simulate message processing: signal extraction followed by reply
          generation
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Form */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <FlaskConical className="h-4 w-4 text-primary" />
              Message Input
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter a test message to process through the AI pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="contactId">Contact ID</Label>
                <Input
                  id="contactId"
                  placeholder="+1234567890"
                  value={form.contactExternalId}
                  onChange={(e) =>
                    setForm({ ...form, contactExternalId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="platform">Platform</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v })}
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                    <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="messageText">Message</Label>
                <Textarea
                  id="messageText"
                  placeholder="Type a test message... e.g., 'How much does your premium plan cost?'"
                  rows={4}
                  value={form.messageText}
                  onChange={(e) =>
                    setForm({ ...form, messageText: e.target.value })
                  }
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    step === "extracting" ||
                    step === "generating" ||
                    !form.messageText.trim()
                  }
                  className="flex-1"
                >
                  {step === "extracting" || step === "generating" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">
                    {step === "extracting"
                      ? "Extracting Signals..."
                      : step === "generating"
                        ? "Generating Reply..."
                        : "Process Message"}
                  </span>
                </Button>
                {step === "result" && (
                  <Button type="button" variant="outline" onClick={handleReset}>
                    Reset
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="flex flex-col gap-4">
          {/* Pipeline Status */}
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <PipelineStep
                  label="Extract"
                  active={step === "extracting"}
                  done={
                    step === "signal" ||
                    step === "generating" ||
                    step === "result"
                  }
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <PipelineStep
                  label="Generate"
                  active={step === "generating"}
                  done={step === "result"}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <PipelineStep
                  label="Review"
                  active={false}
                  done={!!replyAction}
                />
              </div>
            </CardContent>
          </Card>

          {/* Signal Result */}
          {signalResult && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <Signal className="h-4 w-4 text-primary" />
                  Extracted Signal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <SignalField
                    label="Intent"
                    value={signalResult.intent || "N/A"}
                  />
                  <SignalField
                    label="Sentiment"
                    value={signalResult.sentiment || "N/A"}
                    colorClass={
                      signalResult.sentiment === "POSITIVE"
                        ? "text-primary"
                        : signalResult.sentiment === "NEGATIVE"
                          ? "text-destructive"
                          : "text-warning"
                    }
                  />
                  <SignalField
                    label="Urgency"
                    value={signalResult.urgency || "N/A"}
                    colorClass={
                      signalResult.urgency === "HIGH" ||
                      signalResult.urgency === "CRITICAL"
                        ? "text-destructive"
                        : "text-warning"
                    }
                  />
                  <SignalField
                    label="Funnel Stage"
                    value={signalResult.funnelStage || "N/A"}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reply Result */}
          {step === "generating" && !replyResult && (
            <Card className="border-border bg-card">
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Generating AI reply...
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    CPU inference can take 20–60 s — please wait
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {replyResult && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm text-foreground">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Generated Reply
                  </span>
                  {replyResult.confidence !== undefined && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono",
                        (replyResult.confidence || 0) >= 90
                          ? "border-primary/30 text-primary"
                          : (replyResult.confidence || 0) >= 75
                            ? "border-warning/30 text-warning"
                            : "border-destructive/30 text-destructive"
                      )}
                    >
                      {replyResult.confidence}% confidence
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="rounded-lg border border-border bg-secondary/50 p-4">
                  <p className="text-sm leading-relaxed text-foreground">
                    {replyResult.generatedText}
                  </p>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground mr-auto">
                    {replyAction
                      ? `Action: ${replyAction}`
                      : "Review this reply:"}
                  </p>
                  <Button
                    size="sm"
                    variant={
                      replyAction === "APPROVED" ? "default" : "outline"
                    }
                    onClick={() => handleAction("APPROVED")}
                    className={cn(
                      replyAction === "APPROVED"
                        ? ""
                        : "border-primary/30 text-primary hover:bg-primary/10"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span className="ml-1">Approve</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={replyAction === "EDITED" ? "default" : "outline"}
                    onClick={() => handleAction("EDITED")}
                    className={cn(
                      replyAction === "EDITED"
                        ? ""
                        : "border-chart-2/30 text-chart-2 hover:bg-chart-2/10"
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="ml-1">Edit</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      replyAction === "REJECTED" ? "destructive" : "outline"
                    }
                    onClick={() => handleAction("REJECTED")}
                    className={cn(
                      replyAction === "REJECTED"
                        ? ""
                        : "border-destructive/30 text-destructive hover:bg-destructive/10"
                    )}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span className="ml-1">Reject</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {step === "input" && pipelineError && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="pt-5 pb-5">
                <p className="text-xs font-semibold text-destructive mb-1">Pipeline error</p>
                <p className="text-sm text-destructive/80 break-words">{pipelineError}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Check the backend terminal for the full stack trace.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {step === "input" && !pipelineError && (
            <Card className="border-border bg-card border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FlaskConical className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Enter a message and click Process to see the AI pipeline in
                  action
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        done
          ? "bg-primary/15 text-primary"
          : active
            ? "bg-warning/15 text-warning"
            : "bg-muted text-muted-foreground"
      )}
    >
      {active && <Loader2 className="h-3 w-3 animate-spin" />}
      {done && <CheckCircle2 className="h-3 w-3" />}
      {label}
    </div>
  );
}

function SignalField({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-medium",
          colorClass || "text-foreground"
        )}
      >
        {value.replace(/_/g, " ")}
      </span>
    </div>
  );
}
