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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Pencil,
  Loader2,
  Reply,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplyItem {
  id: string;
  generatedText: string;
  confidence: number;
  status: "PENDING" | "APPROVED" | "EDITED" | "REJECTED" | "SENT";
  contactName?: string;
  createdAt?: string;
  originalMessage?: string;
  sendError?: string;
}

const STATUS_STYLES: Record<string, { class: string; label: string }> = {
  PENDING:  { class: "bg-warning/15 text-warning border-warning/30",       label: "Pending"  },
  APPROVED: { class: "bg-primary/15 text-primary border-primary/30",       label: "Approved" },
  EDITED:   { class: "bg-chart-2/15 text-chart-2 border-chart-2/30",       label: "Edited"   },
  REJECTED: { class: "bg-destructive/15 text-destructive border-destructive/30", label: "Rejected" },
  SENT:     { class: "bg-primary/20 text-primary border-primary/40",        label: "Sent ✓"  },
};

export default function RepliesPage() {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    reply: ReplyItem | null;
    text: string;
  }>({ open: false, reply: null, text: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    api
      .getReplies()
      .then((res: any) => setReplies(Array.isArray(res) ? res : (res.data ?? [])))
      .catch(() => {
        // Demo data for display
        setReplies([
          {
            id: "1",
            generatedText:
              "Thank you for your interest! Our premium plan starts at $49/month and includes all features. Would you like me to set up a demo?",
            confidence: 92,
            status: "PENDING",
            contactName: "John Smith",
            createdAt: new Date().toISOString(),
            originalMessage: "How much does your premium plan cost?",
          },
          {
            id: "2",
            generatedText:
              "Hi! Yes, we do offer bulk discounts for orders over 100 units. Let me connect you with our sales team for a custom quote.",
            confidence: 87,
            status: "APPROVED",
            contactName: "Maria Garcia",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            originalMessage: "Do you offer bulk discounts?",
          },
          {
            id: "3",
            generatedText:
              "I understand your frustration. Let me escalate this to our support team who can resolve this within 24 hours.",
            confidence: 78,
            status: "PENDING",
            contactName: "Alex Johnson",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            originalMessage: "I've been waiting for my refund for 2 weeks",
          },
          {
            id: "4",
            generatedText:
              "Great question! Our API documentation is available at docs.example.com. Here are the main endpoints you'll need...",
            confidence: 95,
            status: "EDITED",
            contactName: "Dev Team",
            createdAt: new Date(Date.now() - 14400000).toISOString(),
            originalMessage: "Where can I find your API docs?",
          },
          {
            id: "5",
            generatedText:
              "We're sorry to hear about this issue. Our store hours are Mon-Fri 9am-6pm. You can also reach us at support@example.com.",
            confidence: 65,
            status: "REJECTED",
            contactName: "Sarah Wilson",
            createdAt: new Date(Date.now() - 28800000).toISOString(),
            originalMessage: "What time do you close today?",
          },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredReplies =
    filter === "ALL" ? replies : replies.filter((r) => r.status === filter);

  async function handleStatusUpdate(id: string, status: string) {
    setActionLoading(id);
    try {
      const result: any = await api.updateReplyStatus(id, status);
      if (status === "APPROVED") {
        if (result?.whatsappSent) {
          toast.success("Reply approved and sent via WhatsApp ✓");
          setReplies(replies.map((r) => r.id === id ? { ...r, status: "APPROVED" } : r));
        } else if (result?.whatsappError) {
          toast.error(`Approved but WhatsApp send failed: ${result.whatsappError}`);
          setReplies(replies.map((r) => r.id === id ? { ...r, status: "APPROVED" } : r));
        } else {
          toast.success("Reply approved");
          setReplies(replies.map((r) => r.id === id ? { ...r, status: "APPROVED" } : r));
        }
      } else {
        setReplies(replies.map((r) => r.id === id ? { ...r, status: status as ReplyItem["status"] } : r));
        toast.success(`Reply ${status.toLowerCase()}`);
      }
    } catch (err: any) {
      toast.error(`Failed: ${err?.message || "Unknown error"}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEdit() {
    if (!editDialog.reply) return;
    // Capture all fields before any state changes
    const replyId     = editDialog.reply.id;
    const originalText = editDialog.reply.generatedText;
    const editedText   = editDialog.text;
    setActionLoading(editDialog.reply.id);
    try {
      await api.updateReplyText(editDialog.reply.id, editedText);
      setReplies(
        replies.map((r) =>
          r.id === editDialog.reply!.id
            ? { ...r, generatedText: editedText, status: "EDITED" }
            : r
        )
      );
      toast.success("Reply edited and saved");

      // Fire-and-forget: send the before/after pair to the style learning system.
      // This never blocks the UI — if it fails, the edit is still saved normally.
      // On the backend, this triggers a word-level diff + an Ollama rule derivation.
      api.recordLearning({
        eventType: "EDIT",
        replyId,
        originalReply: originalText,
        editedReply:   editedText,
      }).catch(() => {/* style learning is best-effort — never block the user */});
    } catch (err: any) {
      toast.error(`Failed to save edit: ${err?.message || "Unknown error"}`);
    } finally {
      setActionLoading(null);
      setEditDialog({ open: false, reply: null, text: "" });
    }
  }

  function getConfidenceColor(confidence: number) {
    if (confidence >= 90) return "text-primary";
    if (confidence >= 75) return "text-warning";
    return "text-destructive";
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
        <h1 className="text-2xl font-bold text-foreground">
          Generated Replies
        </h1>
        <p className="text-muted-foreground">
          Review, approve, edit, or reject AI-generated responses
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {["ALL", "PENDING", "APPROVED", "EDITED", "REJECTED", "SENT"].map((s) => (
          <Button
            key={s}
            variant={filter === s ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(s)}
            className={cn(
              filter === s
                ? ""
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            {s !== "ALL" && (
              <span className="ml-1 text-xs opacity-70">
                ({replies.filter((r) => r.status === s).length})
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Reply className="h-4 w-4 text-primary" />
            Replies
            <Badge variant="secondary" className="ml-auto">
              {filteredReplies.length} total
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Click actions to approve, edit, or reject each reply
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Reply className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">No replies found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead className="min-w-[300px]">
                    Generated Reply
                  </TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReplies.map((reply) => (
                  <TableRow key={reply.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {reply.contactName || "Unknown"}
                        </span>
                        {reply.originalMessage && (
                          <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {reply.originalMessage}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground line-clamp-2">
                        {reply.generatedText}
                      </p>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "text-sm font-mono font-bold",
                          getConfidenceColor(reply.confidence)
                        )}
                      >
                        {reply.confidence}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[reply.status]?.class || ""}
                        >
                          {STATUS_STYLES[reply.status]?.label || reply.status}
                        </Badge>
                        {reply.sendError && (
                          <span
                            className="flex items-center gap-1 text-xs text-warning cursor-help"
                            title={reply.sendError}
                          >
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            Send failed
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleStatusUpdate(reply.id, "APPROVED")
                          }
                          disabled={
                            actionLoading === reply.id ||
                            reply.status === "APPROVED"
                          }
                          className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                          aria-label="Approve reply"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setEditDialog({
                              open: true,
                              reply,
                              text: reply.generatedText,
                            })
                          }
                          disabled={actionLoading === reply.id}
                          className="h-8 w-8 text-chart-2 hover:text-chart-2 hover:bg-chart-2/10"
                          aria-label="Edit reply"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleStatusUpdate(reply.id, "REJECTED")
                          }
                          disabled={
                            actionLoading === reply.id ||
                            reply.status === "REJECTED"
                          }
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Reject reply"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(o) =>
          !o && setEditDialog({ open: false, reply: null, text: "" })
        }
      >
        <DialogContent className="border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Edit Reply</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Modify the AI-generated reply before approving
            </DialogDescription>
          </DialogHeader>
          {editDialog.reply?.originalMessage && (
            <div className="rounded-lg border border-border bg-secondary/50 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Original message:
              </p>
              <p className="text-sm text-foreground">
                {editDialog.reply.originalMessage}
              </p>
            </div>
          )}
          <Textarea
            value={editDialog.text}
            onChange={(e) =>
              setEditDialog({ ...editDialog, text: e.target.value })
            }
            rows={5}
            className="resize-none"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditDialog({ open: false, reply: null, text: "" })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!!actionLoading}>
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save & Approve"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
