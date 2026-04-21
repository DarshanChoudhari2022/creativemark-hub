import { useState, useMemo } from "react";
import { Plus, Flame, Thermometer, Snowflake, Phone, Mail, Calendar, Search, LayoutGrid, List, MessageSquare, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StageBadge } from "@/components/shared";
import { leads as initialLeads, kanbanStages } from "@/data/leads";
import { employees } from "@/data/employees";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { toast } from "sonner";
import type { Lead, LeadStage, LeadHeat, ClientCategory } from "@/types";

const HEAT_ICONS: Record<LeadHeat, { icon: React.ElementType; color: string; label: string }> = {
  Hot: { icon: Flame, color: "text-red-500", label: "Hot" },
  Warm: { icon: Thermometer, color: "text-amber-500", label: "Warm" },
  Cold: { icon: Snowflake, color: "text-blue-400", label: "Cold" },
};

const STAGE_COLORS: Record<LeadStage, string> = {
  New: "border-gray-200",
  Contacted: "border-amber-200",
  "Quotation Sent": "border-blue-200",
  Negotiation: "border-orange-200",
  Converted: "border-green-200",
  Lost: "border-red-200",
};

const STAGE_HEADER_COLORS: Record<LeadStage, string> = {
  New: "bg-gray-100 text-gray-700",
  Contacted: "bg-amber-100 text-amber-700",
  "Quotation Sent": "bg-blue-100 text-blue-700",
  Negotiation: "bg-orange-100 text-orange-700",
  Converted: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
};

import { useAuth } from "@/contexts/AuthContext";

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState(initialLeads);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [form, setForm] = useState({
    name: "", company: "", category: "Other" as ClientCategory, phone: "", email: "", estimatedValue: 0,
    source: "Walk-in" as Lead["source"], heat: "Warm" as LeadHeat,
    assignedTo: "E-004", services: "", notes: "", partnerRef: ""
  });

  const filtered = useMemo(() => {
    return leads.filter(l => {
      // Role-Based Access Control logic
      if (user?.role === "Employee" && l.assignedTo !== user.id) return false;

      // Search Filtering
      if (search !== "") {
        const query = search.toLowerCase();
        if (!l.name.toLowerCase().includes(query) && !l.organization.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [leads, search, user]);

  const addLead = () => {
    if (!form.name || !form.company) { toast.error("Name and company are required"); return; }
    const emp = employees.find(e => e.id === form.assignedTo);
    const newLead: Lead = {
      id: `L-${String(leads.length + 1).padStart(3, "0")}`,
      name: form.name, 
      organization: form.company, 
      category: form.category,
      phone: form.phone, 
      whatsapp: form.phone.replace(/[^0-9]/g, ""),
      email: form.email,
      address: "",
      source: form.source, 
      stage: "New", 
      heat: form.heat,
      assignedTo: form.assignedTo,
      assignedToName: emp?.name || "—",
      estimatedValue: form.estimatedValue,
      servicesInterested: form.services.split(",").map(s => s.trim()).filter(Boolean),
      notes: form.notes,
      dateReceived: new Date().toISOString().slice(0, 10),
      lastContactDate: new Date().toISOString().slice(0, 10),
      commLog: [],
      tasks: [],
      reassignments: [],
      partnerId: form.source === "Partner" ? form.partnerRef : undefined,
    };
    setLeads([...leads, newLead]);
    setAddOpen(false);
    toast.success("Lead added successfully");
  };

  const moveLeadStage = (leadId: string, newStage: LeadStage) => {
    setLeads(leads.map(l => l.id === leadId ? { ...l, stage: newStage } : l));
    toast.success(`Lead moved to ${newStage}`);
  };

  const getDaysInStage = (lead: Lead): number => {
    const created = new Date(lead.dateReceived).getTime();
    return Math.floor((Date.now() - created) / 86400000);
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle={`${leads.filter(l => !["Converted", "Lost"].includes(l.stage)).length} active leads in pipeline`}
        actions={
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search leads…" className="pl-9 w-52" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("kanban")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={view === "table" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("table")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Lead</Button></DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Contact Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" /></div>
                  <div><Label>Company/Organization *</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="ABC Corp" /></div>
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={(v: ClientCategory) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Source</Label>
                    <Select value={form.source} onValueChange={(v: Lead["source"]) => setForm({ ...form, source: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(["Referral", "Walk-in", "Social Media", "Website", "Cold Call", "Partner", "Other"] as Lead["source"][]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Heat</Label>
                    <Select value={form.heat} onValueChange={(v: LeadHeat) => setForm({ ...form, heat: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(["Hot", "Warm", "Cold"] as LeadHeat[]).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.source === "Partner" && (
                    <div className="col-span-2"><Label>Partner Reference details</Label><Input value={form.partnerRef} onChange={(e) => setForm({ ...form, partnerRef: e.target.value })} placeholder="Partner name or ID" /></div>
                  )}
                  <div><Label>Estimated Value ₹</Label><Input type="number" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: +e.target.value })} /></div>
                  <div><Label>Assigned To</Label>
                    <Select value={form.assignedTo} onValueChange={(v) => setForm({ ...form, assignedTo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Services Interested (comma separated)</Label><Input value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="e.g. Social Media, Branding" /></div>
                  <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addLead}>Save Lead</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {view === "kanban" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto">
          {kanbanStages.map((stage) => {
            const stageLeads = filtered.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="min-w-[220px]">
                <div className={`px-3 py-2 rounded-t-lg font-bold text-sm flex items-center justify-between ${STAGE_HEADER_COLORS[stage]}`}>
                  {stage}
                  <span className="text-xs font-normal ml-1">{stageLeads.length}</span>
                </div>
                <div className={`space-y-2 p-2 rounded-b-lg border ${STAGE_COLORS[stage]} min-h-[200px] bg-muted/20`}>
                  {stageLeads.map((lead) => {
                    const heat = HEAT_ICONS[lead.heat];
                    const HeatIcon = heat.icon;
                    const daysInStage = getDaysInStage(lead);
                    const aging = daysInStage > 14 && !["Converted", "Lost"].includes(lead.stage);
                    return (
                      <Card
                        key={lead.id}
                        className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${aging ? "ring-1 ring-primary/30" : ""}`}
                        onClick={() => setDetailLead(lead)}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-semibold text-sm truncate pr-1">{lead.name}</div>
                          <HeatIcon className={`h-4 w-4 shrink-0 ${heat.color}`} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-2">{lead.organization}</div>
                        <div className="text-xs font-semibold text-primary mb-1">{formatINR(lead.estimatedValue)}</div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{lead.assignedToName.split(" ")[0]}</span>
                          <span className={aging ? "text-primary font-semibold" : ""}>{daysInStage}d</span>
                        </div>
                        {aging && <div className="text-[10px] text-primary mt-1 font-semibold">⚠ Aging</div>}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead><TableHead>Organization</TableHead><TableHead>Stage</TableHead>
                <TableHead>Heat</TableHead><TableHead>Source</TableHead><TableHead className="text-right">Est. Value</TableHead>
                <TableHead>Assigned To</TableHead><TableHead>Next Follow-up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const heat = HEAT_ICONS[l.heat];
                const HeatIcon = heat.icon;
                return (
                  <TableRow key={l.id} className="cursor-pointer" onClick={() => setDetailLead(l)}>
                    <TableCell className="font-semibold">{l.name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.organization}</TableCell>
                    <TableCell><StageBadge stage={l.stage} /></TableCell>
                    <TableCell><span className="flex items-center gap-1"><HeatIcon className={`h-3.5 w-3.5 ${heat.color}`} />{l.heat}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.source}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(l.estimatedValue)}</TableCell>
                    <TableCell className="text-sm">{l.assignedToName}</TableCell>
                    <TableCell className="text-xs font-mono">{l.nextFollowupDate ? formatDateDDMMYYYY(new Date(l.nextFollowupDate)) : "—"}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No leads found matching your criteria</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        {detailLead && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {detailLead.name}
                  {(() => { const h = HEAT_ICONS[detailLead.heat]; const HI = h.icon; return <HI className={`h-5 w-5 ${h.color}`} />; })()}
                  <StageBadge stage={detailLead.stage} />
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3"/> Organization</div>
                <div className="font-semibold">{detailLead.organization} <Badge variant="outline" className="text-[10px] ml-1">{detailLead.category}</Badge></div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Estimated Value</div>
                <div className="font-bold text-primary text-lg">{formatINR(detailLead.estimatedValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/> Phone / WhatsApp</div>
                <div className="flex items-center gap-2">{detailLead.phone}
                  {detailLead.whatsapp && (
                    <a href={waLink(detailLead.whatsapp)} target="_blank" rel="noopener">
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-green-600 bg-green-50 hover:bg-green-100">WhatsApp</Button>
                    </a>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3"/> Email</div>
                <div>{detailLead.email || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Source</div>
                <div>{detailLead.source}{detailLead.referrerName && ` (${detailLead.referrerName})`}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned To</div>
                <div>{detailLead.assignedToName}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3"/> Next Follow-up</div>
                <div className="font-mono">{detailLead.nextFollowupDate ? formatDateDDMMYYYY(new Date(detailLead.nextFollowupDate)) : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3"/> Received Date</div>
                <div className="font-mono">{formatDateDDMMYYYY(new Date(detailLead.dateReceived))}</div>
              </div>
            </div>

            {detailLead.servicesInterested.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Services Interested</div>
                <div className="flex flex-wrap gap-1.5">
                  {detailLead.servicesInterested.map(s => <span key={s} className="text-[11px] px-2 py-0.5 rounded-full bg-muted font-medium">{s}</span>)}
                </div>
              </div>
            )}

            {detailLead.notes && (
              <div className="mt-2 p-3 bg-muted/30 rounded-lg text-sm">
                <div className="text-xs font-semibold text-muted-foreground mb-1">Notes</div>
                {detailLead.notes}
              </div>
            )}

            {/* Move Stage */}
            <div className="mt-3">
              <div className="text-xs font-semibold text-muted-foreground mb-2">Move to Stage</div>
              <div className="flex flex-wrap gap-1.5">
                {kanbanStages.filter(s => s !== detailLead.stage).map(s => (
                  <Button key={s} size="sm" variant="outline" className="text-xs h-7"
                    onClick={() => { moveLeadStage(detailLead.id, s); setDetailLead({ ...detailLead, stage: s }); }}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Communication Log */}
            <div className="mt-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Communication Log</div>
              <div className="space-y-2">
                {detailLead.commLog.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border text-sm bg-white">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      log.method === "Call" ? "bg-blue-100 text-blue-600" :
                      log.method === "WhatsApp" ? "bg-green-100 text-green-600" :
                      log.method === "Email" ? "bg-purple-100 text-purple-600" :
                      "bg-amber-100 text-amber-600"
                    }`}>
                      {log.method.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{log.method}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{log.datetime}</span>
                      </div>
                      <div className="text-xs mt-0.5">{log.summary}</div>
                      {log.actionItems && <div className="text-xs text-primary mt-1 flex items-center gap-1"><span className="font-semibold">Action:</span> {log.actionItems}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">by {log.contactPerson}</div>
                    </div>
                  </div>
                ))}
                {detailLead.commLog.length === 0 && <div className="text-xs text-muted-foreground text-center py-4 bg-muted/10 rounded-lg">No communication logged yet</div>}
              </div>
            </div>
            
            {/* Tasks linked to Lead */}
            {detailLead.tasks && detailLead.tasks.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">Pending Tasks</div>
                <div className="space-y-2">
                  {detailLead.tasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-2 rounded-lg border border-border text-xs">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={task.status === "Done"} readOnly className="rounded border-gray-300" />
                        <span className={task.status === "Done" ? "line-through text-muted-foreground" : ""}>{task.description}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{task.assignedTo}</span>
                        <Badge variant="outline" className={`text-[9px] ${task.status === "Done" ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"}`}>{task.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Leads;
