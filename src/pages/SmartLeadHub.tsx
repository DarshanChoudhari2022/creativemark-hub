import { useState, useMemo, useEffect } from "react";
import { Plus, Zap, Clock, Users, Phone, MessageCircle, MessageSquare, Bell, BellRing, ArrowUpRight, Filter, Search, RefreshCw, CheckCircle, AlertTriangle, XCircle, TrendingUp, Activity, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { waLink, smsLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { toast } from "sonner";

type LeadSource = "Just Dial" | "Meta Ads" | "Google Ads" | "OEM CRM" | "Walk-in" | "Website" | "Other";
type LeadStatus = "New" | "Assigned" | "Contacted" | "Follow-up" | "Converted" | "Lost";

const SOURCE_COLORS: Record<string, string> = {
  "Just Dial": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "Meta Ads": "bg-blue-100 text-blue-800 border-blue-300",
  "Google Ads": "bg-red-100 text-red-800 border-red-300",
  "OEM CRM": "bg-purple-100 text-purple-800 border-purple-300",
  "Walk-in": "bg-green-100 text-green-800 border-green-300",
  "Website": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "Other": "bg-gray-100 text-gray-600 border-gray-300",
};

const STATUS_COLORS: Record<string, string> = {
  New: "bg-blue-500",
  Assigned: "bg-amber-500",
  Contacted: "bg-emerald-500",
  "Follow-up": "bg-orange-500",
  Converted: "bg-green-600",
  Lost: "bg-red-500",
};

const SLA_THRESHOLD_SECONDS = 15 * 60; // 15 minutes SLA for first response

const SmartLeadHub = () => {
  const { data: smartLeads, loading, insert, update, refresh } = useSupabaseTable<any>("smart_leads", "*, assigned_to(id, name, phone, whatsapp)");
  const { data: employeesData } = useSupabaseTable<any>("employees", "*, leads:leads!assigned_to(id, stage)");
  const { data: rosterData } = useSupabaseTable<any>("sales_roster", "*, employee_id(id, name)");
  const { data: webhookConfigs } = useSupabaseTable<any>("webhook_config", "*");
  const { data: activityLogs, refresh: refreshLogs } = useSupabaseTable<any>("lead_activity_log", "*, lead_id(id, customer_name)");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", whatsapp: "", email: "", vehicle: "", source: "Walk-in" as LeadSource, notes: "" });

  // ── Auto-refresh every 30 seconds for real-time visibility ──
  useEffect(() => {
    const interval = setInterval(() => { refresh(); refreshLogs(); }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate Employee Metrics for Assignment
  const employees = useMemo(() => {
    return employeesData.map(e => {
      const allLeads = e.leads || [];
      const activeLeads = allLeads.filter((l: any) => !["Converted", "Lost"].includes(l.stage));
      const convertedLeads = allLeads.filter((l: any) => l.stage === "Converted");
      const conversionRate = allLeads.length > 0 ? Math.round((convertedLeads.length / allLeads.length) * 100) : 0;
      
      return {
        ...e,
        activeLeadsCount: activeLeads.length,
        conversionRate,
        target: e.lead_target || 50,
      };
    });
  }, [employeesData]);

  // Derived metrics
  const leads = useMemo(() => smartLeads.map(l => ({
    ...l,
    assignedName: l.assigned_to?.name || "Unassigned",
    responseMinutes: l.response_time_seconds ? Math.round(l.response_time_seconds / 60) : null,
  })), [smartLeads]);

  const filtered = useMemo(() => leads.filter(l => {
    if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
    if (statusFilter !== "all" && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.customer_name?.toLowerCase().includes(q) && !l.phone?.includes(q) && !l.vehicle_interest?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [leads, sourceFilter, statusFilter, search]);

  const todayLeads = leads.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString());
  const avgResponseTime = todayLeads.filter(l => l.response_time_seconds).reduce((s, l, _, a) => s + l.response_time_seconds / a.length, 0);
  const unassignedCount = leads.filter(l => l.status === "New" && !l.assigned_to).length;
  const convertedToday = todayLeads.filter(l => l.status === "Converted").length;

  // ── SLA Breach Detection ──
  const slaBreachedLeads = useMemo(() => {
    const now = Date.now();
    return leads.filter(l => {
      if (l.status === "Converted" || l.status === "Lost") return false;
      if (l.first_response_at) return false; // Already responded
      const assignedAt = l.assigned_at ? new Date(l.assigned_at).getTime() : new Date(l.created_at).getTime();
      const elapsed = (now - assignedAt) / 1000;
      return elapsed > SLA_THRESHOLD_SECONDS;
    });
  }, [leads]);

  // ── Assign All Unassigned ──
  const assignAllUnassigned = async () => {
    const unassigned = leads.filter(l => l.status === "New" && !l.assigned_to);
    if (unassigned.length === 0) { toast.info("No unassigned leads"); return; }
    let assigned = 0;
    for (const lead of unassigned) {
      await autoAssign(lead.id);
      assigned++;
    }
    toast.success(`Auto-assigned ${assigned} lead(s)`);
  };

  // Available salespeople (not on leave)
  const availableSalespeople = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return rosterData.filter(r => {
      const emp = employees.find(e => e.id === (r.employee_id?.id || r.employee_id));
      if (!r.is_available || emp?.status !== "Active") return false;
      if (r.leave_start && r.leave_end && today >= r.leave_start && today <= r.leave_end) return false;
      return true;
    }).map(r => {
      const emp = employees.find(e => e.id === (r.employee_id?.id || r.employee_id));
      return { ...r, ...emp };
    });
  }, [rosterData, employees]);

  // Auto-assign logic (Weighted Performance)
  const autoAssign = async (leadId: string) => {
    if (availableSalespeople.length === 0) { toast.error("No salespeople available!"); return; }
    
    // Sort by: 
    // 1. Workload ratio (current active / target) - lower is better
    // 2. Conversion rate - higher is better
    // 3. Today's leads - lower is better
    const assignCounts: Record<string, number> = {};
    todayLeads.forEach(l => { if (l.assigned_to?.id) assignCounts[l.assigned_to.id] = (assignCounts[l.assigned_to.id] || 0) + 1; });

    const sorted = [...availableSalespeople].sort((a, b) => {
      const ratioA = (a.activeLeadsCount || 0) / (a.target || 1);
      const ratioB = (b.activeLeadsCount || 0) / (b.target || 1);
      
      // If workload ratio difference is significant (> 20%), prioritize lower workload
      if (Math.abs(ratioA - ratioB) > 0.2) return ratioA - ratioB;
      
      // Otherwise prioritize higher conversion rate
      if (b.conversionRate !== a.conversionRate) return (b.conversionRate || 0) - (a.conversionRate || 0);
      
      // Finally, tie-break with today's lead count
      return (assignCounts[a.id] || 0) - (assignCounts[b.id] || 0);
    });

    const best = sorted[0];
    const empId = best.id;
    const { error } = await update(leadId, { 
      assigned_to: empId, 
      assigned_at: new Date().toISOString(), 
      status: "Assigned", 
      assignment_method: "auto", 
      notification_sent: true 
    });

    if (error) toast.error("Assignment failed: " + error.message);
    else { 
      toast.success(`Weighted auto-assigned to ${best.name || "salesperson"} (Conv: ${best.conversionRate}%, Workload: ${best.activeLeadsCount}/${best.target})`); 
      refresh(); 
    }
  };

  // Manual assign
  const manualAssign = async (leadId: string, empId: string) => {
    const { error } = await update(leadId, { assigned_to: empId, assigned_at: new Date().toISOString(), status: "Assigned", assignment_method: "manual", notification_sent: true });
    if (error) toast.error("Assignment failed");
    else { toast.success("Lead assigned"); refresh(); }
  };

  // Mark as contacted
  const markContacted = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId);
    const responseSeconds = lead?.assigned_at ? Math.round((Date.now() - new Date(lead.assigned_at).getTime()) / 1000) : null;
    await update(leadId, { status: "Contacted", first_response_at: new Date().toISOString(), response_time_seconds: responseSeconds });
    toast.success("Marked as contacted"); refresh();
  };

  // Add manual lead
  const addLead = async () => {
    if (!form.name) { toast.error("Customer name required"); return; }
    const { data, error } = await insert({
      customer_name: form.name, phone: form.phone, whatsapp: form.whatsapp || form.phone,
      email: form.email, vehicle_interest: form.vehicle, source: form.source, notes: form.notes, status: "New",
    });
    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success("Lead added!");
      setAddOpen(false);
      setForm({ name: "", phone: "", whatsapp: "", email: "", vehicle: "", source: "Walk-in", notes: "" });
      // Auto-assign if possible
      if (data && data[0]) autoAssign(data[0].id);
    }
  };

  // Notification check — unassigned leads + SLA breaches
  useEffect(() => {
    const unassigned = leads.filter(l => l.status === "New" && !l.assigned_to);
    if (unassigned.length > 0) {
      toast.warning(`⚡ ${unassigned.length} new lead(s) need assignment!`, { duration: 10000 });
    }
    if (slaBreachedLeads.length > 0) {
      toast.error(`🚨 ${slaBreachedLeads.length} lead(s) breached 15-min SLA — no response yet!`, { duration: 15000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length, slaBreachedLeads.length]);

  const openWhatsApp = (phone: string, name: string) => window.open(waLink(phone, WHATSAPP_TEMPLATES.LEAD_GENERAL(name)), "_blank");
  const openSMS = (phone: string, name: string) => window.open(smsLink(phone, `Hi ${name}, thank you for your inquiry. We'll get back to you shortly. — CreativeMark`), "_blank");

  const formatTime = (seconds: number) => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const timeSinceCreated = (createdAt: string) => {
    const diff = Math.round((Date.now() - new Date(createdAt).getTime()) / 1000);
    return formatTime(diff);
  };

  const { user: currentUser } = useAuth();

  const topPerformers = useMemo(() => {
    return [...employees].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, 5);
  }, [employees]);

  return (
    <div>
      <PageHeader
        title="⚡ Smart Lead Hub"
        subtitle="Real-time lead capture, auto-assignment & response tracking"
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => { refresh(); refreshLogs(); toast.success("Refreshed"); }} className="gap-1"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
            <Button size="sm" variant="outline" onClick={() => setFeedOpen(true)} className="gap-1"><Activity className="h-3.5 w-3.5" /> Live Feed</Button>
            <Button size="sm" variant="outline" onClick={() => setRosterOpen(true)} className="gap-1"><Users className="h-3.5 w-3.5" /> Team Roster</Button>
            {unassignedCount > 0 && <Button size="sm" variant="destructive" onClick={assignAllUnassigned} className="gap-1 animate-pulse"><Zap className="h-3.5 w-3.5" /> Assign All ({unassignedCount})</Button>}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover gap-1"><Plus className="h-4 w-4" /> Add Lead</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Lead Manually</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Customer Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
                    <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} placeholder="Same or different" /></div>
                  </div>
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Vehicle Interest</Label><Input value={form.vehicle} onChange={e => setForm({ ...form, vehicle: e.target.value })} placeholder="e.g. Tata Nexon, Maruti Swift" /></div>
                  <div><Label>Source</Label>
                    <Select value={form.source} onValueChange={(v: LeadSource) => setForm({ ...form, source: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(["Just Dial", "Meta Ads", "Google Ads", "OEM CRM", "Walk-in", "Website", "Other"] as LeadSource[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addLead}>Save & Auto-Assign</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center justify-between">
                <div><div className="text-xs text-muted-foreground font-semibold uppercase">Today's Leads</div><div className="text-3xl font-black mt-1">{todayLeads.length}</div></div>
                <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center"><Zap className="h-6 w-6 text-blue-500" /></div>
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div><div className="text-xs text-muted-foreground font-semibold uppercase">Avg Response</div><div className="text-3xl font-black mt-1">{avgResponseTime ? formatTime(Math.round(avgResponseTime)) : "—"}</div></div>
                <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center"><Clock className="h-6 w-6 text-amber-500" /></div>
              </div>
            </Card>
            <Card className={`p-4 border-l-4 ${unassignedCount > 0 ? "border-l-red-500 animate-pulse" : "border-l-green-500"}`}>
              <div className="flex items-center justify-between">
                <div><div className="text-xs text-muted-foreground font-semibold uppercase">Unassigned</div><div className={`text-3xl font-black mt-1 ${unassignedCount > 0 ? "text-red-600" : "text-green-600"}`}>{unassignedCount}</div></div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${unassignedCount > 0 ? "bg-red-50" : "bg-green-50"}`}>{unassignedCount > 0 ? <AlertTriangle className="h-6 w-6 text-red-500" /> : <CheckCircle className="h-6 w-6 text-green-500" />}</div>
              </div>
            </Card>
            <Card className={`p-4 border-l-4 ${slaBreachedLeads.length > 0 ? "border-l-orange-500 animate-pulse" : "border-l-emerald-400"}`}>
              <div className="flex items-center justify-between">
                <div><div className="text-xs text-muted-foreground font-semibold uppercase">SLA Breached</div><div className={`text-3xl font-black mt-1 ${slaBreachedLeads.length > 0 ? "text-orange-600" : "text-emerald-600"}`}>{slaBreachedLeads.length}</div></div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${slaBreachedLeads.length > 0 ? "bg-orange-50" : "bg-emerald-50"}`}><BellRing className={`h-6 w-6 ${slaBreachedLeads.length > 0 ? "text-orange-500" : "text-emerald-500"}`} /></div>
              </div>
              {slaBreachedLeads.length > 0 && <div className="text-[10px] text-orange-600 mt-1 font-semibold">No response within 15 min</div>}
            </Card>
            <Card className="p-4 border-l-4 border-l-green-500">
              <div className="flex items-center justify-between">
                <div><div className="text-xs text-muted-foreground font-semibold uppercase">Converted Today</div><div className="text-3xl font-black mt-1 text-green-600">{convertedToday}</div></div>
                <div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center"><TrendingUp className="h-6 w-6 text-green-500" /></div>
              </div>
            </Card>
          </div>
        </div>

        {currentUser?.role === "Manager" && (
          <Card className="p-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5" /> Top Performers</h3>
            <div className="space-y-3">
              {topPerformers.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span className="font-semibold">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-bold text-green-600">{p.conversionRate}%</div>
                      <div className="text-[10px] text-muted-foreground">Conv. Rate</div>
                    </div>
                    <Badge variant="secondary" className="h-5 text-[10px]">{p.activeLeadsCount} active</Badge>
                  </div>
                </div>
              ))}
              {topPerformers.length === 0 && <div className="text-xs text-muted-foreground text-center py-4 italic">No performance data yet</div>}
            </div>
          </Card>
        )}
      </div>

      {/* Source Breakdown */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["Just Dial", "Meta Ads", "Google Ads", "OEM CRM", "Walk-in"] as LeadSource[]).map(src => {
          const count = todayLeads.filter(l => l.source === src).length;
          return (
            <button key={src} onClick={() => setSourceFilter(sourceFilter === src ? "all" : src)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${SOURCE_COLORS[src]} ${sourceFilter === src ? "ring-2 ring-primary ring-offset-1" : "opacity-80 hover:opacity-100"}`}>
              {src}: <span className="font-black">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Integration Status Dots */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
        <span className="font-semibold">Integrations:</span>
        {webhookConfigs.map(w => (
          <span key={w.id} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${w.is_active ? "bg-green-500" : "bg-red-400"}`} />
            {w.platform}
          </span>
        ))}
        {webhookConfigs.length === 0 && <span className="italic">No integrations configured yet</span>}
      </div>

      {/* Filters */}
      <Card className="p-3 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search name, phone, vehicle…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {(["New", "Assigned", "Contacted", "Follow-up", "Converted", "Lost"] as LeadStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {(sourceFilter !== "all" || statusFilter !== "all") && (
            <Button size="sm" variant="ghost" onClick={() => { setSourceFilter("all"); setStatusFilter("all"); }}>Clear Filters</Button>
          )}
        </div>
      </Card>

      {/* Lead Table */}
      {loading ? (
        <Card className="p-12 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" /><p className="text-muted-foreground">Loading leads…</p></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead><TableHead>Source</TableHead><TableHead>Vehicle</TableHead>
                <TableHead>Assigned To</TableHead><TableHead>Status</TableHead><TableHead>Response</TableHead>
                <TableHead>Age</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(lead => (
                <TableRow key={lead.id} className={`${lead.status === "New" && !lead.assigned_to ? "bg-red-50/50" : ""} hover:bg-muted/30 transition-colors`}>
                  <TableCell>
                    <div className="font-semibold">{lead.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{lead.phone}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] font-semibold ${SOURCE_COLORS[lead.source]}`}>{lead.source}</Badge></TableCell>
                  <TableCell className="text-sm">{lead.vehicle_interest || "—"}</TableCell>
                  <TableCell>
                    {lead.assigned_to ? (
                      <div className="text-sm font-medium">{lead.assignedName}</div>
                    ) : (
                      <span className="text-xs text-red-500 font-bold animate-pulse">⚠ Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[lead.status]}`} />
                      <span className="text-xs font-semibold">{lead.status}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-mono font-bold ${lead.responseMinutes !== null ? (lead.responseMinutes <= 5 ? "text-green-600" : lead.responseMinutes <= 15 ? "text-amber-600" : "text-red-600") : "text-muted-foreground"}`}>
                      {lead.response_time_seconds ? formatTime(lead.response_time_seconds) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{timeSinceCreated(lead.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {lead.status === "New" && !lead.assigned_to && (
                        <Button size="sm" variant="default" className="h-7 text-xs bg-primary" onClick={() => autoAssign(lead.id)}>
                          <Zap className="h-3 w-3 mr-1" /> Assign
                        </Button>
                      )}
                      {lead.status === "Assigned" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markContacted(lead.id)}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Contacted
                        </Button>
                      )}
                      {lead.whatsapp && (
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-green-600" onClick={() => openWhatsApp(lead.whatsapp, lead.customer_name)}><MessageCircle className="h-3.5 w-3.5" /></Button>
                      )}
                      {lead.phone && (
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-blue-600" onClick={() => openSMS(lead.phone, lead.customer_name)}><MessageSquare className="h-3.5 w-3.5" /></Button>
                      )}
                      <Select onValueChange={(v) => update(lead.id, { status: v }).then(() => { toast.success("Status updated"); refresh(); })}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>{(["New", "Assigned", "Contacted", "Follow-up", "Converted", "Lost"] as LeadStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <div className="font-semibold">No leads found</div>
                  <div className="text-sm mt-1">Leads will appear here automatically when received from integrations</div>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Team Roster Dialog */}
      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Sales Team Roster</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground mb-3">Manage availability, shifts, and lead capacity for your sales team.</div>
          {rosterData.length > 0 ? (
            <div className="space-y-2">
              {rosterData.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-semibold text-sm">{r.employee_id?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{r.territory || "No territory"} · {r.shift_start}–{r.shift_end}</div>
                    {r.leave_start && r.leave_end && <div className="text-xs text-red-500 mt-0.5">On leave: {r.leave_start} to {r.leave_end}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${r.is_available ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {r.is_available ? "Available" : "Unavailable"}
                    </Badge>
                    <div className="text-xs text-muted-foreground">Max {r.max_daily_leads}/day</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No roster configured yet.</p>
              <p className="text-xs mt-1">Add employees to the sales roster from Settings to enable auto-assignment.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Webhook Integration Info */}
      <Card className="mt-6 p-5">
        <h3 className="font-bold text-sm flex items-center gap-2 mb-3"><Wifi className="h-4 w-4" /> Platform Integrations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: "Just Dial", method: "Webhook push", desc: "JD account manager configures endpoint", color: "border-yellow-300 bg-yellow-50" },
            { name: "Meta Ads", method: "Facebook Lead Ads API", desc: "Leadgen event subscription", color: "border-blue-300 bg-blue-50" },
            { name: "Google Ads", method: "Lead Form Extensions", desc: "Webhook integration", color: "border-red-300 bg-red-50" },
            { name: "OEM CRM", method: "API pull / Email parser", desc: "Brand-specific setup", color: "border-purple-300 bg-purple-50" },
          ].map(p => {
            const config = webhookConfigs.find(w => w.platform === p.name);
            return (
              <div key={p.name} className={`p-3 rounded-lg border-2 ${p.color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">{p.name}</span>
                  <span className={`h-2 w-2 rounded-full ${config?.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                </div>
                <div className="text-xs text-muted-foreground">{p.method}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{p.desc}</div>
                {config && <div className="text-[10px] font-mono mt-1">Leads received: {config.total_leads_received}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Live Activity Feed Dialog */}
      <Dialog open={feedOpen} onOpenChange={setFeedOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-green-500" /> Live Activity Feed</DialogTitle>
          </DialogHeader>
          <div className="text-xs text-muted-foreground mb-3">Real-time log of all lead assignments, responses, and escalations. Auto-refreshes every 30s.</div>
          {activityLogs.length > 0 ? (
            <div className="space-y-2">
              {[...activityLogs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50).map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/30">
                  <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${
                    log.event_type === 'auto_assigned' ? 'bg-blue-500' :
                    log.event_type === 'manual_assigned' ? 'bg-amber-500' :
                    log.event_type === 'contacted' ? 'bg-green-500' :
                    log.event_type === 'sla_breach' ? 'bg-red-500' :
                    log.event_type === 'escalated' ? 'bg-orange-500' :
                    log.event_type === 'converted' ? 'bg-emerald-600' : 'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold">{log.details}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {log.lead_id?.customer_name || 'Lead'} · {new Date(log.created_at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{log.event_type.replace(/_/g, ' ')}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Events will appear here as leads are received and assigned.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmartLeadHub;
