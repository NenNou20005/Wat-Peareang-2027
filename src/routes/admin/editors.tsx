import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Key,
  Mail,
  User as UserIcon,
  Shield,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { AVAILABLE_PERMISSIONS, type User, type Permission } from "@/types/auth";

import {
  useAdminEditors,
  useCreateEditor,
  useUpdateEditor,
  useDeleteEditor,
} from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/editors")({
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងអ្នកកែសម្រួល — Wat Peareang Admin" }],
  }),
  component: EditorsManagementPage,
});

function EditorsManagementPage() {
  const { isSuperAdmin } = useAuth();
  const { data: users = [], isLoading: loading } = useAdminEditors();
  const createEditorMutation = useCreateEditor();
  const updateEditorMutation = useUpdateEditor();
  const deleteEditorMutation = useDeleteEditor();

  const [search, setSearch] = useState("");

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form states for Add
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPermissions, setAddPermissions] = useState<Permission[]>([
    "view_images",
    "upload_images",
    "edit_images",
  ]);

  // Form states for Edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPermissions, setEditPermissions] = useState<Permission[]>([]);
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");

  const handleAddEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName || !addEmail || !addPassword) {
      toast.error("សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់។");
      return;
    }
    if (addPassword.length < 6) {
      toast.error("ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។");
      return;
    }

    try {
      await createEditorMutation.mutateAsync({
        name: addName,
        email: addEmail,
        password: addPassword,
        permissions: addPermissions,
      });
      toast.success(`បានបង្កើត Editor «${addName}» ដោយជោគជ័យ!`);
      setIsAddOpen(false);
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddPermissions(["view_images", "upload_images", "edit_images"]);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចបង្កើត Editor បានទេ។";
      toast.error(errorMsg);
    }
  };

  const openEditModal = (u: User) => {
    setSelectedUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setEditPermissions(u.permissions || []);
    setEditStatus(u.status);
    setIsEditOpen(true);
  };

  const handleEditEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      await updateEditorMutation.mutateAsync({
        id: selectedUser.id,
        name: editName,
        email: editEmail,
        permissions: editPermissions,
        status: editStatus,
        password: editPassword || undefined,
      });
      toast.success("បានកែសម្រួលព័ត៌មាន Editor ជោគជ័យ!");
      setIsEditOpen(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចកែសម្រួលបានទេ។";
      toast.error(errorMsg);
    }
  };

  const handleToggleStatus = async (u: User) => {
    if (u.role === "super_admin") {
      toast.error("មិនអាចផ្លាស់ប្តូរស្ថានភាព Super Admin បានឡើយ។");
      return;
    }
    const newStatus = u.status === "active" ? "disabled" : "active";
    try {
      await updateEditorMutation.mutateAsync({
        id: u.id,
        name: u.name,
        email: u.email,
        permissions: u.permissions,
        status: newStatus,
      });
      toast.success(
        newStatus === "active" ? `បានបើកដំណើរការគណនី ${u.name}` : `បានផ្អាកដំណើរការគណនី ${u.name}`,
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាបច្ចេកទេស។";
      toast.error(errorMsg);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.role === "super_admin") {
      toast.error("មិនអាចលុប Super Admin បានជាដាច់ខាត!");
      return;
    }
    if (!confirm(`តើលោកអ្នកពិតជាចង់លុបគណនី Editor «${u.name}» មែនឬទេ?`)) {
      return;
    }

    try {
      await deleteEditorMutation.mutateAsync(u.id);
      toast.success("បានលុបគណនី Editor ដោយជោគជ័យ។");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាបច្ចេកទេសក្នុងការលុប។";
      toast.error(errorMsg);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout superAdminOnly={true}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                👑 Super Admin Access Only
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រងអ្នកកែសម្រួល (Editors)
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              បង្កើត កំណត់សិទ្ធិ (RBAC) ផ្អាក ឬលុបគណនី Editor។ Super Admin ត្រូវបានរក្សាទុកតែ ១
              នាក់គត់។
            </p>
          </div>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
          >
            <UserPlus className="mr-1.5 h-4 w-4" /> បន្ថែម Editor ថ្មី
          </Button>
        </div>

        {/* Security Rule Card */}
        <div className="rounded-2xl border border-gold/30 bg-gold-soft/20 p-4 text-xs">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                គោលការណ៍សុវត្ថិភាព Super Admin Invariant (1-Admin Rule)
              </p>
              <p className="text-muted-foreground leading-relaxed">
                ប្រព័ន្ធត្រូវបានកំណត់យ៉ាងតឹងរឹងដើម្បីធានាថាមាន **Super Admin តែ ១ នាក់គត់**។
                គ្មានអ្នកណាម្នាក់អាចបង្កើត Super Admin ទីពីរ ឬតម្លើងតួនាទី Editor ទៅជា Super Admin
                បានឡើយ។
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមឈ្មោះ ឬអ៊ីមែល..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-secondary/50 font-medium text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">ឈ្មោះ & អ៊ីមែល</th>
                  <th className="px-5 py-3.5">តួនាទី</th>
                  <th className="px-5 py-3.5">ស្ថានភាព</th>
                  <th className="px-5 py-3.5">សិទ្ធិអនុញ្ញាត (Permissions)</th>
                  <th className="px-5 py-3.5">ចូលចុងក្រោយ</th>
                  <th className="px-5 py-3.5 text-right">សកម្មភាព</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      កំពុងទាញយកទិន្នន័យ...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-muted-foreground">
                      មិនមានអ្នកកែសម្រួលឡើយ។
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSuper = u.role === "super_admin";
                    return (
                      <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`grid h-9 w-9 place-items-center rounded-xl font-semibold ${
                                isSuper ? "bg-gold/20 text-gold" : "bg-secondary text-foreground"
                              }`}
                            >
                              {isSuper ? "👑" : "✍️"}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              isSuper
                                ? "bg-gold/15 text-gold border border-gold/30"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {isSuper ? "Super Admin" : "Editor"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          {u.status === "active" ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> សកម្ម
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <XCircle className="h-3.5 w-3.5" /> ផ្អាក (Disabled)
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {isSuper ? (
                            <span className="text-[11px] font-medium text-gold">
                              សិទ្ធិពេញលេញទាំងអស់ (All Permissions)
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {u.permissions?.length ? (
                                u.permissions.map((p) => {
                                  const def = AVAILABLE_PERMISSIONS.find((x) => x.id === p);
                                  return (
                                    <span
                                      key={p}
                                      className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-foreground"
                                    >
                                      {def ? def.labelKhmer.replace("គ្រប់គ្រង", "").trim() : p}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-muted-foreground text-[10px]">
                                  គ្មានសិទ្ធិ
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-muted-foreground font-mono text-[11px]">
                          {u.lastLoginAt
                            ? new Date(u.lastLoginAt).toLocaleDateString("km-KH", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "មិនទាន់ចូល"}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {isSuper ? (
                            <span className="text-[10px] text-muted-foreground italic">
                              ប្រព័ន្ធការពារ Root
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleStatus(u)}
                                className={`h-8 rounded-xl px-2 text-xs ${
                                  u.status === "active"
                                    ? "text-amber-600 hover:bg-amber-500/10"
                                    : "text-emerald-600 hover:bg-emerald-500/10"
                                }`}
                                title={u.status === "active" ? "ផ្អាកដំណើរការ" : "បើកដំណើរការ"}
                              >
                                {u.status === "active" ? "ផ្អាក" : "បើក"}
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(u)}
                                className="h-8 w-8 rounded-xl text-foreground hover:bg-secondary"
                                title="កែប្រែព័ត៌មាន & សិទ្ធិ"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteUser(u)}
                                className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                                title="លុប Editor"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Add Editor */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                ➕ បន្ថែម Editor ថ្មី
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddEditor} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ឈ្មោះ Editor</Label>
                <Input
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="ឧ. តារា វឌ្ឍនៈ"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">អ៊ីមែល (Email សម្រាប់ Login)</Label>
                <Input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="dara@watpeareang.org"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ពាក្យសម្ងាត់ដំបូង (Initial Password)</Label>
                <Input
                  type="password"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="យ៉ាងតិច ៦ តួអក្សរ"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-foreground">
                  កំណត់សិទ្ធិអនុញ្ញាត (Permissions RBAC):
                </Label>
                <div className="space-y-2 rounded-2xl border border-border/80 bg-secondary/30 p-3 max-h-48 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = addPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className="flex items-start gap-2.5 cursor-pointer text-xs p-1 rounded-lg hover:bg-background/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setAddPermissions([...addPermissions, perm.id]);
                            } else {
                              setAddPermissions(addPermissions.filter((p) => p !== perm.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{perm.labelKhmer}</p>
                          <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={createEditorMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {createEditorMutation.isPending ? "កំពុងបង្កើត..." : "បង្កើត Editor"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Editor */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold text-foreground">
                ✏️ កែសម្រួល Editor: {selectedUser?.name}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditEditor} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ឈ្មោះ Editor</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">អ៊ីមែល (Email)</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ប្តូរពាក្យសម្ងាត់ថ្មី (ទុកទំនេរប្រសិនបើមិនប្តូរ)</Label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="បញ្ចូលពាក្យសម្ងាត់ថ្មី..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ស្ថានភាពគណនី</Label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as "active" | "disabled")}
                  className="w-full rounded-2xl border border-border bg-background px-3 h-10 text-xs"
                >
                  <option value="active">សកម្ម (Active)</option>
                  <option value="disabled">ផ្អាកដំណើរការ (Disabled)</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <Label className="text-xs font-semibold text-foreground">
                  កំណត់សិទ្ធិអនុញ្ញាត (Permissions):
                </Label>
                <div className="space-y-2 rounded-2xl border border-border/80 bg-secondary/30 p-3 max-h-48 overflow-y-auto">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const checked = editPermissions.includes(perm.id);
                    return (
                      <label
                        key={perm.id}
                        className="flex items-start gap-2.5 cursor-pointer text-xs p-1 rounded-lg hover:bg-background/60"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => {
                            if (val) {
                              setEditPermissions([...editPermissions, perm.id]);
                            } else {
                              setEditPermissions(editPermissions.filter((p) => p !== perm.id));
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{perm.labelKhmer}</p>
                          <p className="text-[10px] text-muted-foreground">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={updateEditorMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {updateEditorMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុកការកែប្រែ"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
