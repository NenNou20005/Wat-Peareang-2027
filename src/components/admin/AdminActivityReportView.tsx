import { useState, useMemo } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UploadCloud,
  Edit,
  Trash2,
  RotateCcw,
  Search,
  Lock,
  Clock,
} from "lucide-react";
import { useAdminActivitySummary, type ReportPeriod } from "@/hooks/useReportsData";
import { toKhmerNumber } from "@/data/archive";
import { cn } from "@/lib/utils";

export interface AdminActivityReportViewProps {
  period: ReportPeriod | string;
  startDate?: string | null;
  endDate?: string | null;
}

export function AdminActivityReportView({
  period,
  startDate,
  endDate,
}: AdminActivityReportViewProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data, isLoading, isError } = useAdminActivitySummary(period, startDate, endDate);

  const filteredLogs = useMemo(() => {
    if (!data?.recentLogs) return [];
    let list = data.recentLogs.map((l) => ({ ...l, details: l.details ?? "" }));
    if (actionFilter !== "all") {
      list = list.filter((l) => l.action.toLowerCase().includes(actionFilter.toLowerCase()));
    }
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.resource.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data?.recentLogs, actionFilter, searchFilter]);

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border/70 bg-card p-12 text-center text-muted-foreground shadow-soft">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent mb-3" />
        <p className="text-sm">កំពុងទាញយកកំណត់ត្រាសវនកម្ម Admin (Audit Logs)...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center text-destructive shadow-soft">
        <p className="text-sm font-semibold">មិនអាចទាញយកទិន្នន័យសវនកម្មបានទេ។</p>
      </div>
    );
  }

  const counts = data.summary;
  const topActors = data.actorBreakdown.map((a) => ({
    userId: a.userName,
    userName: a.userName,
    userRole: a.userRole,
    actionCount: a.actionsCount,
  }));

  return (
    <div className="space-y-6">
      {/* 5 Action Category Tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-3xl border border-blue-500/20 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <UserCheck className="h-4 w-4" />
            <span className="text-xs font-semibold">ចូលគណនី (Logins)</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(counts.logins)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-500/20 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <UploadCloud className="h-4 w-4" />
            <span className="text-xs font-semibold">ផ្ទុកឡើង (Uploads)</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(counts.uploads)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
          </p>
        </div>

        <div className="rounded-3xl border border-amber-500/20 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Edit className="h-4 w-4" />
            <span className="text-xs font-semibold">កែសម្រួល (Edits)</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(counts.edits)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
          </p>
        </div>

        <div className="rounded-3xl border border-rose-500/20 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <Trash2 className="h-4 w-4" />
            <span className="text-xs font-semibold">លុប (Deletions)</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(counts.deletes)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
          </p>
        </div>

        <div className="rounded-3xl border border-purple-500/20 bg-card p-4 shadow-soft">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <RotateCcw className="h-4 w-4" />
            <span className="text-xs font-semibold">ស្តារឡើងវិញ (Restores)</span>
          </div>
          <p className="mt-2 text-xl font-bold tracking-tight text-foreground font-mono">
            {toKhmerNumber(counts.restores)}
            <span className="text-xs font-normal text-muted-foreground ml-1.5">ដង</span>
          </p>
        </div>
      </div>

      {/* Top Contributors / Actors */}
      {topActors.length > 0 && (
        <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold" />
            <span>អ្នកគ្រប់គ្រងសកម្មបំផុត (Top Active Administrators)</span>
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topActors.map((actor, idx) => (
              <div
                key={actor.userId || idx}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-gold/15 text-xs font-bold text-gold">
                    {actor.userName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{actor.userName}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{actor.userRole}</p>
                  </div>
                </div>
                <div className="text-right font-mono text-xs font-bold text-foreground">
                  {toKhmerNumber(actor.actionCount)}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">សកម្មភាព</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-gold" />
              <span>កំណត់ត្រាសវនកម្មសុវត្ថិភាពលម្អិត (Audit Trail Table)</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              រាល់ការផ្លាស់ប្តូរទិន្នន័យត្រូវបានកត់ត្រាយ៉ាងម៉ត់ចត់
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ស្វែងរកតាមឈ្មោះ/សកម្មភាព..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-8.5 rounded-xl border border-input bg-background pl-8.5 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-8.5 rounded-xl border border-input bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="all">សកម្មភាពទាំងអស់</option>
              <option value="LOGIN">ការចូលគណនី (LOGIN)</option>
              <option value="UPLOAD">ការផ្ទុកឡើង (UPLOAD)</option>
              <option value="EDIT">ការកែសម្រួល (EDIT/UPDATE)</option>
              <option value="DELETE">ការលុប (DELETE)</option>
              <option value="RESTORE">ការស្តារ (RESTORE)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/60 bg-secondary/30 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3">កាលបរិច្ឆេទ & ម៉ោង</th>
                <th className="py-3 px-3">អ្នកធ្វើសកម្មភាព</th>
                <th className="py-3 px-3">តួនាទី</th>
                <th className="py-3 px-3">សកម្មភាព</th>
                <th className="py-3 px-3">ប្រភេទធនធាន</th>
                <th className="py-3 px-3">ព័ត៌មានលម្អិត</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono text-[11px]">
              {filteredLogs.slice(0, 100).map((log) => (
                <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString("km-KH", {
                      timeZone: "Asia/Phnom_Penh",
                    })}
                  </td>
                  <td className="py-3 px-3 font-semibold text-foreground font-sans">
                    {log.userName}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground capitalize font-sans">
                    {log.userRole}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-bold",
                        log.action.includes("DELETE")
                          ? "bg-rose-500/15 text-rose-600"
                          : log.action.includes("UPLOAD") || log.action.includes("CREATE")
                            ? "bg-emerald-500/15 text-emerald-600"
                            : log.action.includes("RESTORE")
                              ? "bg-purple-500/15 text-purple-600"
                              : log.action.includes("LOGIN")
                                ? "bg-blue-500/15 text-blue-600"
                                : "bg-amber-500/15 text-amber-600",
                      )}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-muted-foreground font-sans">{log.resource}</td>
                  <td className="py-3 px-3 text-foreground font-sans max-w-sm truncate">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
