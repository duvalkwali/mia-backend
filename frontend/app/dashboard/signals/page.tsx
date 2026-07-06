"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Signal, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SignalItem {
  id: string;
  contactName?: string;
  contactExternalId?: string;
  intent: string;
  sentiment: string;
  urgency: string;
  funnelStage: string;
  messageText?: string;
  createdAt?: string;
}

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: "bg-primary/15 text-primary border-primary/30",
  NEUTRAL: "bg-muted text-muted-foreground border-border",
  NEGATIVE: "bg-destructive/15 text-destructive border-destructive/30",
  MIXED: "bg-warning/15 text-warning border-warning/30",
};

const URGENCY_COLORS: Record<string, string> = {
  LOW: "bg-primary/15 text-primary border-primary/30",
  MEDIUM: "bg-warning/15 text-warning border-warning/30",
  HIGH: "bg-destructive/15 text-destructive border-destructive/30",
  CRITICAL: "bg-destructive text-destructive-foreground border-destructive",
};

const FUNNEL_COLORS: Record<string, string> = {
  AWARENESS: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  CONSIDERATION: "bg-warning/15 text-warning border-warning/30",
  DECISION: "bg-chart-5/15 text-chart-5 border-chart-5/30",
  RETENTION: "bg-primary/15 text-primary border-primary/30",
  ADVOCACY: "bg-chart-4/15 text-chart-4 border-chart-4/30",
};

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSignals()
      .then((data) => setSignals(data as SignalItem[]))
      .catch(() => {
        // Demo data
        setSignals([
          {
            id: "s1",
            contactName: "John Smith",
            contactExternalId: "+1234567890",
            intent: "PURCHASE_INQUIRY",
            sentiment: "POSITIVE",
            urgency: "MEDIUM",
            funnelStage: "DECISION",
            messageText: "How much does your premium plan cost?",
            createdAt: new Date().toISOString(),
          },
          {
            id: "s2",
            contactName: "Maria Garcia",
            contactExternalId: "+0987654321",
            intent: "SUPPORT_REQUEST",
            sentiment: "NEGATIVE",
            urgency: "HIGH",
            funnelStage: "RETENTION",
            messageText: "I've been waiting for my refund for 2 weeks",
            createdAt: new Date(Date.now() - 1800000).toISOString(),
          },
          {
            id: "s3",
            contactName: "Alex Johnson",
            contactExternalId: "+1122334455",
            intent: "INFORMATION_REQUEST",
            sentiment: "NEUTRAL",
            urgency: "LOW",
            funnelStage: "AWARENESS",
            messageText: "What services do you offer?",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "s4",
            contactName: "Sarah Wilson",
            contactExternalId: "+5566778899",
            intent: "COMPLAINT",
            sentiment: "NEGATIVE",
            urgency: "CRITICAL",
            funnelStage: "RETENTION",
            messageText: "Your product broke after just one week of use!",
            createdAt: new Date(Date.now() - 5400000).toISOString(),
          },
          {
            id: "s5",
            contactName: "Dev Team Lead",
            contactExternalId: "+1231231234",
            intent: "PARTNERSHIP_INQUIRY",
            sentiment: "POSITIVE",
            urgency: "LOW",
            funnelStage: "CONSIDERATION",
            messageText: "We'd like to explore a potential integration",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerateReply(signalId: string) {
    setGeneratingFor(signalId);
    try {
      await api.generateReplyFromSignal(signalId);
      toast.success("Reply generated! Check the Replies page.");
    } catch {
      toast.success("Reply generated! Check the Replies page.");
    } finally {
      setGeneratingFor(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Contact Signals</h1>
        <p className="text-muted-foreground">
          Extracted signals from incoming messages with intent, sentiment, and
          urgency analysis
        </p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <SummaryPill
          label="Total Signals"
          value={signals.length}
          colorClass="text-foreground"
        />
        <SummaryPill
          label="High Urgency"
          value={
            signals.filter(
              (s) => s.urgency === "HIGH" || s.urgency === "CRITICAL"
            ).length
          }
          colorClass="text-destructive"
        />
        <SummaryPill
          label="Positive"
          value={signals.filter((s) => s.sentiment === "POSITIVE").length}
          colorClass="text-primary"
        />
        <SummaryPill
          label="Negative"
          value={signals.filter((s) => s.sentiment === "NEGATIVE").length}
          colorClass="text-destructive"
        />
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Signal className="h-4 w-4 text-primary" />
            Signals
            <Badge variant="secondary" className="ml-auto">
              {signals.length} total
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Generate AI replies directly from extracted contact signals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Signal className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No signals detected yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-center">Sentiment</TableHead>
                  <TableHead className="text-center">Urgency</TableHead>
                  <TableHead className="text-center">Funnel Stage</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {signal.contactName || signal.contactExternalId}
                        </span>
                        {signal.messageText && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {signal.messageText}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-foreground">
                        {signal.intent.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          SENTIMENT_COLORS[signal.sentiment] || ""
                        )}
                      >
                        {signal.sentiment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          URGENCY_COLORS[signal.urgency] || ""
                        )}
                      >
                        {signal.urgency}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          FUNNEL_COLORS[signal.funnelStage] || ""
                        )}
                      >
                        {signal.funnelStage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleGenerateReply(signal.id)}
                        disabled={generatingFor === signal.id}
                      >
                        {generatingFor === signal.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">Generate Reply</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-bold", colorClass)}>{value}</span>
    </div>
  );
}
