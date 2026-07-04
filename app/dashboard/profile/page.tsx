"use client";

import { useEffect, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building2, Plus, Trash2, Loader2, HelpCircle, Zap } from "lucide-react";

interface Faq {
  id?: string;
  question: string;
  answer: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    businessType: "",
    description: "",
    targetAudience: "",
    pricing: "",
  });
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });
  const [saving, setSaving] = useState(false);
  const [addingFaq, setAddingFaq] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoReply, setAutoReply] = useState(false);
  const [togglingAutoReply, setTogglingAutoReply] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getProfile().catch(() => null),
      api.getFaqs().catch(() => null),
      api.getAutoReply().catch(() => null),
    ])
      .then(([profileData, faqsData, autoReplyData]) => {
        if (profileData) {
          setProfile({
            businessType: (profileData.businessType as string) || "",
            description: (profileData.description as string) || "",
            targetAudience: (profileData.targetAudience as string) || "",
            pricing: (profileData.pricing as string) || "",
          });
        }
        if (Array.isArray(faqsData)) {
          setFaqs(faqsData as unknown as Faq[]);
        }
        if (autoReplyData) {
          setAutoReply((autoReplyData as any).autoReplyEnabled ?? false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile(profile);
      toast.success("Profile updated successfully");
    } catch {
      // Demo mode -- save locally
      toast.success("Profile updated (demo mode)");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!newFaq.question.trim() || !newFaq.answer.trim()) return;
    setAddingFaq(true);
    try {
      const added = await api.addFaq(newFaq);
      setFaqs([...faqs, added as unknown as Faq]);
      setNewFaq({ question: "", answer: "" });
      toast.success("FAQ added");
    } catch {
      // Demo mode -- add locally
      setFaqs([...faqs, { id: `faq-${Date.now()}`, ...newFaq }]);
      setNewFaq({ question: "", answer: "" });
      toast.success("FAQ added (demo mode)");
    } finally {
      setAddingFaq(false);
    }
  }

  async function handleAutoReplyToggle(checked: boolean) {
    setTogglingAutoReply(true);
    try {
      await api.setAutoReply(checked);
      setAutoReply(checked);
      toast.success(checked ? "Auto-reply enabled — replies send instantly" : "Auto-reply disabled — replies need approval");
    } catch (err: any) {
      toast.error(`Failed to update auto-reply: ${err?.message || "Unknown error"}`);
    } finally {
      setTogglingAutoReply(false);
    }
  }

  function handleDeleteFaq(id: string, index: number) {
    if (id) api.deleteFaq(id).catch(() => {});
    setFaqs(faqs.filter((_, i) => i !== index));
    toast.success("FAQ removed");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">
          Business Profile
        </h1>
        <p className="text-muted-foreground">
          Configure your business details to improve AI reply quality
        </p>
      </div>

      {/* Profile Form */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="h-4 w-4 text-primary" />
            Business Details
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            This information helps the AI generate contextually relevant replies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="businessType">Business Type</Label>
              <Select
                value={profile.businessType}
                onValueChange={(v) =>
                  setProfile({ ...profile, businessType: v })
                }
              >
                <SelectTrigger id="businessType">
                  <SelectValue placeholder="Select business type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ECOMMERCE">E-commerce</SelectItem>
                  <SelectItem value="SAAS">SaaS</SelectItem>
                  <SelectItem value="SERVICE">Service</SelectItem>
                  <SelectItem value="CONSULTING">Consulting</SelectItem>
                  <SelectItem value="EDUCATION">Education</SelectItem>
                  <SelectItem value="HEALTHCARE">Healthcare</SelectItem>
                  <SelectItem value="REAL_ESTATE">Real Estate</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Business Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what your business does, your unique value proposition..."
                rows={4}
                value={profile.description}
                onChange={(e) =>
                  setProfile({ ...profile, description: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="targetAudience">Target Audience</Label>
              <Input
                id="targetAudience"
                placeholder="e.g., Small business owners, tech-savvy millennials"
                value={profile.targetAudience}
                onChange={(e) =>
                  setProfile({ ...profile, targetAudience: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="pricing">Pricing Information</Label>
              <Textarea
                id="pricing"
                placeholder="Describe your pricing structure, plans, or rates..."
                rows={3}
                value={profile.pricing}
                onChange={(e) =>
                  setProfile({ ...profile, pricing: e.target.value })
                }
              />
            </div>

            <Button type="submit" disabled={saving} className="w-fit">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Profile"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* FAQs Section */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <HelpCircle className="h-4 w-4 text-primary" />
            FAQs
            <Badge variant="secondary" className="ml-auto">
              {faqs.length} entries
            </Badge>
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Add frequently asked questions to train the AI with common responses
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Existing FAQs */}
          {faqs.length > 0 && (
            <div className="flex flex-col gap-3">
              {faqs.map((faq, i) => (
                <div
                  key={faq.id || i}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/50 p-4"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {faq.question}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {faq.answer}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteFaq(faq.id || "", i)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="Delete FAQ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Add FAQ form */}
          <form onSubmit={handleAddFaq} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">Add new FAQ</p>
            <Input
              placeholder="Question (e.g., What are your business hours?)"
              value={newFaq.question}
              onChange={(e) =>
                setNewFaq({ ...newFaq, question: e.target.value })
              }
            />
            <Textarea
              placeholder="Answer..."
              rows={2}
              value={newFaq.answer}
              onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
            />
            <Button
              type="submit"
              variant="outline"
              disabled={addingFaq}
              className="w-fit"
            >
              {addingFaq ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add FAQ
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
      {/* Auto-Reply */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Zap className="h-4 w-4 text-primary" />
            Auto-Reply
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            When enabled, AI replies are sent to WhatsApp immediately — no approval step
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {autoReply ? "Auto-reply is ON" : "Auto-reply is OFF"}
              </p>
              <p className="text-xs text-muted-foreground">
                {autoReply
                  ? "Every incoming message gets an instant AI reply sent to WhatsApp."
                  : "Replies appear in the dashboard for you to review and approve first."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {togglingAutoReply && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={autoReply}
                onCheckedChange={handleAutoReplyToggle}
                disabled={togglingAutoReply}
                aria-label="Toggle auto-reply"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
