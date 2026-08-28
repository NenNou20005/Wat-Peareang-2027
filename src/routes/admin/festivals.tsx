import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
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
import { toast } from "sonner";
import { AddFestivalModal } from "@/components/site/AddFestivalModal";
import {
  useAdminFestivals,
  useUpdateFestival,
  useDeleteFestival,
  type AdminFestival,
} from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/festivals")({
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងបុណ្យ — Wat Peareang Admin" }],
  }),
  component: AdminFestivalsPage,
});

function AdminFestivalsPage() {
  const { data: festivals = [], isLoading: loading } = useAdminFestivals();
  const updateFestivalMutation = useUpdateFestival();
  const deleteFestivalMutation = useDeleteFestival();

  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Edit modal
  const [editingFest, setEditingFest] = useState<AdminFestival | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editMonth, setEditMonth] = useState("");

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFest) return;

    try {
      await updateFestivalMutation.mutateAsync({
        id: editingFest.id,
        name: editName,
        emoji: editEmoji,
        month: editMonth,
      });
      toast.success("បានកែប្រែព័ត៌មានបុណ្យជោគជ័យ!");
      setEditingFest(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកែប្រែ។";
      toast.error(errorMsg);
    }
  };

  const handleDelete = async (fest: AdminFestival) => {
    if (!confirm(`តើលោកអ្នកពិតជាចង់លុបពិធីបុណ្យ «${fest.name}» មែនឬទេ?`)) return;

    try {
      await deleteFestivalMutation.mutateAsync(fest.id);
      toast.success("បានលុបពិធីបុណ្យដោយជោគជ័យ។");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការលុប។";
      toast.error(errorMsg);
    }
  };

  const filtered = festivals.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AdminLayout requiredPermission="manage_festivals">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              🎉 គ្រប់គ្រងពិធីបុណ្យ
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              បន្ថែម កែប្រែ ឬលុបប្រភេទពិធីបុណ្យក្នុងបណ្ណសារវត្តពារាំង។
            </p>
          </div>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
          >
            <Plus className="mr-1.5 h-4 w-4" /> បន្ថែមពិធីបុណ្យថ្មី
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកពិធីបុណ្យ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
              កំពុងទាញយកទិន្នន័យ...
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
              មិនមានពិធីបុណ្យឡើយ។
            </div>
          ) : (
            filtered.map((fest) => (
              <div
                key={fest.id}
                className="rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all hover:shadow-card flex flex-col justify-between"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-2xl">
                      {fest.emoji}
                    </span>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{fest.name}</h3>
                      <p className="text-xs text-muted-foreground">{fest.month}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground font-mono">ID: {fest.id}</span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingFest(fest);
                        setEditName(fest.name);
                        setEditEmoji(fest.emoji);
                        setEditMonth(fest.month);
                      }}
                      className="h-8 w-8 rounded-xl"
                      title="កែសម្រួល"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={deleteFestivalMutation.isPending}
                      onClick={() => handleDelete(fest)}
                      className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                      title="លុប"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Festival Modal */}
        <AddFestivalModal
          open={isAddOpen}
          onOpenChange={setIsAddOpen}
          existingFestivalIds={festivals.map((f) => f.id)}
        />

        {/* Edit Festival Modal */}
        <Dialog open={!!editingFest} onOpenChange={(v) => !v && setEditingFest(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                ✏️ កែសម្រួលពិធីបុណ្យ
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEdit} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ឈ្មោះពិធីបុណ្យ</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">រូបសញ្ញា (Emoji)</Label>
                <Input
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ខែប្រារព្ធ</Label>
                <Input
                  value={editMonth}
                  onChange={(e) => setEditMonth(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingFest(null)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={updateFestivalMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {updateFestivalMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
