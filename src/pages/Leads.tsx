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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, StageBadge } from "@/components/shared";
import { LeadTasks } from "@/components/LeadTasks";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDateDDMMYYYY, waLink, smsLink, isValidIndianPhone } from "@/lib/format";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import type { Lead, LeadStage, LeadHeat, ClientCategory, LeadQuotationStatus, LeadPaymentStatus } from "@/types";

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
  const navigate = useNavigate();
  const { data: leadsData, loading, refresh, insert, update: updateLead } = useSupabaseTable<any>('leads', '*, assigned_to(name), lead_services(service_name), comm_logs(*), lead_tasks(*)');
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
    customCategory: "",
    whatsappError: "",
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

  // Sync detailLead with updated data when leads array changes
  useEffect(() => {
    if (detailLead) {
      const updated = leads.find(l => l.id === detailLead.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(detailLead)) {
        setDetailLead(updated);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, detailLead?.id]); // Also depend on detailLead.id to re-sync if the user switches leads

  const addLead = async () => {
    if (!form.name || !form.company) { toast.error("Name and company are required"); return; }
    if (form.phone && !isValidIndianPhone(form.phone)) { setPhoneError("Enter valid Indian number"); return; }
    if (form.whatsapp && !isValidIndianPhone(form.whatsapp)) { setForm(f => ({ ...f, whatsappError: "Enter valid Indian number" })); return; }
    if (form.category === "Other" && !form.customCategory.trim()) { 
      toast.error("Please specify the custom role"); 
      return; 
    }
    
    const { error } = await insert({
      name: form.name, 
      organization: form.company, 
      category: form.category === "Other" ? form.customCategory : form.category,
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
        customCategory: "",
        whatsappError: "",
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
      // Refresh local state if needed (optional since we rely on memoized leadsData)
      setCallLogOpen(false);
      setCallForm({ summary: "", outcome: "", nextAction: "", duration: 0 });
      toast.success("Call logged");
    } else toast.error("Failed to log call: " + error.message);
  };

  const logCommunication = async (leadId: string, method: string, summary: string) => {
    await supabase.from('comm_logs').insert({
      lead_id: leadId,
      method,
      summary,
      datetime: new Date().toISOString(),
    });
    await updateLead(leadId, { 
      last_interaction_date: new Date().toISOString().slice(0, 10)
    });
  };

  const openWhatsApp = (lead: any, type: "general" | "quote" | "followup" | "soft" | "firm" | "final" = "general") => {
    let msg = "";
    const amount = formatINR(lead.estimatedValue || 0);
    const invoice = `LD-${lead.id.toString().slice(0, 5).toUpperCase()}`;

    switch(type) {
      case "quote":
        msg = WHATSAPP_TEMPLATES.LEAD_QUOTE_SENT(lead.name, amount);
        break;
      case "followup":
        msg = WHATSAPP_TEMPLATES.LEAD_FOLLOWUP(lead.name, lead.actionItem || "your requirement");
        break;
      case "soft":
        msg = WHATSAPP_TEMPLATES.RECOVERY_SOFT(lead.name, amount, invoice);
        break;
      case "firm":
        msg = WHATSAPP_TEMPLATES.RECOVERY_FIRM(lead.name, amount, invoice);
        break;
      case "final":
        msg = WHATSAPP_TEMPLATES.RECOVERY_FINAL(lead.name, amount, invoice);
        break;
      default:
        msg = WHATSAPP_TEMPLATES.LEAD_GENERAL(lead.name);
    }
    
    if (lead.whatsapp || lead.phone) {
      window.open(waLink(lead.whatsapp || lead.phone, msg), "_blank");
      logCommunication(lead.id, "WhatsApp", `Sent ${type} template`);
      toast.success("WhatsApp reminder opened");
    } else {
      toast.error("No contact number found");
    }
  };

  const openSMS = (lead: any, type: "general" | "quote" | "followup" = "general") => {
    let msg = "";
    switch(type) {
      case "quote":
        msg = WHATSAPP_TEMPLATES.LEAD_QUOTE_SENT(lead.name, lead.organization || "your project");
        break;
      case "followup":
        msg = WHATSAPP_TEMPLATES.LEAD_FOLLOWUP(lead.name, lead.actionItem || "your requirement");
        break;
      default:
        msg = WHATSAPP_TEMPLATES.LEAD_GENERAL(lead.name);
    }
    window.open(smsLink(lead.phone, msg), "_blank");
    logCommunication(lead.id, "SMS", `Sent ${type} template via SMS`);
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
                  <div><Label>Role *</Label>
                    <Select value={form.category} onValueChange={(v: ClientCategory) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {(form.category === "Other" || !["Politician", "Clothing", "Motors"].includes(form.category)) && (
                    <div className="col-span-2">
                      <Label>Specify Role *</Label>
                      <Input 
                        value={form.customCategory || (form.category !== "Other" ? form.category : "")} 
                        onChange={(e) => setForm({ ...form, customCategory: e.target.value })} 
                        placeholder="e.g. Real Estate Agent, Teacher"
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div>
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setPhoneError(""); }} placeholder="+91 98765 43210" className={phoneError ? "border-red-500" : ""} />
                    {phoneError && <p className="text-[11px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <Input value={form.whatsapp} onChange={(e) => { setForm({ ...form, whatsapp: e.target.value, whatsappError: "" }); }} placeholder="+91 98765 43210" className={form.whatsappError ? "border-red-500" : ""} />
                    {form.whatsappError && <p className="text-[11px] text-red-500 mt-0.5">{form.whatsappError}</p>}
                  </div>
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
                        className={`p-3 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden ${
                          new Date(lead.nextCallDate) < new Date(new Date().setHours(0,0,0,0)) 
                          ? "ring-1 ring-red-400 bg-red-50/10" 
                          : aging 
                          ? "ring-1 ring-primary/30" 
                          : ""
                        }`}
                        onClick={() => setDetailLead(lead)}
                      >
                        {new Date(lead.nextCallDate) < new Date(new Date().setHours(0,0,0,0)) && (
                          <div className="absolute top-0 right-0">
                            <div className="bg-red-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg animate-pulse">OVERDUE</div>
                          </div>
                        )}
                        <div className="flex items-start justify-between mb-1">
                          <div className="font-semibold text-sm truncate pr-1">{lead.name}</div>
                          <HeatIcon className={`h-4 w-4 shrink-0 ${heat.color}`} />
                        </div>
                        <div className="text-xs text-muted-foreground truncate mb-2">{lead.organization}</div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-primary">{formatINR(lead.estimatedValue)}</div>
                          {lead.nextCallDate && (
                            <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              new Date(lead.nextCallDate) < new Date(new Date().setHours(0,0,0,0)) 
                                ? "bg-red-100 text-red-600" 
                                : lead.nextCallDate === new Date().toISOString().slice(0, 10)
                                ? "bg-amber-100 text-amber-600"
                                : "bg-blue-50 text-blue-600"
                            }`}>
                              <Bell className="h-2.5 w-2.5" /> {formatDateDDMMYYYY(lead.nextCallDate).split('/')[0] + '/' + formatDateDDMMYYYY(lead.nextCallDate).split('/')[1]}
                            </div>
                          )}
                        </div>
                        {lead.paymentStatus === "Pending" && (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 mb-2">
                            <CreditCard className="h-3 w-3" /> Bill Pending
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
                          <span className="flex items-center gap-1"><Briefcase className="h-2.5 w-2.5" /> {lead.assignedToName.split(" ")[0]}</span>
                          <span className={aging ? "text-primary font-semibold" : ""}>{daysInStage}d active</span>
                        </div>
                        {aging && ! (new Date(lead.nextCallDate) < new Date(new Date().setHours(0,0,0,0))) && <div className="text-[10px] text-primary mt-1 font-semibold flex items-center gap-1">⚠ Priority Action</div>}
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
                <TableHead>Contact</TableHead><TableHead>Organization</TableHead><TableHead>Role</TableHead><TableHead>Stage</TableHead>
                <TableHead>Heat</TableHead><TableHead className="text-right">Est. Value</TableHead>
                <TableHead>Next Call</TableHead><TableHead>Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => {
                const heat = HEAT_ICONS[l.heat];
                const HeatIcon = heat.icon;
                const isOverdue = l.nextCallDate && new Date(l.nextCallDate) < new Date(new Date().setHours(0,0,0,0));
                const isToday = l.nextCallDate === new Date().toISOString().slice(0, 10);
                return (
                  <TableRow 
                    key={l.id} 
                    className={`cursor-pointer transition-colors ${isOverdue ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-muted/30"}`} 
                    onClick={() => setDetailLead(l)}
                  >
                    <TableCell>
                      <div className="font-semibold flex items-center gap-2">
                        {l.name}
                        {isOverdue && <Badge className="h-4 text-[8px] bg-red-600 animate-pulse border-0">URGENT</Badge>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{l.assignedToName}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.organization}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] font-medium">{l.category}</Badge></TableCell>
                    <TableCell><StageBadge stage={l.stage} /></TableCell>
                    <TableCell><span className="flex items-center gap-1.5"><HeatIcon className={`h-4 w-4 ${heat.color}`} />{l.heat}</span></TableCell>
                    <TableCell className="text-right font-bold text-primary">{formatINR(l.estimatedValue)}</TableCell>
                    <TableCell>
                      {l.nextCallDate ? (
                        <div className={`flex items-center gap-1.5 font-bold text-xs ${isOverdue ? "text-red-600" : isToday ? "text-amber-600" : "text-blue-600"}`}>
                          <div className="relative">
                            <BellRing className={`h-3.5 w-3.5 ${isOverdue || isToday ? "animate-pulse" : ""}`} />
                            {(isOverdue || isToday) && <span className="absolute -top-1 -right-1 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                          </div>
                          {formatDateDDMMYYYY(new Date(l.nextCallDate))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {l.paymentStatus !== "Not Due" ? (
                        <Badge variant="outline" className={`text-[10px] font-bold ${
                          l.paymentStatus === "Paid" ? "bg-green-100 text-green-700 border-green-200" :
                          l.paymentStatus === "Overdue" ? "bg-red-100 text-red-700 border-red-200 animate-pulse" :
                          "bg-amber-100 text-amber-700 border-amber-200"
                        }`}>{l.paymentStatus}</Badge>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No leads found matching your criteria</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Lead Detail Dialog */}
      <Dialog open={!!detailLead} onOpenChange={(open) => !open && setDetailLead(null)}>
        {detailLead ? (
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
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-green-600 hover:bg-green-50" onClick={() => openWhatsApp(detailLead, detailLead.stage === "Quotation Sent" ? "quote" : "followup")} title="WhatsApp">
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  )}
                  {detailLead.phone && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:bg-blue-50" onClick={() => openSMS(detailLead, detailLead.stage === "Quotation Sent" ? "quote" : "followup")} title="SMS">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </DialogTitle>
            </DialogHeader>
            <Tabs defaultValue="info" className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">Info & Status</TabsTrigger>
                <TabsTrigger value="history">Interaction History</TabsTrigger>
                <TabsTrigger value="tasks" className="relative">
                  Tasks
                  {detailLead.tasks.filter((t: any) => t.status === "Pending").length > 0 && (
                    <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-primary">
                      {detailLead.tasks.filter((t: any) => t.status === "Pending").length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3"/> Role</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{detailLead.category}</Badge>
                      <Select onValueChange={(v) => updateLeadField(detailLead.id, "category", v)}>
                        <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent hover:bg-muted"><SelectValue placeholder="" /></SelectTrigger>
                        <SelectContent>
                          {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {detailLead.category !== "Politician" && detailLead.category !== "Clothing" && detailLead.category !== "Motors" && (
                      <Input 
                        className="h-7 text-xs mt-1" 
                        placeholder="Type manual role..." 
                        onBlur={(e) => updateLeadField(detailLead.id, "category", e.target.value)}
                        defaultValue={detailLead.category}
                      />
                    )}
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
                </div>

                {/* Interaction Tracking Section */}
                <div className="p-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-white shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-amber-700 flex items-center gap-1.5 uppercase tracking-wider"><BellRing className="h-3.5 w-3.5" /> Interaction Center</h4>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-amber-600 hover:bg-amber-100" onClick={() => openWhatsApp(detailLead, "followup")}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-blue-600 hover:bg-blue-100" onClick={() => openSMS(detailLead, "followup")}>
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Last Interaction</Label>
                      <div className="relative group">
                        <Calendar className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                          type="date" 
                          className="h-8 pl-7 text-[11px] bg-white border-amber-100 focus:ring-amber-500" 
                          value={detailLead.lastInteractionDate || ""} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setDetailLead({...detailLead, lastInteractionDate: val});
                            updateLeadField(detailLead.id, "last_interaction_date", val);
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground uppercase">Next Follow-up</Label>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-3 w-3 p-0 hover:text-amber-600"
                          onClick={() => {
                            if ("Notification" in window) {
                              Notification.requestPermission().then(permission => {
                                if (permission === "granted") {
                                  toast.success("🔔 Alerts enabled for " + (detailLead.nextCallDate || "the set date"));
                                }
                              });
                            }
                          }}
                        >
                          <Bell className={`h-2.5 w-2.5 ${detailLead.nextCallDate === new Date().toISOString().slice(0, 10) ? "text-red-500 animate-bounce" : "text-amber-500"}`} />
                        </Button>
                      </div>
                      <Input 
                        type="date" 
                        className={`h-8 text-[11px] bg-white border-amber-100 focus:ring-amber-500 ${detailLead.nextCallDate && new Date(detailLead.nextCallDate) <= new Date() ? "border-red-300 ring-1 ring-red-100" : ""}`}
                        value={detailLead.nextCallDate || ""} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setDetailLead({...detailLead, nextCallDate: val});
                          updateLeadField(detailLead.id, "next_call_date", val);
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground uppercase">Next Objective</Label>
                      <Input 
                        className="h-8 text-[11px] bg-white border-amber-100 focus:ring-amber-500" 
                        value={detailLead.actionItem || ""} 
                        placeholder="e.g. Schedule visit"
                        onBlur={(e) => updateLeadField(detailLead.id, "action_item", e.target.value)}
                        onChange={(e) => setDetailLead({...detailLead, actionItem: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-amber-100/50">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-4" onClick={() => setCallLogOpen(true)}>
                      <Phone className="h-3.5 w-3.5 mr-1.5" /> Log Call Outcome
                    </Button>
                    <div className="flex items-center gap-1.5 ml-auto text-[10px] text-amber-600/70 font-medium">
                      <CheckCircle className="h-3 w-3" /> Changes auto-saved
                    </div>
                  </div>
                </div>

                {/* Quotation & Billing Lifecycle */}
                <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/50">
                  <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Quotation & Billing</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Quotation Status</div>
                        <Select 
                          value={detailLead.quotationStatus || "Not Sent"} 
                          onValueChange={(v) => {
                            setDetailLead({...detailLead, quotationStatus: v as LeadQuotationStatus});
                            updateLeadField(detailLead.id, "quotation_status", v);
                            if (v === "Accepted") toast.success("Accepted! You can now generate the bill.");
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Sent">Not Sent</SelectItem>
                            <SelectItem value="Sent">Sent</SelectItem>
                            <SelectItem value="Accepted">Accepted ✅</SelectItem>
                            <SelectItem value="Rejected">Rejected ❌</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
                          Payment Status
                        </div>
                        <Select 
                          value={detailLead.paymentStatus || "Not Due"} 
                          onValueChange={(v) => {
                            setDetailLead({...detailLead, paymentStatus: v as LeadPaymentStatus});
                            updateLeadField(detailLead.id, "payment_status", v);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Not Due">Not Due</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <Button 
                      className="flex-1 text-xs h-8 font-bold bg-primary shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                      onClick={() => {
                        navigate("/quotations", { 
                          state: { 
                            leadId: detailLead.id,
                            name: detailLead.name,
                            organization: detailLead.organization,
                            email: detailLead.email,
                            phone: detailLead.whatsapp || detailLead.phone,
                            services: detailLead.servicesInterested
                          } 
                        });
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Generate Quote / Bill
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="pt-4">
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {detailLead.commLog.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm italic bg-muted/5 rounded-xl border border-dashed border-muted">
                      No interaction history yet.
                    </div>
                  ) : (
                    [...detailLead.commLog]
                      .sort((a: any, b: any) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
                      .map((log: any, idx: number) => (
                        <div key={idx} className="flex gap-3 pb-4 border-b border-muted last:border-0 last:pb-0">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                            log.method === "Call" ? "bg-blue-500" :
                            log.method === "WhatsApp" ? "bg-green-500" :
                            "bg-primary"
                          }`} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                log.method === "Call" ? "bg-blue-50 text-blue-700" :
                                log.method === "WhatsApp" ? "bg-green-50 text-green-700" :
                                "bg-gray-50 text-gray-700"
                              }`}>{log.method} Logged</span>
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {new Date(log.datetime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} • {new Date(log.datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed font-medium">{log.summary}</p>
                            {log.action_items && (
                              <div className="mt-2 flex items-start gap-1.5 text-[11px] bg-primary/5 text-primary p-1.5 rounded-lg border border-primary/10">
                                <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span><span className="font-bold">Next Step:</span> {log.action_items}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tasks" className="pt-4">
                <LeadTasks 
                  leadId={detailLead.id} 
                  initialTasks={detailLead.tasks} 
                  employees={employees} 
                  onUpdate={refresh} 
                />
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-muted">
              <div className="flex flex-col gap-4">
                {/* Generate Bill Action - Only if Accepted */}
                {detailLead.quotationStatus === "Accepted" && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-800">Quotation Accepted!</div>
                      <div className="text-[10px] text-emerald-600">Ready to convert this lead into a bill.</div>
                    </div>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8"
                      onClick={() => {
                        navigate("/quotations", { 
                          state: { 
                            leadId: detailLead.id,
                            type: "Bill",
                            services: detailLead.servicesInterested
                          } 
                        });
                      }}
                    >
                      <CreditCard className="h-3.5 w-3.5 mr-1" /> Generate Bill
                    </Button>
                  </div>
                )}

                {/* Move Stage Action */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Move to Stage</div>
                  <div className="flex flex-wrap gap-1.5">
                    {kanbanStages.filter(s => s !== detailLead.stage).map(s => (
                      <Button key={s} size="sm" variant="outline" className="text-xs h-7 font-medium border-muted-foreground/20 hover:border-primary hover:text-primary transition-colors"
                        onClick={() => { moveLeadStage(detailLead.id, s); setDetailLead({ ...detailLead, stage: s }); }}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-center">
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold" onClick={() => {
                    navigate("/quotations", { 
                      state: { 
                        leadId: detailLead.id,
                        name: detailLead.name,
                        organization: detailLead.organization,
                        phone: detailLead.whatsapp || detailLead.phone,
                        email: detailLead.email,
                        services: detailLead.servicesInterested
                      } 
                    });
                  }}>
                    View All Quotes & Invoices
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
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
