import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, ShieldCheck, ArrowLeft, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "ចូលគណនីគ្រប់គ្រង — Wat Peareang Admin" },
      { name: "description", content: "ផ្ទាំងចូលគណនីសម្រាប់ Super Admin និង Editor" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate({ to: "/admin" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់។");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success("ចូលប្រព័ន្ធជោគជ័យ!");
        navigate({ to: "/admin" });
      } else {
        setErrorMessage(result.error || "អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។");
      }
    } catch {
      setErrorMessage("មានបញ្ហាក្នុងការផ្ទៀងផ្ទាត់។ សូមព្យាយាមម្ដងទៀត។");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-border/80 bg-card p-8 shadow-card backdrop-blur">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-gold">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
              ចូលគណនីគ្រប់គ្រង
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              សម្រាប់តែ Super Admin និង Editor វត្តពារាំង
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email" className="text-xs font-medium">
                អ៊ីមែល (Email)
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@watpeareang.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl pl-10 h-11 text-sm bg-background/50"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password" className="text-xs font-medium">
                  ពាក្យសម្ងាត់ (Password)
                </Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl pl-10 h-11 text-sm bg-background/50"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-11 rounded-2xl bg-gold font-medium text-primary-foreground hover:bg-gold/90 transition-all shadow-soft"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                </div>
              ) : (
                "ចូលប្រព័ន្ធ (Login)"
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 rounded-2xl bg-secondary/60 p-3 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              🔒 ប្រព័ន្ធនេះត្រូវបានការពារដោយ Secure HTTP-Only Cookies និង Role-Based Access Control
              (RBAC)។
            </p>
          </div>

          <div className="mt-4 text-center">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់ទៅ Public Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
