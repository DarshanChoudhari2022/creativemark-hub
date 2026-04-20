import { useState } from "react";
import { MessageCircle, Mail, Check, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { recoveries as initial } from "@/data/recoveries";
import { formatINR, formatINRCompact } from "@/lib/format";
import { toast } from "sonner";

const Recovery = () => {
  const [items, setItems] = useState(initial);
  const totalDue = items.filter((i) => !i.received).reduce((s, i) => s + i.amountDue, 0);

  const sendWhatsApp = (phone: string, name: string, amount: number, inv: string) => {
    const msg = encodeURIComponent(`Hi ${name}, this is a friendly reminder from CreativeMark. Invoice ${inv} for ${formatINR(amount)} is now overdue. Please arrange payment at the earliest. Thank you!`);
    window.open(`https://wa.me/${phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  const sendEmail = (email: string, inv: string, amount: number) => {
    window.open(`mailto:${email}?subject=Payment%20Reminder%20-%20${inv}&body=Outstanding%20amount:%20${formatINR(amount)}`, "_blank");
  };

  const markReceived = (id: string) => {
    setItems((it) => it.map((r) => (r.id === id ? { ...r, received: true } : r)));
    toast.success("Marked as received");
  };

  return (
    <div>
      <PageHeader title="Recovery" subtitle="Outstanding payments tracker" />

      <Card className="p-6 mb-6 border-primary/30 bg-primary/5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-primary" />
              Total Outstanding
            </div>
            <div className="text-4xl md:text-5xl font-extrabold text-primary mt-2">{formatINR(totalDue)}</div>
            <div className="text-sm text-muted-foreground mt-1">{items.filter((i) => !i.received).length} unpaid invoices · {formatINRCompact(totalDue)}</div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-right">
            <div><div className="text-xs text-muted-foreground">&gt;30 days overdue</div><div className="font-bold text-primary text-xl">{items.filter((i) => i.daysOverdue > 30 && !i.received).length}</div></div>
            <div><div className="text-xs text-muted-foreground">&lt;30 days</div><div className="font-bold text-xl">{items.filter((i) => i.daysOverdue <= 30 && !i.received).length}</div></div>
          </div>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead><TableHead>Invoice #</TableHead><TableHead className="text-right">Amount Due</TableHead>
              <TableHead>Due Date</TableHead><TableHead>Days Overdue</TableHead><TableHead>Last Reminder</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id} className={r.received ? "opacity-50" : ""}>
                <TableCell className="font-semibold">{r.clientName}</TableCell>
                <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                <TableCell className="text-right font-bold">{formatINR(r.amountDue)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.dueDate}</TableCell>
                <TableCell>
                  <span className={`font-bold ${r.daysOverdue > 30 ? "text-primary" : "text-foreground"}`}>{r.daysOverdue} days</span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.lastReminder}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => sendWhatsApp(r.contact, r.clientName, r.amountDue, r.invoiceNo)}>
                      <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => sendEmail(r.email, r.invoiceNo, r.amountDue)}>
                      <Mail className="h-3.5 w-3.5" />Email
                    </Button>
                    {!r.received && (
                      <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => markReceived(r.id)}>
                        <Check className="h-3.5 w-3.5" />Received
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default Recovery;
