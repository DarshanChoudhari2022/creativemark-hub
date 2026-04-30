import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useMemo, useCallback } from "react";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Camera, FileText, Wallet, Instagram, Facebook, Twitter, Linkedin, Send, Plus, Trash2, Bell, MessageSquare, Download, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PaymentBadge } from "@/components/shared";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";
import { formatINR, formatDateDDMMYYYY, waLink, smsLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { generateReceiptPDF } from "@/lib/pdf";
import { toast } from "sonner";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  Instagram,
  Facebook,
  "Twitter/X": Twitter,
  LinkedIn: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "text-pink-500",
  Facebook: "text-blue-600",
  "Twitter/X": "text-gray-700",
  LinkedIn: "text-blue-700",
};

const POST_STATUS_COLORS: Record<string, string> = {
  Published: "bg-green-100 text-green-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shootOpen, setShootOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [teamEmpId, setTeamEmpId] = useState("");
  const [shootForm, setShootForm] = useState({ date: "", time: "", location: "", crew: [] as string[], notes: "", billAmount: 0 });
  const [postForm, setPostForm] = useState({ date: "", platform: "Instagram", postType: "Image", caption: "", status: "Draft" });
  const [payForm, setPayForm] = useState({ invoiceNo: "", date: "", amount: 0, status: "Paid", notes: "", paymentMode: "UPI" as string, chequeNo: "", transactionId: "" });
  const [meetOpen, setMeetOpen] = useState(false);
  const [meetForm, setMeetForm] = useState({ date: "", time: "", mom: "", actionItems: "", nextMeetDate: "", notes: "" });
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editPayId, setEditPayId] = useState<string | null>(null);
  const [editPayForm, setEditPayForm] = useState({ invoiceNo: "", date: "", amount: 0, status: "Paid", notes: "", paymentMode: "UPI" as string, chequeNo: "", transactionId: "" });

  const fetchClient = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (clientError || !clientData) {
      console.error("Client fetch error:", clientError?.message);
      setLoading(false);
      return;
    }

    const [servicesRes, shootsRes, postsRes, paymentsRes, eRes, billsRes, meetingsRes] = await Promise.all([
      supabase.from("client_services").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("client_shoots").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("client_posts").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("payment_history").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("employees").select("id, name, role, phone"),
      supabase.from("quotations").select("*").eq("client_id", id).order("created_at", { ascending: false }).then(r => r.data || [], () => []),
      supabase.from("client_meetings").select("*").eq("client_id", id).order("meeting_date", { ascending: false }).then(r => r.data || [], () => []),
    ]);

    // Auto-compute Total Billed from invoices (BL- prefix or is_bill flag)
    const billsArr = billsRes || [];
    const invoices = billsArr.filter((b: any) => b.is_bill || (b.quotation_number || b.quote_number || "").startsWith("BL-"));
    const computedBilled = invoices.reduce((s: number, b: any) => s + (b.grand_total || b.total_amount || 0), 0);
    const allBilled = billsArr.reduce((s: number, b: any) => s + (b.grand_total || b.total_amount || 0), 0);
    const paidTotal = (paymentsRes || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const finalBilled = computedBilled > 0 ? computedBilled : (allBilled > 0 ? allBilled : (clientData.total_billed || 0));

    setClient({
      ...clientData,
      totalBilled: finalBilled,
      outstanding: finalBilled > 0 ? Math.max(0, finalBilled - paidTotal) : (clientData.outstanding || 0),
      monthlyRetainer: clientData.monthly_retainer || 0,
      paymentStatus: clientData.payment_status || "Current",
      services: servicesRes || [],
      shoots: shootsRes || [],
      posts: postsRes || [],
      paymentHistory: paymentsRes || [],
      assignedEmployees: clientData.assigned_employees || [],
      bills: billsArr,
      meetings: meetingsRes || [],
    });
    setEmployees(eRes.data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const handleAssignTeam = async () => {
    if (!teamEmpId) return;
    const current = client.assignedEmployees || [];
    if (current.includes(teamEmpId)) return toast.error("Already assigned");
    const updated = [...current, teamEmpId];
    
    const { error } = await supabase.from('clients').update({ assigned_employees: updated }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success("Team member assigned");
    setTeamEmpId("");
    fetchClient();
  };

  const handleRemoveTeam = async (empId: string) => {
    const updated = (client.assignedEmployees || []).filter((e: string) => e !== empId);
    const { error } = await supabase.from('clients').update({ assigned_employees: updated }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success("Team member removed");
    fetchClient();
  };

  const handleAddShoot = async () => {
    if (!shootForm.date || !shootForm.location) return toast.error("Date and Location required");
    const { error } = await supabase.from('client_shoots').insert({
      client_id: id,
      date: shootForm.date,
      reporting_time: shootForm.time,
      location: shootForm.location,
      assigned_employees: shootForm.crew,
      notes: shootForm.notes
    });
    if (error) return toast.error(error.message);
    
    if (shootForm.billAmount > 0) {
      // create a bill
      await supabase.from('quotations').insert({
        client_id: id,
        client_name: client.name,
        total_amount: shootForm.billAmount,
        status: 'Unpaid',
        is_bill: true,
        issue_date: shootForm.date,
        due_date: new Date(new Date(shootForm.date).getTime() + 7*24*60*60*1000).toISOString().split('T')[0]
      });
      // update client outstanding
      await supabase.from('clients').update({
        total_billed: (client.totalBilled || 0) + Number(shootForm.billAmount),
        outstanding: (client.outstanding || 0) + Number(shootForm.billAmount)
      }).eq('id', id);
    }
    
    toast.success("Shoot logged");
    setShootOpen(false);
    setShootForm({ date: "", time: "", location: "", crew: [], notes: "", billAmount: 0 });
    fetchClient();
  };

  const handleAddPost = async () => {
    if (!postForm.date) return toast.error("Date required");
    const { error } = await supabase.from('client_posts').insert({
      client_id: id,
      date: postForm.date,
      platform: postForm.platform,
      post_type: postForm.postType,
      caption: postForm.caption,
      status: postForm.status
    });
    if (error) return toast.error(error.message);
    toast.success("Post scheduled");
    setPostOpen(false);
    setPostForm({ date: "", platform: "Instagram", postType: "Image", caption: "", status: "Draft" });
    fetchClient();
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || !payForm.date) return toast.error("Amount and date required");
    const { error } = await supabase.from('payment_history').insert({
      client_id: id,
      invoice_no: payForm.invoiceNo,
      date: payForm.date,
      amount: payForm.amount,
      status: payForm.status,
      payment_mode: payForm.paymentMode,
      cheque_no: payForm.chequeNo || null,
      transaction_id: payForm.transactionId || null,
      notes: payForm.notes
    });
    if (error) return toast.error(error.message);
    
    // Always update outstanding when recording a received payment
    const newOutstanding = Math.max(0, (client.outstanding || 0) - Number(payForm.amount));
    await supabase.from('clients').update({
      outstanding: newOutstanding,
      payment_status: newOutstanding <= 0 ? "Paid" : "Overdue",
    }).eq('id', id);

    // ── Sync quotations table ──────────────────────────────────────
    // Distribute the payment across outstanding bills (oldest first)
    // so Clients list, Quotations, Recovery & Dashboard all stay in sync.
    try {
      const { data: allClientBills } = await supabase
        .from("quotations")
        .select("id, grand_total, total_amount, amount_paid, type, status, is_bill, quotation_number, quote_number")
        .eq("client_id", id)
        .order("created_at", { ascending: true });

      const clientBills = (allClientBills || []).filter((b: any) => b.is_bill || b.type === "Bill" || (b.quotation_number || b.quote_number || "").startsWith("BL-"));

      if (clientBills && clientBills.length > 0) {
        let remaining = Number(payForm.amount);
        for (const bill of clientBills) {
          if (remaining <= 0) break;
          const billTotal = bill.grand_total || bill.total_amount || 0;
          const currentPaid = bill.amount_paid || 0;
          const billBalance = billTotal - currentPaid;
          if (billBalance <= 0) continue;

          const applyAmount = Math.min(remaining, billBalance);
          const newPaid = currentPaid + applyAmount;
          const newStatus = newPaid >= billTotal ? "Paid" : "Partial";

          await supabase.from("quotations").update({
            amount_paid: newPaid,
            status: newStatus,
          }).eq("id", bill.id);

          remaining -= applyAmount;
        }
      }
    } catch (syncErr) {
      console.warn("Quotation sync warning:", syncErr);
    }
    
    const savedForm = { ...payForm };
    const effectiveBilled = (client.totalBilled && client.totalBilled > 0)
      ? client.totalBilled
      : totalReceived + Number(payForm.amount) + newOutstanding;

    toast.success("Payment recorded! ✅", {
      action: {
        label: "Generate Receipt",
        onClick: () => {
          generateReceiptPDF({
            clientName: client.name,
            invoiceNo: savedForm.invoiceNo,
            date: savedForm.date,
            amount: savedForm.amount,
            paymentMode: savedForm.paymentMode,
            chequeNo: savedForm.chequeNo,
            transactionId: savedForm.transactionId,
            notes: savedForm.notes,
            totalBilled: effectiveBilled,
            totalPaid: totalReceived + savedForm.amount,
            balanceDue: Math.max(0, effectiveBilled - totalReceived - savedForm.amount),
          });
        }
      }
    });
    setPayOpen(false);
    setPayForm({ invoiceNo: "", date: "", amount: 0, status: "Paid", notes: "", paymentMode: "UPI", chequeNo: "", transactionId: "" });
    fetchClient();
  };

  const handleAddService = async () => {
    if (!svcName.trim()) return toast.error("Service name required");
    const { error } = await supabase.from('client_services').insert({ client_id: id, service_name: svcName.trim(), active: true });
    if (error) return toast.error(error.message);
    toast.success("Service added");
    setSvcOpen(false);
    setSvcName("");
    fetchClient();
  };

  const handleRemoveService = async (svcId: string) => {
    const { error } = await supabase.from('client_services').delete().eq('id', svcId);
    if (error) return toast.error(error.message);
    toast.success("Service removed");
    fetchClient();
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this post entry?")) return;
    const { error } = await supabase.from('client_posts').delete().eq('id', postId);
    if (error) return toast.error(error.message);
    toast.success("Post deleted");
    fetchClient();
  };

  const handleDeleteShoot = async (shootId: string) => {
    if (!confirm("Delete this shoot entry?")) return;
    const { error } = await supabase.from('client_shoots').delete().eq('id', shootId);
    if (error) return toast.error(error.message);
    toast.success("Shoot deleted");
    fetchClient();
  };

  const handleGenerateReceipt = (entry: any) => {
    // If totalBilled is 0 or missing, compute from totalReceived + outstanding
    const effectiveTotalBilled = (client.totalBilled && client.totalBilled > 0)
      ? client.totalBilled
      : totalReceived + (client.outstanding || 0);

    generateReceiptPDF({
      clientName: client.name,
      invoiceNo: entry.invoice_no || entry.invoiceNo || "",
      date: entry.date,
      amount: entry.amount,
      paymentMode: entry.payment_mode || entry.paymentMode || "Cash",
      chequeNo: entry.cheque_no || "",
      transactionId: entry.transaction_id || "",
      notes: entry.notes,
      totalBilled: effectiveTotalBilled,
      totalPaid: totalReceived,
      balanceDue: client.outstanding,
    });
  };

  // ── Meeting handlers ──
  const handleAddMeeting = async () => {
    if (!meetForm.date) return toast.error("Meeting date is required");
    const { error } = await supabase.from("client_meetings").insert({
      client_id: id, meeting_date: meetForm.date, meeting_time: meetForm.time || null,
      mom: meetForm.mom || null, action_items: meetForm.actionItems || null,
      next_meeting_date: meetForm.nextMeetDate || null, notes: meetForm.notes || null,
    });
    if (error) return toast.error("Failed: " + error.message);
    // Sync to main Calendar
    const startTime = meetForm.time ? new Date(`${meetForm.date}T${meetForm.time}:00`).toISOString() : new Date(`${meetForm.date}T09:00:00`).toISOString();
    await supabase.from("calendar_events").insert({ title: `Meeting: ${client.name}`, type: "Meeting", start_time: startTime, client_name: client.name, notes: meetForm.mom || null, status: "Scheduled" });
    if (meetForm.nextMeetDate) {
      await supabase.from("calendar_events").insert({ title: `Next Meeting: ${client.name}`, type: "Meeting", start_time: new Date(`${meetForm.nextMeetDate}T09:00:00`).toISOString(), client_name: client.name, notes: "Follow-up", status: "Scheduled" });
    }
    toast.success("Meeting logged & synced to Calendar!");
    setMeetOpen(false);
    setMeetForm({ date: "", time: "", mom: "", actionItems: "", nextMeetDate: "", notes: "" });
    fetchClient();
  };

  const handleShareMOM = (meet: any) => {
    const lines = [
      `*Meeting Summary — ${client.name}*`,
      `Date: ${formatDateDDMMYYYY(new Date(meet.meeting_date))}`,
      meet.meeting_time ? `Time: ${meet.meeting_time}` : "",
      meet.mom ? `\n*MOM:*\n${meet.mom}` : "",
      meet.action_items ? `\n*Action Items:*\n${meet.action_items}` : "",
      meet.next_meeting_date ? `\n*Next Meeting:* ${formatDateDDMMYYYY(new Date(meet.next_meeting_date))}` : "",
      meet.notes ? `\n*Notes:* ${meet.notes}` : "",
      "\n— CreativeMark Advertising",
    ].filter(Boolean).join("\n");
    window.open(waLink(client.whatsapp || client.phone, lines), "_blank");
  };

  // ── Payment edit handlers ──
  const openEditPayment = (entry: any) => {
    setEditPayId(entry.id);
    setEditPayForm({
      invoiceNo: entry.invoice_no || "", date: entry.date || "", amount: entry.amount || 0,
      status: entry.status || "Paid", notes: entry.notes || "",
      paymentMode: entry.payment_mode || entry.paymentMode || "Cash",
      chequeNo: entry.cheque_no || "", transactionId: entry.transaction_id || "",
    });
    setEditPayOpen(true);
  };

  const handleUpdatePayment = async () => {
    if (!editPayId || !editPayForm.amount || !editPayForm.date) return toast.error("Amount and date required");
    const { error } = await supabase.from("payment_history").update({
      invoice_no: editPayForm.invoiceNo, date: editPayForm.date, amount: editPayForm.amount,
      status: editPayForm.status, payment_mode: editPayForm.paymentMode,
      cheque_no: editPayForm.chequeNo || null, transaction_id: editPayForm.transactionId || null,
      notes: editPayForm.notes,
    }).eq("id", editPayId);
    if (error) return toast.error("Update failed: " + error.message);
    toast.success("Payment updated");
    setEditPayOpen(false);
    setEditPayId(null);
    fetchClient();
  };

  const sendPaymentReminder = () => {
    const msg = WHATSAPP_TEMPLATES.RECOVERY_SOFT(client.name, formatINR(client.outstanding), "");
    window.open(waLink(client.whatsapp, msg), "_blank");
  };

  const sendPaymentReminderSMS = () => {
    const msg = `Hi ${client.name}, this is a friendly reminder from CreativeMark regarding your pending balance of ${formatINR(client.outstanding)}. Kindly process the payment at the earliest. Thank you!`;
    window.open(smsLink(client.phone, msg), "_blank");
  };


  const totalReceived = useMemo(() => {
    if (!client?.paymentHistory) return 0;
    return client.paymentHistory.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  }, [client?.paymentHistory]);

  const assigned = useMemo(() => {
    if (!client?.assignedEmployees || !employees) return [];
    return employees.filter((e) => client.assignedEmployees.includes(e.id));
  }, [client?.assignedEmployees, employees]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Loading client…</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-muted-foreground mb-2">Client not found</h2>
        <Link to="/clients"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Clients</Button></Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
        </Link>
      </div>

      {/* Header Card */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-extrabold">{client.name}</h1>
              <Badge variant="outline" className="text-xs font-semibold">{client.category}</Badge>
              <PaymentBadge status={client.paymentStatus} />
            </div>
            {client.area && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {client.area}</div>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {client.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.outstanding > 0 && (client.whatsapp || client.phone) && (
              <Button size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1.5" onClick={() => {
                const outstandingMsg = `Dear ${client.name},\n\nThis is a friendly reminder from *CreativeMark Advertising* regarding your outstanding balance.\n\n📋 *Total Billed:* ${formatINR(client.totalBilled)}\n✅ *Received:* ${formatINR(totalReceived)}\n⚠️ *Outstanding:* ${formatINR(client.outstanding)}\n\nKindly arrange the pending payment at the earliest convenience.\n\nThank you for your business! 🙏\n— CreativeMark Advertising`;
                window.open(waLink(client.whatsapp || client.phone, outstandingMsg), "_blank");
              }}>
                <Send className="h-3.5 w-3.5" /> Outstanding Reminder
              </Button>
            )}
            {client.whatsapp && (
              <a href={waLink(client.whatsapp, WHATSAPP_TEMPLATES.CLIENT_GREETING(client.name))} target="_blank" rel="noopener">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"><Send className="h-4 w-4" /> WhatsApp</Button>
              </a>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Total Billed</div>
            <div className="text-xl font-extrabold">{formatINR(client.totalBilled)}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-muted-foreground">Received</div>
            <div className="text-xl font-extrabold text-green-600">{formatINR(totalReceived)}</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className={`text-xl font-extrabold ${client.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(client.outstanding)}</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Team Members</div>
            <div className="text-xl font-extrabold">{assigned.length}</div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 flex-nowrap overflow-x-auto hide-scrollbar">
          {[
            { value: "services", label: "Services & Team" },
            { value: "social", label: "Social Calendar" },
            { value: "posts", label: "Post Log" },
            { value: "shoots", label: "Shoots" },
            { value: "payments", label: "Payment History" },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm whitespace-nowrap"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Services & Team */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">Active Services</h3>
                <Dialog open={svcOpen} onOpenChange={setSvcOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button></DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
                    <div><Label>Service Name</Label><Input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Social Media, Reels, Logo Design" /></div>
                    <DialogFooter><Button onClick={handleAddService}>Save</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2">
                {client.services.map((s: any) => {
                  const serviceName = typeof s === 'string' ? s : (s.service_name || s.serviceName);
                  const serviceId = typeof s === 'string' ? s : s.id;
                  return (
                    <div key={serviceId} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{serviceName}</span>
                      </div>
                      {typeof s !== 'string' && s.id && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveService(s.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  );
                })}
                {client.services.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No services assigned</div>}
              </div>

              {/* Bills Section */}
              <div className="mt-5 pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-primary" /> Bills & Quotations</h4>
                  <Link to="/quotations"><Button size="sm" variant="outline" className="text-xs h-7"><Plus className="h-3 w-3 mr-1" />New Bill</Button></Link>
                </div>
                {client.bills && client.bills.length > 0 ? (
                  <div className="space-y-2">
                    {client.bills.map((bill: any) => (
                      <div key={bill.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border">
                        <div>
                          <div className="text-sm font-semibold">{bill.quote_number}</div>
                          <div className="text-xs text-muted-foreground">{formatDateDDMMYYYY(new Date(bill.created_at))} &middot; {bill.type === "Bill" ? "Invoice" : "Quote"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">{formatINR(bill.grand_total || 0)}</div>
                          <Badge variant={bill.status === "Paid" ? "default" : "outline"} className={`text-[10px] ${bill.status === "Paid" ? "bg-green-100 text-green-700" : bill.status === "Sent" ? "bg-blue-100 text-blue-700" : ""}`}>{bill.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-3">No bills raised yet. Create one from Quotations.</div>
                )}
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">Assigned Team</h3>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Select value={teamEmpId} onValueChange={setTeamEmpId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => !(client.assignedEmployees || []).includes(e.id)).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssignTeam} disabled={!teamEmpId}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                {assigned.length > 0 ? assigned.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div>
                      <div className="text-sm font-semibold">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.role}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveTeam(emp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-4">No team members assigned</div>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Social Calendar — Meeting Log */}
        <TabsContent value="social">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Meeting Log</h3>
              <Dialog open={meetOpen} onOpenChange={setMeetOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Meeting</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Log a Meeting</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Date *</Label><Input type="date" value={meetForm.date} onChange={e => setMeetForm(f => ({ ...f, date: e.target.value }))} /></div>
                      <div><Label>Time</Label><Input type="time" value={meetForm.time} onChange={e => setMeetForm(f => ({ ...f, time: e.target.value }))} /></div>
                    </div>
                    <div><Label>Minutes of Meeting (MOM)</Label><Textarea rows={3} value={meetForm.mom} onChange={e => setMeetForm(f => ({ ...f, mom: e.target.value }))} placeholder="Key discussion points..." /></div>
                    <div><Label>Action Items</Label><Textarea rows={2} value={meetForm.actionItems} onChange={e => setMeetForm(f => ({ ...f, actionItems: e.target.value }))} placeholder={"1. Follow up on proposal\n2. Send revised quote"} /></div>
                    <div><Label>Next Meeting Date</Label><Input type="date" value={meetForm.nextMeetDate} onChange={e => setMeetForm(f => ({ ...f, nextMeetDate: e.target.value }))} /></div>
                    <div><Label>Notes / Reminders</Label><Textarea rows={2} value={meetForm.notes} onChange={e => setMeetForm(f => ({ ...f, notes: e.target.value }))} placeholder="Custom notes, reminders..." /></div>
                  </div>
                  <DialogFooter><Button onClick={handleAddMeeting}>Save Meeting</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Next Meeting Banner */}
            {(() => {
              const upcoming = (client.meetings || []).find((m: any) => m.next_meeting_date && new Date(m.next_meeting_date) >= new Date(new Date().toDateString()));
              if (!upcoming) return null;
              return (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-blue-600 font-semibold">📅 Next Meeting</div>
                    <div className="font-bold text-blue-800">{formatDateDDMMYYYY(new Date(upcoming.next_meeting_date))}</div>
                  </div>
                  {(client.whatsapp || client.phone) && (
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                      window.open(waLink(client.whatsapp || client.phone, `Hi ${client.name}, reminder about our meeting on ${formatDateDDMMYYYY(new Date(upcoming.next_meeting_date))}.\n— CreativeMark Advertising`), "_blank");
                    }}><Send className="h-3.5 w-3.5 mr-1" /> Remind via WhatsApp</Button>
                  )}
                </div>
              );
            })()}

            {/* Meeting History */}
            {(client.meetings || []).length > 0 ? (
              <div className="space-y-3">
                {(client.meetings || []).map((meet: any) => (
                  <div key={meet.id} className="p-4 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-semibold text-sm">{formatDateDDMMYYYY(new Date(meet.meeting_date))}{meet.meeting_time ? ` at ${meet.meeting_time}` : ""}</div>
                        {meet.next_meeting_date && <div className="text-xs text-blue-600 mt-0.5">Next: {formatDateDDMMYYYY(new Date(meet.next_meeting_date))}</div>}
                      </div>
                      {(client.whatsapp || client.phone) && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => handleShareMOM(meet)}>
                          <Send className="h-3 w-3 mr-1" /> Share MOM
                        </Button>
                      )}
                    </div>
                    {meet.mom && <div className="mb-2"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">MOM:</div><div className="text-sm whitespace-pre-wrap">{meet.mom}</div></div>}
                    {meet.action_items && <div className="mb-2"><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Action Items:</div><div className="text-sm whitespace-pre-wrap">{meet.action_items}</div></div>}
                    {meet.notes && <div><div className="text-[10px] font-semibold text-muted-foreground mb-0.5">Notes:</div><div className="text-sm whitespace-pre-wrap text-muted-foreground">{meet.notes}</div></div>}
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground text-center py-8">No meetings logged yet. Click "Log Meeting" to record your first meeting.</div>}
          </Card>
        </TabsContent>

        {/* Post Log */}
        <TabsContent value="posts">
          <div className="flex justify-end mb-3">
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Post</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Schedule a Post</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Date</Label><Input type="date" value={postForm.date} onChange={e => setPostForm(p => ({ ...p, date: e.target.value }))} /></div>
                  <div><Label>Platform</Label>
                    <Select value={postForm.platform} onValueChange={v => setPostForm(p => ({ ...p, platform: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Instagram","Facebook","Twitter/X","LinkedIn","YouTube","Other"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={postForm.postType} onValueChange={v => setPostForm(p => ({ ...p, postType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Image","Video","Reel","Story","Carousel","Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Caption</Label><Textarea value={postForm.caption} onChange={e => setPostForm(p => ({ ...p, caption: e.target.value }))} /></div>
                  <div><Label>Status</Label>
                    <Select value={postForm.status} onValueChange={v => setPostForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Draft","Scheduled","Published"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={handleAddPost}>Save Post</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead>Type</TableHead>
                  <TableHead>Caption</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.posts.length > 0 ? client.posts.map((post: any) => {
                  const platform = post.platform || "Instagram";
                  const PlatformIcon = PLATFORM_ICONS[platform] || Instagram;
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(post.date))}</TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 ${PLATFORM_COLORS[platform] || ""}`}>
                          <PlatformIcon className="h-4 w-4" /> {platform}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{post.post_type || post.postType}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{post.caption}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${POST_STATUS_COLORS[post.status] || ""}`}>{post.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeletePost(post.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No posts logged</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Shoots */}
        <TabsContent value="shoots">
          <div className="flex justify-end mb-3">
            <Dialog open={shootOpen} onOpenChange={setShootOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Shoot</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Shoot / Development Work</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={shootForm.date} onChange={e => setShootForm(p => ({ ...p, date: e.target.value }))} /></div>
                    <div><Label>Reporting Time</Label><Input type="time" value={shootForm.time} onChange={e => setShootForm(p => ({ ...p, time: e.target.value }))} /></div>
                  </div>
                  <div><Label>Location</Label><Input value={shootForm.location} onChange={e => setShootForm(p => ({ ...p, location: e.target.value }))} placeholder="Studio / On-site address" /></div>
                  <div>
                    <Label>Crew (who did the shoot)</Label>
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {shootForm.crew.map(eid => {
                        const emp = employees.find(e => e.id === eid);
                        return <Badge key={eid} variant="secondary" className="cursor-pointer" onClick={() => setShootForm(p => ({ ...p, crew: p.crew.filter(x => x !== eid) }))}>{emp?.name || eid} ✕</Badge>;
                      })}
                    </div>
                    <Select onValueChange={v => { if (!shootForm.crew.includes(v)) setShootForm(p => ({ ...p, crew: [...p.crew, v] })); }}>
                      <SelectTrigger><SelectValue placeholder="Add crew member" /></SelectTrigger>
                      <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bill Amount (₹)</Label><Input type="number" value={shootForm.billAmount || ""} onChange={e => setShootForm(p => ({ ...p, billAmount: Number(e.target.value) }))} placeholder="0 = no bill" /></div>
                  <div><Label>Notes</Label><Textarea value={shootForm.notes} onChange={e => setShootForm(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>
                <DialogFooter><Button onClick={handleAddShoot}>Save Shoot</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Location</TableHead>
                  <TableHead>Crew</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.shoots.length > 0 ? client.shoots.map((shoot: any) => (
                  <TableRow key={shoot.id}>
                    <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(shoot.date))}</TableCell>
                    <TableCell className="font-mono text-sm">{shoot.reporting_time || shoot.reportingTime}</TableCell>
                    <TableCell className="text-sm">{shoot.location}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(shoot.assigned_employees || shoot.assignedEmployees || []).map((eid: string) => {
                          const emp = employees.find(e => e.id === eid);
                          return <span key={eid} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium">{emp?.name.split(" ")[0] || eid}</span>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${shoot.status === "Completed" ? "bg-green-100 text-green-700" : shoot.status === "Scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{shoot.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteShoot(shoot.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No shoots scheduled</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="payments">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            {client.outstanding > 0 && client.whatsapp && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={sendPaymentReminder}><Send className="h-4 w-4 mr-1" /> WhatsApp Reminder</Button>
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={sendPaymentReminderSMS}><MessageSquare className="h-4 w-4 mr-1" /> SMS Reminder</Button>
              </div>
            )}
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Payment</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Payment Received</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Invoice #</Label><Input value={payForm.invoiceNo} onChange={e => setPayForm(p => ({ ...p, invoiceNo: e.target.value }))} placeholder="INV-001" /></div>
                    <div><Label>Date *</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Amount (₹) *</Label><Input type="number" value={payForm.amount || ""} onChange={e => setPayForm(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
                    <div><Label>Payment Mode</Label>
                      <Select value={payForm.paymentMode} onValueChange={v => setPayForm(p => ({ ...p, paymentMode: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["Cash","UPI","NEFT","Cheque","Bank Transfer","Google Pay","PhonePe"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {payForm.paymentMode === "Cheque" && (
                    <div><Label>Cheque Number</Label><Input value={payForm.chequeNo} onChange={e => setPayForm(p => ({ ...p, chequeNo: e.target.value }))} placeholder="e.g. 123456" /></div>
                  )}
                  {["UPI","NEFT","Bank Transfer","Google Pay","PhonePe"].includes(payForm.paymentMode) && (
                    <div><Label>Transaction ID / Reference</Label><Input value={payForm.transactionId} onChange={e => setPayForm(p => ({ ...p, transactionId: e.target.value }))} placeholder="e.g. TXN202604240001" /></div>
                  )}
                  <div><Label>Notes</Label><Textarea value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Partial payment for April services" /></div>
                </div>
                <DialogFooter><Button onClick={handleAddPayment}>Save & Record Payment</Button></DialogFooter>
              </DialogContent>
            </Dialog>

          {/* Edit Payment Dialog */}
          <Dialog open={editPayOpen} onOpenChange={setEditPayOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Invoice #</Label><Input value={editPayForm.invoiceNo} onChange={e => setEditPayForm(p => ({ ...p, invoiceNo: e.target.value }))} /></div>
                  <div><Label>Date *</Label><Input type="date" value={editPayForm.date} onChange={e => setEditPayForm(p => ({ ...p, date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount *</Label><Input type="number" value={editPayForm.amount || ""} onChange={e => setEditPayForm(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
                  <div><Label>Payment Mode</Label>
                    <Select value={editPayForm.paymentMode} onValueChange={v => setEditPayForm(p => ({ ...p, paymentMode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Cash","UPI","NEFT","Cheque","Bank Transfer","Google Pay","PhonePe"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                {editPayForm.paymentMode === "Cheque" && (
                  <div><Label>Cheque Number</Label><Input value={editPayForm.chequeNo} onChange={e => setEditPayForm(p => ({ ...p, chequeNo: e.target.value }))} /></div>
                )}
                {["UPI","NEFT","Bank Transfer","Google Pay","PhonePe"].includes(editPayForm.paymentMode) && (
                  <div><Label>Transaction ID</Label><Input value={editPayForm.transactionId} onChange={e => setEditPayForm(p => ({ ...p, transactionId: e.target.value }))} /></div>
                )}
                <div><Label>Status</Label>
                  <Select value={editPayForm.status} onValueChange={v => setEditPayForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["Paid","Pending","Partial","Bounced"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Notes</Label><Textarea value={editPayForm.notes} onChange={e => setEditPayForm(p => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <DialogFooter><Button onClick={handleUpdatePayment}>Update Payment</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          </div>

          {/* Bill Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Total Billed</div><div className="text-lg font-bold">{formatINR(client.totalBilled)}</div></Card>
            <Card className="p-3 text-center bg-green-50"><div className="text-xs text-muted-foreground">Received</div><div className="text-lg font-bold text-green-600">{formatINR(totalReceived)}</div></Card>
            <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Pending</div><div className={`text-lg font-bold ${client.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>{formatINR(client.outstanding)}</div></Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(client.paymentHistory || []).length > 0 ? (client.paymentHistory || []).map((entry: any, i: number) => (
                  <TableRow key={entry.id || i}>
                    <TableCell className="font-mono font-semibold text-sm">{entry.invoice_no || entry.invoiceNo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(entry.date))}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(entry.amount)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{entry.payment_mode || entry.paymentMode || "Cash"}</Badge></TableCell>
                    <TableCell><PaymentBadge status={entry.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{entry.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditPayment(entry)}><Edit2 className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleGenerateReceipt(entry)}><Download className="h-3 w-3 mr-1" />Receipt</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No payment records</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetail;
