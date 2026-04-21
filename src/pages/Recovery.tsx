import { useState, useMemo } from "react";
import { AlertTriangle, Send, Phone, Mail, MessageSquare, CheckCircle2, Clock, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { recoveries as initialRecoveries, WA_TEMPLATES } from "@/data/recoveries";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { toast } from "sonner";
import type { Recovery } from "@/types";

const SEVERITY_COLORS = (days: number): string => {
  if (days > 30) return "bg-red-50 border-red-200";
  if (days > 15) return "bg-amber-50 border-amber-200";
  return "bg-card border-border";
};

const Recovery = () => {
  const [recoveries, setRecoveries] = useState(initialRecoveries);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("pending");
  const [selected, setSelected] = useState<Recovery | null>(null);
  const [templateType, setTemplateType] = useState<"soft" | "firm" | "final">("soft");
  const [partialAmount, setPartialAmount] = useState(0);

  const filtered = useMemo(() =>
    recoveries.filter(r =>
      (filter === "all" || (filter === "pending" && !r.received) || (filter === "received" && r.received)) &&
      (search === "" || r.clientName.toLowerCase().includes(search.toLowerCase()) || r.invoiceNo.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => b.daysOverdue - a.daysOverdue),
    [recoveries, filter, search]);

  const totalOutstanding = recoveries.filter(r => !r.received).reduce((s, r) => s + (r.amountDue - r.amountPaid), 0);
  const overdueCount = recoveries.filter(r => !r.received).length;
  const criticalCount = recoveries.filter(r => !r.received && r.daysOverdue > 30).length;

  const sendWhatsApp = (recovery: Recovery, type: "soft" | "firm" | "final") => {
    const msg = WA_TEMPLATES[type](recovery.clientName, formatINR(recovery.amountDue - recovery.amountPaid), recovery.invoiceNo);
    window.open(waLink(recovery.whatsapp, msg), "_blank");

    // Add to reminder history
    setRecoveries(recoveries.map(r =>
      r.id === recovery.id
        ? { ...r, reminderHistory: [{ date: new Date().toISOString().slice(0, 10), channel: "WhatsApp", note: `${type.charAt(0).toUpperCase() + type.slice(1)} reminder sent` }, ...r.reminderHistory] }
        : r
    ));
    toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} reminder sent via WhatsApp`);
  };

  const markPartialPayment = (recovery: Recovery, amount: number) => {
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = recovery.amountPaid + amount;
    const fullyPaid = newPaid >= recovery.amountDue;

    setRecoveries(recoveries.map(r =>
      r.id === recovery.id
        ? {
            ...r,
            amountPaid: newPaid,
            received: fullyPaid,
            daysOverdue: fullyPaid ? 0 : r.daysOverdue,
            reminderHistory: [{ date: new Date().toISOString().slice(0, 10), channel: "Call", note: `${fullyPaid ? "Full" : "Partial"} payment of ${formatINR(amount)} received` }, ...r.reminderHistory],
          }
        : r
    ));
    setPartialAmount(0);
    toast.success(fullyPaid ? "Invoice fully paid!" : `Partial payment of ${formatINR(amount)} recorded`);
    if (fullyPaid) setSelected(null);
  };

  const markFullPayment = (recovery: Recovery) => {
    markPartialPayment(recovery, recovery.amountDue - recovery.amountPaid);
  };

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
          </>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Outstanding</div>
          <div className="text-3xl font-extrabold text-primary mt-1">{formatINR(totalOutstanding)}</div>
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead><TableHead>Invoice</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Due</TableHead><TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Balance</TableHead><TableHead>Overdue</TableHead>
              <TableHead>Reminders</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className={r.received ? "opacity-50" : ""}>
                <TableCell className="font-semibold">{r.clientName}</TableCell>
                <TableCell className="font-mono text-sm">{r.invoiceNo}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{formatDateDDMMYYYY(new Date(r.invoiceDate))}</TableCell>
                <TableCell className="text-right">{formatINR(r.amountDue)}</TableCell>
                <TableCell className="text-right text-green-600 font-semibold">{formatINR(r.amountPaid)}</TableCell>
                <TableCell className={`text-right font-bold ${!r.received ? "text-primary" : ""}`}>{formatINR(r.amountDue - r.amountPaid)}</TableCell>
                <TableCell>
                  {r.received ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-xs">Paid</Badge>
                  ) : (
                    <Badge variant="outline" className={`text-xs ${r.daysOverdue > 30 ? "bg-red-100 text-red-700 border-red-200" : r.daysOverdue > 15 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {r.daysOverdue}d
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reminderHistory.length} sent</TableCell>
                <TableCell className="text-right">
                  {!r.received && (
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => sendWhatsApp(r, "soft")} title="WhatsApp Reminder"><Send className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setSelected(r)} title="Details"><MessageSquare className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => markFullPayment(r)} title="Mark Paid"><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{filter === "received" ? "No received payments" : "No pending invoices — all clear! 🎉"}</TableCell></TableRow>}
          </TableBody>
        </Table>
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
              <div><span className="text-muted-foreground">Invoice Date:</span> <span className="font-mono">{formatDateDDMMYYYY(new Date(selected.invoiceDate))}</span></div>
              <div><span className="text-muted-foreground">Due Date:</span> <span className="font-mono">{formatDateDDMMYYYY(new Date(selected.dueDate))}</span></div>
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
              <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-lg">
                Preview: {WA_TEMPLATES[templateType](selected.clientName, formatINR(selected.amountDue - selected.amountPaid), selected.invoiceNo).slice(0, 120)}…
              </div>
            </div>

            {/* Partial Payment */}
            <div className="mt-4 p-3 border border-border rounded-lg">
              <h4 className="font-bold text-sm mb-2">Record Payment</h4>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Amount ₹</Label>
                  <Input type="number" value={partialAmount} onChange={(e) => setPartialAmount(+e.target.value)} placeholder="Enter amount" />
                </div>
                <Button size="sm" variant="outline" onClick={() => markPartialPayment(selected, partialAmount)}>Record Partial</Button>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => markFullPayment(selected)}>Mark Full Paid</Button>
              </div>
            </div>

            {/* Reminder History */}
            <div className="mt-4">
              <h4 className="font-bold text-sm flex items-center gap-1.5 mb-2"><Clock className="h-4 w-4" /> Reminder History</h4>
              <div className="space-y-1.5">
                {selected.reminderHistory.map((rem, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded border border-border text-xs">
                    <Badge variant="outline" className={`text-[10px] ${rem.channel === "WhatsApp" ? "bg-green-50 text-green-600" : rem.channel === "Call" ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"}`}>{rem.channel}</Badge>
                    <span className="flex-1 text-muted-foreground">{rem.note}</span>
                    <span className="font-mono text-muted-foreground">{formatDateDDMMYYYY(new Date(rem.date))}</span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {selected.contact}
                <Mail className="h-3.5 w-3.5 ml-2" /> {selected.email}
              </div>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Recovery;
