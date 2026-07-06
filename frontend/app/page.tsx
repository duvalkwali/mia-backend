"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageSquare,
  Zap,
  Shield,
  Loader2,
  Play,
} from "lucide-react";

export default function AuthPage() {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    businessName: "",
  });

  function loginAsDemo() {
    login("demo-token-xxxx", {
      id: "Joe-user-1",
      email: "demo@mia.ai",
      businessName: "Joe Corp",
    });
    toast.success("Welcome to the demo!");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.login(loginForm);
      login(res.token, res.user as Parameters<typeof login>[1]);
      toast.success("Welcome back!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Cannot reach the server. Is the backend running?";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.register(registerForm);
      login(res.token, res.user as Parameters<typeof login>[1]);
      toast.success("Account created successfully!");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Cannot reach the server. Is the backend running?";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-secondary p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold text-foreground">
              MIA
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <h1 className="text-4xl font-bold leading-tight text-balance text-foreground">
            AI-Powered WhatsApp Reply Management
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Automate customer responses with intelligent signal detection,
            customizable reply styles, and full conversation control.
          </p>

          <div className="flex flex-col gap-6">
            <FeatureItem
              icon={<Zap className="h-5 w-5 text-primary" />}
              title="Smart Signal Detection"
              description="Automatically extract intent, sentiment, and urgency from messages"
            />
            <FeatureItem
              icon={<MessageSquare className="h-5 w-5 text-primary" />}
              title="Styled Responses"
              description="Customize tone, formality, and brand voice for every reply"
            />
            <FeatureItem
              icon={<Shield className="h-5 w-5 text-primary" />}
              title="Full Control"
              description="Approve, edit, or reject every AI-generated reply before sending"
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Trusted by businesses worldwide
        </p>
      </div>

      {/* Right panel - Auth forms */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">
                MIA
              </span>
            </div>
          </div>

          <Button
            onClick={loginAsDemo}
            variant="outline"
            className="mb-6 w-full gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Play className="h-4 w-4" />
            Try Demo &mdash; No Account Needed
          </Button>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    Welcome back
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Sign in to manage your AI replies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@business.com"
                        value={loginForm.email}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, email: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm({
                            ...loginForm,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="mt-2">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Sign In"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register" className="mt-6">
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">
                    Create your account
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Get started with AI-powered reply management
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleRegister}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="register-business">Business Name</Label>
                      <Input
                        id="register-business"
                        placeholder="Acme Corp"
                        value={registerForm.businessName}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            businessName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@business.com"
                        value={registerForm.email}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="register-password">Password</Label>
                      <Input
                        id="register-password"
                        type="password"
                        placeholder="Create a password"
                        value={registerForm.password}
                        onChange={(e) =>
                          setRegisterForm({
                            ...registerForm,
                            password: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <Button type="submit" disabled={isLoading} className="mt-2">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary border border-border">
        {icon}
      </div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
