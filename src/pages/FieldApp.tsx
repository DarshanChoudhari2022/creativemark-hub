import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  MapPin,
  Play,
  Square,
  LogOut,
  ClipboardList,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Home,
  Navigation,
  Eye,
  EyeOff,
} from "lucide-react";

// --- Native (Capacitor) geolocation bridge --------------------------------
// We lazy-import so the web build doesn't crash if the plugin isn't present.
// In a pure browser we fall back to navigator.geolocation.
type Coords = { lat: number; lng: number; accuracy: number | null };

async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== "granted") {
        const req = await Geolocation.requestPermissions();
        if (req.location !== "granted") return null;
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      };
    }
  } catch {
    /* fall through to browser API */
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

async function requestLocationPermission(): Promise<"granted" | "denied"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const req = await Geolocation.requestPermissions();
      return req.location === "granted" ? "granted" : "denied";
    }
  } catch {
    /* ignore */
  }
  // Browser fallback — just call getCurrentPosition to trigger prompt.
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve("denied");
    navigator.geolocation.getCurrentPosition(
      () => resolve("granted"),
      () => resolve("denied"),
      { timeout: 10000 },
    );
  });
}

const HEARTBEAT_MS = 2 * 60 * 1000; // 2 minutes

// --- Types -----------------------------------------------------------------
interface Assignment {
  id: string;
  society_name: string;
  address: string | null;
  priority: number | null;
  notes: string | null;
  visited_at: string | null;
  assigned_date: string;
}

function formatRelative(ts: number | null) {
  if (!ts) return "never";
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3600_000)}h ago`;
}

// --- Main component --------------------------------------------------------
export default function FieldApp() {
  const { user, logout, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"home" | "assignments" | "log">("home");
  const [target, setTarget] = useState<number>(15);
  const [visitedToday, setVisitedToday] = useState<number>(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const [isTracking, setIsTracking] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [locPerm, setLocPerm] = useState<"unknown" | "granted" | "denied">(
    "unknown",
  );
  const [lastSyncTs, setLastSyncTs] = useState<number | null>(null);

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingRef = useRef(false);

  // --- Load stats + today's assignments ----------------------------------
  const loadData = useCallback(async () => {
    if (!user?.id) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [{ data: emp }, { count }, { data: asg }] = await Promise.all([
      supabase
        .from("employees")
        .select("lead_target_daily")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("society_data")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", user.id)
        .gte("created_at", start.toISOString()),
      supabase
        .from("assigned_societies")
        .select(
          "id, society_name, address, priority, notes, visited_at, assigned_date",
        )
        .eq("employee_id", user.id)
        .gte("assigned_date", start.toISOString())
        .lte("assigned_date", end.toISOString())
        .order("priority", { ascending: false }),
    ]);

    if (emp?.lead_target_daily) setTarget(emp.lead_target_daily);
    setVisitedToday(count || 0);
    setAssignments((asg as Assignment[]) || []);
    setLoadingAssignments(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
    const i = setInterval(loadData, 30_000);
    return () => clearInterval(i);
  }, [loadData]);

  // --- Reconcile existing open shift on mount ---------------------------
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data: openShift } = await supabase
        .from("employee_shifts")
        .select("id")
        .eq("employee_id", user.id)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (openShift?.id) {
        setActiveShiftId(openShift.id);
        setIsTracking(true);
        trackingRef.current = true;
        startHeartbeat();
      }
    })();
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // --- Location heartbeat ------------------------------------------------
  const pushLocation = useCallback(async () => {
    if (!trackingRef.current || !user?.id) return;
    const c = await getCurrentCoords();
    if (!c) return;
    const now = new Date().toISOString();
    await Promise.all([
      supabase
        .from("employees")
        .update({
          current_lat: c.lat,
          current_lng: c.lng,
          last_location_update: now,
        })
        .eq("id", user.id),
      supabase.from("employee_location_history").insert({
        employee_id: user.id,
        lat: c.lat,
        lng: c.lng,
        timestamp: now,
        accuracy_m: c.accuracy,
        is_mock: false,
      }),
    ]);
    setLastSyncTs(Date.now());
  }, [user?.id]);

  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    // Immediate tick so dashboard updates within seconds.
    pushLocation();
    heartbeatRef.current = setInterval(pushLocation, HEARTBEAT_MS);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  // --- Start / stop shift ------------------------------------------------
  const handleStartShift = async () => {
    if (!user?.id) return;
    const perm = await requestLocationPermission();
    setLocPerm(perm);
    if (perm !== "granted") {
      toast.error(
        "Location permission is required to start a shift. Enable it in your device settings.",
      );
      return;
    }
    const c = await getCurrentCoords();
    const { data: row, error } = await supabase
      .from("employee_shifts")
      .insert({
        employee_id: user.id,
        start_lat: c?.lat ?? null,
        start_lng: c?.lng ?? null,
      })
      .select("id")
      .single();
    if (error) {
      if ((error as any).code === "23505") {
        toast.error("A shift is already open. End it before starting a new one.");
      } else {
        toast.error(error.message || "Could not start shift.");
      }
      return;
    }
    setActiveShiftId((row as any)?.id);
    setIsTracking(true);
    trackingRef.current = true;
    startHeartbeat();
    toast.success("Shift started. Your location is now being shared.");
  };

  const handleStopShift = async () => {
    stopHeartbeat();
    setIsTracking(false);
    trackingRef.current = false;
    if (!activeShiftId || !user?.id) return;
    const c = await getCurrentCoords();
    const { data: row } = await supabase
      .from("employee_shifts")
      .select("started_at")
      .eq("id", activeShiftId)
      .maybeSingle();
    const startedAt = row ? new Date((row as any).started_at) : null;
    const durationMin = startedAt
      ? Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 60000))
      : null;
    let visitCount = 0;
    if (startedAt) {
      const { count } = await supabase
        .from("society_data")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", user.id)
        .gte("created_at", startedAt.toISOString());
      visitCount = count || 0;
    }
    await supabase
      .from("employee_shifts")
      .update({
        ended_at: new Date().toISOString(),
        end_lat: c?.lat ?? null,
        end_lng: c?.lng ?? null,
        duration_min: durationMin,
        visit_count: visitCount,
      })
      .eq("id", activeShiftId);
    setActiveShiftId(null);
    toast.success("Shift ended.");
  };

  const handleGrantPermission = async () => {
    const perm = await requestLocationPermission();
    setLocPerm(perm);
    if (perm === "granted") toast.success("Location permission granted.");
    else
      toast.error(
        "Permission denied. Open Settings → Apps → CreativeMark Field → Permissions → Location.",
      );
  };

  const handleLogout = async () => {
    stopHeartbeat();
    trackingRef.current = false;
    await logout();
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
      </div>
    );
  }

  if (!user) {
    return <FieldLogin />;
  }

  const progressPct =
    target > 0 ? Math.min(100, Math.round((visitedToday / target) * 100)) : 0;
  const pending = assignments.filter((a) => !a.visited_at);
  const visited = assignments.filter((a) => a.visited_at);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-black text-lg tracking-tight">CreativeMark Field</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">
            {user.name}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "home" && (
          <HomeTab
            target={target}
            visitedToday={visitedToday}
            progressPct={progressPct}
            isTracking={isTracking}
            locPerm={locPerm}
            lastSyncTs={lastSyncTs}
            onStart={handleStartShift}
            onStop={handleStopShift}
            onGrantPerm={handleGrantPermission}
          />
        )}
        {tab === "assignments" && (
          <AssignmentsTab
            loading={loadingAssignments}
            pending={pending}
            visited={visited}
          />
        )}
        {tab === "log" && (
          <LogVisitTab
            userId={user.id}
            onSubmitted={() => {
              loadData();
              setTab("home");
            }}
          />
        )}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
        <TabButton
          active={tab === "home"}
          icon={<Home className="h-5 w-5" />}
          label="Home"
          onClick={() => setTab("home")}
        />
        <TabButton
          active={tab === "assignments"}
          icon={<ClipboardList className="h-5 w-5" />}
          label="Assignments"
          badge={pending.length || undefined}
          onClick={() => setTab("assignments")}
        />
        <TabButton
          active={tab === "log"}
          icon={<PlusCircle className="h-5 w-5" />}
          label="Log Visit"
          onClick={() => setTab("log")}
        />
      </nav>
    </div>
  );
}

// --- Sub-components --------------------------------------------------------

function TabButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 relative ${
        active ? "text-sky-400" : "text-slate-400"
      }`}
    >
      {icon}
      <span className="text-[10px] font-semibold">{label}</span>
      {badge ? (
        <span className="absolute top-1 right-1/3 bg-orange-500 text-white text-[9px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function StatusPill({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      ) : (
        <AlertCircle className="h-4 w-4 text-amber-400" />
      )}
      <span className={ok ? "text-slate-200" : "text-amber-300"}>{label}</span>
    </div>
  );
}

function HomeTab({
  target,
  visitedToday,
  progressPct,
  isTracking,
  locPerm,
  lastSyncTs,
  onStart,
  onStop,
  onGrantPerm,
}: {
  target: number;
  visitedToday: number;
  progressPct: number;
  isTracking: boolean;
  locPerm: "unknown" | "granted" | "denied";
  lastSyncTs: number | null;
  onStart: () => void;
  onStop: () => void;
  onGrantPerm: () => void;
}) {
  return (
    <div className="p-4 space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Target" value={target} />
        <StatCard label="Visited" value={visitedToday} />
        <StatCard
          label="Progress"
          value={`${progressPct}%`}
          accent={progressPct >= 100 ? "emerald" : "sky"}
        />
      </div>

      {/* Location perm warning */}
      {locPerm === "denied" && (
        <Card className="bg-amber-950/40 border-amber-600/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-amber-300">Location Permission Required</h3>
          </div>
          <p className="text-xs text-amber-200/80 mb-3">
            Location access is needed so your manager can see where you are during
            a shift.
          </p>
          <Button
            onClick={onGrantPerm}
            className="w-full bg-amber-600 hover:bg-amber-500"
          >
            Grant Location Permission
          </Button>
        </Card>
      )}

      {/* Tracking card */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-5 w-5 text-sky-400" />
          <h3 className="font-bold text-slate-100">Live Tracking</h3>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          {isTracking
            ? `Your location is being shared. Last sync ${formatRelative(lastSyncTs)}.`
            : "Tracking is paused. Start a shift to share your location with your manager."}
        </p>
        {isTracking ? (
          <Button
            onClick={onStop}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold"
          >
            <Square className="h-4 w-4 mr-2" /> Stop Shift
          </Button>
        ) : (
          <Button
            onClick={onStart}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold"
          >
            <Play className="h-4 w-4 mr-2" /> Start Shift & Share Location
          </Button>
        )}
      </Card>

      {/* System status */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <h3 className="font-bold text-slate-100 mb-2 flex items-center gap-2">
          <Navigation className="h-4 w-4 text-sky-400" /> System Status
        </h3>
        <StatusPill
          ok={locPerm === "granted"}
          label={`Location permission: ${locPerm}`}
        />
        <StatusPill
          ok={isTracking}
          label={isTracking ? "Tracking: running" : "Tracking: stopped"}
        />
        <StatusPill
          ok={!!lastSyncTs && Date.now() - (lastSyncTs || 0) < 5 * 60_000}
          label={`Last sync: ${formatRelative(lastSyncTs)}`}
        />
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "sky",
}: {
  label: string;
  value: string | number;
  accent?: "sky" | "emerald";
}) {
  const color = accent === "emerald" ? "text-emerald-400" : "text-sky-400";
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function AssignmentsTab({
  loading,
  pending,
  visited,
}: {
  loading: boolean;
  pending: Assignment[];
  visited: Assignment[];
}) {
  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
      </div>
    );
  }
  if (pending.length === 0 && visited.length === 0) {
    return (
      <div className="p-8 text-center">
        <ClipboardList className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-400">
          Your manager hasn't assigned any societies for today.
        </p>
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4">
      {pending.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Pending ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((a) => (
              <Card
                key={a.id}
                className="bg-slate-900 border-amber-600/50 p-4"
              >
                <div className="flex items-start gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-100">
                      {a.society_name}
                    </div>
                    {a.address && (
                      <div className="text-xs text-slate-400 mt-1">
                        {a.address}
                      </div>
                    )}
                    {a.notes && (
                      <div className="text-xs text-slate-500 italic mt-1">
                        {a.notes}
                      </div>
                    )}
                  </div>
                  {a.priority && a.priority > 0 ? (
                    <span className="bg-purple-600 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
                      P{a.priority}
                    </span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      {visited.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-4">
            Completed ({visited.length})
          </h3>
          <div className="space-y-2">
            {visited.map((a) => (
              <Card
                key={a.id}
                className="bg-slate-900/50 border-slate-800 p-4 opacity-70"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-100 line-through decoration-slate-600">
                      {a.society_name}
                    </div>
                    {a.address && (
                      <div className="text-xs text-slate-400 mt-1">
                        {a.address}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LogVisitTab({
  userId,
  onSubmitted,
}: {
  userId: string;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [numberOfFlats, setNumberOfFlats] = useState("");
  const [status, setStatus] = useState("Pending");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !address.trim()) {
      toast.error("Society name and address are required.");
      return;
    }
    setSubmitting(true);
    const coords = await getCurrentCoords();
    if (!coords) {
      toast.error(
        "Could not get your location. Move outdoors and ensure permission is granted.",
      );
      setSubmitting(false);
      return;
    }
    const { data: visitRow, error } = await supabase
      .from("society_data")
      .insert({
        employee_id: userId,
        name: name.trim(),
        address: address.trim(),
        contact_person: contactPerson.trim() || null,
        contact_phone: contactPhone.trim() || null,
        number_of_flats: numberOfFlats ? parseInt(numberOfFlats, 10) : null,
        status,
        notes: notes.trim() || null,
        lat: coords.lat,
        lng: coords.lng,
        accuracy_m: coords.accuracy,
        is_mock: false,
        verification_status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message || "Failed to submit visit.");
      setSubmitting(false);
      return;
    }

    // Auto-link to today's matching assignment (case-insensitive).
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: candidates } = await supabase
      .from("assigned_societies")
      .select("id, society_name")
      .eq("employee_id", userId)
      .is("visited_at", null)
      .gte("assigned_date", todayStart.toISOString());

    if (candidates && visitRow?.id) {
      const normalized = name.trim().toLowerCase();
      const match = (candidates as any[]).find(
        (c) => c.society_name.trim().toLowerCase() === normalized,
      );
      if (match) {
        await supabase
          .from("assigned_societies")
          .update({
            visited_at: new Date().toISOString(),
            visit_id: visitRow.id,
          })
          .eq("id", match.id);
      }
    }

    toast.success("Visit logged. The calling team will verify it.");
    setName("");
    setAddress("");
    setContactPerson("");
    setContactPhone("");
    setNumberOfFlats("");
    setStatus("Pending");
    setNotes("");
    setSubmitting(false);
    onSubmitted();
  };

  return (
    <div className="p-4 space-y-4">
      <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="f-name" className="text-slate-300">
            Society Name *
          </Label>
          <Input
            id="f-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g. Green Valley Apartments"
            className="bg-slate-950 border-slate-700"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-addr" className="text-slate-300">
            Address *
          </Label>
          <Input
            id="f-addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full address"
            className="bg-slate-950 border-slate-700"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-cp" className="text-slate-300">
              Contact Person
            </Label>
            <Input
              id="f-cp"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Secretary"
              className="bg-slate-950 border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-phone" className="text-slate-300">
              Phone
            </Label>
            <Input
              id="f-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="10-digit"
              className="bg-slate-950 border-slate-700"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="f-flats" className="text-slate-300">
              Flats
            </Label>
            <Input
              id="f-flats"
              type="number"
              inputMode="numeric"
              value={numberOfFlats}
              onChange={(e) => setNumberOfFlats(e.target.value)}
              placeholder="Count"
              className="bg-slate-950 border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-status" className="text-slate-300">
              Status
            </Label>
            <select
              id="f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option>Pending</option>
              <option>Interested</option>
              <option>Not Interested</option>
              <option>Follow-up</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="f-notes" className="text-slate-300">
            Notes
          </Label>
          <Input
            id="f-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to remember?"
            className="bg-slate-950 border-slate-700"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <MapPin className="h-3.5 w-3.5" />
          Location will be captured automatically on submit.
        </div>

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-sky-600 hover:bg-sky-500 font-bold h-11"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
            </>
          ) : (
            "Submit Visit"
          )}
        </Button>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Embedded field-sales login — shown instead of the shared admin login page.
// ---------------------------------------------------------------------------
function FieldLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authErr) {
      setError(authErr.message);
    }
    // On success AuthContext picks up the new session and re-renders FieldApp
    // which will now show the main UI instead of FieldLogin.
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 items-center justify-center px-6 py-10">
      {/* Logo + branding */}
      <div className="flex flex-col items-center mb-10 gap-3">
        <div className="h-24 w-24 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-xl shadow-sky-900/30">
          <img
            src="/logo-brand.png"
            alt="CreativeMark"
            className="w-full h-full object-contain p-1"
          />
        </div>
        <div className="text-center mt-1">
          <h1 className="text-3xl font-black tracking-tight text-white uppercase">
            Creative Mark
          </h1>
          <div className="mt-1 inline-flex items-center gap-1.5 bg-sky-600/20 border border-sky-500/30 rounded-full px-3 py-0.5">
            <MapPin className="h-3 w-3 text-sky-400" />
            <span className="text-xs font-bold tracking-widest uppercase text-sky-400">
              Field Work App
            </span>
          </div>
        </div>
      </div>

      {/* Login card */}
      <Card className="w-full max-w-sm bg-slate-900 border-slate-800 p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Sign In</h2>
        <p className="text-xs text-slate-500 mb-6">
          Use your CreativeMark employee credentials.
        </p>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-950/60 border border-red-700/40 px-3 py-2.5 text-xs font-semibold text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fl-email" className="text-slate-300 text-sm">
              Email Address
            </Label>
            <Input
              id="fl-email"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="you@creativemark.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fl-pw" className="text-slate-300 text-sm">
              Password
            </Label>
            <div className="relative">
              <Input
                id="fl-pw"
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 h-11 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showPw ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-sky-600 hover:bg-sky-500 font-bold text-base mt-2 shadow-lg shadow-sky-900/40"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Signing In…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </Card>

      <p className="mt-8 text-[11px] text-slate-600 tracking-widest uppercase">
        © 2026 CreativeMark · Field Operations
      </p>
    </div>
  );
}
