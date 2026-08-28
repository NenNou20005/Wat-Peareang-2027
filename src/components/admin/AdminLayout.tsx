import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Sparkles,
  Calendar,
  FolderKanban,
  Image as ImageIcon,
  Users,
  ScrollText,
  Trash2,
  Settings,
  LogOut,
  ArrowLeft,
  Shield,
  ShieldCheck,
  Menu,
  Lock,
  TrendingUp,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { Permission, User } from "@/types/auth";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  superAdminOnly?: boolean;
  requiredPermission?: Permission;
}

const adminNav: NavItem[] = [
  { to: "/admin", label: "ផ្ទាំងគ្រប់គ្រង", icon: LayoutDashboard },
  { to: "/admin/analytics", label: "ស្ថិតិ & របាយការណ៍", icon: TrendingUp },
  {
    to: "/admin/festivals",
    label: "គ្រប់គ្រងបុណ្យ",
    icon: Sparkles,
    requiredPermission: "manage_festivals",
  },
  {
    to: "/admin/years",
    label: "គ្រប់គ្រងឆ្នាំ",
    icon: Calendar,
    requiredPermission: "manage_years",
  },
  {
    to: "/admin/albums",
    label: "គ្រប់គ្រង Albums",
    icon: FolderKanban,
    requiredPermission: "manage_albums",
  },
  {
    to: "/admin/images",
    label: "រូបភាព & Upload",
    icon: ImageIcon,
    requiredPermission: "view_images",
  },
  {
    to: "/admin/editors",
    label: "អ្នកកែសម្រួល (Editors)",
    icon: Users,
    superAdminOnly: true,
  },
  {
    to: "/admin/activity-logs",
    label: "កំណត់ត្រាសកម្មភាព",
    icon: ScrollText,
    requiredPermission: "view_logs",
  },
  {
    to: "/admin/trash",
    label: "ធុងសំរាម (Trash)",
    icon: Trash2,
    requiredPermission: "manage_trash",
  },
  { to: "/admin/settings", label: "ការកំណត់", icon: Settings },
];

export function AdminLayout({
  children,
  requiredPermission,
  superAdminOnly = false,
}: {
  children: React.ReactNode;
  requiredPermission?: Permission;
  superAdminOnly?: boolean;
}) {
  const { user, isAuthenticated, isLoading, isSuperAdmin, hasPermission, logout, refetchUser } =
    useAuth();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/admin/login" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Re-verify session when navigating between admin routes or when tab regains focus
  useEffect(() => {
    refetchUser();
  }, [currentPath, refetchUser]);

  useEffect(() => {
    const onFocus = () => refetchUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refetchUser]);

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="text-sm text-muted-foreground">កំពុងផ្ទៀងផ្ទាត់សិទ្ធិ...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">៤០៣ — គ្មានសិទ្ធិចូលដំណើរការ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ទំព័រនេះសម្រាប់តែអ្នកគ្រប់គ្រងប៉ុណ្ណោះ។ សូមចូលគណនីរបស់អ្នក។
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/admin/login"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            ចូលគណនី (Login)
          </Link>
          <Link
            to="/"
            className="rounded-full border border-border bg-card px-5 py-2.5 text-sm text-foreground"
          >
            ត្រឡប់ទំព័រដើម
          </Link>
        </div>
      </div>
    );
  }

  // Permission Check for current page
  const hasAccess =
    (!superAdminOnly || isSuperAdmin) &&
    (!requiredPermission || isSuperAdmin || hasPermission(requiredPermission));

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Top Mobile Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold text-sm text-primary-foreground">
            🛡️
          </span>
          <span className="font-display text-sm font-semibold">ផ្ទាំងគ្រប់គ្រង Admin</span>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-xl">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent
              currentPath={currentPath}
              user={user}
              isSuperAdmin={isSuperAdmin}
              hasPermission={hasPermission}
              logout={logout}
              onNavClick={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="mx-auto flex max-w-[1500px]">
        {/* Desktop Sidebar */}
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-64 shrink-0 flex-col border-r border-border/80 bg-card/60 p-4 backdrop-blur lg:flex">
          <SidebarContent
            currentPath={currentPath}
            user={user}
            isSuperAdmin={isSuperAdmin}
            hasPermission={hasPermission}
            logout={logout}
          />
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1 p-4 md:p-8">
          {!hasAccess ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                សិទ្ធិត្រូវបានបដិសេធ (Access Denied)
              </h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                {superAdminOnly
                  ? "មុខងារនេះត្រូវបានកំណត់សម្រាប់តែ Super Admin តែម្នាក់គត់។"
                  : "លោកអ្នកមិនទាន់ត្រូវបានផ្តល់សិទ្ធិ (Permission) សម្រាប់ផ្នែកនេះឡើយ។"}
              </p>
              <div className="mt-6">
                <Link
                  to="/admin"
                  className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                >
                  ត្រឡប់ទៅផ្ទាំង Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  currentPath,
  user,
  isSuperAdmin,
  hasPermission,
  logout,
  onNavClick,
}: {
  currentPath: string;
  user: User | null;
  isSuperAdmin: boolean;
  hasPermission: (perm: Permission) => boolean;
  logout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between p-4 lg:p-0">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gold/20 text-sm text-gold">
              🏛️
            </span>
            <div>
              <p className="font-display text-sm font-semibold leading-none">វត្តពារាំង Admin</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">ប្រព័ន្ធគ្រប់គ្រងបណ្ណសារ</p>
            </div>
          </div>
        </div>

        <nav className="space-y-1">
          {adminNav.map((item) => {
            if (item.superAdminOnly && !isSuperAdmin) return null;
            if (
              item.requiredPermission &&
              !isSuperAdmin &&
              !hasPermission(item.requiredPermission)
            ) {
              return null;
            }

            const Icon = item.icon;
            const active = currentPath === item.to;

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onNavClick}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? "bg-gold text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.superAdminOnly && (
                  <span className="ml-auto rounded-full bg-gold-soft/50 px-1.5 py-0.5 text-[9px] font-semibold text-gold">
                    Super
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-border/80">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់ទៅ Public Website
        </Link>

        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold">
              {isSuperAdmin ? <ShieldCheck className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{user?.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
              <span className="inline-block mt-1 rounded-full bg-gold/15 px-1.5 py-0.2 text-[9px] font-medium text-gold">
                {isSuperAdmin ? "👑 Super Admin" : "✍️ Editor"}
              </span>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="mt-2 w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2 rounded-xl"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> ចាកចេញ (Logout)
          </Button>
        </div>
      </div>
    </div>
  );
}
