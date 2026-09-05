import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  PartyPopper,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  ArrowUp,
  ArrowDown,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useAdminEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useReorderEvents,
  type AdminEvent,
} from "@/hooks/useAdminData";
import { useFestivals, useYears } from "@/hooks/useArchiveData";
import { toKhmerNumber } from "@/data/archive";

export const Route = createFileRoute("/admin/events")({
  head: () => ({
    meta: [{ title: "គ្រប់គ្រងពិធីការរង (Events) — Wat Peareang Admin" }],
  }),
  component: AdminEventsPage,
});

const DEFAULT_ICONS = ["🏮", "🕊️", "🙏", "🌾", "🕯️", "🪷", "🍚", "🎉", "🚣", "🌸", "🤾", "🛕"];

function AdminEventsPage() {
  const { data: festivals = [] } = useFestivals();
  const { data: years = [] } = useYears();

  const [selectedFestival, setSelectedFestival] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: eventData = [], isLoading: loading } = useAdminEvents({
    festivalId: selectedFestival !== "all" ? selectedFestival : undefined,
    year: selectedYear !== "all" ? Number(selectedYear) : undefined,
  });

  const events: AdminEvent[] = useMemo(() => {
    if (!Array.isArray(eventData)) return [];
    if (!search.trim()) return eventData;
    const q = search.toLowerCase().trim();
    return eventData.filter(
      (e) =>
        e.nameKh.toLowerCase().includes(q) ||
        (e.nameEn && e.nameEn.toLowerCase().includes(q)),
    );
  }, [eventData, search]);

  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();
  const deleteEventMutation = useDeleteEvent();
  const reorderEventsMutation = useReorderEvents();

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createFestivalId, setCreateFestivalId] = useState(festivals[0]?.id || "chaul-chnam");
  const [createYear, setCreateYear] = useState<number>(years[0] || 2026);
  const [createNameKh, setCreateNameKh] = useState("");
  const [createNameEn, setCreateNameEn] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEventDate, setCreateEventDate] = useState("");
  const [createLocation, setCreateLocation] = useState("វត្តពារាំង");
  const [createIcon, setCreateIcon] = useState("🏮");
  const [createCoverImage, setCreateCoverImage] = useState("");
  const [createStatus, setCreateStatus] = useState("published");

  // Edit Modal State
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [editFestivalId, setEditFestivalId] = useState("");
  const [editYear, setEditYear] = useState<number>(2026);
  const [editNameKh, setEditNameKh] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editLocation, setEditLocation] = useState("វត្តពារាំង");
  const [editIcon, setEditIcon] = useState("🏮");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editStatus, setEditStatus] = useState("published");

  // Delete Modal State
  const [deletingEvent, setDeletingEvent] = useState<AdminEvent | null>(null);

  const handleOpenCreate = () => {
    setCreateFestivalId(selectedFestival !== "all" ? selectedFestival : festivals[0]?.id || "chaul-chnam");
    setCreateYear(selectedYear !== "all" ? Number(selectedYear) : years[0] || 2026);
    setCreateNameKh("");
    setCreateNameEn("");
    setCreateDescription("");
    setCreateEventDate("");
    setCreateLocation("វត្តពារាំង");
    setCreateIcon("🏮");
    setCreateCoverImage("");
    setCreateStatus("published");
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createNameKh.trim()) {
      toast.error("សូមបញ្ចូលឈ្មោះពិធីការជាភាសាខ្មែរ!");
      return;
    }

    try {
      await createEventMutation.mutateAsync({
        festivalId: createFestivalId,
        year: Number(createYear),
        nameKh: createNameKh.trim(),
        nameEn: createNameEn.trim() || undefined,
        description: createDescription.trim() || undefined,
        eventDate: createEventDate.trim() || undefined,
        location: createLocation.trim() || "វត្តពារាំង",
        icon: createIcon || "🎉",
        coverImage: createCoverImage.trim() || undefined,
        status: createStatus,
        sortOrder: events.length,
      });

      toast.success("បានបង្កើតពិធីការថ្មីដោយជោគជ័យ!");
      setIsCreateOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្កើតពិធីការ។";
      toast.error(msg);
    }
  };

  const handleOpenEdit = (ev: AdminEvent) => {
    setEditingEvent(ev);
    setEditFestivalId(ev.festivalId);
    setEditYear(ev.year);
    setEditNameKh(ev.nameKh);
    setEditNameEn(ev.nameEn || "");
    setEditDescription(ev.description || "");
    setEditEventDate(ev.eventDate || "");
    setEditLocation(ev.location || "វត្តពារាំង");
    setEditIcon(ev.icon || "🏮");
    setEditCoverImage(ev.coverImage || "");
    setEditStatus(ev.status || "published");
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!editNameKh.trim()) {
      toast.error("សូមបញ្ចូលឈ្មោះពិធីការជាភាសាខ្មែរ!");
      return;
    }

    try {
      await updateEventMutation.mutateAsync({
        id: editingEvent.id,
        updates: {
          festivalId: editFestivalId,
          year: Number(editYear),
          nameKh: editNameKh.trim(),
          nameEn: editNameEn.trim() || undefined,
          description: editDescription.trim() || undefined,
          eventDate: editEventDate.trim() || undefined,
          location: editLocation.trim() || "វត្តពារាំង",
          icon: editIcon || "🎉",
          coverImage: editCoverImage.trim() || undefined,
          status: editStatus,
        },
      });

      toast.success("បានកែសម្រួលពិធីការដោយជោគជ័យ!");
      setEditingEvent(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកែប្រែពិធីការ។";
      toast.error(msg);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingEvent) return;
    try {
      await deleteEventMutation.mutateAsync(deletingEvent.id);
      toast.success("បានលុបពិធីការដោយជោគជ័យ (Albums និងរូបថតត្រូវបានរក្សាទុកជាធម្មតា)។");
      setDeletingEvent(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការលុបពិធីការ។";
      toast.error(msg);
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === events.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newItems = [...events];
    const temp = newItems[index]!;
    newItems[index] = newItems[targetIndex]!;
    newItems[targetIndex] = temp;

    try {
      await reorderEventsMutation.mutateAsync(
        newItems.map((item, idx) => ({ id: item.id, sortOrder: idx + 1 })),
      );
      toast.success("បានរៀបលំដាប់ពិធីការជោគជ័យ!");
    } catch {
      toast.error("មានបញ្ហាក្នុងការរៀបលំដាប់។");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              គ្រប់គ្រងពិធីការរង (Events)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              រៀបចំពិធីការតាមឆ្នាំ និងបុណ្យនីមួយៗ (Festival → Year → Event → Albums)
            </p>
          </div>
          <Button
            onClick={handleOpenCreate}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-sm transition-all"
          >
            <Plus className="mr-2 h-4 w-4" /> បង្កើតពិធីការថ្មី
          </Button>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ស្វែងរកពិធីការតាមឈ្មោះខ្មែរ/អង់គ្លេស..."
              className="pl-9 rounded-xl border-border bg-background"
            />
          </div>

          {/* Festival Filter */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold shrink-0" />
            <select
              value={selectedFestival}
              onChange={(e) => setSelectedFestival(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">បុណ្យទាំងអស់</option>
              {festivals.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gold shrink-0" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">ឆ្នាំទាំងអស់</option>
              {years.map((y) => (
                <option key={y} value={String(y)}>
                  ឆ្នាំ {toKhmerNumber(y)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-36 rounded-2xl border border-border bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 p-12 text-center">
            <PartyPopper className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-semibold text-foreground">មិនមានពិធីការនៅឡើយទេ</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              ជ្រើសរើសបុណ្យ និងឆ្នាំផ្សេង ឬចុច «បង្កើតពិធីការថ្មី» ដើម្បីបន្ថែមពិធីការរង។
            </p>
            <Button onClick={handleOpenCreate} variant="outline" className="mt-4 rounded-full">
              <Plus className="mr-2 h-4 w-4" /> បង្កើតពិធីការថ្មី
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev, index) => {
              const fest = festivals.find((f) => f.id === ev.festivalId);
              return (
                <div
                  key={ev.id}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-border/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon / Cover */}
                    <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl shadow-inner overflow-hidden border border-border/60">
                      {ev.coverImage ? (
                        <img
                          src={ev.coverImage}
                          alt={ev.nameKh}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{ev.icon || "🎉"}</span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-foreground truncate">
                          {ev.nameKh}
                        </h3>
                        {ev.nameEn && (
                          <span className="text-xs text-muted-foreground font-normal">
                            ({ev.nameEn})
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            ev.status === "published"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {ev.status === "published" ? "ផ្សព្វផ្សាយ" : "សេចក្តីព្រាង"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/80">
                          {fest?.emoji || "🎉"} {fest?.name || ev.festivalId}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-gold" />
                          ឆ្នាំ {toKhmerNumber(ev.year)}
                        </span>
                        {ev.eventDate && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {ev.eventDate}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {ev.location}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                          <FolderKanban className="h-3.5 w-3.5 text-primary" />
                          {toKhmerNumber(ev.albumCount || 0)} Albums
                        </span>
                      </div>

                      {ev.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                          {ev.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Reorder */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Reorder Buttons */}
                    <div className="flex items-center rounded-xl border border-border bg-background p-0.5">
                      <button
                        type="button"
                        onClick={() => handleMove(index, "up")}
                        disabled={index === 0}
                        title="រំកិលឡើងលើ"
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-secondary transition-colors"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, "down")}
                        disabled={index === events.length - 1}
                        title="រំកិលចុះក្រោម"
                        className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none rounded-lg hover:bg-secondary transition-colors"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(ev)}
                      className="rounded-xl border-border hover:bg-secondary"
                    >
                      <Edit2 className="h-4 w-4 mr-1 text-muted-foreground" /> កែប្រែ
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingEvent(ev)}
                      className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE EVENT MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              បង្កើតពិធីការរងថ្មី
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              ពិធីការរងនឹងត្រូវចងភ្ជាប់ជាមួយបុណ្យ និងឆ្នាំដែលបានជ្រើសរើស
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ពិធីបុណ្យ *</Label>
                <select
                  value={createFestivalId}
                  onChange={(e) => setCreateFestivalId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                >
                  {festivals.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.emoji} {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ឆ្នាំ *</Label>
                <select
                  value={createYear}
                  onChange={(e) => setCreateYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      ឆ្នាំ {toKhmerNumber(y)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ឈ្មោះពិធីការជាភាសាខ្មែរ *</Label>
              <Input
                value={createNameKh}
                onChange={(e) => setCreateNameKh(e.target.value)}
                placeholder="ឧ. 🏮 មហាសង្ក្រាន្ត ឬ 🙏 ពិធីស្រង់ព្រះ"
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ឈ្មោះជាភាសាអង់គ្លេស (Optional)</Label>
              <Input
                value={createNameEn}
                onChange={(e) => setCreateNameEn(e.target.value)}
                placeholder="e.g. Maha Sangkran or Bathing the Buddha"
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">កាលបរិច្ឆេទប្រារព្ធ (Event Date)</Label>
                <Input
                  value={createEventDate}
                  onChange={(e) => setCreateEventDate(e.target.value)}
                  placeholder="ឧ. ១៤ មេសា ២០២៤"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ទីកន្លែង (Location)</Label>
                <Input
                  value={createLocation}
                  onChange={(e) => setCreateLocation(e.target.value)}
                  placeholder="វត្តពារាំង"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Emoji Icon</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DEFAULT_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setCreateIcon(ic)}
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-base transition-all ${
                      createIcon === ic
                        ? "border-primary bg-primary/10 scale-110 shadow-sm"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">រូបភាពតំណាង (Cover Image URL)</Label>
              <Input
                value={createCoverImage}
                onChange={(e) => setCreateCoverImage(e.target.value)}
                placeholder="https://... ឬ upload ពី R2"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ការពិពណ៌នាពីពិធីការ</Label>
              <Textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
                placeholder="រៀបរាប់សង្ខេបពីអត្ថន័យ និងសកម្មភាពក្នុងពិធីការនេះ..."
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ស្ថានភាព (Status)</Label>
              <select
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
              >
                <option value="published">ផ្សព្វផ្សាយ (Published)</option>
                <option value="draft">សេចក្តីព្រាង (Draft)</option>
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full"
              >
                បោះបង់
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                className="rounded-full bg-primary text-primary-foreground font-medium"
              >
                {createEventMutation.isPending ? "កំពុងរក្សាទុក..." : "បង្កើតពិធីការ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT EVENT MODAL */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              កែសម្រួលពិធីការរង
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              កែប្រែព័ត៌មានលម្អិតនៃពិធីការ «{editingEvent?.nameKh}»
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ពិធីបុណ្យ *</Label>
                <select
                  value={editFestivalId}
                  onChange={(e) => setEditFestivalId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                >
                  {festivals.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.emoji} {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ឆ្នាំ *</Label>
                <select
                  value={editYear}
                  onChange={(e) => setEditYear(Number(e.target.value))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      ឆ្នាំ {toKhmerNumber(y)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ឈ្មោះពិធីការជាភាសាខ្មែរ *</Label>
              <Input
                value={editNameKh}
                onChange={(e) => setEditNameKh(e.target.value)}
                required
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ឈ្មោះជាភាសាអង់គ្លេស (Optional)</Label>
              <Input
                value={editNameEn}
                onChange={(e) => setEditNameEn(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">កាលបរិច្ឆេទប្រារព្ធ (Event Date)</Label>
                <Input
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  placeholder="ឧ. ១៤ មេសា ២០២៤"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">ទីកន្លែង (Location)</Label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Emoji Icon</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {DEFAULT_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setEditIcon(ic)}
                    className={`grid h-9 w-9 place-items-center rounded-xl border text-base transition-all ${
                      editIcon === ic
                        ? "border-primary bg-primary/10 scale-110 shadow-sm"
                        : "border-border bg-background hover:bg-secondary"
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">រូបភាពតំណាង (Cover Image URL)</Label>
              <Input
                value={editCoverImage}
                onChange={(e) => setEditCoverImage(e.target.value)}
                placeholder="https://... ឬ upload ពី R2"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ការពិពណ៌នា</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">ស្ថានភាព (Status)</Label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/20"
              >
                <option value="published">ផ្សព្វផ្សាយ (Published)</option>
                <option value="draft">សេចក្តីព្រាង (Draft)</option>
              </select>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingEvent(null)}
                className="rounded-full"
              >
                បោះបង់
              </Button>
              <Button
                type="submit"
                disabled={updateEventMutation.isPending}
                className="rounded-full bg-primary text-primary-foreground font-medium"
              >
                {updateEventMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុកការកែប្រែ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-destructive">
              <AlertCircle className="h-5 w-5" /> បញ្ជាក់ការលុបពិធីការ
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              តើអ្នកពិតជាចង់លុបពិធីការ «{deletingEvent?.nameKh}» មែនទេ?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-foreground/80 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>ការធានាសុវត្ថិភាពទិន្នន័យ (Data Safety)</span>
            </div>
            <p>
              ការលុបពិធីការនេះ នឹង **មិនធ្វើឱ្យបាត់បង់ Albums ឬរូបថតឡើយ**។ Albums ដែលធ្លាប់ស្ថិតក្នុងពិធីការនេះ នឹងត្រូវប្រែក្លាយជា Albums ទូទៅដោយស្វ័យប្រវត្ត។
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletingEvent(null)}
              className="rounded-full"
            >
              បោះបង់
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteEventMutation.isPending}
              onClick={handleDeleteSubmit}
              className="rounded-full"
            >
              {deleteEventMutation.isPending ? "កំពុងលុប..." : "យល់ព្រមលុប"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
