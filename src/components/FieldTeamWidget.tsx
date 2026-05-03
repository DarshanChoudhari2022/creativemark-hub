import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  MapPin, ShieldAlert, CheckCircle2, Clock, AlertTriangle, WifiOff,
  TrendingUp, ShieldX, ArrowRight, Activity,
} from "lucide-react";

// Same thresholds as the LiveTracking page — kept in sync by convention.
const LIVE_MS = 5 * 60 * 1000;
const RECENT_MS = 30 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;

type Status = "live" | "recent" | "stale" | "offline";
const classify = (last?: string | null): Status => {
  if (!last) return "offline";
  const age = Date.now() - new Date(last).getTime();
  if (age < LIVE_MS) return "live";
  if (age < RECENT_MS) return "recent";
  if (age < STALE_MS) return "stale";
  return "offline";
};

const getInitials = (n?: string) =>
  (n || "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

interface EmployeeRow {
  id: string;
  name: string;
  role: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_update: string | null;
}

interface FraudRow {
  employee_id: string;
  employee_name: string;
  total_visits: number;
  real_count: number;
  fake_count: number;
  pending_count: number;
  mock_attempts: number;
  fake_pct: number | null;
}

export function FieldTeamWidget() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [visitsToday, setVisitsToday] = useState<Record<string, number>>({});
  const [fraud, setFraud] = useState<FraudRow[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [eRes, vRes, fRes, pRes] = await Promise.all([
      supabase
        .from("employees")
        .select("id, name, role, current_lat, current_lng, last_location_update")
        .not("current_lat", "is", null)
        .not("current_lng", "is", null),
      supabase
        .from("society_data")
        .select("employee_id")
        .gte("created_at", start.toISOString()),
      // View created in supabase_field_tracking_v3.sql — may be absent on older DBs.
      supabase.from("employee_fraud_stats").select("*"),
      supabase
        .from("society_data")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "pending"),
    ]);

    if (eRes.data) setEmployees(eRes.data as any);
    if (vRes.data) {
      const map: Record<string, number> = {};
      for (const r of vRes.data as any[]) {
        if (r.employee_id) map[r.employee_id] = (map[r.employee_id] || 0) + 1;
      }
      setVisitsToday(map);
    }
    if (fRes.data) setFraud(fRes.data as any);
    setPendingCount(pRes.count || 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 60_000);
    const tick = setInterval(() => setEmployees((p) => [...p]), 30_000); // re-classify
    return () => {
      clearInterval(i);
      clearInterval(tick);
    };
  }, []);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { live: 0, recent: 0, stale: 0, offline: 0 };
    for (const e of employees) c[classify(e.last_location_update)]++;
    return c;
  }, [employees]);

  // Top 3 performers today (by visit count).
  const topPerformers = useMemo(() => {
    return employees
      .map((e) => ({ ...e, visits: visitsToday[e.id] || 0 }))
      .filter((e) => e.visits > 0)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 3);
  }, [employees, visitsToday]);

  // Top 3 fraud risk: needs a meaningful sample (≥3 verified), then sort by fake_pct desc.
  const fraudRisk = useMemo(() => {
    return fraud
      .filter((f) => f.fake_pct != null && (f.real_count + f.fake_count) >= 3)
      .sort((a, b) => (b.fake_pct || 0) - (a.fake_pct || 0))
      .slice(0, 3);
  }, [fraud]);

  const mockAttemptsTotal = useMemo(
    () => fraud.reduce((s, f) => s + (f.mock_attempts || 0), 0),
    [fraud]
  );

  return (
    <Card className="p-5 border-border/60">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Field Team Today</h3>
            <p className="text-xs text-muted-foreground">
              Live location status + verification & fraud watch
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/live-tracking")}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
        >
          Open map <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading field data...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* ─── Status counts ─── */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              Tracking status
            </div>
            {[
              { k: "live",    label: "Live",    icon: CheckCircle2,  cls: "bg-green-50 text-green-700 border-green-200" },
              { k: "recent",  label: "Recent",  icon: Clock,         cls: "bg-blue-50 text-blue-700 border-blue-200" },
              { k: "stale",   label: "Stale",   icon: AlertTriangle, cls: "bg-amber-50 text-amber-700 border-amber-200" },
              { k: "offline", label: "Offline", icon: WifiOff,       cls: "bg-slate-50 text-slate-600 border-slate-200" },
            ].map((s) => {
              const Icon = s.icon as any;
              const count = (counts as any)[s.k] || 0;
              return (
                <div
                  key={s.k}
                  className={`flex items-center justify-between px-3 py-2 rounded-md border ${s.cls}`}
                >
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Icon className="w-3.5 h-3.5" /> {s.label}
                  </div>
                  <div className="text-sm font-bold">{count}</div>
                </div>
              );
            })}
          </div>

          {/* ─── Top performers today ─── */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Leaderboard today
            </div>
            {topPerformers.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                No visits logged yet today.
              </div>
            ) : (
              topPerformers.map((e, i) => {
                const status = classify(e.last_location_update);
                const dot =
                  status === "live" ? "bg-green-500"
                  : status === "recent" ? "bg-blue-500"
                  : status === "stale" ? "bg-amber-500"
                  : "bg-slate-300";
                return (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-md border border-border/50 bg-muted/20">
                    <div className="text-xs font-bold text-muted-foreground w-4 text-center">
                      {i + 1}
                    </div>
                    <div className="relative">
                      <Avatar className="h-7 w-7 border border-border">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {getInitials(e.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${dot}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{e.name}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0 font-bold">
                      {e.visits}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>

          {/* ─── Fraud watch ─── */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3" /> Fraud watch
            </div>

            {/* Banner: pending queue + mock attempts */}
            <button
              onClick={() => navigate("/verification")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                pendingCount > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Pending verification
              </span>
              <span className="font-bold">{pendingCount}</span>
            </button>

            {mockAttemptsTotal > 0 && (
              <div className="flex items-center justify-between px-3 py-2 rounded-md border bg-red-50 text-red-700 border-red-200 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Mock-GPS attempts
                </span>
                <span className="font-bold">{mockAttemptsTotal}</span>
              </div>
            )}

            {fraudRisk.length === 0 ? (
              <div className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-md">
                Not enough verified data yet to flag fraud.
              </div>
            ) : (
              fraudRisk.map((f) => {
                const severe = (f.fake_pct || 0) >= 40;
                const cls = severe
                  ? "border-red-200 bg-red-50/60"
                  : "border-amber-200 bg-amber-50/60";
                return (
                  <div key={f.employee_id} className={`flex items-center gap-2 p-2 rounded-md border ${cls}`}>
                    <Avatar className="h-7 w-7 border border-border">
                      <AvatarFallback className="bg-red-500/10 text-red-600 text-[10px] font-semibold">
                        {getInitials(f.employee_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{f.employee_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {f.fake_count} fake / {f.real_count + f.fake_count} verified
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${severe ? "bg-red-100 text-red-700 border-red-300" : "bg-amber-100 text-amber-700 border-amber-300"}`}>
                      <ShieldX className="w-3 h-3 mr-0.5" />
                      {f.fake_pct}%
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3" />
          Auto-refresh every 60s
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/verification")} className="hover:text-primary hover:underline">
            Verification queue
          </button>
          <button onClick={() => navigate("/employees")} className="hover:text-primary hover:underline">
            Employees
          </button>
        </div>
      </div>
    </Card>
  );
}
