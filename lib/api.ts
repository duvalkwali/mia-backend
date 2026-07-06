const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    // Backend wraps errors as { success: false, error: { message } }
    const message = body.error?.message || body.message || res.statusText;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return {} as T;
  const body = await res.json();
  // Unwrap { success: true, data: ... } envelope used by all non-auth endpoints
  if (body && typeof body === "object" && body.success === true && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

export const api = {
  // Auth
  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: Record<string, unknown> }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  register: (data: {
    email: string;
    password: string;
    businessName: string;
  }) =>
    request<{ token: string; user: Record<string, unknown> }>(
      "/auth/register",
      { method: "POST", body: JSON.stringify(data) }
    ),

  // Dashboard
  getDashboard: () =>
    request<{
      pendingReplies: number;
      costTracked: number;
      faqsCount: number;
    }>("/dashboard"),

  // Business Profile
  getProfile: () => request<Record<string, unknown>>("/business/profile"),
  updateProfile: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/business/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // FAQs
  getFaqs: () => request<Array<Record<string, unknown>>>("/business/faqs"),
  addFaq: (data: { question: string; answer: string }) =>
    request<Record<string, unknown>>("/business/faqs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteFaq: (id: string) =>
    request<void>(`/business/faqs/${id}`, { method: "DELETE" }),

  // Auto-reply setting
  getAutoReply: () => request<{ autoReplyEnabled: boolean }>("/business/auto-reply"),
  setAutoReply: (enabled: boolean) =>
    request<{ autoReplyEnabled: boolean }>("/business/auto-reply", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  // Style
  getStyle: () => request<Record<string, unknown>>("/style"),
  updateStyle: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>("/style", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Replies
  getReplies: () => request<Array<Record<string, unknown>>>("/replies"),
  updateReplyStatus: (id: string, status: string) =>
    request<Record<string, unknown>>(`/replies/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  updateReplyText: (id: string, text: string) =>
    request<Record<string, unknown>>(`/replies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ generatedText: text }),
    }),

  // Style learning
  recordLearning: (data: { eventType: string; replyId: string; originalReply?: string; editedReply?: string }) =>
    request<Record<string, unknown>>("/style/learn", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getLearnedRules: () =>
    request<Array<{
      id: string;
      rule: string;
      ruleType: string;
      confidence: number;
      exampleCount: number;
      active: boolean;
    }>>("/style/learned-rules"),
  toggleLearnedRule: (id: string, active: boolean) =>
    request<Record<string, unknown>>(`/style/learned-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),

  // Signals
  getSignals: () => request<Array<Record<string, unknown>>>("/signals"),
  generateReplyFromSignal: (signalId: string) =>
    request<Record<string, unknown>>(`/signals/${signalId}/generate-reply`, {
      method: "POST",
    }),

  // Test Playground
  extractSignal: (data: {
    contactExternalId: string;
    platform: string;
    messageText: string;
  }) =>
    request<Record<string, unknown>>("/playground/extract-signal", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  generateTestReply: (data: {
    contactExternalId: string;
    platform: string;
    messageText: string;
  }) =>
    request<Record<string, unknown>>("/playground/generate-reply", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export { ApiError };
