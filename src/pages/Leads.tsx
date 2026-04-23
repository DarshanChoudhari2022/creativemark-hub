import { useState, useMemo, useEffect } from "react";
import { Plus, Flame, Thermometer, Snowflake, Phone, Mail, Calendar, Search, LayoutGrid, List, MessageSquare, MessageCircle, Briefcase, Bell, BellRing, FileText, CreditCard, CheckCircle, XCircle } from "lucide-react";
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
import { useSupabaseTable } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDateDDMMYYYY, waLink, smsLink, isValidIndianPhone } from "@/lib/format";
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

const kanbanStages: LeadStage[] = ["New", "Contacted", "Quotation Sent", "Negotiation", "Converted", "Lost"];

const Leads = () => {
  const { user } = useAuth();
  const { data: leadsData, loading, insert, update: updateLead } = useSupabaseTable<any>('leads', '*, assigned_to(name), lead_services(service_name), comm_logs(*), lead_tasks(*)');
  const { data: employees } = useSupabaseTable<any>('employees', 'id, name');
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [callLogOpen, setCallLogOpen] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [callForm, setCallForm] = useState({ summary: "", outcome: "", nextAction: "", duration: 0 });
  const [form, setForm] = useState({
    name: "", company: "", category: "Other" as ClientCategory, phone: "", whatsapp: "", email: "", estimatedValue: 0,
    source: "Walk-in" as Lead["source"], heat: "Warm" as LeadHeat,
    assignedTo: "", services: "", notes: "", partnerRef: "",
    lastInteractionDate: "", actionItem: "", nextCallDate: "",
  });

  const leads = useMemo(() => {
    return leadsData.map(l => ({
      ...l,
      organization: l.organization,
      assignedToName: l.assigned_to?.name || "—",
      servicesInterested: l.lead_services?.map((s: any) => s.service_name) || [],
      commLog: l.comm_logs?.map((log: any) => ({
        ...log,
        contactPerson: log.contact_person_id
      })) || [],
      tasks: l.lead_tasks || [],
      dateReceived: l.date_received,
      estimatedValue: l.estimated_value,
      nextFollowupDate: l.next_followup_date,
      lastInteractionDate: l.last_interaction_date,
      actionItem: l.action_item,
      nextCallDate: l.next_call_date,
      quotationStatus: l.quotation_status || "Not Sent",
      paymentDueDate: l.payment_due_date,
      paymentStatus: l.payment_status || "Not Due",
      lifecycleStage: l.lifecycle_stage || "Lead",
    }));
  }, [leadsData]);

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

  const addLead = async () => {
    if (!form.name || !form.company) { toast.error("Name and company are required"); return; }
    if (form.phone && !isValidIndianPhone(form.phone)) { setPhoneError("Enter valid Indian number"); return; }
    
    const { error } = await insert({
      name: form.name, 
      organization: form.company, 
      category: form.category,
      phone: form.phone, 
      whatsapp: form.whatsapp || form.phone.replace(/[^0-9+]/g, ""),
      email: form.email,
      source: form.source, 
      stage: "New", 
      heat: form.heat,
      assigned_to: form.assignedTo || null,
      estimated_value: form.estimatedValue,
      notes: form.notes,
      partner_id: form.source === "Partner" ? form.partnerRef : null,
      last_interaction_date: form.lastInteractionDate || null,
      action_item: form.actionItem || null,
      next_call_date: form.nextCallDate || null,
      quotation_status: "Not Sent",
      payment_status: "Not Due",
      lifecycle_stage: "Lead",
    });

    if (error) {
      toast.error("Failed to add lead: " + error.message);
    } else {
      setAddOpen(false);
      setForm({
        name: "", company: "", category: "Other", phone: "", whatsapp: "", email: "", estimatedValue: 0,
        source: "Walk-in", heat: "Warm", assignedTo: "", services: "", notes: "", partnerRef: "",
        lastInteractionDate: "", actionItem: "", nextCallDate: "",
      });
      setPhoneError("");
      toast.success("Lead added successfully");
    }
  };

  const moveLeadStage = async (leadId: string, newStage: LeadStage) => {
    const { error } = await updateLead(leadId, { stage: newStage });
    if (error) toast.error("Failed to move lead: " + error.message);
    else toast.success(`Lead moved to ${newStage}`);
  };

  const updateLeadField = async (leadId: string, field: string, value: any) => {
    const { error } = await updateLead(leadId, { [field]: value });
    if (error) toast.error("Failed to update: " + error.message);
    else toast.success("Updated successfully");
  };

  const logCall = async () => {
    if (!detailLead || !callForm.summary) { toast.error("Summary is required"); return; }
    const { error } = await supabase.from('comm_logs').insert({
      lead_id: detailLead.id,
      method: "Call",
      summary: callForm.summary,
      action_items: callForm.nextAction,
      datetime: new Date().toISOString(),
    });
    if (!error) {
      await updateLead(detailLead.id, { 
        last_interaction_date: new Date().toISOString().slice(0, 10),
        action_item: callForm.nextAction,
      });
      setCallLogOpen(false);
      setCallForm({ summary: "", outcome: "", nextAction: "", duration: 0 });
      toast.success("Call logged");
    } else toast.error("Failed to log call: " + error.message);
  };

  const openWhatsApp = (phone: string, name: string) => {
    const msg = `Hi ${name}, this is from CreativeMark. `;
    window.open(waLink(phone, msg), "_blank");
  };

  const openSMS = (phone: string, name: string) => {
    const msg = `Hi ${name}, this is from CreativeMark. `;
    window.open(smsLink(phone, msg), "_blank");
  };

  const sendPaymentReminder = (lead: any) => {
    const msg = `Hi ${lead.name}, this is a reminder from CreativeMark regarding your pending payment of ${formatINR(lead.estimatedValue)}. Kindly process the payment at the earliest. Thank you!`;
    if (lead.whatsapp) window.open(waLink(lead.whatsapp, msg), "_blank");
    else if (lead.phone) window.open(smsLink(lead.phone, msg), "_blank");
  };

  // Check for due notifications
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dueLeads = leads.filter(l => l.nextCallDate === today && !["Converted", "Lost"].includes(l.stage));
    if (dueLeads.length > 0) {
      toast.info(`🔔 ${dueLeads.length} lead(s) due for follow-up today!`, { duration: 8000 });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("CreativeMark CRM", { body: `${dueLeads.length} lead(s) need follow-up today!` });
      } else if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
    const paymentDue = leads.filter(l => l.paymentDueDate === today && l.paymentStatus !== "Paid");
    if (paymentDue.length > 0) {
      toast.warning(`💰 ${paymentDue.length} payment(s) due today!`, { duration: 8000 });
    }
  }, [leads]);

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
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v: ClientCategory) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setPhoneError(""); }} placeholder="+91 98765 43210" className={phoneError ? "border-red-500" : ""} />
                    {phoneError && <p className="text-[11px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+91 98765 43210 (if different)" /></div>
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
                  
                  {/* Lifecycle tracking fields */}
                  <div className="col-span-2 border-t pt-3 mt-1">
                    <h4 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Bell className="h-3.5 w-3.5" /> Interaction Tracking</h4>
                  </div>
                  <div><Label>Last Interaction Date</Label><Input type="date" value={form.lastInteractionDate} onChange={(e) => setForm({ ...form, lastInteractionDate: e.target.value })} /></div>
                  <div><Label className="flex items-center gap-1">Next Call Date <BellRing className="h-3 w-3 text-amber-500" /></Label><Input type="date" value={form.nextCallDate} onChange={(e) => setForm({ ...form, nextCallDate: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Action Item</Label><Input value={form.actionItem} onChange={(e) => setForm({ ...form, actionItem: e.target.value })} placeholder="e.g. Send proposal, Follow up on quote" /></div>
                  
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

      {loading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading leads...</p>
        </Card>
      ) : view === "kanban" ? (
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
                <div className="flex items-center gap-1">
                  {detailLead.whatsapp && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:bg-green-50" onClick={() => openWhatsApp(detailLead.whatsapp, detailLead.name)} title="WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {detailLead.phone && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:bg-blue-50" onClick={() => openSMS(detailLead.phone, detailLead.name)} title="SMS">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
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
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/> Phone</div>
                <div>{detailLead.phone}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><MessageCircle className="h-3 w-3"/> WhatsApp</div>
                <div>{detailLead.whatsapp || detailLead.phone || "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Source</div>
                <div>{detailLead.source}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned To</div>
                <div>{detailLead.assignedToName}</div>
              </div>
            </div>

            {/* Interaction Tracking Section */}
            <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
              <h4 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1"><BellRing className="h-3.5 w-3.5" /> Interaction Tracking</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Last Interaction</div>
                  <div className="font-mono text-sm">{detailLead.lastInteractionDate ? formatDateDDMMYYYY(detailLead.lastInteractionDate) : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">Next Call Date <Bell className="h-3 w-3 text-amber-500" /></div>
                  <div className="font-mono text-sm font-semibold">{detailLead.nextCallDate ? formatDateDDMMYYYY(detailLead.nextCallDate) : "—"}</div>
                  {detailLead.nextCallDate && new Date(detailLead.nextCallDate) <= new Date() && (
                    <span className="text-[10px] text-red-600 font-bold">⚠ Due!</span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Action Item</div>
                  <div className="text-sm">{detailLead.actionItem || "—"}</div>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setCallLogOpen(true)}>
                  <Phone className="h-3 w-3 mr-1" /> Log a Call
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                  const nextDate = prompt("Set next call date (YYYY-MM-DD):");
                  if (nextDate) updateLeadField(detailLead.id, "next_call_date", nextDate);
                }}>
                  <Calendar className="h-3 w-3 mr-1" /> Set Next Call
                </Button>
              </div>
            </div>

            {/* Quotation & Billing Lifecycle */}
            <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
              <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Quotation & Billing</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Quotation Status</div>
                  <Badge variant="outline" className={`text-[11px] ${
                    detailLead.quotationStatus === "Accepted" ? "bg-green-100 text-green-700" :
                    detailLead.quotationStatus === "Rejected" ? "bg-red-100 text-red-700" :
                    detailLead.quotationStatus === "Sent" ? "bg-blue-100 text-blue-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{detailLead.quotationStatus || "Not Sent"}</Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Payment Status</div>
                  <Badge variant="outline" className={`text-[11px] ${
                    detailLead.paymentStatus === "Paid" ? "bg-green-100 text-green-700" :
                    detailLead.paymentStatus === "Overdue" ? "bg-red-100 text-red-700" :
                    detailLead.paymentStatus === "Pending" ? "bg-amber-100 text-amber-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{detailLead.paymentStatus || "Not Due"}</Badge>
                </div>
                {detailLead.paymentDueDate && (
                  <div>
                    <div className="text-xs text-muted-foreground">Payment Due Date</div>
                    <div className="font-mono text-sm">{formatDateDDMMYYYY(detailLead.paymentDueDate)}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Select onValueChange={(v) => updateLeadField(detailLead.id, "quotation_status", v)}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Update Quote Status" /></SelectTrigger>
                  <SelectContent>
                    {["Not Sent", "Sent", "Accepted", "Rejected"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select onValueChange={(v) => updateLeadField(detailLead.id, "payment_status", v)}>
                  <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Update Payment" /></SelectTrigger>
                  <SelectContent>
                    {["Not Due", "Pending", "Paid", "Overdue"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                  const dueDate = prompt("Set payment due date (YYYY-MM-DD):");
                  if (dueDate) updateLeadField(detailLead.id, "payment_due_date", dueDate);
                }}>
                  <CreditCard className="h-3 w-3 mr-1" /> Set Due Date
                </Button>
                {detailLead.paymentStatus !== "Paid" && (detailLead.whatsapp || detailLead.phone) && (
                  <Button size="sm" variant="outline" className="text-xs h-7 text-green-600 border-green-300 hover:bg-green-50" onClick={() => sendPaymentReminder(detailLead)}>
                    <MessageCircle className="h-3 w-3 mr-1" /> Send Reminder
                  </Button>
                )}
              </div>
            </div>

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
                      {log.method?.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs">{log.method}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">{log.datetime}</span>
                      </div>
                      <div className="text-xs mt-0.5">{log.summary}</div>
                      {log.action_items && <div className="text-xs text-primary mt-1"><span className="font-semibold">Action:</span> {log.action_items}</div>}
                    </div>
                  </div>
                ))}
                {detailLead.commLog.length === 0 && <div className="text-xs text-muted-foreground text-center py-4 bg-muted/10 rounded-lg">No communication logged yet</div>}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Call Log Dialog */}
      <Dialog open={callLogOpen} onOpenChange={setCallLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log a Call</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Call Summary *</Label><Textarea value={callForm.summary} onChange={(e) => setCallForm({ ...callForm, summary: e.target.value })} rows={3} placeholder="What was discussed?" /></div>
            <div><Label>Outcome</Label><Input value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })} placeholder="e.g. Interested, Need follow-up" /></div>
            <div><Label>Next Action</Label><Input value={callForm.nextAction} onChange={(e) => setCallForm({ ...callForm, nextAction: e.target.value })} placeholder="e.g. Send quotation, Schedule meeting" /></div>
            <div><Label>Duration (minutes)</Label><Input type="number" value={callForm.duration} onChange={(e) => setCallForm({ ...callForm, duration: +e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCallLogOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary-hover" onClick={logCall}>Save Call</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
