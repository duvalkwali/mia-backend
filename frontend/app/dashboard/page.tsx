"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import {
  Clock,
  DollarSign,
  HelpCircle,
  TrendingUp,
  MessageSquare,
  Activity,
} from "lucide-react";

interface DashboardData {
  pendingReplies: number;
  costTracked: number;
  faqsCount: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileDone, setProfileDone] = useState(false);
  const [health, setHealth] = useState<"checking" | "up" | "down">("checking");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.getDashboard(),
      // A missing profile (404) just means setup isn't done — not a page error
      api.getProfile().catch(() => null),
    ])
      .then(([dashboard, profile]) => {
        setData(dashboard);
        setProfileDone(!!profile && !!(profile as { businessType?: string }).businessType);
      })
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Could not load dashboard data");
      })
      .finally(() => setLoading(false));

    setHealth("checking");
    api.getHealth().then((ok) => setHealth(ok ? "up" : "down"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          Welcome back{user?.businessName ? `, ${user.businessName}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {"Here's an overview of your AI reply management"}
        </p>
      </div>

      {/* Stats Cards — or the real error when the backend is unreachable */}
      {error ? (
        <ErrorState
          title="Could not load dashboard stats"
          message={error}
          onRetry={load}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Pending Replies"
            value={data?.pendingReplies}
            loading={loading}
            icon={<Clock className="h-4 w-4" />}
            description="Awaiting your review"
            accentClass="text-warning"
          />
          <StatsCard
            title="Cost Tracked"
            value={data?.costTracked !== undefined ? `$${data.costTracked.toFixed(2)}` : undefined}
            loading={loading}
            icon={<DollarSign className="h-4 w-4" />}
            description="Total API usage cost"
            accentClass="text-chart-2"
          />
          <StatsCard
            title="FAQs Configured"
            value={data?.faqsCount}
            loading={loading}
            icon={<HelpCircle className="h-4 w-4" />}
            description="Knowledge base entries"
            accentClass="text-primary"
          />
        </div>
      )}

      {/* Quick actions & info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-primary" />
              Quick Actions
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Common tasks to get started
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <QuickAction
                href="/dashboard/replies"
                label="Review pending replies"
                badge="Replies"
              />
              <QuickAction
                href="/dashboard/signals"
                label="Check new contact signals"
                badge="Signals"
              />
              <QuickAction
                href="/dashboard/playground"
                label="Test a reply generation"
                badge="Playground"
              />
              <QuickAction
                href="/dashboard/profile"
                label="Update business profile & FAQs"
                badge="Profile"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Getting Started
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Set up your AI reply system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <SetupStep
                step={1}
                label="Configure your business profile"
                done={profileDone}
              />
              <SetupStep step={2} label="Set your reply style preferences" />
              <SetupStep step={3} label="Add FAQs to your knowledge base" />
              <SetupStep
                step={4}
                label="Test with the playground before going live"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System status */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <MessageSquare className="h-4 w-4 text-primary" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* All four subsystems run inside the one backend process, so they
              share the real GET /health result — no hardcoded "operational" */}
          <div className="flex flex-wrap items-center gap-4">
            <StatusPill label="API" health={health} />
            <StatusPill label="Signal Extraction" health={health} />
            <StatusPill label="Reply Generation" health={health} />
            <StatusPill label="WhatsApp Integration" health={health} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatsCard({
  title,
  value,
  loading,
  icon,
  description,
  accentClass,
}: {
  title: string;
  value: string | number | undefined;
  loading: boolean;
  icon: React.ReactNode;
  description: string;
  accentClass: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={accentClass}>{icon}</div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-foreground">{value}</div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3 transition-colors hover:bg-secondary"
    >
      <span className="text-sm text-foreground">{label}</span>
      <Badge variant="outline" className="text-muted-foreground">
        {badge}
      </Badge>
    </a>
  );
}

function SetupStep({
  step,
  label,
  done,
}: {
  step: number;
  label: string;
  done?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          done
            ? "bg-primary text-primary-foreground"
            : "border border-border text-muted-foreground"
        }`}
      >
        {step}
      </div>
      <span
        className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
      </span>
    </div>
  );
}

function StatusPill({
  label,
  health,
}: {
  label: string;
  health: "checking" | "up" | "down";
}) {
  const colors = {
    up: "bg-primary/20 text-primary",
    checking: "bg-warning/20 text-warning",
    down: "bg-destructive/20 text-destructive",
  };
  const dot = {
    up: "bg-primary",
    checking: "bg-warning",
    down: "bg-destructive",
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${colors[health]}`}
    >
      <div className={`h-1.5 w-1.5 rounded-full ${dot[health]}`} />
      {label}
      {health === "down" && <span className="opacity-80">— down</span>}
    </div>
  );
}
