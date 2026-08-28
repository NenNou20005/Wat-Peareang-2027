import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/hooks/useAuth";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  FolderKanban,
  Image as ImageIcon,
  Search,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

import {
  useAdminTrash,
  useRestoreTrashItem,
  usePermanentDeleteTrashItem,
} from "@/hooks/useAdminData";

export const Route = createFileRoute("/admin/trash")({
  head: () => ({
    meta: [{ title: "ធុងសំរាម (Trash & Recovery) — Wat Peareang Admin" }],
  }),
  component: AdminTrashPage,
});

function AdminTrashPage() {
  const { isSuperAdmin, hasPermission } = useAuth();
  const {
    data = { festivals: [], albums: [], images: [] },
    isLoading: loading,
    refetch: fetchTrash,
  } = useAdminTrash();
  const restoreMutation = useRestoreTrashItem();
  const permanentDeleteMutation = usePermanentDeleteTrashItem();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "festivals" | "albums" | "images">("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Restore Handlers
  const handleRestore = async (type: "festival" | "album" | "image", id: string, name: string) => {
    setActionLoadingId(id);
    try {
      await restoreMutation.mutateAsync({ type, id });
      toast.success(`បានស្តារ «${name}» ត្រឡប់មកវិញដោយជោគជ័យ!`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចស្តារឡើងវិញបានទេ។";
      toast.error(errorMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Permanent Delete Handlers (Super Admin Only)
  const handlePermanentDelete = async (
    type: "festival" | "album" | "image",
    id: string,
    name: string,
  ) => {
    if (!isSuperAdmin) {
      toast.error("មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបទិន្នន័យជាអចិន្ត្រៃយ៍បាន!");
      return;
    }

    if (
      !confirm(
        `⚠️ ការព្រមានខ្ពស់៖ តើលោកអ្នកពិតជាចង់លុប «${name}» ជាអចិន្ត្រៃយ៍មែនឬទេ?\n\nទិន្នន័យដែលបានលុបជាអចិន្ត្រៃយ៍ នឹងមិនអាចស្តារឡើងវិញបានឡើយ!`,
      )
    ) {
      return;
    }

    setActionLoadingId(id);
    try {
      await permanentDeleteMutation.mutateAsync({ type, id });
      toast.success(`បានលុប «${name}» ជាអចិន្ត្រៃយ៍រួចរាល់។`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "មិនអាចលុបជាអចិន្ត្រៃយ៍បានទេ។";
      toast.error(errorMsg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const totalTrashed = data.festivals.length + data.albums.length + data.images.length;

  const filteredFestivals = data.festivals.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredAlbums = data.albums.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.festivalId.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredImages = data.images.filter((i) =>
    i.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout requiredPermission="manage_trash">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                🗑️ Soft Delete & Recovery
              </span>
              <span className="text-xs text-muted-foreground">
                សរុប៖ {totalTrashed} ធាតុក្នុងធុងសំរាម
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">
              ធុងសំរាម (Trash Management)
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              គ្រប់គ្រងទិន្នន័យដែលត្រូវបានលុបបណ្តោះអាសន្ន។ លោកអ្នកអាចស្តារ (Restore)
              ត្រឡប់មកវិញបានគ្រប់ពេលវេលា។
            </p>
          </div>

          <Button
            onClick={() => {
              void fetchTrash();
            }}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> ផ្ទុកឡើងវិញ
          </Button>
        </div>

        {/* Super Admin Notice */}
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                សុវត្ថិភាពទិន្នន័យ៖ គ្មានការបាត់បង់ទិន្នន័យដោយអចេតនា
              </p>
              <p className="text-muted-foreground leading-relaxed">
                រាល់ការលុបពិធីបុណ្យ Album ឬរូបភាពពីផ្ទាំងធម្មតា គឺគ្រាន់តែផ្លាស់ទីមកកាន់ធុងសំរាមនេះ
                (Soft Delete) ប៉ុណ្ណោះ។ មានតែ <strong>Super Admin</strong>{" "}
                ប៉ុណ្ណោះដែលអាចបញ្ជាក់ការលុបជា
                <strong>អចិន្ត្រៃយ៍ (Permanent Delete)</strong>។
              </p>
            </div>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-border/80 bg-card p-1">
            <button
              onClick={() => setTab("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                tab === "all"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ទាំងអស់ ({totalTrashed})
            </button>
            <button
              onClick={() => setTab("festivals")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                tab === "festivals"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> បុណ្យ ({data.festivals.length})
            </button>
            <button
              onClick={() => setTab("albums")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                tab === "albums"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" /> Albums ({data.albums.length})
            </button>
            <button
              onClick={() => setTab("images")}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all flex items-center gap-1.5 ${
                tab === "images"
                  ? "bg-gold text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" /> រូបភាព ({data.images.length})
            </button>
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកក្នុងធុងសំរាម..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-9 h-9 text-xs bg-card"
            />
          </div>
        </div>

        {/* Content Lists */}
        {loading ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gold" />
            កំពុងផ្ទុកទិន្នន័យធុងសំរាម...
          </div>
        ) : totalTrashed === 0 ? (
          <div className="rounded-3xl border border-border/80 bg-card p-12 text-center shadow-soft">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-2xl">
              ✨
            </div>
            <h3 className="font-semibold text-foreground">ធុងសំរាមទទេស្អាត</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              មិនមានទិន្នន័យណាមួយត្រូវបានលុប ឬស្ថិតក្នុងធុងសំរាមឡើយ។
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Festivals Section */}
            {(tab === "all" || tab === "festivals") && filteredFestivals.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" /> ពិធីបុណ្យក្នុងធុងសំរាម (
                  {filteredFestivals.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredFestivals.map((fest) => (
                    <div
                      key={fest.id}
                      className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-xl">
                          {fest.emoji}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">
                            {fest.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            ID: {fest.id}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore("festival", fest.id, fest.name)}
                          disabled={actionLoadingId === fest.id}
                          className="h-8 rounded-xl text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          title="ស្តារពិធីបុណ្យឡើងវិញ"
                        >
                          <RotateCcw className="h-3 w-3" /> ស្តារ
                        </Button>

                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePermanentDelete("festival", fest.id, fest.name)}
                            disabled={actionLoadingId === fest.id}
                            className="h-8 w-8 rounded-xl p-0 text-destructive hover:bg-destructive/10"
                            title="លុបជាអចិន្ត្រៃយ៍"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Albums Section */}
            {(tab === "all" || tab === "albums") && filteredAlbums.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5 text-blue-500" /> Albums ក្នុងធុងសំរាម (
                  {filteredAlbums.length})
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAlbums.map((album) => (
                    <div
                      key={album.id}
                      className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-foreground">
                            {album.festivalId}
                          </span>
                          <span className="text-[10px] font-semibold text-gold font-mono">
                            ឆ្នាំ {album.year}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-foreground">
                          {album.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {album.photoCount} រូបភាព
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestore("album", album.id, album.title)}
                          disabled={actionLoadingId === album.id}
                          className="h-8 rounded-xl text-xs gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                          title="ស្តារ Album ឡើងវិញ"
                        >
                          <RotateCcw className="h-3 w-3" /> ស្តារ
                        </Button>

                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePermanentDelete("album", album.id, album.title)}
                            disabled={actionLoadingId === album.id}
                            className="h-8 w-8 rounded-xl p-0 text-destructive hover:bg-destructive/10"
                            title="លុបជាអចិន្ត្រៃយ៍"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Images Section */}
            {(tab === "all" || tab === "images") && filteredImages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-purple-500" /> រូបភាពក្នុងធុងសំរាម (
                  {filteredImages.length})
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {filteredImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-soft"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-secondary">
                        <img
                          src={img.url}
                          alt={img.title}
                          className="h-full w-full object-cover opacity-75 grayscale transition-all group-hover:grayscale-0 group-hover:opacity-100"
                        />
                      </div>

                      <div className="p-2">
                        <p className="truncate text-[11px] font-semibold text-foreground">
                          {img.title}
                        </p>
                        <p className="truncate text-[9px] text-muted-foreground font-mono">
                          {img.albumId}
                        </p>
                      </div>

                      <div className="absolute inset-0 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100 flex flex-col items-center justify-center gap-2 p-2">
                        <Button
                          size="sm"
                          onClick={() => handleRestore("image", img.id, img.title)}
                          disabled={actionLoadingId === img.id}
                          className="w-full h-7 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-[10px] text-white"
                        >
                          <RotateCcw className="mr-1 h-3 w-3" /> ស្តារ
                        </Button>

                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handlePermanentDelete("image", img.id, img.title)}
                            disabled={actionLoadingId === img.id}
                            className="w-full h-7 rounded-xl text-[10px]"
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> លុបដាច់
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
