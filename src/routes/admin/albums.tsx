import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Search,
  Image as ImageIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Upload,
  RefreshCw,
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
import { toast } from "sonner";
import { toKhmerNumber } from "@/data/archive";
import {
  useAdminAlbums,
  useAdminFestivals,
  useAdminYears,
  useCreateAlbum,
  useUpdateAlbum,
  useDeleteAlbum,
  type AdminAlbum,
} from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/albums")({
  head: () => ({
    meta: [{ title: "គ្រប់គ្រង Albums — Wat Peareang Admin" }],
  }),
  component: AdminAlbumsPage,
});

function AdminAlbumsPage() {
  const navigate = useNavigate();

  // Filters & Pagination state
  const [search, setSearch] = useState("");
  const [selectedFestival, setSelectedFestival] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Queries
  const { data: festivals = [] } = useAdminFestivals();
  const { data: years = [] } = useAdminYears();
  const { data: albumsData, isLoading: loading } = useAdminAlbums({
    page,
    limit: 24,
    search,
    festivalId: selectedFestival,
    year: selectedYear,
  });

  const albums = albumsData?.albums || [];
  const totalPages = albumsData?.totalPages || 1;
  const totalCount = albumsData?.total || 0;

  // Mutations
  const createAlbumMutation = useCreateAlbum();
  const updateAlbumMutation = useUpdateAlbum();
  const deleteAlbumMutation = useDeleteAlbum();

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AdminAlbum | null>(null);

  // Form states
  const [formFestId, setFormFestId] = useState("");
  const [formYear, setFormYear] = useState<number>(2026);
  const [formTitle, setFormTitle] = useState("");
  const [formLocation, setFormLocation] = useState("វត្តពារាំង");
  const [formDescription, setFormDescription] = useState("");
  const [formCoverImage, setFormCoverImage] = useState("");

  const handleAddAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveFestId = formFestId || festivals[0]?.id;
    const effectiveYear = formYear || years[0] || 2026;

    if (!formTitle.trim() || !effectiveFestId || !effectiveYear) {
      toast.error("សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់។");
      return;
    }

    try {
      await createAlbumMutation.mutateAsync({
        festivalId: effectiveFestId,
        year: effectiveYear,
        title: formTitle.trim(),
        location: formLocation.trim() || "វត្តពារាំង",
        description: formDescription.trim() || undefined,
        coverImage: formCoverImage.trim() || undefined,
      });
      toast.success("បានបង្កើត Album ថ្មីជោគជ័យ!");
      setIsAddOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormCoverImage("");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការបង្កើត Album។";
      toast.error(errorMsg);
    }
  };

  const openEditModal = (album: AdminAlbum) => {
    setEditingAlbum(album);
    setFormTitle(album.title);
    setFormLocation(album.location || "វត្តពារាំង");
    setFormDescription(album.description || "");
    setFormCoverImage(album.coverImage || "");
  };

  const handleEditAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlbum) return;

    try {
      await updateAlbumMutation.mutateAsync({
        id: editingAlbum.id,
        title: formTitle.trim(),
        location: formLocation.trim(),
        description: formDescription.trim() || undefined,
        coverImage: formCoverImage.trim() || undefined,
      });
      toast.success("បានកែសម្រួល Album ជោគជ័យ!");
      setEditingAlbum(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការកែប្រែ Album។";
      toast.error(errorMsg);
    }
  };

  const handleDeleteAlbum = async (album: AdminAlbum) => {
    if (
      !confirm(
        `តើលោកអ្នកពិតជាចង់ផ្លាស់ទី Album «${album.title}» ទៅកាន់ធុងសំរាម (Trash) មែនឬទេ?\n(អ្នកអាចស្តារឡើងវិញបានគ្រប់ពេល)`,
      )
    ) {
      return;
    }

    try {
      await deleteAlbumMutation.mutateAsync(album.id);
      toast.success("បានផ្លាស់ទី Album ទៅកាន់ធុងសំរាមរួចរាល់។");
      navigate({ to: "/admin/albums" });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការលុប Album។";
      toast.error(errorMsg);
    }
  };

  return (
    <AdminLayout requiredPermission="manage_albums">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-gold">
                📁 បណ្ដុំរូបភាព
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                សរុប {totalCount} Albums
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              គ្រប់គ្រង Albums
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              រៀបចំ និងគ្រប់គ្រងបណ្ដុំរូបភាពតាមឋានានុក្រម៖ បុណ្យ ➔ ឆ្នាំ ➔ Album ➔ រូបភាព។
            </p>
          </div>

          <Button
            onClick={() => {
              setFormTitle("");
              setFormLocation("វត្តពារាំង");
              setFormDescription("");
              setFormCoverImage("");
              if (festivals.length > 0 && !formFestId && festivals[0])
                setFormFestId(festivals[0].id);
              if (years.length > 0 && years[0] !== undefined) setFormYear(years[0]);
              setIsAddOpen(true);
            }}
            className="rounded-full bg-gold font-medium text-primary-foreground hover:bg-gold/90 shadow-soft"
          >
            <Plus className="mr-1.5 h-4 w-4" /> បង្កើត Album ថ្មី
          </Button>
        </div>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមចំណងជើង..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
          </div>

          <select
            value={selectedFestival}
            onChange={(e) => {
              setSelectedFestival(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground"
          >
            <option value="all">🎉 គ្រប់ពិធីបុណ្យទាំងអស់</option>
            {festivals.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs text-foreground"
          >
            <option value="all">📅 គ្រប់ឆ្នាំទាំងអស់</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                ឆ្នាំ {y} ({toKhmerNumber(y)})
              </option>
            ))}
          </select>
        </div>

        {/* Albums Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground">
              <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
              កំពុងទាញយក Albums...
            </div>
          ) : albums.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-muted-foreground rounded-3xl border border-border/80 bg-card">
              រកមិនឃើញ Album ណាឡើយ។
            </div>
          ) : (
            albums.map((album) => {
              const fest = festivals.find((f) => f.id === album.festivalId);
              return (
                <div
                  key={album.id}
                  className="rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition-all hover:shadow-card flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                        {fest?.emoji || "🎉"} {fest?.name || album.festivalId}
                      </span>
                      <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold">
                        ឆ្នាំ {album.year}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-bold text-foreground">
                        {album.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {album.description || "គ្មានការពិពណ៌នាបន្ថែមឡើយ។"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5 text-gold" /> {album.photoCount} រូបភាព
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> {album.location || "វត្តពារាំង"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full h-8 text-xs"
                    >
                      <Link to={`/admin/images`} search={{ albumId: album.id }}>
                        <Upload className="mr-1 h-3.5 w-3.5" /> Upload រូប
                      </Link>
                    </Button>

                    <div className="flex items-center gap-1">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
                        <a href={`/album/${album.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(album)}
                        className="h-8 w-8 rounded-xl"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deleteAlbumMutation.isPending}
                        onClick={() => handleDeleteAlbum(album)}
                        className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              ទំព័រទី {page} នៃ {totalPages} (សរុប {totalCount} Albums)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-full h-8 text-xs"
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> ថយក្រោយ
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-full h-8 text-xs"
              >
                បន្ទាប់ <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Modal: Create Album */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                ➕ បង្កើត Album ថ្មី
              </DialogTitle>
            </DialogHeader>

            {/* Destination Summary Banner */}
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3.5 text-xs shadow-sm">
              <div className="font-semibold text-gold mb-1 flex items-center gap-1.5">
                <span>📍 គោលដៅបង្កើត Album ក្នុងទិន្នន័យ (PostgreSQL Record)៖</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-foreground font-medium">
                <div>
                  📅 ឆ្នាំ៖{" "}
                  <span className="font-bold text-gold">
                    {formYear || (years[0] ?? 2027)} (
                    {toKhmerNumber(formYear || (years[0] ?? 2027))})
                  </span>
                </div>
                <div>
                  🏮 ពិធីបុណ្យ៖{" "}
                  <span className="font-bold text-gold">
                    {festivals.find((f) => f.id === (formFestId || festivals[0]?.id))?.name ||
                      "បុណ្យ"}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddAlbum} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ជ្រើសរើសពិធីបុណ្យ</Label>
                <select
                  value={formFestId}
                  onChange={(e) => setFormFestId(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-card px-3 h-10 text-xs"
                  required
                >
                  {festivals.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.emoji} {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ជ្រើសរើសឆ្នាំប្រារព្ធ</Label>
                <select
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="w-full rounded-2xl border border-border bg-card px-3 h-10 text-xs"
                  required
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      ឆ្នាំ {y} ({toKhmerNumber(y)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ចំណងជើង Album</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="ឧ. ពិធីដង្ហែផ្កាប្រាក់មហាសាមគ្គី"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ទីកន្លែងប្រារព្ធ</Label>
                <Input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="វត្តពារាំង"
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ការពិពណ៌នាបន្ថែម (ជម្រើស)</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ព័ត៌មានបន្ថែមអំពីកម្មវិធីបុណ្យ..."
                  className="rounded-2xl h-10 text-xs"
                />
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
                  disabled={createAlbumMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {createAlbumMutation.isPending ? "កំពុងបង្កើត..." : "បង្កើត Album"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal: Edit Album */}
        <Dialog open={!!editingAlbum} onOpenChange={(v) => !v && setEditingAlbum(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 shadow-card">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-bold">
                ✏️ កែសម្រួល Album
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditAlbum} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">ចំណងជើង Album</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ទីកន្លែងប្រារព្ធ</Label>
                <Input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="rounded-2xl h-10 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ការពិពណ៌នា</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="ព័ត៌មានបន្ថែម..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">រូបភាពតំណាង (Cover Image URL - ជម្រើស)</Label>
                <Input
                  value={formCoverImage}
                  onChange={(e) => setFormCoverImage(e.target.value)}
                  placeholder="https://..."
                  className="rounded-2xl h-10 text-xs"
                />
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingAlbum(null)}
                  className="rounded-full"
                >
                  បោះបង់
                </Button>
                <Button
                  type="submit"
                  disabled={updateAlbumMutation.isPending}
                  className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90"
                >
                  {updateAlbumMutation.isPending ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
