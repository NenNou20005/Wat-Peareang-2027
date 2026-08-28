import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toKhmerNumber } from "@/data/archive";
import { useAdminYears, useCreateYear, useDeleteYear } from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/years")({
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងឆ្នាំ — Wat Peareang Admin" }],
  }),
  component: AdminYearsPage,
});

function AdminYearsPage() {
  const { data: years = [], isLoading: loading } = useAdminYears();
  const createYearMutation = useCreateYear();
  const deleteYearMutation = useDeleteYear();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newYear, setNewYear] = useState<string>("");

  const handleAddYear = async (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(newYear);
    if (!y || isNaN(y) || y < 1900 || y > 2100) {
      toast.error("សូមបញ្ចូលឆ្នាំឱ្យបានត្រឹមត្រូវ។");
      return;
    }

    try {
      await createYearMutation.mutateAsync(y);
      toast.success(`បានបន្ថែមឆ្នាំ ${y} ជោគជ័យ!`);
      setIsAddOpen(false);
      setNewYear("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចបន្ថែមឆ្នាំបានទេ។";
      toast.error(errorMsg);
    }
  };

  const handleDeleteYear = async (y: number) => {
    if (!confirm(`តើលោកអ្នកពិតជាចង់លុបឆ្នាំ ${y} ចេញពីបណ្ណសារមែនឬទេ?`)) return;

    try {
      await deleteYearMutation.mutateAsync(y);
      toast.success("បានលុបឆ្នាំដោយជោគជ័យ។");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចលុបឆ្នាំបានទេ។";
      toast.error(errorMsg);
    }
  };

  return (
    <AdminLayout requiredPermission="manage_years">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">📅 គ្រប់គ្រងឆ្នាំ</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              បន្ថែម ឬលុបឆ្នាំប្រារព្ធពិធីបុណ្យក្នុងបណ្ណសាររូបភាព។
            </p>
          </div>

          <Button
            onClick={() => setIsAddOpen(true)}
            className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
          >
            <Plus className="mr-1.5 h-4 w-4" /> បន្ថែមឆ្នាំថ្មី
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {loading ? (
            <div className="col-span-full py-12 text-center text-xs text-muted-foreground">
              កំពុងទាញយកទិន្នន័យ...
            </div>
          ) : (
            years.map((y) => (
              <div
                key={y}
                className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 text-center shadow-soft transition-all hover:shadow-card flex flex-col justify-between"
              >
                <div>
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-secondary text-foreground">
                    <Calendar className="h-5 w-5 text-gold" />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">{y}</h3>
                  <p className="text-xs text-muted-foreground">ឆ្នាំ {toKhmerNumber(y)}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-border/50 flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteYearMutation.isPending}
                    onClick={() => handleDeleteYear(y)}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> លុប
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Year Modal */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-xs rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                ➕ បន្ថែមឆ្នាំថ្មី
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleAddYear} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Input
                  type="number"
                  placeholder="ឧ. 2028"
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="rounded-2xl h-11 text-center font-bold text-base"
                  required
                  min={1900}
                  max={2100}
                />
              </div>

              <DialogFooter className="flex gap-2">
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
                  disabled={createYearMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {createYearMutation.isPending ? "កំពុងបន្ថែម..." : "បន្ថែម"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
