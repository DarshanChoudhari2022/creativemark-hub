import { useState, useMemo } from "react";
import { Plus, FileText, Download, Send, Eye, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared";
import { quotations as initialQuotations } from "@/data/quotations";
import { clients } from "@/data/clients";
import { leads } from "@/data/leads";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { generateQuotationPDF } from "@/lib/pdf";
import { toast } from "sonner";
import type { QuotationBill, QuotationBillStatus, LineItem } from "@/types";

const STATUS_COLORS: Record<QuotationBillStatus, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-100 text-blue-700 border-blue-200",
  Approved: "bg-green-100 text-green-700 border-green-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  Converted: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Overdue: "bg-red-100 text-red-700 border-red-200",
};

const emptyItem = (): LineItem => ({ description: "", quantity: 1, rate: 0, amount: 0 });

const Quotations = () => {
  const [quotations, setQuotations] = useState(initialQuotations);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [previewQ, setPreviewQ] = useState<QuotationBill | null>(null);

  // Builder state
  const [type, setType] = useState<"Quotation" | "Bill">("Quotation");
  const [recipientId, setRecipientId] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [gstEnabled, setGstEnabled] = useState(true);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [terms, setTerms] = useState("50% advance, 50% upon completion. Delivery within 30 days.");
  const [notes, setNotes] = useState("");

  const allRecipients = [
    ...clients.map(c => ({ id: c.id, name: c.name, type: "Client", isClient: true })),
    ...leads.map(l => ({ id: l.id, name: `${l.name} (${l.company})`, type: "Lead", isClient: false })),
  ];

  const filtered = useMemo(() =>
    quotations.filter(q =>
      (statusFilter === "all" || q.status === statusFilter) &&
      (search === "" || q.recipientName.toLowerCase().includes(search.toLowerCase()) || q.number.toLowerCase().includes(search.toLowerCase()))
    ), [quotations, statusFilter, search]);

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    if (field === "quantity" || field === "rate") {
      updated[index].amount = updated[index].quantity * updated[index].rate;
    }
    setItems(updated);
  };

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100));
  const afterDiscount = subtotal - discountAmount;
  const cgstAmount = gstEnabled ? Math.round(afterDiscount * 0.09) : 0;
  const sgstAmount = gstEnabled ? Math.round(afterDiscount * 0.09) : 0;
  const total = afterDiscount + cgstAmount + sgstAmount;

  const createQuotation = () => {
    const recipient = allRecipients.find(r => r.id === recipientId);
    if (!recipient || items.every(i => !i.description)) { toast.error("Select recipient and add items"); return; }
    
    // In actual system we would differentiate Q vs B numbering
    const prefix = type === "Quotation" ? "QT" : "BL";
    const status: QuotationBillStatus = type === "Quotation" ? "Draft" : "Sent";
    
    const newDoc: QuotationBill = {
      id: `DOC-${String(quotations.length + 1).padStart(3, "0")}`,
      number: `${prefix}-2026-${String(19 + quotations.length).padStart(4, "0")}`,
      type,
      status,
      date: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
      
      recipientId,
      recipientName: recipient.name,
      isClient: recipient.isClient,
      
      items: items.filter(i => i.description),
      subtotal,
      discountPercent,
      discountAmount,
      cgstPercent: gstEnabled ? 9 : 0,
      cgstAmount,
      sgstPercent: gstEnabled ? 9 : 0,
      sgstAmount,
      total,
      
      terms,
      internalNotes: notes,
    };
    setQuotations([newDoc, ...quotations]);
    setAddOpen(false);
    resetForm();
    toast.success(`${type} created`);
  };

  const resetForm = () => {
    setRecipientId(""); setItems([emptyItem()]); setGstEnabled(true); setDiscountPercent(0);
    setTerms("50% advance, 50% upon completion. Delivery within 30 days."); setNotes("");
    setType("Quotation");
  };

  const shareViaWhatsApp = (q: QuotationBill) => {
    let phone = "";
    if (q.isClient) {
      phone = clients.find(c => c.id === q.recipientId)?.whatsapp || clients.find(c => c.id === q.recipientId)?.phone || "";
    } else {
      phone = leads.find(l => l.id === q.recipientId)?.phone || "";
    }
    
    const msg = `Hi, please find your ${q.type.toLowerCase()} ${q.number} for ${formatINR(q.total)}. Valid/due until ${formatDateDDMMYYYY(new Date(q.dueDate))}. — CreativeMark`;
    if (phone) window.open(waLink(phone, msg), "_blank");
    else toast.error("No phone number found for this recipient");
  };

  const downloadPDF = (q: QuotationBill) => {
    // Cast appropriately since we've changed the type but PDF generator might need updates later
    generateQuotationPDF(q as any);
    toast.success("PDF downloaded");
  };

  return (
    <div>
      <PageHeader
        title="Quotations & Bills"
        subtitle={`${quotations.length} documents`}
        actions={
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search…" className="pl-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(["Draft", "Sent", "Approved", "Rejected", "Converted", "Paid", "Overdue"] as QuotationBillStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />New Document</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Quotation or Bill</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Document Type *</Label>
                      <Select value={type} onValueChange={(v: "Quotation" | "Bill") => setType(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Quotation">Quotation</SelectItem>
                          <SelectItem value="Bill">Bill / Invoice</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Client / Lead *</Label>
                      <Select value={recipientId} onValueChange={setRecipientId}>
                        <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
                        <SelectContent>{allRecipients.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.type})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Line Items */}
                  <div>
                    <Label className="mb-2 block">Line Items</Label>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5"><Input placeholder="Description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} /></div>
                          <div className="col-span-2"><Input type="number" placeholder="Qty" min={1} value={item.quantity} onChange={(e) => updateItem(i, "quantity", +e.target.value)} /></div>
                          <div className="col-span-2"><Input type="number" placeholder="Rate ₹" value={item.rate} onChange={(e) => updateItem(i, "rate", +e.target.value)} /></div>
                          <div className="col-span-2 text-right font-semibold text-sm pt-2">{formatINR(item.amount)}</div>
                          <div className="col-span-1">
                            {items.length > 1 && <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setItems(items.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></Button>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={() => setItems([...items, emptyItem()])}><Plus className="h-3 w-3" /> Add Item</Button>
                  </div>

                  {/* Settings & Totals */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm font-semibold">Apply GST (18%)</span>
                        <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <span className="text-sm font-semibold">Discount (%)</span>
                        <Input type="number" className="w-20 h-8 text-right" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(+e.target.value)} />
                      </div>
                    </div>
                    <div className="p-4 bg-muted/20 border border-border rounded-lg text-right space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal:</span><span>{formatINR(subtotal)}</span></div>
                      {discountPercent > 0 && <div className="flex justify-between text-green-600"><span>Discount ({discountPercent}%):</span><span>-{formatINR(discountAmount)}</span></div>}
                      {gstEnabled && (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%):</span><span>{formatINR(cgstAmount)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%):</span><span>{formatINR(sgstAmount)}</span></div>
                        </>
                      )}
                      <div className="flex justify-between border-t border-border mt-2 pt-2 text-lg font-bold text-primary">
                        <span>Total:</span><span>{formatINR(total)}</span>
                      </div>
                    </div>
                  </div>

                  <div><Label>Terms & Conditions</Label><Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} /></div>
                  <div><Label>Internal Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Not visible to client" /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={createQuotation}>Create {type}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Recipient</TableHead><TableHead>Date</TableHead>
              <TableHead>Due / Valid</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((q) => (
              <TableRow key={q.id}>
                <TableCell><Badge variant="outline" className="text-[10px]">{q.type}</Badge></TableCell>
                <TableCell className="font-mono font-semibold">{q.number}</TableCell>
                <TableCell className="font-semibold">{q.recipientName} {q.isClient ? "" : <span className="text-[10px] text-muted-foreground ml-1">(Lead)</span>}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{formatDateDDMMYYYY(new Date(q.date))}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{formatDateDDMMYYYY(new Date(q.dueDate))}</TableCell>
                <TableCell className="text-right font-bold">{formatINR(q.total)}</TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] ${STATUS_COLORS[q.status]}`}>{q.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setPreviewQ(q)} title="Preview"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => downloadPDF(q)} title="Download PDF"><Download className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => shareViaWhatsApp(q)} title="WhatsApp"><Send className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No documents found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewQ} onOpenChange={(open) => !open && setPreviewQ(null)}>
        {previewQ && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" /> {previewQ.number} ({previewQ.type})
                <Badge variant="outline" className={`${STATUS_COLORS[previewQ.status]}`}>{previewQ.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">To:</span> <span className="font-semibold">{previewQ.recipientName}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-mono">{formatDateDDMMYYYY(new Date(previewQ.date))}</span></div>
                <div><span className="text-muted-foreground">{previewQ.type === "Bill" ? "Due Date:" : "Valid Until:"}</span> <span className="font-mono">{formatDateDDMMYYYY(new Date(previewQ.dueDate))}</span></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead><TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewQ.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatINR(item.rate)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatINR(previewQ.subtotal)}</span></div>
                  {previewQ.discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount ({previewQ.discountPercent}%)</span><span>-{formatINR(previewQ.discountAmount)}</span></div>}
                  {previewQ.cgstAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">CGST ({previewQ.cgstPercent}%)</span><span>{formatINR(previewQ.cgstAmount)}</span></div>}
                  {previewQ.sgstAmount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">SGST ({previewQ.sgstPercent}%)</span><span>{formatINR(previewQ.sgstAmount)}</span></div>}
                  <div className="flex justify-between border-t border-border pt-1 font-bold text-lg"><span>Total</span><span className="text-primary">{formatINR(previewQ.total)}</span></div>
                </div>
              </div>

              {previewQ.terms && (
                <div className="p-3 bg-muted/30 rounded-lg text-xs">
                  <div className="font-semibold mb-1">Terms & Conditions</div>
                  {previewQ.terms}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => downloadPDF(previewQ)}><Download className="h-4 w-4" /> Download PDF</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => shareViaWhatsApp(previewQ)}><Send className="h-4 w-4" /> Share via WhatsApp</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Quotations;
