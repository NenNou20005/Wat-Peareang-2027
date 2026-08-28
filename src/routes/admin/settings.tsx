import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { Key, ShieldCheck, UserCheck, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "ការកំណត់ — Wat Peareang Admin" }],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { user, isSuperAdmin, refetchUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន (Current Password)។");
      return;
    }
    if (!newPassword || !confirmPassword) {
      toast.error("សូមបញ្ចូលពាក្យសម្ងាត់ថ្មី និងផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់។");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("ពាក្យសម្ងាត់ថ្មី និងផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់មិនត្រូវគ្នាឡើយ។");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/settings/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("បានផ្លាស់ប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ! សូមចូលប្រើប្រាស់ម្ដងទៀត។");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        await refetchUser();
        navigate({ to: "/admin/login" });
      } else {
        toast.error(data.error || "មិនអាចប្តូរពាក្យសម្ងាត់បានទេ។");
      }
    } catch {
      toast.error("មានបញ្ហាក្នុងការភ្ជាប់ទៅកាន់ប្រព័ន្ធ។");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">⚙️ ការកំណត់ប្រព័ន្ធ</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            គ្រប់គ្រងព័ត៌មានផ្ទាល់ខ្លួន សុវត្ថិភាពគណនី និងពិនិត្យគោលការណ៍ RBAC។
          </p>
        </div>

        {/* User Card */}
        <div
          id="admin-profile-card"
          className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-gold" /> ព័ត៌មានគណនីបច្ចុប្បន្ន
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-2xl bg-secondary/40 p-4 space-y-1">
              <span className="text-muted-foreground">ឈ្មោះ:</span>
              <p className="font-semibold text-sm text-foreground">{user?.name}</p>
            </div>

            <div className="rounded-2xl bg-secondary/40 p-4 space-y-1">
              <span className="text-muted-foreground">អ៊ីមែល (Login ID):</span>
              <p className="font-mono text-sm text-foreground">{user?.email}</p>
            </div>

            <div className="rounded-2xl bg-secondary/40 p-4 space-y-1">
              <span className="text-muted-foreground">តួនាទី (Role):</span>
              <p className="font-semibold text-gold">
                {isSuperAdmin ? "👑 Super Admin (Root Access)" : "✍️ Editor"}
              </p>
            </div>

            <div className="rounded-2xl bg-secondary/40 p-4 space-y-1">
              <span className="text-muted-foreground">ស្ថានភាពគណនី:</span>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">សកម្ម (Active)</p>
            </div>
          </div>
        </div>

        {/* Change Password Form */}
        <div
          id="change-password-card"
          className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Key className="h-4 w-4 text-gold" /> ផ្លាស់ប្តូរពាក្យសម្ងាត់ (Change Password)
          </h2>

          <form
            id="change-password-form"
            onSubmit={handlePasswordChange}
            className="space-y-4 max-w-md"
          >
            <div className="space-y-1.5">
              <Label htmlFor="current-password-input" className="text-xs">
                ពាក្យសម្ងាត់បច្ចុប្បន្ន (Current Password)
              </Label>
              <Input
                id="current-password-input"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="បញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន"
                className="rounded-2xl h-10 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password-input" className="text-xs">
                ពាក្យសម្ងាត់ថ្មី (New Password)
              </Label>
              <Input
                id="new-password-input"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="យ៉ាងតិច ៦ តួអក្សរ"
                className="rounded-2xl h-10 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password-input" className="text-xs">
                ផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់ថ្មី (Confirm New Password)
              </Label>
              <Input
                id="confirm-password-input"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="បញ្ចូលពាក្យសម្ងាត់ថ្មីម្ដងទៀត"
                className="rounded-2xl h-10 text-xs"
                required
              />
            </div>

            <Button
              id="change-password-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 font-medium"
            >
              {isSubmitting ? "កំពុងរក្សាទុក..." : "ផ្លាស់ប្តូរពាក្យសម្ងាត់"}
            </Button>
          </form>
        </div>

        {/* Security Architecture Info */}
        <div
          id="security-architecture-card"
          className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft space-y-4"
        >
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" /> ស្ថាបត្យកម្មសុវត្ថិភាព (Security
            Architecture)
          </h2>

          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              • <strong>Authentication:</strong> ប្រើប្រាស់ Secure, HTTP-Only Cookie ជាមួយ Session
              Secret ការពារការលួចទិន្នន័យ (XSS Protection)។
            </p>
            <p>
              • <strong>Password Hashing:</strong> រាល់ Password ទាំងអស់ត្រូវបាន Hash ជាមួយ Salt
              មុននឹងរក្សាទុកក្នុង Database មិនមានការរក្សាទុកជា Plain Text ឡើយ។
            </p>
            <p>
              • <strong>Server-Side Verification:</strong> ការផ្ទៀងផ្ទាត់ Current Password
              ត្រូវបានធ្វើឡើងនៅលើ Server ដោយផ្ទាល់។
            </p>
            <p>
              • <strong>Session Invalidation:</strong> បន្ទាប់ពីប្តូរពាក្យសម្ងាត់ជោគជ័យ Session
              ចាស់ៗទាំងអស់នឹងត្រូវបានបញ្ចប់ភ្លាមៗ។
            </p>
            <p>
              • <strong>Auditing:</strong> រាល់សកម្មភាពបង្កើត កែប្រែ លុប និង Login/Logout
              ត្រូវបានកត់ត្រាក្នុង Audit Logs ដោយស្វ័យប្រវត្តិ។
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
