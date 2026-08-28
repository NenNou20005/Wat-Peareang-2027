import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ScrollText, Search, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/activity-logs")({
  head: () => ({
    meta: [{ title: "កំណត់ត្រាសកម្មភាព — Wat Peareang Admin" }],
  }),
  component: AdminActivityLogsPage,
});

interface ActivityLogItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  resource: string;
  details?: string;
  ip?: string;
  timestamp: string;
}

function AdminActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/activity-logs");
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(search.toLowerCase()));

    const matchAction = actionFilter === "all" || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <AdminLayout requiredPermission="view_logs">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              📜 កំណត់ត្រាសកម្មភាព (Audit Logs)
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              តាមដានរាល់សកម្មភាពរបស់អ្នកប្រើប្រាស់ (Login, Upload, Delete, Manage Editors)
              ក្នុងប្រព័ន្ធ។
            </p>
          </div>

          <Button
            onClick={fetchLogs}
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> ផ្ទុកឡើងវិញ
          </Button>
        </div>

        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ស្វែងរកតាមឈ្មោះ សកម្មភាព..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-2xl pl-10 h-10 text-xs bg-card"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 h-10 text-xs"
          >
            <option value="all">⚡ គ្រប់ប្រភេទសកម្មភាពទាំងអស់</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {/* Logs Table */}
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/60 bg-secondary/50 font-medium text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5">កាលបរិច្ឆេទ & ម៉ោង</th>
                  <th className="px-5 py-3.5">អ្នកប្រើប្រាស់</th>
                  <th className="px-5 py-3.5">តួនាទី</th>
                  <th className="px-5 py-3.5">សកម្មភាព (Action)</th>
                  <th className="px-5 py-3.5">ធនធាន & ព័ត៌មានលម្អិត</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 font-sans">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      កំពុងទាញយកកំណត់ត្រា...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      មិនមានកំណត់ត្រាសកម្មភាពឡើយ។
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString("km-KH", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>

                      <td className="px-5 py-3.5 font-semibold text-foreground">{log.userName}</td>

                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            log.userRole === "super_admin"
                              ? "bg-gold/15 text-gold"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {log.userRole === "super_admin" ? "Super Admin" : "Editor"}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground">
                          {log.action}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <p className="font-medium text-foreground">{log.resource}</p>
                          {log.details && (
                            <p className="text-[11px] text-muted-foreground">{log.details}</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
