import { useState } from "react";
import { Plus, FileDown, Receipt, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, StatusBadge } from "@/components/shared";
import { quotations as initialQ, Quotation, QuotationItem, quotationTerms } from "@/data/quotations";
import { clients } from "@/data/clients";
import { formatINR, formatDateDDMMYYYY } from "@/lib/format";
import { downloadQuotationPDF } from "@/lib/pdf";
import { toast } from "sonner";

const Quotations = () => {
  const [list, setList] = useState<Quotation[]>(initialQ);
  const [previewing, setPreviewing] = useState<Quotation | null>(null);
  const [building, setBuilding] = useState(false);
  const [form, setForm] = useState<{ clientId: string; items: QuotationItem[] }>({ clientId: clients[0].id, items: [{ description: "", qty: 1, rate: 0 }] });

  const subtotal = (q: Quotation) => q.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const total = (q: Quotation) => Math.round(subtotal(q) * 1.18);

  const generate = () => {
    const client = clients.find((c) => c.id === form.clientId)!;
    const next: Quotation = {
      id: `QT-2026-${String(20 + list.length).padStart(4, "0")}`,
      clientId: client.id, clientName: client.name,
      date: formatDateDDMMYYYY(), status: "Draft", validity: "30 days",
      items: form.items.filter((i) => i.description),
    };
    setList([next, ...list]);
    setBuilding(false);
    setForm({ clientId: clients[0].id, items: [{ description: "", qty: 1, rate: 0 }] });
    toast.success("Quotation generated");
  };

  const convertToBill = (q: Quotation) => {
    setList((l) => l.map((x) => (x.id === q.id ? { ...x, status: "Billed" } : x)));
    toast.success(`${q.id} converted to bill`);
  };

  return (
    <div>
      <PageHeader
        title="Quotations & Bills"
        subtitle={`${list.length} documents`}
        actions={
          <Button className="bg-primary hover:bg-primary-hover" onClick={() => setBuilding(true)}>
            <Plus className="h-4 w-4" />Generate Quotation
          </Button>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quotation #</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-mono font-semibold">{q.id}</TableCell>
                <TableCell>{q.clientName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{q.date}</TableCell>
                <TableCell className="text-right font-semibold">{formatINR(total(q))}</TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewing(q)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="outline" onClick={() => downloadQuotationPDF(q)}><FileDown className="h-3.5 w-3.5" />PDF</Button>
                    {q.status !== "Billed" && (
                      <Button size="sm" className="bg-primary hover:bg-primary-hover" onClick={() => convertToBill(q)}>
                        <Receipt className="h-3.5 w-3.5" />Convert to Bill
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Builder */}
      <Dialog open={building} onOpenChange={setBuilding}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Generate Quotation</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                <Button size="sm" variant="outline" onClick={() => setForm({ ...form, items: [...form.items, { description: "", qty: 1, rate: 0 }] })}>
                  <Plus className="h-3 w-3" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {form.items.map((it, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <Input className="col-span-7" placeholder="Description" value={it.description}
                      onChange={(e) => { const items = [...form.items]; items[i].description = e.target.value; setForm({ ...form, items }); }} />
                    <Input className="col-span-2" type="number" placeholder="Qty" value={it.qty}
                      onChange={(e) => { const items = [...form.items]; items[i].qty = +e.target.value; setForm({ ...form, items }); }} />
                    <Input className="col-span-3" type="number" placeholder="Rate ₹" value={it.rate}
                      onChange={(e) => { const items = [...form.items]; items[i].rate = +e.target.value; setForm({ ...form, items }); }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuilding(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary-hover" onClick={generate}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewing} onOpenChange={() => setPreviewing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          {previewing && (
            <div>
              <div className="bg-primary text-primary-foreground px-8 py-5 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-2xl tracking-tight">CREATIVE MARK</div>
                  <div className="text-[11px] opacity-90">Advertising · Digital Marketing · Branding · Multimedia</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">{previewing.status === "Billed" ? "BILL" : "QUOTATION"}</div>
                  <div className="text-xs opacity-90 font-mono">{previewing.id}</div>
                </div>
              </div>
              <div className="p-8 bg-card">
                <div className="flex justify-between mb-6">
                  <div>
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Bill To</div>
                    <div className="font-bold text-lg mt-1">{previewing.clientName}</div>
                    <div className="text-xs text-muted-foreground">Client ID: {previewing.clientId}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div><span className="text-muted-foreground">Date:</span> <span className="font-semibold">{previewing.date}</span></div>
                    <div><span className="text-muted-foreground">Validity:</span> <span className="font-semibold">{previewing.validity}</span></div>
                  </div>
                </div>
                <table className="w-full text-sm border-t border-b border-border mb-4">
                  <thead className="bg-primary text-primary-foreground">
                    <tr><th className="text-left py-2 px-3">#</th><th className="text-left py-2 px-3">Description</th><th className="text-right py-2 px-3">Qty</th><th className="text-right py-2 px-3">Rate</th><th className="text-right py-2 px-3">Amount</th></tr>
                  </thead>
                  <tbody>
                    {previewing.items.map((it, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-2 px-3">{i + 1}</td><td className="py-2 px-3">{it.description}</td>
                        <td className="text-right py-2 px-3">{it.qty}</td>
                        <td className="text-right py-2 px-3">{formatINR(it.rate)}</td>
                        <td className="text-right py-2 px-3 font-semibold">{formatINR(it.qty * it.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="ml-auto w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(subtotal(previewing))}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST @ 18%</span><span>{formatINR(Math.round(subtotal(previewing) * 0.18))}</span></div>
                  <div className="flex justify-between border-t border-primary pt-2 mt-1 text-primary font-extrabold text-base"><span>TOTAL</span><span>{formatINR(total(previewing))}</span></div>
                </div>
                <div className="mt-8">
                  <h4 className="font-bold border-b-2 border-primary inline-block pb-1">Terms & Conditions</h4>
                  <ol className="text-xs text-muted-foreground space-y-1 mt-3 list-decimal pl-5">
                    {quotationTerms.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
              </div>
              <div className="p-4 border-t flex justify-end gap-2 bg-muted/30">
                <Button variant="outline" onClick={() => setPreviewing(null)}>Close</Button>
                <Button className="bg-primary hover:bg-primary-hover" onClick={() => downloadQuotationPDF(previewing, previewing.status === "Billed" ? "Bill" : "Quotation")}>
                  <FileDown className="h-4 w-4" />Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Quotations;
