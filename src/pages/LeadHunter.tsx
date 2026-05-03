// ═══════════════════════════════════════════════════════════════════
// Lead Hunter
//
// Free B2B prospecting tool inspired by MapiLeads.
//   1. Pick a business category + city + radius
//   2. Scrape OpenStreetMap (free, no API key)
//   3. Optionally enrich each lead by fetching its website -> emails/socials
//   4. Optionally ask Gemini 2.5 Flash for a personalized cold email + fit score
//   5. Import the best leads into the main CRM `leads` table
//
// All third-party calls are FREE and key-less except Gemini, which uses the
// VITE_GEMINI_API_KEY env var.
// ═══════════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Search, MapPin, Sparkles, Globe, Mail, Phone, Star, ExternalLink,
  Download, RefreshCw, Loader2, MessageSquare, Send, Plus, Trash2, Filter,
  Zap, AlertCircle, CheckCircle2,
} from "lucide-react";

import {
  BUSINESS_CATEGORIES, BusinessCategoryDef, geocodeCity, scrapeLeads,
  ScrapedLead, googleMapsLink, osmLink,
} from "@/lib/leadScraper";
import { enrichFromWebsite } from "@/lib/leadEnrich";
import { generateColdEmail, isGeminiConfigured, GeminiError } from "@/lib/gemini";
import { waLink } from "@/lib/format";

// ── Types ─────────────────────────────────────────────────────────
interface ListRow {
  id: string;
  name: string;
  category_label: string | null;
  city: string | null;
  radius_meters: number | null;
  created_at: string;
}

interface LeadRow {
  id: string;
  list_id: string;
  source: string;
  source_id: string | null;
  name: string;
  category: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  address_full: string | null;
  address_city: string | null;
  lat: number | null;
  lon: number | null;
  enriched: boolean;
  enriched_emails: string[] | null;
  enriched_phones: string[] | null;
  socials: Record<string, string> | null;
  ai_subject: string | null;
  ai_email_body: string | null;
  ai_whatsapp: string | null;
  ai_pain_point: string | null;
  ai_fit_score: number | null;
  status: string;
  imported_lead_id: string | null;
  notes: string | null;
}

const RADIUS_OPTIONS = [
  { value: 1000, label: "1 km" },
  { value: 2500, label: "2.5 km" },
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 25000, label: "25 km (city-wide)" },
];

// ═══════════════════════════════════════════════════════════════════
const LeadHunter = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Search-form state ──
  const [categoryKey, setCategoryKey] = useState<string>(BUSINESS_CATEGORIES[0].key);
  const [city, setCity] = useState<string>("");
  const [radius, setRadius] = useState<number>(5000);
  const [scraping, setScraping] = useState(false);
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // ── Bulk-action state ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // ── Detail dialog ──
  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);

  const category = BUSINESS_CATEGORIES.find(c => c.key === categoryKey)!;

  // ── Fetch saved lists ──
  const { data: lists } = useQuery({
    queryKey: ["lead_hunter_lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_hunter_lists")
        .select("id, name, category_label, city, radius_meters, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[lead-hunter] lists fetch error:", error.message);
        if (error.message.includes("does not exist") || error.message.includes("relation")) {
          toast.error("Run supabase_lead_hunter_schema.sql in your Supabase SQL editor first.");
        }
        return [] as ListRow[];
      }
      return (data || []) as ListRow[];
    },
  });

  // ── Fetch leads in active list ──
  const { data: leads, refetch: refetchLeads } = useQuery({
    queryKey: ["lead_hunter_leads", activeListId],
    enabled: !!activeListId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_hunter_leads")
        .select("*")
        .eq("list_id", activeListId)
        .order("ai_fit_score", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[lead-hunter] leads fetch error:", error.message);
        return [] as LeadRow[];
      }
      return (data || []) as LeadRow[];
    },
  });

  // ── Auto-pick the most recent list on load ──
  useEffect(() => {
    if (!activeListId && lists && lists.length > 0) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  // ── Filtered + searched leads (memo) ──
  const visibleLeads = useMemo(() => {
    if (!leads) return [];
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.category || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.phone || "").toLowerCase().includes(q) ||
        (l.address_city || "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  // ── Scrape: geocode -> overpass -> save list + leads ──
  const handleScrape = async () => {
    if (!city.trim()) { toast.error("Enter a city or area name"); return; }
    setScraping(true);
    try {
      toast.info(`Looking up "${city}"…`);
      let geo;
      try {
        geo = await geocodeCity(city.trim());
      } catch (geoErr: any) {
        console.error("[lead-hunter] geocode error:", geoErr);
        toast.error(
          geoErr?.message?.includes("Failed to fetch")
            ? "Map lookup failed: check your internet connection and retry."
            : `Map lookup failed: ${geoErr?.message || "unknown error"}`
        );
        return;
      }
      if (!geo) { toast.error(`Could not find "${city}" on the map.`); return; }

      toast.info(`Scanning ${category.label.toLowerCase()} within ${RADIUS_OPTIONS.find(r => r.value === radius)?.label} of ${geo.display_name.split(",")[0]}…`);

      let scraped;
      try {
        scraped = await scrapeLeads({
          category, lat: geo.lat, lon: geo.lon, radiusMeters: radius, limit: 200,
        });
      } catch (scrapeErr: any) {
        console.error("[lead-hunter] scrape error:", scrapeErr);
        const m = scrapeErr?.message || "";
        if (m.includes("429") || m.includes("busy") || m.includes("504")) {
          toast.error("Lead server is busy. Please wait 30 seconds and retry.");
        } else if (m.includes("Failed to fetch")) {
          toast.error("Scan failed: check your internet connection and retry.");
        } else {
          toast.error(`Scan failed: ${m || "unknown error"}`);
        }
        return;
      }

      if (scraped.length === 0) {
        toast.warning("No businesses found. Try a wider radius or a different category.");
        return;
      }

      // 1) Create the list
      const { data: listInsert, error: listErr } = await supabase
        .from("lead_hunter_lists")
        .insert([{
          name: `${category.label} · ${geo.display_name.split(",")[0]} · ${RADIUS_OPTIONS.find(r => r.value === radius)?.label}`,
          category_key: category.key,
          category_label: category.label,
          city: geo.display_name,
          center_lat: geo.lat,
          center_lon: geo.lon,
          radius_meters: radius,
          source: "osm",
          created_by: user?.id || null,
        }])
        .select("id")
        .single();
      if (listErr || !listInsert) {
        toast.error(`Save failed: ${listErr?.message || "unknown"}`);
        return;
      }

      // 2) Insert all leads (upsert + ignoreDuplicates is safe — schema has
      //    a unique (list_id, source, source_id) index)
      const rows = scraped.map((s: ScrapedLead) => ({
        list_id: listInsert.id,
        source: s.source,
        source_id: s.osm_id,
        name: s.name,
        category: s.category,
        phone: s.phone || null,
        website: s.website || null,
        email: s.email || null,
        address_full: s.address_full || null,
        address_city: s.address_city || null,
        lat: s.lat,
        lon: s.lon,
        raw_tags: s.raw_tags,
        created_by: user?.id || null,
      }));

      const { error: leadsErr } = await supabase
        .from("lead_hunter_leads")
        .upsert(rows, { onConflict: "list_id,source,source_id", ignoreDuplicates: true });

      if (leadsErr) {
        toast.error(`Saved list but leads insert failed: ${leadsErr.message}`);
        return;
      }

      toast.success(`Found ${scraped.length} leads. Click any row to enrich + generate AI outreach.`);
      setActiveListId(listInsert.id);
      queryClient.invalidateQueries({ queryKey: ["lead_hunter_lists"] });
    } catch (e: any) {
      toast.error(e?.message || "Scrape failed");
    } finally {
      setScraping(false);
    }
  };

  // ── Enrich a single lead via website scraping ──
  const enrichOne = async (lead: LeadRow): Promise<boolean> => {
    if (!lead.website) {
      toast.warning(`${lead.name}: no website to scrape.`);
      return false;
    }
    const result = await enrichFromWebsite(lead.website);
    if (!result.ok && !result.emails.length && !Object.keys(result.socials).length) {
      // Mark as enriched anyway so we don't keep retrying
      await supabase.from("lead_hunter_leads").update({
        enriched: true, enriched_at: new Date().toISOString(),
      }).eq("id", lead.id);
      return false;
    }
    await supabase.from("lead_hunter_leads").update({
      enriched: true,
      enriched_emails: result.emails,
      enriched_phones: result.phones,
      socials: result.socials,
      // If we found an email and the lead didn't have one, promote the first
      email: lead.email || result.emails[0] || null,
      enriched_at: new Date().toISOString(),
    }).eq("id", lead.id);
    return true;
  };

  // ── Generate AI cold-email for a single lead ──
  const generateOne = async (lead: LeadRow): Promise<boolean> => {
    if (!isGeminiConfigured()) {
      toast.error("Gemini API key missing. Add VITE_GEMINI_API_KEY to .env and rebuild.");
      return false;
    }
    try {
      const out = await generateColdEmail({
        name: lead.name,
        category: lead.category || undefined,
        city: lead.address_city || undefined,
        website: lead.website || undefined,
        email: lead.email || lead.enriched_emails?.[0] || undefined,
        phone: lead.phone || undefined,
      });
      await supabase.from("lead_hunter_leads").update({
        ai_subject: out.subject,
        ai_email_body: out.body,
        ai_whatsapp: out.whatsapp,
        ai_pain_point: out.pain_point_guess,
        ai_fit_score: out.fit_score,
        ai_generated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      return true;
    } catch (e: any) {
      console.error("[lead-hunter] gemini error:", e);
      if (e instanceof GeminiError) toast.error(e.message);
      else toast.error("AI generation failed: " + (e?.message || "unknown"));
      return false;
    }
  };

  // ── Bulk: enrich selected ──
  const handleBulkEnrich = async () => {
    if (selectedIds.size === 0) { toast.error("Select at least one lead first."); return; }
    const targets = (leads || []).filter(l => selectedIds.has(l.id));
    setBusyAction(`Enriching 0/${targets.length}…`);
    let ok = 0, skipped = 0;
    for (let i = 0; i < targets.length; i++) {
      setBusyAction(`Enriching ${i + 1}/${targets.length}…`);
      const success = await enrichOne(targets[i]);
      if (success) ok++; else skipped++;
    }
    setBusyAction(null);
    refetchLeads();
    toast.success(`Enriched ${ok} leads. ${skipped} skipped (no website / no data found).`);
  };

  // ── Bulk: AI cold-emails for selected ──
  const handleBulkGenerate = async () => {
    if (selectedIds.size === 0) { toast.error("Select at least one lead first."); return; }
    if (!isGeminiConfigured()) {
      toast.error("Gemini API key missing. Add VITE_GEMINI_API_KEY to .env and rebuild.");
      return;
    }
    const targets = (leads || []).filter(l => selectedIds.has(l.id));
    if (targets.length > 30) {
      toast.error("Free Gemini tier is ~10 RPM. Pick ≤30 leads at a time.");
      return;
    }
    setBusyAction(`Writing cold emails 0/${targets.length}…`);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      setBusyAction(`Writing cold emails ${i + 1}/${targets.length}…`);
      const success = await generateOne(targets[i]);
      if (success) ok++;
      // Soft 7s gap between calls to stay under the free 10 RPM limit
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 7000));
    }
    setBusyAction(null);
    refetchLeads();
    toast.success(`Generated ${ok}/${targets.length} cold emails + WhatsApp messages.`);
  };

  // ── Star / mark contacted / reject ──
  const setStatus = async (leadId: string, status: string) => {
    await supabase.from("lead_hunter_leads").update({ status }).eq("id", leadId);
    refetchLeads();
  };

  // ── Promote to main CRM `leads` table ──
  const promoteToCrm = async (lead: LeadRow) => {
    const payload: any = {
      name: lead.name,
      organization: lead.name,
      company: lead.name,
      phone: lead.phone || lead.enriched_phones?.[0] || null,
      whatsapp: lead.phone || lead.enriched_phones?.[0] || null,
      email: lead.email || lead.enriched_emails?.[0] || null,
      stage: "New",
      heat: "Cold",
      source: "Lead Hunter",
      notes: [
        lead.category && `Category: ${lead.category}`,
        lead.address_full && `Address: ${lead.address_full}`,
        lead.ai_pain_point && `Pain point: ${lead.ai_pain_point}`,
        lead.website && `Website: ${lead.website}`,
      ].filter(Boolean).join("\n"),
      date_received: new Date().toISOString().slice(0, 10),
      assigned_to: user?.id || null,
    };
    const { data, error } = await supabase.from("leads").insert([payload]).select("id").single();
    if (error) {
      // If the leads table has different required columns, surface the error so
      // the user sees the exact field name to add.
      toast.error(`Import failed: ${error.message}`);
      return;
    }
    await supabase.from("lead_hunter_leads").update({
      status: "imported", imported_lead_id: data.id,
    }).eq("id", lead.id);
    refetchLeads();
    toast.success(`${lead.name} added to CRM Leads.`);
  };

  const handleBulkPromote = async () => {
    const targets = (leads || []).filter(l => selectedIds.has(l.id) && l.status !== "imported");
    if (targets.length === 0) { toast.error("Nothing new to import."); return; }
    setBusyAction(`Importing 0/${targets.length}…`);
    let ok = 0;
    for (let i = 0; i < targets.length; i++) {
      setBusyAction(`Importing ${i + 1}/${targets.length}…`);
      try { await promoteToCrm(targets[i]); ok++; } catch { /* toast already shown */ }
    }
    setBusyAction(null);
    toast.success(`Imported ${ok} leads into CRM.`);
    setSelectedIds(new Set());
  };

  // ── Export current view as CSV ──
  const handleExportCsv = () => {
    if (visibleLeads.length === 0) { toast.error("Nothing to export."); return; }
    const headers = ["Name", "Category", "Phone", "Email", "Website", "City", "Address", "Lat", "Lon", "AI Fit", "AI Pain Point", "Status"];
    const rows = visibleLeads.map(l => [
      l.name,
      l.category || "",
      l.phone || l.enriched_phones?.[0] || "",
      l.email || l.enriched_emails?.[0] || "",
      l.website || "",
      l.address_city || "",
      l.address_full || "",
      l.lat ?? "",
      l.lon ?? "",
      l.ai_fit_score ?? "",
      l.ai_pain_point || "",
      l.status,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lead-hunter-${activeListId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${visibleLeads.length} leads.`);
  };

  // ── Delete list ──
  const deleteList = async (listId: string) => {
    if (!confirm("Delete this list and all its leads? This cannot be undone.")) return;
    const { error } = await supabase.from("lead_hunter_lists").delete().eq("id", listId);
    if (error) { toast.error(error.message); return; }
    toast.success("List deleted.");
    if (activeListId === listId) setActiveListId(null);
    queryClient.invalidateQueries({ queryKey: ["lead_hunter_lists"] });
  };

  const allSelected = visibleLeads.length > 0 && visibleLeads.every(l => selectedIds.has(l.id));
  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleLeads.map(l => l.id)));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Lead Hunter
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Scrape Google-Maps-style B2B leads from OpenStreetMap (free), enrich via website, and generate AI cold emails with Gemini 2.5 Flash.
          </p>
        </div>
        {!isGeminiConfigured() && (
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] gap-1">
            <AlertCircle className="h-3 w-3" /> Gemini key missing — AI features disabled
          </Badge>
        )}
      </div>

      {/* ── Search panel ───────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-purple-500/5 to-blue-500/5 border-purple-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-purple-600" />
            New Hunt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-4">
              <Label className="text-xs">Business Type</Label>
              <Select value={categoryKey} onValueChange={setCategoryKey}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-4">
              <Label className="text-xs">City / Area</Label>
              <Input
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="e.g. Pune, Bandra Mumbai, Connaught Place Delhi"
                onKeyDown={e => { if (e.key === "Enter" && !scraping) handleScrape(); }}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Radius</Label>
              <Select value={String(radius)} onValueChange={v => setRadius(parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RADIUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Button onClick={handleScrape} disabled={scraping} className="w-full gap-1">
                {scraping ? <><Loader2 className="h-3 w-3 animate-spin" />Hunting…</> : <><Sparkles className="h-3 w-3" />Hunt</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Saved lists tabs ───────────────────────────────────── */}
      {lists && lists.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0">My Hunts:</span>
              {lists.map(l => (
                <div key={l.id} className="flex items-center gap-1 shrink-0">
                  <Button
                    variant={activeListId === l.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setActiveListId(l.id); setSelectedIds(new Set()); }}
                    className="h-7 text-[11px]"
                  >
                    {l.category_label} · {l.city?.split(",")[0]}
                  </Button>
                  {activeListId === l.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteList(l.id)} title="Delete list">
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* ── Results table ──────────────────────────────────────── */}
      {activeListId && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Results
                {leads && <Badge variant="secondary" className="ml-2 text-[10px]">{leads.length} total</Badge>}
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 w-44 text-xs"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-32 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="starred">Starred</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="imported">Imported</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleExportCsv}>
                  <Download className="h-3 w-3" />CSV
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => refetchLeads()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap p-2 bg-purple-500/10 rounded-md">
                <span className="text-xs font-semibold">{selectedIds.size} selected</span>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleBulkEnrich} disabled={!!busyAction}>
                  <Globe className="h-3 w-3" />Enrich (website→emails)
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleBulkGenerate} disabled={!!busyAction || !isGeminiConfigured()}>
                  <Zap className="h-3 w-3" />AI Cold Email
                </Button>
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleBulkPromote} disabled={!!busyAction}>
                  <Plus className="h-3 w-3" />Import to CRM
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
                {busyAction && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />{busyAction}
                  </span>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-xs">Business</TableHead>
                    <TableHead className="text-xs">Contact</TableHead>
                    <TableHead className="text-xs">AI Fit</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <Sparkles className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                        <div className="font-semibold mb-1">No leads yet</div>
                        <div className="text-xs">Start a hunt above — pick a category, city, and radius.</div>
                      </TableCell>
                    </TableRow>
                  ) : visibleLeads.map(l => (
                    <TableRow
                      key={l.id}
                      className={`cursor-pointer ${selectedIds.has(l.id) ? "bg-purple-500/5" : ""}`}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(l.id)}
                          onCheckedChange={() => {
                            setSelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                              return next;
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell onClick={() => setDetailLead(l)}>
                        <div className="font-semibold text-sm">{l.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          {l.category && <span>{l.category}</span>}
                          {l.address_city && <span>· {l.address_city}</span>}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setDetailLead(l)}>
                        <div className="space-y-0.5 text-[11px]">
                          {(l.email || l.enriched_emails?.[0]) && (
                            <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{l.email || l.enriched_emails?.[0]}</div>
                          )}
                          {l.phone && (
                            <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{l.phone}</div>
                          )}
                          {l.website && (
                            <div className="flex items-center gap-1 text-blue-600"><Globe className="h-3 w-3" />Has site</div>
                          )}
                          {l.enriched && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">enriched</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => setDetailLead(l)}>
                        {l.ai_fit_score != null ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge variant="outline" className={`text-[10px] w-fit ${
                              l.ai_fit_score >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                              l.ai_fit_score >= 40 ? "bg-amber-50 text-amber-700 border-amber-300" :
                              "bg-gray-50 text-gray-600 border-gray-300"
                            }`}>
                              {l.ai_fit_score}/100
                            </Badge>
                            {l.ai_pain_point && (
                              <span className="text-[10px] text-muted-foreground italic line-clamp-2 max-w-[200px]">"{l.ai_pain_point}"</span>
                            )}
                          </div>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${
                          l.status === "imported" ? "bg-blue-50 text-blue-700 border-blue-300" :
                          l.status === "starred" ? "bg-yellow-50 text-yellow-700 border-yellow-300" :
                          l.status === "contacted" ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                          l.status === "rejected" ? "bg-red-50 text-red-700 border-red-300" :
                          "bg-gray-50 text-gray-700"
                        }`}>{l.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStatus(l.id, l.status === "starred" ? "new" : "starred")} title="Star">
                            <Star className={`h-3.5 w-3.5 ${l.status === "starred" ? "fill-yellow-400 text-yellow-500" : ""}`} />
                          </Button>
                          {(l.phone || l.enriched_phones?.[0]) && (
                            <a href={waLink(l.phone || l.enriched_phones![0], l.ai_whatsapp || "")} target="_blank" rel="noreferrer" title="WhatsApp">
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MessageSquare className="h-3.5 w-3.5 text-emerald-600" /></Button>
                            </a>
                          )}
                          {(l.email || l.enriched_emails?.[0]) && (
                            <a
                              href={`mailto:${l.email || l.enriched_emails?.[0]}?subject=${encodeURIComponent(l.ai_subject || "")}&body=${encodeURIComponent(l.ai_email_body || "")}`}
                              title="Email"
                            >
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Send className="h-3.5 w-3.5 text-blue-600" /></Button>
                            </a>
                          )}
                          {l.lat != null && l.lon != null && (
                            <a href={googleMapsLink({ lat: l.lat, lon: l.lon } as any)} target="_blank" rel="noreferrer" title="Map">
                              <Button variant="ghost" size="icon" className="h-7 w-7"><MapPin className="h-3.5 w-3.5" /></Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Lead detail / AI dialog ─────────────────────────── */}
      <Dialog open={!!detailLead} onOpenChange={v => !v && setDetailLead(null)}>
        {detailLead && (
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {detailLead.name}
                {detailLead.ai_fit_score != null && (
                  <Badge variant="outline" className={`${
                    detailLead.ai_fit_score >= 70 ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                    detailLead.ai_fit_score >= 40 ? "bg-amber-50 text-amber-700 border-amber-300" :
                    "bg-gray-50 text-gray-600 border-gray-300"
                  }`}>
                    Fit: {detailLead.ai_fit_score}/100
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{detailLead.category}{detailLead.address_full && ` · ${detailLead.address_full}`}</p>
            </DialogHeader>

            <Tabs defaultValue="contact" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="contact" className="text-xs">Contact</TabsTrigger>
                <TabsTrigger value="email" className="text-xs"><Mail className="h-3 w-3 mr-1" />Cold Email</TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />WhatsApp</TabsTrigger>
              </TabsList>

              <TabsContent value="contact" className="space-y-2 pt-2 text-sm">
                {detailLead.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{detailLead.phone}</div>}
                {detailLead.enriched_phones?.map((p, i) => <div key={i} className="flex items-center gap-2 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{p} <Badge variant="outline" className="text-[9px]">enriched</Badge></div>)}
                {detailLead.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" />{detailLead.email}</div>}
                {detailLead.enriched_emails?.map((e, i) => <div key={i} className="flex items-center gap-2 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{e} <Badge variant="outline" className="text-[9px]">enriched</Badge></div>)}
                {detailLead.website && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><a className="text-blue-600 underline" href={detailLead.website} target="_blank" rel="noreferrer">{detailLead.website}</a></div>}
                {detailLead.address_full && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{detailLead.address_full}</div>}

                {detailLead.socials && Object.keys(detailLead.socials).length > 0 && (
                  <div className="pt-2 border-t">
                    <Label className="text-xs">Socials</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(detailLead.socials).map(([k, v]) => (
                        <a key={k} href={v} target="_blank" rel="noreferrer">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <ExternalLink className="h-3 w-3" />{k}
                          </Badge>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {detailLead.ai_pain_point && (
                  <div className="pt-2 border-t bg-purple-50 -mx-4 px-4 py-2">
                    <Label className="text-xs text-purple-700">AI-guessed pain point</Label>
                    <p className="text-sm italic mt-1">"{detailLead.ai_pain_point}"</p>
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t flex-wrap">
                  <Button size="sm" variant="outline" onClick={async () => { setBusyAction("Enriching…"); await enrichOne(detailLead); setBusyAction(null); refetchLeads(); setDetailLead(null); }} disabled={!detailLead.website || !!busyAction} className="gap-1">
                    <Globe className="h-3 w-3" />Enrich from Website
                  </Button>
                  <Button size="sm" variant="outline" onClick={async () => { setBusyAction("Generating…"); await generateOne(detailLead); setBusyAction(null); refetchLeads(); setDetailLead(null); }} disabled={!isGeminiConfigured() || !!busyAction} className="gap-1">
                    <Zap className="h-3 w-3" />Generate AI Outreach
                  </Button>
                  <Button size="sm" onClick={() => promoteToCrm(detailLead).then(() => setDetailLead(null))} disabled={detailLead.status === "imported"} className="gap-1">
                    {detailLead.status === "imported" ? <><CheckCircle2 className="h-3 w-3" />Already in CRM</> : <><Plus className="h-3 w-3" />Add to CRM Leads</>}
                  </Button>
                  <a href={osmLink({ osm_id: detailLead.source_id || "", osm_type: "node" } as any)} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" className="gap-1"><ExternalLink className="h-3 w-3" />OSM</Button>
                  </a>
                </div>
              </TabsContent>

              <TabsContent value="email" className="space-y-2 pt-2">
                {detailLead.ai_email_body ? (
                  <>
                    <div>
                      <Label className="text-xs">Subject</Label>
                      <Input value={detailLead.ai_subject || ""} readOnly className="font-semibold" />
                    </div>
                    <div>
                      <Label className="text-xs">Body</Label>
                      <Textarea value={detailLead.ai_email_body} readOnly rows={8} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigator.clipboard.writeText(`Subject: ${detailLead.ai_subject}\n\n${detailLead.ai_email_body}`)}>
                        Copy
                      </Button>
                      {(detailLead.email || detailLead.enriched_emails?.[0]) && (
                        <a
                          href={`mailto:${detailLead.email || detailLead.enriched_emails?.[0]}?subject=${encodeURIComponent(detailLead.ai_subject || "")}&body=${encodeURIComponent(detailLead.ai_email_body || "")}`}
                        >
                          <Button size="sm" variant="default" className="gap-1"><Send className="h-3 w-3" />Open in Mail</Button>
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No AI cold email yet.
                    <div className="mt-2">
                      <Button size="sm" onClick={async () => { setBusyAction("Generating…"); await generateOne(detailLead); setBusyAction(null); refetchLeads(); }} disabled={!isGeminiConfigured() || !!busyAction} className="gap-1">
                        <Zap className="h-3 w-3" />Generate Now
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="whatsapp" className="space-y-2 pt-2">
                {detailLead.ai_whatsapp ? (
                  <>
                    <Textarea value={detailLead.ai_whatsapp} readOnly rows={6} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => navigator.clipboard.writeText(detailLead.ai_whatsapp || "")}>
                        Copy
                      </Button>
                      {(detailLead.phone || detailLead.enriched_phones?.[0]) && (
                        <a href={waLink(detailLead.phone || detailLead.enriched_phones![0], detailLead.ai_whatsapp)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700"><MessageSquare className="h-3 w-3" />Open WhatsApp</Button>
                        </a>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No AI WhatsApp message yet. Use "Generate AI Outreach" on the Contact tab.
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter className="border-t pt-3">
              <Button variant="ghost" onClick={() => setDetailLead(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default LeadHunter;
