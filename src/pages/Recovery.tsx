import { useState, useMemo, useEffect } from "react";
import { AlertTriangle, Send, Phone, Mail, MessageSquare, CheckCircle2, Clock, Search, Filter, RefreshCw, IndianRupee, Share2, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { Masked } from "@/components/Masked";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { generateReceiptPDF } from "@/lib/pdf";

/* Recovery is now derived from Bills (quotations where type='Bill' and status != 'Paid') */

interface RecoveryRow {
  id: string;
  clientName: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  daysOverdue: number;
  received: boolean;
  contact: string;
  email: string;
  whatsapp: string;
  reminderCount: number;
}

const Recovery = () => {
  const [recoveries, setRecoveries] = useState<RecoveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("pending");
  const [selected, setSelected] = useState<RecoveryRow | null>(null);
  const [templateType, setTemplateType] = useState<"soft" | "firm" | "final">("soft");
  const [partialAmount, setPartialAmount] = useState(0);
  const [reminderHistory, setReminderHistory] = useState<any[]>([]);
  const [inlinePayId, setInlinePayId] = useState<string | null>(null);
  const [inlinePayAmount, setInlinePayAmount] = useState(0);
  const [inlinePayMode, setInlinePayMode] = useState("Cash");
  const [inlinePayCheque, setInlinePayCheque] = useState("");
  const [inlinePayTxnId, setInlinePayTxnId] = useState("");
  const [dialogPayMode, setDialogPayMode] = useState("Cash");
  const [dialogPayCheque, setDialogPayCheque] = useState("");
  const [dialogPayTxnId, setDialogPayTxnId] = useState("");

  const fetchRecoveries = async () => {
    setLoading(true);
    // Get all bills (type = 'Bill')
    const { data: bills } = await supabase
      .from("quotations")
      .select("*")
      .eq("type", "Bill")
      .order("created_at", { ascending: false });

    const now = Date.now();
    const rows: RecoveryRow[] = (bills || []).map(b => {
      const dueDate = b.due_date ? new Date(b.due_date) : new Date(b.date || b.created_at);
      const daysOverdue = b.status === "Paid" ? 0 : Math.max(0, Math.floor((now - dueDate.getTime()) / 86400000));
      const amountPaid = b.status === "Paid" ? (b.grand_total || 0) : (b.amount_paid || 0);

      return {
        id: b.id,
        clientName: b.client_name || "Unknown",
        invoiceNo: b.quote_number || "",
        invoiceDate: b.date || "",
        dueDate: b.due_date || b.date || "",
        amountDue: b.grand_total || 0,
        amountPaid,
        daysOverdue,
        received: b.status === "Paid",
        contact: b.client_phone || "",
        email: b.client_email || "",
        whatsapp: b.client_phone || "",
        reminderCount: 0,
      };
    });
    setRecoveries(rows);
    setLoading(false);
  };

  useEffect(() => { fetchRecoveries(); }, []);

  const filtered = useMemo(() =>
    recoveries.filter(r =>
      (filter === "all" || (filter === "pending" && !r.received) || (filter === "received" && r.received)) &&
      (search === "" || r.clientName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNo.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => b.daysOverdue - a.daysOverdue),
    [recoveries, filter, search]);

  const totalOutstanding = recoveries.filter(r => !r.received).reduce((s, r) => s + (r.amountDue - r.amountPaid), 0);
  const overdueCount = recoveries.filter(r => !r.received).length;
  const criticalCount = recoveries.filter(r => !r.received && r.daysOverdue > 30).length;

  const sendWhatsApp = (recovery: RecoveryRow, type: "soft" | "firm" | "final") => {
    const balance = recovery.amountDue - recovery.amountPaid;
    const amountStr = formatINR(balance);
    let msg = "";
    
    if (type === "soft") msg = WHATSAPP_TEMPLATES.RECOVERY_SOFT(recovery.clientName, amountStr, recovery.invoiceNo);
    else if (type === "firm") msg = WHATSAPP_TEMPLATES.RECOVERY_FIRM(recovery.clientName, amountStr, recovery.invoiceNo);
    else msg = WHATSAPP_TEMPLATES.RECOVERY_FINAL(recovery.clientName, amountStr, recovery.invoiceNo);

    window.open(waLink(recovery.whatsapp, msg), "_blank");
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} reminder opened`);

    // Log reminder in Supabase
    supabase.from("recovery_reminders").insert({
      quotation_id: recovery.id,
      type: "whatsapp",
      message: msg,
      sent_at: new Date().toISOString(),
    }).then(() => {});
  };

  const markPartialPayment = async (recovery: RecoveryRow, amount: number, payMode = "Cash", chequeNo = "", txnId = "") => {
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = recovery.amountPaid + amount;
    const fullyPaid = newPaid >= recovery.amountDue;
    const balanceDue = Math.max(0, recovery.amountDue - newPaid);

    const { error } = await supabase.from("quotations").update({
      amount_paid: newPaid,
      status: fullyPaid ? "Paid" : "Overdue",
    }).eq("id", recovery.id);
    if (error) { toast.error("Failed to record payment: " + error.message); return; }

    // Fetch client_id for syncing
    const { data: qData } = await supabase.from("quotations").select("client_id").eq("id", recovery.id).single();
    const clientId = qData?.client_id || null;

    // Record in payment_history with full mode details
    await supabase.from("payment_history").insert({
      client_id: clientId,
      invoice_no: recovery.invoiceNo,
      date: new Date().toISOString().slice(0, 10),
      amount,
      status: "Paid",
      payment_mode: payMode,
      cheque_no: chequeNo || null,
      transaction_id: txnId || null,
      notes: `${fullyPaid ? "Full" : "Partial"} payment against ${recovery.invoiceNo} via ${payMode}${chequeNo ? ` (Cheque: ${chequeNo})` : ""}${txnId ? ` (Txn: ${txnId})` : ""}`,
    });

    // Sync client outstanding across all bills
    if (clientId) {
      const { data: allBills } = await supabase.from("quotations").select("grand_total, amount_paid").eq("client_id", clientId).eq("type", "Bill");
      if (allBills) {
        const totalBilled = allBills.reduce((s: number, b: any) => s + (b.grand_total || 0), 0);
        const totalPaidAll = allBills.reduce((s: number, b: any) => s + (b.amount_paid || 0), 0);
        await supabase.from("clients").update({ total_billed: totalBilled, outstanding: totalBilled - totalPaidAll }).eq("id", clientId);
      }
    }

    await supabase.from("recovery_notes").insert({
      quotation_id: recovery.id,
      note: `${fullyPaid ? "Full" : "Partial"} payment of ${formatINR(amount)} received via ${payMode}${chequeNo ? ` (Cheque: ${chequeNo})` : ""}. Balance: ${formatINR(balanceDue)}`,
      created_at: new Date().toISOString(),
    });

    // Reset all payment form state
    setPartialAmount(0);
    setInlinePayId(null);
    setInlinePayAmount(0);
    setInlinePayMode("Cash");
    setInlinePayCheque("");
    setInlinePayTxnId("");
    setDialogPayMode("Cash");
    setDialogPayCheque("");
    setDialogPayTxnId("");

    // Prepare receipt data for download
    const receiptData = {
      clientName: recovery.clientName,
      invoiceNo: recovery.invoiceNo,
      date: new Date().toISOString().slice(0, 10),
      amount,
      paymentMode: payMode,
      chequeNo: chequeNo || undefined,
      transactionId: txnId || undefined,
      totalBilled: recovery.amountDue,
      totalPaid: newPaid,
      balanceDue,
      notes: `Payment via ${payMode}${chequeNo ? ` | Cheque: ${chequeNo}` : ""}${txnId ? ` | Txn: ${txnId}` : ""}`,
    };

    if (fullyPaid) {
      toast.success("Invoice fully paid! 🎉", {
        duration: 8000,
        action: { label: "📥 Download Receipt", onClick: () => generateReceiptPDF(receiptData) }
      });
      setSelected(null);
    } else {
      toast.success(`Partial payment of ${formatINR(amount)} via ${payMode} recorded! Balance: ${formatINR(balanceDue)}`, {
        duration: 8000,
        action: { label: "📥 Receipt", onClick: () => generateReceiptPDF(receiptData) }
      });
    }
    fetchRecoveries();
  };

  const markFullPayment = (recovery: RecoveryRow, payMode = "Cash", chequeNo = "", txnId = "") => {
    markPartialPayment(recovery, recovery.amountDue - recovery.amountPaid, payMode, chequeNo, txnId);
  };

  const openDetail = async (r: RecoveryRow) => {
    setSelected(r);
    // Fetch reminder history for this bill
    const { data: reminders } = await supabase
      .from("recovery_reminders")
      .select("*")
      .eq("quotation_id", r.id)
      .order("sent_at", { ascending: false });
    const { data: notes } = await supabase
      .from("recovery_notes")
      .select("*")
      .eq("quotation_id", r.id)
      .order("created_at", { ascending: false });

    const combined = [
      ...(reminders || []).map((rem: any) => ({
        date: rem.sent_at,
        channel: "WhatsApp",
        note: rem.message?.slice(0, 80) + "…" || "Reminder sent",
      })),
      ...(notes || []).map((n: any) => ({
        date: n.created_at,
        channel: "Payment",
        note: n.note || "Note",
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setReminderHistory(combined);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Payment Recovery" subtitle="Loading…" />
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payment Recovery"
        subtitle={`${overdueCount} pending invoices`}
        actions={
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search…" className="pl-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="received">Received</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchRecoveries}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Outstanding</div>
          <div className="text-3xl font-extrabold text-primary mt-1"><Masked placeholder="₹•••••">{formatINR(totalOutstanding)}</Masked></div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Invoices Pending</div>
          <div className="text-3xl font-extrabold mt-1">{overdueCount}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Critical (30+ days)</div>
          <div className="text-3xl font-extrabold text-primary mt-1">{criticalCount}</div>
          <div className="text-xs text-muted-foreground">Require immediate action</div>
        </div>
      </div>

      {/* Recovery Table */}
      <Card>
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Due</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead><TableHead>Overdue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const balance = r.amountDue - r.amountPaid;
              return (
              <>
              <TableRow key={r.id} className={r.received ? "opacity-50" : ""}>
                <TableCell className="font-semibold"><Masked>{r.clientName}</Masked></TableCell>
                <TableCell className="font-mono text-sm">{r.invoiceNo}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{r.invoiceDate ? formatDateDDMMYYYY(new Date(r.invoiceDate)) : ""}</TableCell>
                <TableCell className="text-right"><Masked placeholder="₹•••••">{formatINR(r.amountDue)}</Masked></TableCell>
                <TableCell className="text-right text-green-600 font-semibold"><Masked placeholder="₹•••••">{formatINR(r.amountPaid)}</Masked></TableCell>
                <TableCell className={`text-right font-bold ${!r.received ? "text-primary" : ""}`}><Masked placeholder="₹•••••">{formatINR(balance)}</Masked></TableCell>
                <TableCell>
                  {r.received ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">Paid</Badge>
                  ) : (
                    <Badge variant="outline" className={`text-xs ${r.daysOverdue > 30 ? "bg-red-100 text-red-700 border-red-200" : r.daysOverdue > 15 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {r.daysOverdue}d
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {!r.received && (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setInlinePayId(inlinePayId === r.id ? null : r.id); setInlinePayAmount(0); }} title="Record Payment"><IndianRupee className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => sendWhatsApp(r, "soft")} title="WhatsApp Reminder"><Send className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                        const msg = WHATSAPP_TEMPLATES.OUTSTANDING_REMINDER(r.clientName, r.invoiceNo, formatINR(r.amountDue), formatINR(r.amountPaid), formatINR(balance));
                        window.open(waLink(r.whatsapp, msg), "_blank");
                      }} title="Share Outstanding"><Share2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetail(r)} title="Details"><MessageSquare className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => markFullPayment(r)} title="Mark Paid"><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
              {/* Inline partial payment row */}
              {inlinePayId === r.id && !r.received && (
                <TableRow key={`pay-${r.id}`} className="bg-blue-50/50">
                  <TableCell colSpan={8}>
                    <div className="p-2 space-y-2">
                      <div className="text-xs font-semibold text-blue-700">Record Payment for {r.clientName} — Balance: {formatINR(balance)}</div>
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <Label className="text-[10px]">Amount ₹</Label>
                          <Input type="number" className="h-8 w-28 text-sm" placeholder="Amount" value={inlinePayAmount || ""} onChange={(e) => setInlinePayAmount(+e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Mode</Label>
                          <Select value={inlinePayMode} onValueChange={setInlinePayMode}>
                            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Cash">Cash</SelectItem>
                              <SelectItem value="Cheque">Cheque</SelectItem>
                              <SelectItem value="UPI">UPI</SelectItem>
                              <SelectItem value="NEFT">NEFT / RTGS</SelectItem>
                              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {inlinePayMode === "Cheque" && (
                          <div>
                            <Label className="text-[10px]">Cheque No.</Label>
                            <Input className="h-8 w-32 text-sm" placeholder="Cheque #" value={inlinePayCheque} onChange={(e) => setInlinePayCheque(e.target.value)} />
                          </div>
                        )}
                        {(inlinePayMode === "UPI" || inlinePayMode === "NEFT" || inlinePayMode === "Bank Transfer") && (
                          <div>
                            <Label className="text-[10px]">Txn / UTR ID</Label>
                            <Input className="h-8 w-36 text-sm" placeholder="Transaction ID" value={inlinePayTxnId} onChange={(e) => setInlinePayTxnId(e.target.value)} />
                          </div>
                        )}
                        <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs" onClick={() => markPartialPayment(r, inlinePayAmount, inlinePayMode, inlinePayCheque, inlinePayTxnId)}>Record ₹{inlinePayAmount.toLocaleString("en-IN")}</Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setInlinePayId(null); setInlinePayAmount(0); setInlinePayMode("Cash"); setInlinePayCheque(""); setInlinePayTxnId(""); }}>Cancel</Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              </>
              );
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{filter === "received" ? "No received payments" : "No pending invoices — all clear! 🎉"}</TableCell></TableRow>}
          </TableBody>
        </Table>
        </div>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${selected.daysOverdue > 30 ? "text-primary" : "text-amber-500"}`} />
                {selected.clientName} — {selected.invoiceNo}
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Invoice Date:</span> <span className="font-mono">{selected.invoiceDate ? formatDateDDMMYYYY(new Date(selected.invoiceDate)) : "—"}</span></div>
              <div><span className="text-muted-foreground">Due Date:</span> <span className="font-mono">{selected.dueDate ? formatDateDDMMYYYY(new Date(selected.dueDate)) : "—"}</span></div>
              <div><span className="text-muted-foreground">Amount Due:</span> <span className="font-bold">{formatINR(selected.amountDue)}</span></div>
              <div><span className="text-muted-foreground">Amount Paid:</span> <span className="font-bold text-green-600">{formatINR(selected.amountPaid)}</span></div>
              <div><span className="text-muted-foreground">Balance:</span> <span className="font-bold text-lg text-primary">{formatINR(selected.amountDue - selected.amountPaid)}</span></div>
              <div><span className="text-muted-foreground">Days Overdue:</span> <span className={`font-bold ${selected.daysOverdue > 30 ? "text-primary" : ""}`}>{selected.daysOverdue}</span></div>
            </div>

            {/* WhatsApp Templates */}
            <div className="mt-4 space-y-2">
              <h4 className="font-bold text-sm">Send WhatsApp Reminder</h4>
              <div className="grid grid-cols-3 gap-2">
                {(["soft", "firm", "final"] as const).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant={templateType === type ? "default" : "outline"}
                    className={`text-xs capitalize ${templateType === type ? "bg-green-600 hover:bg-green-700" : ""}`}
                    onClick={() => { setTemplateType(type); sendWhatsApp(selected, type); }}
                  >
                    {type === "soft" ? "😊" : type === "firm" ? "⚠️" : "🚨"} {type}
                  </Button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg italic">
                Preview: {(WHATSAPP_TEMPLATES[`RECOVERY_${templateType.toUpperCase()}` as keyof typeof WHATSAPP_TEMPLATES] as (c: string, a: string, i: string) => string)(selected.clientName, formatINR(selected.amountDue - selected.amountPaid), selected.invoiceNo).slice(0, 100)}…
              </div>
            </div>

            {/* Record Payment */}
            <div className="mt-4 p-3 border border-border rounded-lg space-y-3">
              <h4 className="font-bold text-sm">Record Payment</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Amount ₹</Label>
                  <Input type="number" value={partialAmount} onChange={(e) => setPartialAmount(+e.target.value)} placeholder="Enter amount" />
                </div>
                <div>
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={dialogPayMode} onValueChange={setDialogPayMode}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="NEFT">NEFT / RTGS</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {dialogPayMode === "Cheque" && (
                <div>
                  <Label className="text-xs">Cheque Number</Label>
                  <Input value={dialogPayCheque} onChange={(e) => setDialogPayCheque(e.target.value)} placeholder="Enter cheque number" />
                </div>
              )}
              {(dialogPayMode === "UPI" || dialogPayMode === "NEFT" || dialogPayMode === "Bank Transfer") && (
                <div>
                  <Label className="text-xs">Transaction / UTR ID</Label>
                  <Input value={dialogPayTxnId} onChange={(e) => setDialogPayTxnId(e.target.value)} placeholder="Enter transaction reference" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => markPartialPayment(selected, partialAmount, dialogPayMode, dialogPayCheque, dialogPayTxnId)}>Record Partial</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => markFullPayment(selected, dialogPayMode, dialogPayCheque, dialogPayTxnId)}>Mark Full Paid</Button>
              </div>
            </div>

            {/* Reminder History */}
            <div className="mt-4">
              <h4 className="font-bold text-sm flex items-center gap-1.5 mb-2"><Clock className="h-4 w-4" /> Activity History</h4>
              <div className="space-y-1.5">
                {reminderHistory.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No activity recorded yet</div>}
                {reminderHistory.map((rem, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded border border-border text-xs">
                    <Badge variant="outline" className={`text-[10px] ${rem.channel === "WhatsApp" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"}`}>{rem.channel}</Badge>
                    <span className="flex-1 text-muted-foreground truncate">{rem.note}</span>
                    <span className="font-mono text-muted-foreground shrink-0">{rem.date ? formatDateDDMMYYYY(new Date(rem.date)) : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {selected.contact || "No phone"}
                <Mail className="h-3.5 w-3.5 ml-2" /> {selected.email || "No email"}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Recovery;
