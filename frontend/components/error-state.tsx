"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Shared fetch-failure state: shows the real error and a retry button.
 * Pages must render this instead of falling back to fabricated data.
 */
export function ErrorState({
  title = "Could not load data",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-card">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        </div>
        <Button variant="outline" onClick={onRetry} className="mt-2 gap-2">
          <RotateCw className="h-4 w-4" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
