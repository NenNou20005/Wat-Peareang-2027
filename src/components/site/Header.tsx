import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, User, Menu, Upload, ShieldCheck, LogOut, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadModal } from "@/components/site/UploadModal";
import { useAuth } from "@/hooks/useAuth";

const nav = [
  { to: "/", label: "🏠 ទំព័រដើម" },
  { to: "/images", label: "📸 រូបភាព" },
  { to: "/albums", label: "🖼️ Albums" },
  { to: "/years", label: "📅 តាមឆ្នាំ" },
  { to: "/festivals", label: "🎉 តាមបុណ្យ" },
  { to: "/search", label: "🔍 ស្វែងរក" },
  { to: "/favorites", label: "⭐ ចំណូលចិត្ត" },
  { to: "/developer", label: "👨‍💻 អ្នកអភិវឌ្ឍន៍" },
] as const;

export function Header() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isSuperAdmin, hasPermission, logout } = useAuth();
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: "/search", search: { q } });
  }

  const canUpload = isAuthenticated && (isSuperAdmin || hasPermission("upload_images"));

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary text-lg text-primary-foreground">
              🏛️
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base leading-tight">
                បណ្ណសាររូបភាព
              </span>
              <span className="block truncate text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Khmer Festival Archive
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <form
            onSubmit={submit}
            className="hidden items-center gap-2 rounded-full border border-border bg-card px-4 py-2 md:flex"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ស្វែងរកបុណ្យ ឆ្នាំ ទីកន្លែង..."
              className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground lg:w-56"
            />
          </form>

          {canUpload && (
            <Button
              variant="outline"
              className="hidden rounded-full border-gold text-foreground lg:inline-flex"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="mr-1 h-4 w-4" /> បង្ហោះរូប
            </Button>
          )}

          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="relative rounded-full border border-gold/40 bg-gold-soft/30 text-foreground hover:bg-gold-soft"
                  size="icon"
                  aria-label="គណនី"
                >
                  <ShieldCheck className="h-4 w-4 text-gold" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-card">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="font-medium text-sm text-foreground">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className="inline-block mt-1 w-fit rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                      {isSuperAdmin ? "👑 Super Admin" : "✍️ Editor"}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-xl"
                  onClick={() => navigate({ to: "/admin" })}
                >
                  <LayoutDashboard className="h-4 w-4" /> ផ្ទាំងគ្រប់គ្រង (Admin)
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer gap-2 rounded-xl text-destructive hover:text-destructive"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4" /> ចាកចេញ (Logout)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full xl:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <nav className="mt-8 flex flex-col gap-1">
                {nav.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    activeOptions={{ exact: item.to === "/" }}
                    activeProps={{ className: "bg-secondary" }}
                    className="rounded-2xl px-4 py-3 text-sm"
                  >
                    {item.label}
                  </Link>
                ))}

                {canUpload && (
                  <button
                    type="button"
                    onClick={() => setUploadOpen(true)}
                    className="mt-2 rounded-2xl bg-primary px-4 py-3 text-left text-sm text-primary-foreground"
                  >
                    ⬆️ បង្ហោះរូបភាព
                  </button>
                )}

                {isAuthenticated && (
                  <Link
                    to="/admin"
                    className="mt-4 rounded-2xl border border-gold/40 bg-gold-soft/30 px-4 py-3 text-sm font-medium text-gold"
                  >
                    🛡️ ផ្ទាំងគ្រប់គ្រង Admin
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      {canUpload && <UploadModal open={uploadOpen} onOpenChange={setUploadOpen} />}
    </header>
  );
}
