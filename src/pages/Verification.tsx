import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck, ShieldAlert, ShieldX, PhoneCall, Search, MapPin, Clock,
  Image as ImageIcon, AlertTriangle, User as UserIcon, Phone,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

type VStatus = "pending" | "verified_real" | "verified_fake" | "unreachable";
type Filter = "pending" | "verified_real" | "verified_fake" | "unreachable" | "all";

interface VisitRow {
  id: string;
  employee_id: string;
  name: string;
  address: string;
  contact_person: string | null;
  contact_phone: string | null;
  number_of_flats: number | null;
  status: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  is_mock: boolean | null;
  selfie_url: string | null;
  building_photo_url: string | null;
  verification_status: VStatus | null;
  verification_notes: string | null;
  verified_at: string | null;
  created_at: string;
  employees?: { id: string; name: string; role: string | null };
}

const STATUS_META: Record<VStatus, { label: string; cls: string; icon: any }> = {
  pending:        { label: "Pending",     cls: "bg-amber-50 text-amber-700 border-amber-200",   icon: Clock },
  verified_real:  { label: "Real",        cls: "bg-green-50 text-green-700 border-green-200",   icon: ShieldCheck },
  verified_fake:  { label: "Fake",        cls: "bg-red-50 text-red-700 border-red-200",         icon: ShieldX },
  unreachable:    { label: "Unreachable", cls: "bg-slate-50 text-slate-600 border-slate-200",   icon: PhoneCall },
};

const Verification = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [search, setSearch] = useState("");
  const [photoOpen, setPhotoOpen] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState<{ row: VisitRow; status: VStatus } | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRows = async () => {
    const { data, error } = await supabase
      .from("society_data")
      .select("*, employees:employees!employee_id(id, name, role)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchRows();
    // Refresh every 30s so newly submitted visits appear without manual reload.
    const i = setInterval(fetchRows, 30_000);

    // Realtime: catch new inserts/updates immediately.
    const ch = supabase
      .channel("society_data_verification")
      .on("postgres_changes", { event: "*", schema: "public", table: "society_data" }, () => fetchRows())
      .subscribe();

    return () => {
      clearInterval(i);
      supabase.removeChannel(ch);
    };
  }, []);

  const counts = useMemo(() => {
    const c = { pending: 0, verified_real: 0, verified_fake: 0, unreachable: 0, all: rows.length };
    for (const r of rows) {
      const s = (r.verification_status || "pending") as VStatus;
      if (s in c) (c as any)[s]++;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const s = (r.verification_status || "pending") as VStatus;
      if (filter !== "all" && s !== filter) return false;
      if (!search) return true;
      const hay = `${r.name} ${r.address} ${r.contact_person || ""} ${r.contact_phone || ""} ${r.employees?.name || ""}`.toLowerCase();
      return hay.includes(search.toLowerCase());
    });
  }, [rows, filter, search]);

  const beginMark = (row: VisitRow, status: VStatus) => {
    setNotes(row.verification_notes || "");
    setNotesOpen({ row, status });
  };

  const confirmMark = async () => {
    if (!notesOpen) return;
    setSaving(true);
    const { row, status } = notesOpen;
    const { error } = await supabase
      .from("society_data")
      .update({
        verification_status: status,
        verification_notes: notes || null,
        verified_at: new Date().toISOString(),
        verified_by: user?.id || null,
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update: " + error.message);
      return;
    }
    toast.success(`Visit marked ${STATUS_META[status].label}`);
    setNotesOpen(null);
    setNotes("");
    fetchRows();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Verification Queue"
        subtitle="Calling team: confirm field visits with the chairman / contact person"
        actions={
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-1.5">
            <Clock className="w-3.5 h-3.5" />
            {counts.pending} pending
          </Badge>
        }
      />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {(["pending", "verified_real", "verified_fake", "unreachable", "all"] as const).map((k) => {
          const active = filter === k;
          const meta = k === "all" ? { label: "All", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: ShieldAlert } : STATUS_META[k];
          const Icon = meta.icon as any;
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : meta.cls + " hover:opacity-80"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {meta.label}
              <span className={`ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold ${active ? "bg-white/20" : "bg-white"}`}>
                {(counts as any)[k]}
              </span>
            </button>
          );
        })}
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search society, address, employee, phone..."
            className="pl-9 w-72"
          />
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading visits...</div>
      )}

      {!loading && visible.length === 0 && (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No visits match the current filter.
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {visible.map((row) => {
          const status = (row.verification_status || "pending") as VStatus;
          const meta = STATUS_META[status];
          const Icon = meta.icon;
          const mapsHref = row.lat && row.lng ? `https://www.google.com/maps?q=${row.lat},${row.lng}` : null;
          return (
            <Card key={row.id} className="p-4 border-border/60">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="font-bold text-base truncate">{row.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">{row.address}</div>
                </div>
                <Badge variant="outline" className={meta.cls + " gap-1 shrink-0"}>
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </Badge>
              </div>

              {/* Photos + key facts */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { url: row.selfie_url, label: "Selfie" },
                  { url: row.building_photo_url, label: "Building" },
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-6 h-6 opacity-40" />
                        <span className="text-[10px] mt-1">No {p.label.toLowerCase()}</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-0.5 font-medium">
                      {p.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs mb-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserIcon className="w-3 h-3" />
                  <span className="font-medium text-foreground truncate">{row.employees?.name || "Unknown"}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                </div>
                {row.contact_person && (
                  <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                    <UserIcon className="w-3 h-3" />
                    Chairman: <span className="text-foreground font-medium">{row.contact_person}</span>
                  </div>
                )}
                {row.contact_phone && (
                  <a
                    href={`tel:${row.contact_phone}`}
                    className="flex items-center gap-1.5 text-primary hover:underline col-span-2"
                  >
                    <Phone className="w-3 h-3" />
                    {row.contact_phone}
                  </a>
                )}
                {row.number_of_flats != null && (
                  <div className="text-muted-foreground">
                    Flats: <span className="font-medium text-foreground">{row.number_of_flats}</span>
                  </div>
                )}
                {mapsHref && (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <MapPin className="w-3 h-3" />
                    Open in Maps
                  </a>
                )}
                {row.accuracy_m != null && (
                  <div className="text-muted-foreground">
                    GPS: ±{Math.round(row.accuracy_m)}m
                  </div>
                )}
              </div>

              {/* Mock-GPS warning */}
              {row.is_mock && (
                <div className="flex items-center gap-2 p-2 mb-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Mock GPS detected on this submission!
                </div>
              )}

              {/* Existing notes */}
              {row.verification_notes && (
                <div className="text-xs bg-muted/40 rounded-md p-2 mb-3 border border-border/40">
                  <span className="font-semibold">Notes:</span> {row.verification_notes}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant={status === "verified_real" ? "default" : "outline"}
                  className={status === "verified_real" ? "bg-green-600 hover:bg-green-700" : "border-green-300 text-green-700 hover:bg-green-50"}
                  onClick={() => beginMark(row, "verified_real")}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Real
                </Button>
                <Button
                  size="sm"
                  variant={status === "verified_fake" ? "default" : "outline"}
                  className={status === "verified_fake" ? "bg-red-600 hover:bg-red-700" : "border-red-300 text-red-700 hover:bg-red-50"}
                  onClick={() => beginMark(row, "verified_fake")}
                >
                  <ShieldX className="w-3.5 h-3.5 mr-1" /> Fake
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => beginMark(row, "unreachable")}
                >
                  <PhoneCall className="w-3.5 h-3.5 mr-1" /> No Reply
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Photo lightbox */}
      <Dialog open={!!photoOpen} onOpenChange={(o) => !o && setPhotoOpen(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black border-black">
          {photoOpen && (
            <img src={photoOpen} alt="Evidence" className="w-full max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Notes / confirmation dialog */}
      <Dialog open={!!notesOpen} onOpenChange={(o) => !o && setNotesOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Mark as {notesOpen ? STATUS_META[notesOpen.status].label : ""}
            </DialogTitle>
          </DialogHeader>
          {notesOpen && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{notesOpen.row.name}</span> — submitted by{" "}
                <span className="font-medium text-foreground">{notesOpen.row.employees?.name}</span>
              </div>
              {notesOpen.status === "verified_fake" && (
                <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>This will count as a fake-lead strike against the employee. Add a clear reason below.</div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium mb-1 block">Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    notesOpen.status === "verified_fake"
                      ? "Why is this fake? e.g. Chairman said no salesperson visited, or society does not exist."
                      : notesOpen.status === "unreachable"
                      ? "e.g. Number switched off after 3 attempts."
                      : "e.g. Chairman confirmed visit and is interested."
                  }
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(null)}>Cancel</Button>
            <Button onClick={confirmMark} disabled={saving}>
              {saving ? "Saving..." : `Confirm ${notesOpen ? STATUS_META[notesOpen.status].label : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Verification;
