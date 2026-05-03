import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { ShieldCheck, ShieldX, Clock, AlertTriangle, TrendingUp, Home } from "lucide-react";

// Haversine distance in meters. Good enough for city-scale distances where
// we only need "is this visit within X metres of home?".
function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000; // earth radius in m
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// `visits` = the employee's society_data rows (already loaded in Employees.tsx
// via the `society_data(*)` join). We derive everything client-side so no
// extra queries are needed. `homeLat/Lng/RadiusM` enable the home-cluster flag.
interface Visit {
  created_at: string;
  verification_status?: string | null;
  is_mock?: boolean | null;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  visits: Visit[];
  homeLat?: number | null;
  homeLng?: number | null;
  homeRadiusM?: number | null;
}

export function EmployeeFieldStats({ visits, homeLat, homeLng, homeRadiusM }: Props) {
  const stats = useMemo(() => {
    const s = {
      total: visits.length,
      real: 0,
      fake: 0,
      pending: 0,
      unreachable: 0,
      mock: 0,
    };
    for (const v of visits) {
      const st = v.verification_status || "pending";
      if (st === "verified_real") s.real++;
      else if (st === "verified_fake") s.fake++;
      else if (st === "unreachable") s.unreachable++;
      else s.pending++;
      if (v.is_mock) s.mock++;
    }
    const verified = s.real + s.fake;
    const fakePct = verified > 0 ? Math.round((s.fake / verified) * 100) : null;
    return { ...s, fakePct };
  }, [visits]);

  // Home-cluster: number of visits geolocated within `homeRadiusM` of the
  // employee's registered home. A visit with no lat/lng is not counted
  // (it's already flagged by the accuracy gate in the field app).
  const homeCluster = useMemo(() => {
    if (homeLat == null || homeLng == null) return null;
    const radius = homeRadiusM || 250;
    let near = 0;
    let withCoords = 0;
    for (const v of visits) {
      if (v.lat == null || v.lng == null) continue;
      withCoords++;
      if (haversineMeters(homeLat, homeLng, v.lat, v.lng) <= radius) near++;
    }
    const pct = withCoords > 0 ? Math.round((near / withCoords) * 100) : 0;
    return { near, withCoords, pct };
  }, [visits, homeLat, homeLng, homeRadiusM]);

  // Last 6 months: label (e.g. "Jun") + count of visits created in that month.
  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; count: number; real: number; fake: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      buckets.push({
        key,
        label: d.toLocaleString("default", { month: "short" }),
        count: 0, real: 0, fake: 0,
      });
    }
    for (const v of visits) {
      const d = new Date(v.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const bucket = buckets.find((b) => b.key === key);
      if (!bucket) continue;
      bucket.count++;
      if (v.verification_status === "verified_real") bucket.real++;
      else if (v.verification_status === "verified_fake") bucket.fake++;
    }
    return buckets;
  }, [visits]);

  // Color the fake-% badge by severity so it jumps out in the owner view.
  const fakeBadgeCls =
    stats.fakePct == null
      ? "bg-slate-50 text-slate-600 border-slate-200"
      : stats.fakePct >= 40
      ? "bg-red-50 text-red-700 border-red-200"
      : stats.fakePct >= 20
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-green-50 text-green-700 border-green-200";

  return (
    <div className="space-y-3">
      {/* Headline stat chips */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-slate-50 gap-1">
          <TrendingUp className="w-3 h-3" /> {stats.total} visits total
        </Badge>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <ShieldCheck className="w-3 h-3" /> {stats.real} real
        </Badge>
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
          <ShieldX className="w-3 h-3" /> {stats.fake} fake
        </Badge>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <Clock className="w-3 h-3" /> {stats.pending} pending
        </Badge>
        <Badge variant="outline" className={fakeBadgeCls + " gap-1 font-semibold"}>
          Fake: {stats.fakePct == null ? "—" : `${stats.fakePct}%`}
        </Badge>
        {stats.mock > 0 && (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300 gap-1 font-semibold">
            <AlertTriangle className="w-3 h-3" /> {stats.mock} mock-GPS attempts
          </Badge>
        )}
        {homeCluster && homeCluster.withCoords > 0 && (
          <Badge
            variant="outline"
            className={
              "gap-1 font-semibold " +
              (homeCluster.pct >= 40
                ? "bg-red-50 text-red-700 border-red-300"
                : homeCluster.pct >= 20
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-600 border-slate-200")
            }
            title={`${homeCluster.near} of ${homeCluster.withCoords} geolocated visits were within ${homeRadiusM || 250}m of the registered home address.`}
          >
            <Home className="w-3 h-3" /> Near-home: {homeCluster.pct}%
          </Badge>
        )}
        {homeCluster === null && (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 gap-1 text-[10px]">
            <Home className="w-3 h-3" /> home address not set
          </Badge>
        )}
      </div>

      {/* Monthly bar chart — visits logged per calendar month (last 6). */}
      <div className="bg-muted/30 rounded-lg border border-border/60 p-3">
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          Visits logged per month (last 6)
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="count" name="Visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
