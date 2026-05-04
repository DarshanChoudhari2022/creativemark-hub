import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Users, Upload, Smartphone, MessageCircle, Mail, Send, Search,
  RefreshCw, FileSpreadsheet, CheckCircle2, AlertCircle,
  Sparkles, History, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { PageHeader, EmptyState } from "@/components/shared";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  BROADCAST_TEMPLATES,
  personalize,
  type BroadcastTemplate,
  type BroadcastChannel,
} from "@/data/broadcastTemplates";
import {
  parseCSV,
  parseExcel,
  importPhoneContacts,
  isPhoneContactsAvailable,
  buildWhatsAppQueue,
  buildEmailBatches,
  openWhatsAppLink,
  openEmailBatch,
  dedupeContacts,
  normalizePhone,
  type BroadcastContact,
} from "@/lib/broadcast";

// ─────────────────────────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────────────────────────

const SourceBadge = ({ source }: { source?: string }) => {
  const cfg: Record<string, { label: string; cls: string }> = {
    "crm-client":  { label: "Client",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
    "crm-lead":    { label: "Lead",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
    "crm-partner": { label: "Partner", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    "csv":         { label: "CSV/Excel", cls: "bg-purple-50 text-purple-700 border-purple-200" },
    "phone":       { label: "Phone",   cls: "bg-rose-50 text-rose-700 border-rose-200" },
    "manual":      { label: "Manual",  cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  const c = cfg[source || "manual"] || cfg.manual;
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold ${c.cls}`}>
      {c.label}
    </Badge>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────

export default function BroadcastHub() {
  const { user } = useAuth();

  // ── CRM data sources ───────────────────────────────────────────
  const { data: clients } = useSupabaseTable<any>("clients", "id, name, phone, whatsapp, email, category");
  const { data: leads } = useSupabaseTable<any>("leads", "id, name, phone, whatsapp, email, organization, category");
  const { data: partners } = useSupabaseTable<any>("partners", "id, name, phone, whatsapp, email");

  // ── Saved broadcast contacts (CSV / Phone imports) ─────────────
  const [savedContacts, setSavedContacts] = useState<BroadcastContact[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const refreshSaved = useCallback(async () => {
    setLoadingSaved(true);
    const { data, error } = await supabase
      .from("broadcast_contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.warn("[broadcast] failed to load saved contacts:", error.message);
      toast.error(
        error.message?.includes("does not exist") || error.message?.includes("relation")
          ? "Run the broadcast schema migration first (supabase_broadcast_schema.sql)"
          : "Could not load saved contacts"
      );
    } else {
      setSavedContacts((data || []) as BroadcastContact[]);
    }
    setLoadingSaved(false);
  }, []);

  useEffect(() => {
    refreshSaved();
  }, [refreshSaved]);

  // ── Build the unified pool of contacts (CRM + saved) ───────────
  const allContacts = useMemo<BroadcastContact[]>(() => {
    const crmClients: BroadcastContact[] = (clients || []).map((c: any) => ({
      id: `c:${c.id}`,
      name: c.name || "Unnamed Client",
      phone: c.phone ? normalizePhone(c.phone) : undefined,
      whatsapp: c.whatsapp ? normalizePhone(c.whatsapp) : (c.phone ? normalizePhone(c.phone) : undefined),
      email: c.email || undefined,
      source: "crm-client",
      tags: c.category ? [c.category] : [],
    }));
    const crmLeads: BroadcastContact[] = (leads || []).map((l: any) => ({
      id: `l:${l.id}`,
      name: l.name || l.organization || "Unnamed Lead",
      phone: l.phone ? normalizePhone(l.phone) : undefined,
      whatsapp: l.whatsapp ? normalizePhone(l.whatsapp) : (l.phone ? normalizePhone(l.phone) : undefined),
      email: l.email || undefined,
      source: "crm-lead",
      tags: l.category ? [l.category] : [],
    }));
    const crmPartners: BroadcastContact[] = (partners || []).map((p: any) => ({
      id: `p:${p.id}`,
      name: p.name || "Unnamed Partner",
      phone: p.phone ? normalizePhone(p.phone) : undefined,
      whatsapp: p.whatsapp ? normalizePhone(p.whatsapp) : (p.phone ? normalizePhone(p.phone) : undefined),
      email: p.email || undefined,
      source: "crm-partner",
      tags: [],
    }));
    const saved: BroadcastContact[] = (savedContacts || []).map((s: any) => ({
      id: `s:${s.id}`,
      name: s.name,
      phone: s.phone || undefined,
      whatsapp: s.whatsapp || s.phone || undefined,
      email: s.email || undefined,
      source: s.source || "manual",
      tags: s.tags || [],
      notes: s.notes || undefined,
    }));
    return dedupeContacts([...crmClients, ...crmLeads, ...crmPartners, ...saved]);
  }, [clients, leads, partners, savedContacts]);

  // ── Filters ───────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "whatsapp" | "email">("all");

  const filtered = useMemo(() => {
    return allContacts.filter((c) => {
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false;
      if (channelFilter === "whatsapp" && !(c.whatsapp || c.phone)) return false;
      if (channelFilter === "email" && !c.email) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${c.name} ${c.phone || ""} ${c.whatsapp || ""} ${c.email || ""} ${(c.tags || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allContacts, search, sourceFilter, channelFilter]);

  // ── Selection ─────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelectedIds(new Set(filtered.map(c => c.id!).filter(Boolean)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectedContacts = useMemo(
    () => allContacts.filter(c => c.id && selectedIds.has(c.id)),
    [allContacts, selectedIds]
  );

  // ── Composer ──────────────────────────────────────────────────
  const [activeTemplate, setActiveTemplate] = useState<BroadcastTemplate>(BROADCAST_TEMPLATES[0]);
  const [message, setMessage] = useState<string>(BROADCAST_TEMPLATES[0].message);
  const [emailSubject, setEmailSubject] = useState<string>(`${BROADCAST_TEMPLATES[0].emoji} ${BROADCAST_TEMPLATES[0].label} from CreativeMark`);

  const pickTemplate = (key: string) => {
    const t = BROADCAST_TEMPLATES.find(x => x.key === key);
    if (!t) return;
    setActiveTemplate(t);
    setMessage(t.message);
    setEmailSubject(`${t.emoji} ${t.label} from CreativeMark`);
  };

  // ── Send dialogs ──────────────────────────────────────────────
  const [waDialogOpen, setWaDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Broadcast Hub"
        subtitle="Send festival greetings, brochures, and product launches to all your contacts in one go."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <HistoryButton />
            <Button variant="outline" size="sm" onClick={refreshSaved} disabled={loadingSaved}>
              {loadingSaved ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1">Refresh</span>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: Contacts panel ───────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Contacts
              </h2>
              <Badge variant="outline" className="text-xs">
                {allContacts.length} total · {filtered.length} shown · {selectedIds.size} selected
              </Badge>
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid grid-cols-4 mb-3 w-full">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="crm" className="text-xs">From CRM</TabsTrigger>
                <TabsTrigger value="upload" className="text-xs">
                  <Upload className="h-3 w-3 mr-1" /> Upload
                </TabsTrigger>
                <TabsTrigger value="phone" className="text-xs">
                  <Smartphone className="h-3 w-3 mr-1" /> Phone
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="m-0">
                <ContactsListWithFilters
                  contacts={filtered}
                  search={search}
                  setSearch={setSearch}
                  sourceFilter={sourceFilter}
                  setSourceFilter={setSourceFilter}
                  channelFilter={channelFilter}
                  setChannelFilter={setChannelFilter}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  selectAllVisible={selectAllVisible}
                  clearSelection={clearSelection}
                />
              </TabsContent>

              <TabsContent value="crm" className="m-0">
                <ContactsListWithFilters
                  contacts={filtered.filter(c => (c.source || "").startsWith("crm-"))}
                  search={search}
                  setSearch={setSearch}
                  sourceFilter={sourceFilter}
                  setSourceFilter={setSourceFilter}
                  channelFilter={channelFilter}
                  setChannelFilter={setChannelFilter}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  selectAllVisible={selectAllVisible}
                  clearSelection={clearSelection}
                />
              </TabsContent>

              <TabsContent value="upload" className="m-0">
                <UploadPanel onImported={refreshSaved} userId={user?.id} />
                <ContactsListWithFilters
                  contacts={filtered.filter(c => c.source === "csv")}
                  search={search}
                  setSearch={setSearch}
                  sourceFilter={sourceFilter}
                  setSourceFilter={setSourceFilter}
                  channelFilter={channelFilter}
                  setChannelFilter={setChannelFilter}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  selectAllVisible={selectAllVisible}
                  clearSelection={clearSelection}
                  hideTopFilters
                />
              </TabsContent>

              <TabsContent value="phone" className="m-0">
                <PhonePanel onImported={refreshSaved} userId={user?.id} />
                <ContactsListWithFilters
                  contacts={filtered.filter(c => c.source === "phone")}
                  search={search}
                  setSearch={setSearch}
                  sourceFilter={sourceFilter}
                  setSourceFilter={setSourceFilter}
                  channelFilter={channelFilter}
                  setChannelFilter={setChannelFilter}
                  selectedIds={selectedIds}
                  toggleSelect={toggleSelect}
                  selectAllVisible={selectAllVisible}
                  clearSelection={clearSelection}
                  hideTopFilters
                />
              </TabsContent>
            </Tabs>
          </Card>
        </div>

        {/* ── Right: Composer ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <h2 className="font-bold text-base flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" /> Message
            </h2>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Pick a template
                </Label>
                <Select value={activeTemplate.key} onValueChange={pickTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">Festivals</div>
                    {BROADCAST_TEMPLATES.filter(t => t.category === "festival").map(t => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="mr-2">{t.emoji}</span>{t.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">Marketing</div>
                    {BROADCAST_TEMPLATES.filter(t => t.category === "marketing").map(t => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="mr-2">{t.emoji}</span>{t.label}
                      </SelectItem>
                    ))}
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">Other</div>
                    {BROADCAST_TEMPLATES.filter(t => t.category === "general").map(t => (
                      <SelectItem key={t.key} value={t.key}>
                        <span className="mr-2">{t.emoji}</span>{t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  Email subject (used only for email channel)
                </Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Message body
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{`{name}`}</code> to insert recipient name
                  </span>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={10}
                  className="text-xs font-mono"
                />
              </div>

              {/* Live preview */}
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Preview (first selected)</p>
                <pre className="text-[11px] whitespace-pre-wrap font-sans text-foreground">
                  {personalize(message, selectedContacts[0]?.name || "Friend")}
                </pre>
              </div>

              {/* Send buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  disabled={selectedContacts.length === 0 || !message.trim()}
                  onClick={() => setWaDialogOpen(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send via WhatsApp ({selectedContacts.filter(c => c.whatsapp || c.phone).length})
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={selectedContacts.length === 0 || !message.trim()}
                  onClick={() => setEmailDialogOpen(true)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send via Email ({selectedContacts.filter(c => c.email).length})
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Send dialogs ─────────────────────────────────────── */}
      <WhatsAppSendDialog
        open={waDialogOpen}
        onOpenChange={setWaDialogOpen}
        contacts={selectedContacts}
        message={message}
        templateKey={activeTemplate.key}
        userId={user?.id}
      />
      <EmailSendDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        contacts={selectedContacts}
        subject={emailSubject}
        body={message}
        templateKey={activeTemplate.key}
        userId={user?.id}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ContactsListWithFilters — search, source/channel filter, list
// ═══════════════════════════════════════════════════════════════
interface ContactsListProps {
  contacts: BroadcastContact[];
  search: string;
  setSearch: (s: string) => void;
  sourceFilter: string;
  setSourceFilter: (s: string) => void;
  channelFilter: "all" | "whatsapp" | "email";
  setChannelFilter: (s: "all" | "whatsapp" | "email") => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAllVisible: () => void;
  clearSelection: () => void;
  hideTopFilters?: boolean;
}

function ContactsListWithFilters(props: ContactsListProps) {
  const {
    contacts, search, setSearch, sourceFilter, setSourceFilter,
    channelFilter, setChannelFilter, selectedIds, toggleSelect,
    selectAllVisible, clearSelection, hideTopFilters,
  } = props;

  return (
    <div className="space-y-3">
      {!hideTopFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, phone, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="crm-client">Clients</SelectItem>
              <SelectItem value="crm-lead">Leads</SelectItem>
              <SelectItem value="crm-partner">Partners</SelectItem>
              <SelectItem value="csv">CSV/Excel</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={selectAllVisible} className="h-7 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Select all ({contacts.length})
        </Button>
        <Button size="sm" variant="outline" onClick={clearSelection} className="h-7 text-xs">
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm" variant={channelFilter === "all" ? "default" : "outline"}
            onClick={() => setChannelFilter("all")} className="h-7 text-xs px-2"
          >All</Button>
          <Button
            size="sm" variant={channelFilter === "whatsapp" ? "default" : "outline"}
            onClick={() => setChannelFilter("whatsapp")} className="h-7 text-xs px-2"
          ><MessageCircle className="h-3 w-3 mr-1" /> WA</Button>
          <Button
            size="sm" variant={channelFilter === "email" ? "default" : "outline"}
            onClick={() => setChannelFilter("email")} className="h-7 text-xs px-2"
          ><Mail className="h-3 w-3 mr-1" /> Email</Button>
        </div>
      </div>

      {/* List */}
      <div className="border rounded-lg max-h-[55vh] overflow-y-auto">
        {contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts found"
            description="Try uploading a CSV or importing from your phone."
          />
        ) : (
          <div className="divide-y">
            {contacts.map((c) => (
              <label
                key={c.id}
                className="flex items-start gap-3 p-2.5 hover:bg-accent/40 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={c.id ? selectedIds.has(c.id) : false}
                  onCheckedChange={() => c.id && toggleSelect(c.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <SourceBadge source={c.source} />
                    {(c.tags || []).map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-[9px] py-0">{tag}</Badge>
                    ))}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                    {(c.whatsapp || c.phone) && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />{c.whatsapp || c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3" />{c.email}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UploadPanel — CSV / Excel upload
// ═══════════════════════════════════════════════════════════════
function UploadPanel({ onImported, userId }: { onImported: () => void; userId?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File) => {
    setBusy(true);
    try {
      const ext = file.name.toLowerCase().split(".").pop() || "";
      let parsed: BroadcastContact[] = [];
      if (ext === "csv") parsed = await parseCSV(file);
      else if (ext === "xlsx" || ext === "xls") parsed = await parseExcel(file);
      else { toast.error("Please upload a .csv or .xlsx file"); setBusy(false); return; }

      if (parsed.length === 0) {
        toast.error("No valid rows found in file");
        setBusy(false);
        return;
      }

      // Insert into Supabase
      const rows = parsed.map(c => ({
        name: c.name,
        phone: c.phone || null,
        whatsapp: c.whatsapp || c.phone || null,
        email: c.email || null,
        source: "csv",
        tags: c.tags || [],
        notes: c.notes || null,
        created_by: userId || null,
      }));

      // The partial unique index (created_by, phone) WHERE phone IS NOT NULL
      // cannot be used with PostgreSQL ON CONFLICT. We deduplicate client-side
      // by querying existing phones for this user, then inserting only new rows.
      const rowsWithPhone = rows.filter(r => r.phone != null);
      const rowsWithoutPhone = rows.filter(r => r.phone == null);

      const saved: any[] = [];
      let error: any = null;

      // Helper: insert only new phone contacts by checking existing first
      const insertNewPhones = async (phoneRows: any[]) => {
        if (!userId) {
          const { data: s, error: e } = await supabase
            .from("broadcast_contacts")
            .insert(phoneRows)
            .select("id");
          return { s, e };
        }
        const { data: existing } = await supabase
          .from("broadcast_contacts")
          .select("phone")
          .eq("created_by", userId)
          .in("phone", phoneRows.map((r: any) => r.phone));
        const existingPhones = new Set((existing || []).map((x: any) => x.phone));
        const newRows = phoneRows.filter((r: any) => !existingPhones.has(r.phone));
        if (newRows.length === 0) return { s: [], e: null };
        const { data: s, error: e } = await supabase
          .from("broadcast_contacts")
          .insert(newRows)
          .select("id");
        return { s, e };
      };

      if (rowsWithPhone.length > 0) {
        const { s, e } = await insertNewPhones(rowsWithPhone);
        if (e) error = e;
        else saved.push(...(s || []));
      }
      if (!error && rowsWithoutPhone.length > 0) {
        const { data: s, error: e } = await supabase
          .from("broadcast_contacts")
          .insert(rowsWithoutPhone)
          .select("id");
        if (e) error = e;
        else saved.push(...(s || []));
      }

      if (error) {
        console.error("[broadcast] CSV upload error:", error);
        toast.error(`Upload failed: ${error.message}`);
      } else {
        const savedCount = saved.length;
        const dupCount = parsed.length - savedCount;
        if (savedCount === 0) {
          toast.info(`No new contacts — all ${parsed.length} already exist.`);
        } else if (dupCount > 0) {
          toast.success(`Imported ${savedCount} new contacts (${dupCount} duplicates skipped)`);
        } else {
          toast.success(`Imported ${savedCount} contact${savedCount === 1 ? "" : "s"} from ${file.name}`);
        }
        onImported();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to parse file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border-2 border-dashed bg-muted/30 p-4 mb-3">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="h-7 w-7 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Upload CSV or Excel file</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            First row must have headers. Recognized: <strong>Name</strong>, <strong>Phone</strong>, <strong>WhatsApp</strong>, <strong>Email</strong>, <strong>Notes</strong>, <strong>Tags</strong> (comma-separated).
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handle(f);
              }}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {busy ? "Importing…" : "Choose File"}
            </Button>
            <a
              href="data:text/csv;charset=utf-8,Name,Phone,Email,Notes,Tags%0AAsha%20Sharma,9876543210,asha@example.com,Diwali%20client,VIP%3BPolitician%0ARahul%20Mehta,9123456789,rahul@example.com,New%20lead,Motors"
              download="broadcast-contacts-template.csv"
              className="text-[11px] text-primary hover:underline ml-1"
            >
              ↓ Sample CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PhonePanel — import from device address book (APK only)
// ═══════════════════════════════════════════════════════════════
function PhonePanel({ onImported, userId }: { onImported: () => void; userId?: string }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    isPhoneContactsAvailable().then(setAvailable);
  }, []);

  const importNow = async () => {
    setBusy(true);
    try {
      const contacts = await importPhoneContacts();
      if (contacts.length === 0) {
        toast.info("No contacts found in your phone address book.");
        setBusy(false);
        return;
      }

      const rows = contacts.map(c => ({
        name: c.name,
        phone: c.phone || null,
        whatsapp: c.whatsapp || c.phone || null,
        email: c.email || null,
        source: "phone",
        tags: [],
        created_by: userId || null,
      }));

      console.log(`[broadcast] Importing ${rows.length} phone contacts. Sample:`, rows.slice(0, 3));

      // The partial unique index (created_by, phone) WHERE phone IS NOT NULL
      // cannot be used with PostgreSQL ON CONFLICT. We deduplicate client-side.
      const rowsWithPhone = rows.filter(r => r.phone != null);
      const rowsWithoutPhone = rows.filter(r => r.phone == null);

      const saved: any[] = [];
      let error: any = null;

      const insertNewPhones = async (phoneRows: any[]) => {
        if (!userId) {
          const { data: s, error: e } = await supabase
            .from("broadcast_contacts")
            .insert(phoneRows)
            .select("id");
          return { s, e };
        }
        const { data: existing } = await supabase
          .from("broadcast_contacts")
          .select("phone")
          .eq("created_by", userId)
          .in("phone", phoneRows.map((r: any) => r.phone));
        const existingPhones = new Set((existing || []).map((x: any) => x.phone));
        const newRows = phoneRows.filter((r: any) => !existingPhones.has(r.phone));
        if (newRows.length === 0) return { s: [], e: null };
        const { data: s, error: e } = await supabase
          .from("broadcast_contacts")
          .insert(newRows)
          .select("id");
        return { s, e };
      };

      if (rowsWithPhone.length > 0) {
        const { s, e } = await insertNewPhones(rowsWithPhone);
        if (e) error = e;
        else saved.push(...(s || []));
      }
      if (!error && rowsWithoutPhone.length > 0) {
        const { data: s, error: e } = await supabase
          .from("broadcast_contacts")
          .insert(rowsWithoutPhone)
          .select("id");
        if (e) error = e;
        else saved.push(...(s || []));
      }

      if (error) {
        console.error("[broadcast] Phone import save error:", error);
        toast.error(`Save failed: ${error.message}`);
      } else {
        const savedCount = saved.length;
        const dupCount = contacts.length - savedCount;
        if (savedCount === 0) {
          toast.info(`No new contacts — all ${contacts.length} already imported.`);
        } else if (dupCount > 0) {
          toast.success(`Imported ${savedCount} new (${dupCount} duplicates skipped)`);
        } else {
          toast.success(`Imported ${savedCount} contact${savedCount === 1 ? "" : "s"} from your phone`);
        }
        onImported();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to import phone contacts");
    } finally {
      setBusy(false);
    }
  };

  if (available === null) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 mb-3 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking…
      </div>
    );
  }

  if (!available) {
    return (
      <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 p-4 mb-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Phone import is APK-only</p>
            <p className="text-[11px] text-amber-800 mt-0.5">
              Install the latest CreativeMark Hub APK on your phone to read contacts directly from the device.
              On the web, you can still upload a CSV/Excel exported from your phone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed bg-muted/30 p-4 mb-3">
      <div className="flex items-start gap-3">
        <Smartphone className="h-7 w-7 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Import from your phone</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Tap below — Android will ask for permission to read your address book. Contacts will be saved to your CRM and reused for every future broadcast.
          </p>
          <div className="mt-2">
            <Button size="sm" onClick={importNow} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Smartphone className="h-4 w-4 mr-1" />}
              {busy ? "Importing…" : "Import Phone Contacts"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WhatsAppSendDialog — sequential per-contact send
// ═══════════════════════════════════════════════════════════════
interface SendDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: BroadcastContact[];
  message: string;
  templateKey: string;
  userId?: string;
}

function WhatsAppSendDialog(props: SendDialogProps) {
  const { open, onOpenChange, contacts, message, templateKey, userId } = props;
  const queue = useMemo(() => buildWhatsAppQueue(contacts, message), [contacts, message]);
  const [sentIdx, setSentIdx] = useState<Set<number>>(new Set());

  useEffect(() => { if (open) setSentIdx(new Set()); }, [open]);

  const sendOne = (i: number) => {
    const item = queue[i];
    if (!item) return;
    openWhatsAppLink(item.url);
    setSentIdx(prev => { const n = new Set(prev); n.add(i); return n; });
  };

  const sendAllSequential = async () => {
    for (let i = 0; i < queue.length; i++) {
      if (sentIdx.has(i)) continue;
      sendOne(i);
      // Stagger to give the WhatsApp app time to launch + return focus
      await new Promise(r => setTimeout(r, 1500));
    }
    await logCampaign({
      title: `WhatsApp · ${queue.length} contacts`,
      template_key: templateKey,
      message,
      channel: "whatsapp",
      recipients: queue.map(q => ({ name: q.contact.name, phone: q.contact.whatsapp || q.contact.phone })),
      sent_by: userId,
    });
    toast.success(`Opened ${queue.length} WhatsApp chats. Tap Send in each.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp Broadcast
          </DialogTitle>
        </DialogHeader>

        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No selected contacts have a valid WhatsApp / phone number.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900">
              <strong>How this works:</strong> Each tap opens WhatsApp with the message pre-filled — you only need to press <strong>Send</strong> inside WhatsApp. To stay safe with WhatsApp's spam filters, keep batches under ~50-100 messages per session.
            </div>

            <Progress value={(sentIdx.size / queue.length) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {sentIdx.size} / {queue.length} opened
            </p>

            <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
              {queue.map((item, i) => (
                <div key={i} className="p-2 flex items-center gap-2 hover:bg-accent/30">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{item.contact.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.contact.whatsapp || item.contact.phone}</p>
                  </div>
                  {sentIdx.has(i) ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Opened
                    </Badge>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-green-600" onClick={() => sendOne(i)}>
                      <Send className="h-3.5 w-3.5 mr-1" /> Open
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {queue.length > 0 && (
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={sendAllSequential}>
              <Send className="h-4 w-4 mr-2" /> Open All ({queue.length - sentIdx.size} pending)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// EmailSendDialog — mailto BCC in batches of 50
// ═══════════════════════════════════════════════════════════════
interface EmailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contacts: BroadcastContact[];
  subject: string;
  body: string;
  templateKey: string;
  userId?: string;
}

function EmailSendDialog(props: EmailDialogProps) {
  const { open, onOpenChange, contacts, subject, body, templateKey, userId } = props;
  // Email is bulk so {name} can't be personalized per recipient — use a generic
  // "Hello" body. If the user wants per-recipient personalization, they should
  // use the WhatsApp channel.
  const generic = useMemo(() => personalize(body, "Friend"), [body]);
  const batches = useMemo(() => buildEmailBatches(contacts, subject, generic, 50), [contacts, subject, generic]);
  const validEmails = useMemo(
    () => contacts.filter(c => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)),
    [contacts]
  );
  const [sentBatches, setSentBatches] = useState<Set<number>>(new Set());

  useEffect(() => { if (open) setSentBatches(new Set()); }, [open]);

  const sendBatch = (i: number) => {
    openEmailBatch(batches[i]);
    setSentBatches(prev => { const n = new Set(prev); n.add(i); return n; });
  };

  const sendAll = async () => {
    for (let i = 0; i < batches.length; i++) {
      if (sentBatches.has(i)) continue;
      sendBatch(i);
      await new Promise(r => setTimeout(r, 800));
    }
    await logCampaign({
      title: `Email · ${validEmails.length} contacts`,
      template_key: templateKey,
      message: generic,
      channel: "email",
      recipients: validEmails.map(c => ({ name: c.name, email: c.email })),
      sent_by: userId,
    });
    toast.success(`Opened ${batches.length} email draft${batches.length === 1 ? "" : "s"} — review and Send from your mail app.`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" /> Email Broadcast (BCC)
          </DialogTitle>
        </DialogHeader>

        {validEmails.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            None of the selected contacts have a valid email address.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-[12px] text-blue-900">
              <strong>How this works:</strong> {validEmails.length} email{validEmails.length === 1 ? "" : "s"} will be split into <strong>{batches.length}</strong> batch{batches.length === 1 ? "" : "es"} of up to 50 BCC recipients. Each batch opens your default mail app — review the draft and tap <strong>Send</strong>.
              <br />
              <em>Tip:</em> Recipients won't see each other (BCC). For per-recipient personalization, use WhatsApp instead.
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Subject</Label>
              <p className="text-sm font-medium border rounded-md p-2 bg-muted/40">{subject}</p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Body preview</Label>
              <pre className="text-[11px] whitespace-pre-wrap border rounded-md p-2 bg-muted/40 max-h-40 overflow-y-auto font-sans">{generic}</pre>
            </div>

            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {batches.map((_, i) => (
                <div key={i} className="p-2 flex items-center gap-2">
                  <div className="flex-1">
                    <p className="text-sm">Batch {i + 1} · {Math.min(50, validEmails.length - i * 50)} recipient(s)</p>
                  </div>
                  {sentBatches.has(i) ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Opened
                    </Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => sendBatch(i)} className="h-7 text-xs">
                      <Send className="h-3 w-3 mr-1" /> Open Draft
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {batches.length > 0 && (
            <Button onClick={sendAll}>
              <Send className="h-4 w-4 mr-2" /> Open All Drafts ({batches.length})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// Campaign log helper
// ═══════════════════════════════════════════════════════════════
async function logCampaign(c: {
  title: string;
  template_key: string;
  message: string;
  channel: BroadcastChannel | "mixed";
  recipients: any[];
  sent_by?: string;
}) {
  const { error } = await supabase.from("broadcast_campaigns").insert({
    title: c.title,
    template_key: c.template_key,
    message: c.message,
    channel: c.channel,
    recipient_count: c.recipients.length,
    recipients: c.recipients,
    status: "sent",
    sent_by: c.sent_by || null,
  });
  if (error) console.warn("[broadcast] failed to log campaign:", error.message);
}

// ═══════════════════════════════════════════════════════════════
// HistoryButton — quick view of past campaigns
// ═══════════════════════════════════════════════════════════════
function HistoryButton() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("broadcast_campaigns")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="h-4 w-4 mr-1" /> History
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Broadcast History
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-8 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No broadcasts sent yet.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y">
              {items.map((it) => (
                <div key={it.id} className="py-2.5 px-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{it.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {it.channel === "whatsapp" ? <MessageCircle className="h-3 w-3 mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                      {it.channel}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {it.recipient_count} recipient(s) · {new Date(it.sent_at).toLocaleString()}
                  </p>
                  <pre className="text-[10px] mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-3 font-sans">{it.message}</pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
