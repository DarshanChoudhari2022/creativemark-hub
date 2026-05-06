import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import {
  Clock, Play, Square, Calendar, Users as UsersIcon, MapPin, Image as ImageIcon,
  Download, Filter, Activity,
} from "lucide-react";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

interface Shift {
  id: string;
  employee_id: string;
  started_at: string;
  ended_at: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  start_selfie_url: string | null;
  end_selfie_url: string | null;
  duration_min: number | null;
  visit_count: number | null;
  notes: string | null;
  planned_work: string | null;
  no_work_flag: boolean | null;
  work_summary: string | null;
}

interface Employee {
  id: string;
  name: string;
  role: string | null;
}

const getInitials = (n?: string) =>
  (n || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

const Shifts = () => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Record<string, Employee>>({});
  const [loading, setLoading] = useState(true);

  // Default range: last 7 days inclusive of today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [from, setFrom] = useState<string>(sevenAgo);
  const [to, setTo] = useState<string>(todayStr);
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const fromIso = new Date(from + "T00:00:00").toISOString();
    const toIso = new Date(to + "T23:59:59.999").toISOString();
    const [sRes, eRes] = await Promise.all([
      supabase
        .from("employee_shifts")
        .select("*")
        .gte("started_at", fromIso)
        .lte("started_at", toIso)
        .order("started_at", { ascending: false })
        .limit(500),
      supabase.from("employees").select("id, name, role"),
    ]);
    if (sRes.data) setShifts(sRes.data as Shift[]);
    if (eRes.data) {
      const map: Record<string, Employee> = {};
      for (const e of eRes.data as Employee[]) map[e.id] = e;
      setEmployees(map);
    }
    setLoading(false);
  };

  // `load` is recreated each render but its only inputs are `from`/`to` from
  // state, so depending on those alone is correct. Disable the rule here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [from, to]);

  // Apply employee filter on the client (data is already small enough).
  const visible = useMemo(() => {
    return empFilter === "all" ? shifts : shifts.filter((s) => s.employee_id === empFilter);
  }, [shifts, empFilter]);

  // Aggregate KPIs across the visible window.
  const totals = useMemo(() => {
    const open = visible.filter((s) => !s.ended_at).length;
    const totalMin = visible.reduce((sum, s) => {
      if (s.duration_min != null) return sum + s.duration_min;
      // Open shifts: count from start to now.
      if (!s.ended_at) return sum + Math.max(0, differenceInMinutes(new Date(), new Date(s.started_at)));
      return sum;
    }, 0);
    const visits = visible.reduce((sum, s) => sum + (s.visit_count || 0), 0);
    const uniqueEmps = new Set(visible.map((s) => s.employee_id)).size;
    return { open, totalMin, visits, uniqueEmps };
  }, [visible]);

  // Group by date for a clean chronological list.
  const groups = useMemo(() => {
    const map: Record<string, Shift[]> = {};
    for (const s of visible) {
      const day = format(new Date(s.started_at), "yyyy-MM-dd");
      (map[day] ||= []).push(s);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Employee", "Role", "Start", "End", "Duration (min)", "Visits", "Start lat", "Start lng", "End lat", "End lng", "Status"].join(","),
      ...visible.map((s) => {
        const emp = employees[s.employee_id];
        return [
          format(new Date(s.started_at), "yyyy-MM-dd"),
          (emp?.name || "").replace(/,/g, " "),
          (emp?.role || "").replace(/,/g, " "),
          format(new Date(s.started_at), "HH:mm"),
          s.ended_at ? format(new Date(s.ended_at), "HH:mm") : "",
          s.duration_min ?? "",
          s.visit_count ?? 0,
          s.start_lat ?? "",
          s.start_lng ?? "",
          s.end_lat ?? "",
          s.end_lng ?? "",
          s.ended_at ? "closed" : "open",
        ].join(",");
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shifts_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Shifts & Attendance"
        subtitle="Punch-in/out history, working hours and on-shift visit counts"
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">From</label>
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">To</label>
            <Input type="date" value={to} min={from} max={todayStr} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">Employee</label>
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {Object.values(employees)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1" />
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            {visible.length} shift{visible.length === 1 ? "" : "s"} in range
          </div>
        </div>
      </Card>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Open shifts</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Play className="w-4 h-4 text-green-600" />
            {totals.open}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Total hours</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            {(totals.totalMin / 60).toFixed(1)}h
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Visits during shifts</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            {totals.visits}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase font-bold text-muted-foreground">Active employees</div>
          <div className="text-2xl font-bold mt-1 flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-primary" />
            {totals.uniqueEmps}
          </div>
        </Card>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading shifts...</div>
      )}

      {!loading && visible.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No shifts in this range. Once an employee starts their shift from the field app, it'll appear here.
        </Card>
      )}

      {/* Day-grouped list */}
      <div className="space-y-5">
        {groups.map(([day, daysShifts]) => (
          <div key={day}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-bold text-sm">
                {format(new Date(day + "T00:00:00"), "EEEE, d MMM yyyy")}
              </h3>
              <Badge variant="outline" className="text-[10px]">{daysShifts.length} shift{daysShifts.length === 1 ? "" : "s"}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {daysShifts.map((s) => {
                const emp = employees[s.employee_id];
                const ongoing = !s.ended_at;
                const durationMin = s.duration_min ?? (ongoing ? differenceInMinutes(new Date(), new Date(s.started_at)) : null);
                return (
                  <Card key={s.id} className={`p-4 border-border/60 ${ongoing ? "ring-1 ring-green-200 bg-green-50/30" : ""}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                          {getInitials(emp?.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm truncate">{emp?.name || "Unknown employee"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{emp?.role || "—"}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={ongoing ? "bg-green-100 text-green-700 border-green-300 gap-1" : "bg-slate-100 text-slate-600 border-slate-200 gap-1"}
                      >
                        {ongoing ? <><Play className="w-2.5 h-2.5 fill-current" /> Ongoing</> : <><Square className="w-2.5 h-2.5 fill-current" /> Closed</>}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { url: s.start_selfie_url, label: "Start", time: format(new Date(s.started_at), "HH:mm") },
                        {
                          url: s.end_selfie_url,
                          label: "End",
                          time: s.ended_at ? format(new Date(s.ended_at), "HH:mm") : "—",
                        },
                      ].map((p, i) => (
                        <div
                          key={i}
                          className="aspect-square bg-muted/40 rounded-md border border-border overflow-hidden relative cursor-pointer group"
                          onClick={() => p.url && setPhotoOpen(p.url)}
                        >
                          {p.url ? (
                            <img
                              src={p.url}
                              alt={p.label}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                              <ImageIcon className="w-5 h-5 opacity-40" />
                              <span className="text-[10px] mt-1">No {p.label.toLowerCase()} selfie</span>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/55 text-white text-[10px] px-2 py-0.5 flex items-center justify-between font-medium">
                            <span>{p.label}</span>
                            <span>{p.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Duration</div>
                        <div className="font-semibold">
                          {durationMin == null
                            ? "—"
                            : durationMin >= 60
                              ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                              : `${durationMin}m`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Visits</div>
                        <div className="font-semibold">{s.visit_count ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-muted-foreground uppercase font-semibold">Start ago</div>
                        <div className="font-semibold text-[11px]">
                          {formatDistanceToNow(new Date(s.started_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>

                    {(s.planned_work || s.no_work_flag || s.work_summary) && (
                      <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                        {s.no_work_flag && (
                          <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-semibold">
                            <Activity className="w-3 h-3" /> No work assigned (flagged by employee)
                          </div>
                        )}
                        {s.planned_work && (
                          <div className="text-[11px]">
                            <span className="text-muted-foreground font-semibold">Plan: </span>
                            <span>{s.planned_work}</span>
                          </div>
                        )}
                        {s.work_summary && (
                          <div className="text-[11px]">
                            <span className="text-muted-foreground font-semibold">Summary: </span>
                            <span>{s.work_summary}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {(s.start_lat != null || s.end_lat != null) && (
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40 text-[11px]">
                        {s.start_lat != null && (
                          <a
                            href={`https://www.google.com/maps?q=${s.start_lat},${s.start_lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> Start location
                          </a>
                        )}
                        {s.end_lat != null && (
                          <a
                            href={`https://www.google.com/maps?q=${s.end_lat},${s.end_lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" /> End location
                          </a>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Photo lightbox */}
      <Dialog open={!!photoOpen} onOpenChange={(o) => !o && setPhotoOpen(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black border-black">
          <DialogHeader className="sr-only">
            <DialogTitle>Shift selfie</DialogTitle>
          </DialogHeader>
          {photoOpen && (
            <img src={photoOpen} alt="Shift selfie" className="w-full max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shifts;
