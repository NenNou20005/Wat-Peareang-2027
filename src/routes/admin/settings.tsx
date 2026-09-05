import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import { Key, ShieldCheck, UserCheck, Keyboard, RotateCcw, Save, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getStoredAdminShortcut,
  saveStoredAdminShortcut,
  resetStoredAdminShortcut,
  formatShortcutKeyTokens,
  DEFAULT_ADMIN_SHORTCUT,
  isMacOS,
  type AdminShortcutConfig,
} from "@/config/adminShortcut";
import { HeroImageManager } from "@/components/admin/HeroImageManager";
import { DeveloperProfileManager } from "@/components/admin/DeveloperProfileManager";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [{ title: "ការកំណត់ — Wat Peareang Admin" }],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { user, isSuperAdmin, refetchUser } = useAuth();
  const navigate = useNavigate();

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Shortcut state
  const [savedShortcut, setSavedShortcut] = useState<AdminShortcutConfig>(getStoredAdminShortcut);
  const [recordedShortcut, setRecordedShortcut] =
    useState<AdminShortcutConfig>(getStoredAdminShortcut);
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [liveKeysPreview, setLiveKeysPreview] = useState<string[]>([]);
  const isMac = isMacOS();

  // Load shortcut from server on mount
  useEffect(() => {
    fetch("/api/admin/settings/shortcut")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setSavedShortcut(res.data);
          setRecordedShortcut(res.data);
          saveStoredAdminShortcut(res.data);
        }
      })
      .catch(() => {});
  }, []);

  // Shortcut Recorder Listener
  useEffect(() => {
    if (!isRecording) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();

      // Cancel on Escape if no modifiers are held
      if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        setIsRecording(false);
        setLiveKeysPreview([]);
        toast.info("បានបោះបង់ការបញ្ចូល Shortcut");
        return;
      }

      // Ignore if user only pressed a modifier key by itself
      const modifierKeys = ["Control", "Shift", "Alt", "Meta"];
      if (modifierKeys.includes(e.key)) {
        // Show live modifier preview
        const tokens: string[] = [];
        if (isMac) {
          if (e.ctrlKey) tokens.push("Control");
          if (e.altKey) tokens.push("Option");
          if (e.shiftKey) tokens.push("Shift");
          if (e.metaKey) tokens.push("Command");
        } else {
          if (e.ctrlKey) tokens.push("Ctrl");
          if (e.altKey) tokens.push("Alt");
          if (e.shiftKey) tokens.push("Shift");
          if (e.metaKey) tokens.push("Win");
        }
        setLiveKeysPreview(tokens);
        return;
      }

      // We have a valid primary key!
      let primaryKey = e.key;
      if (primaryKey.length === 1) {
        primaryKey = primaryKey.toUpperCase();
      }

      // Validate key
      if (!/^[A-Z0-9]$/.test(primaryKey)) {
        toast.error("សូមជ្រើសរើសអក្សរ A-Z ឬលេខ 0-9 សម្រាប់គ្រាប់ចុចចម្បង។");
        return;
      }

      // Validate modifiers: must have at least one modifier
      const hasModifier = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      if (!hasModifier) {
        toast.error("Shortcut ត្រូវតែមានយ៉ាងតិច modifier key មួយ (Ctrl, Alt, Shift ឬ Cmd/Win)។");
        return;
      }

      const newConfig: AdminShortcutConfig = {
        key: primaryKey,
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        metaKey: e.metaKey,
        targetRoute: "/admin",
      };

      setRecordedShortcut(newConfig);
      setIsRecording(false);
      setLiveKeysPreview([]);
      toast.success(
        `បានជ្រើសរើស: ${formatShortcutKeyTokens(newConfig, isMac).join(" + ")} (សូមចុច «រក្សាទុក» ដើម្បីអនុវត្ត)`,
      );
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isRecording, isMac]);

  // Save Shortcut
  const handleSaveShortcut = async () => {
    if (!recordedShortcut.key) {
      toast.error("សូមបញ្ចូល Shortcut ឱ្យបានត្រឹមត្រូវ។");
      return;
    }

    setIsSavingShortcut(true);
    try {
      // 1. Save to local storage & broadcast event
      saveStoredAdminShortcut(recordedShortcut);
      setSavedShortcut(recordedShortcut);

      // 2. Sync to server API
      await fetch("/api/admin/settings/shortcut", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recordedShortcut),
      });

      toast.success("✅ Shortcut ត្រូវបានរក្សាទុក");
    } catch {
      toast.error("មានបញ្ហាក្នុងការរក្សាទុក Shortcut។");
    } finally {
      setIsSavingShortcut(false);
    }
  };

  // Reset Shortcut to Default
  const handleResetShortcut = async () => {
    if (
      !confirm(
        `តើលោកអ្នកពិតជាចង់កំណត់ Shortcut ទៅជាទម្រង់ដើម (${formatShortcutKeyTokens(DEFAULT_ADMIN_SHORTCUT, isMac).join(" + ")}) វិញមែនឬទេ?`,
      )
    ) {
      return;
    }

    setIsSavingShortcut(true);
    try {
      // 1. Reset in local storage & broadcast
      resetStoredAdminShortcut();
      setSavedShortcut(DEFAULT_ADMIN_SHORTCUT);
      setRecordedShortcut(DEFAULT_ADMIN_SHORTCUT);

      // 2. Reset on server API
      await fetch("/api/admin/settings/shortcut/reset", { method: "POST" });

      toast.success("✅ បានកំណត់ Shortcut ទៅជាទម្រង់ដើមវិញរួចរាល់។");
    } catch {
      toast.error("មានបញ្ហាក្នុងការកំណត់ Shortcut ឡើងវិញ។");
    } finally {
      setIsSavingShortcut(false);
    }
  };

  // Password Change Handler
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

    setIsSubmittingPassword(true);
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
      setIsSubmittingPassword(false);
    }
  };

  const isShortcutModified = JSON.stringify(recordedShortcut) !== JSON.stringify(savedShortcut);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">⚙️ ការកំណត់ប្រព័ន្ធ</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            គ្រប់គ្រងរូបភាពទំព័រដើម រូបថតអ្នកអភិវឌ្ឍន៍ ព័ត៌មានផ្ទាល់ខ្លួន សុវត្ថិភាពគណនី និងផ្លាស់ប្តូរគ្រាប់ចុចកាត់ Admin (Shortcut)។
          </p>
        </div>

        {/* 1. Homepage Hero Image Manager */}
        <HeroImageManager />

        {/* 2. Developer Profile Photo Manager */}
        <DeveloperProfileManager />

        {/* 3. Admin Keyboard Shortcut Settings Card */}
        <div
          id="admin-shortcut-settings-card"
          className="rounded-3xl border border-border/80 bg-card p-6 shadow-soft space-y-5"
        >
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-gold" /> 🔐 Admin Keyboard Shortcut
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              កំណត់ Shortcut សម្រាប់ចូលទៅកាន់ផ្ទាំងគ្រប់គ្រង Admin។ អ្នកអាចផ្លាស់ប្តូរ Shortcut
              បានដោយមិនចាំបាច់កែ Code។
            </p>
          </div>

          {/* Current & Recorded Shortcut Visual Display */}
          <div className="rounded-2xl border border-border/70 bg-secondary/30 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-foreground">Shortcut បច្ចុប្បន្ន:</span>
                <p className="text-[11px] text-muted-foreground">
                  ចុចគ្រាប់ចុចនេះនៅលើទំព័រណាមួយដើម្បីចូលកាន់ Admin
                </p>
              </div>

              {/* Styled Keycap Badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {formatShortcutKeyTokens(savedShortcut, isMac).map((token, idx) => (
                  <span key={idx} className="flex items-center gap-1.5">
                    <kbd className="inline-flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-xl border border-gold/40 bg-card text-foreground font-mono text-xs font-bold shadow-soft">
                      {token}
                    </kbd>
                    {idx < formatShortcutKeyTokens(savedShortcut, isMac).length - 1 && (
                      <span className="text-xs font-bold text-muted-foreground">+</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            {/* Recorder Active Banner */}
            {isRecording ? (
              <div className="mt-3 rounded-2xl border-2 border-dashed border-gold bg-gold/10 p-5 text-center space-y-2 animate-pulse">
                <p className="text-xs font-bold text-gold flex items-center justify-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                  កំពុងរង់ចាំការចុច Keyboard...
                </p>
                <p className="text-[11px] text-foreground">
                  សូមចុចគ្រាប់ចុចនៅលើ Keyboard របស់លោកអ្នក (ឧ. Ctrl + Shift + M ឬ Alt + F9)
                </p>
                {liveKeysPreview.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {liveKeysPreview.map((token, idx) => (
                      <kbd
                        key={idx}
                        className="px-2 py-1 rounded-lg border border-gold bg-background text-xs font-mono font-bold"
                      >
                        {token}
                      </kbd>
                    ))}
                    <span className="text-xs text-muted-foreground">+ ...</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground pt-1">
                  ចុច <kbd className="px-1.5 py-0.5 rounded bg-card border text-[10px]">Esc</kbd>{" "}
                  ដើម្បីបោះបង់
                </p>
              </div>
            ) : isShortcutModified ? (
              <div className="mt-3 rounded-2xl border border-gold/50 bg-gold/10 p-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
                  <span>
                    បានជ្រើសរើសថ្មី:{" "}
                    <strong>{formatShortcutKeyTokens(recordedShortcut, isMac).join(" + ")}</strong>
                  </span>
                </div>
                <span className="text-[11px] text-gold font-medium">មិនទាន់បានរក្សាទុក</span>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={() => setIsRecording(true)}
              variant={isRecording ? "secondary" : "outline"}
              className="rounded-full text-xs font-semibold h-9 px-4"
              disabled={isRecording}
            >
              <Keyboard className="mr-1.5 h-3.5 w-3.5 text-gold" />
              {isRecording ? "កំពុងបញ្ចូល..." : "⌨️ ចុចបញ្ចូល Shortcut"}
            </Button>

            {isShortcutModified && (
              <Button
                type="button"
                onClick={handleSaveShortcut}
                disabled={isSavingShortcut}
                className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 text-xs font-semibold h-9 px-4 shadow-soft"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isSavingShortcut ? "កំពុងរក្សាទុក..." : "💾 រក្សាទុក"}
              </Button>
            )}

            <Button
              type="button"
              onClick={handleResetShortcut}
              disabled={isSavingShortcut}
              variant="ghost"
              className="rounded-full text-xs text-muted-foreground hover:text-foreground h-9 px-3"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              ↩️ កំណត់ទៅ Shortcut ដើម
            </Button>
          </div>
        </div>

        {/* 2. User Profile Card */}
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

        {/* 3. Change Password Form */}
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
              disabled={isSubmittingPassword}
              className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 font-medium"
            >
              {isSubmittingPassword ? "កំពុងរក្សាទុក..." : "ផ្លាស់ប្តូរពាក្យសម្ងាត់"}
            </Button>
          </form>
        </div>

        {/* 4. Security Architecture Info */}
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
