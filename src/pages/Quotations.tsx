import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Plus, FileText, Download, Send, Eye, Search, Trash2, CheckCircle, XCircle, CreditCard } from "lucide-react";
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
import { SERVICE_PRESETS, DEFAULT_TERMS_QUOTATION, DEFAULT_TERMS_BILL } from "@/data/quotations";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { generateQuotationPDF } from "@/lib/pdf";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Masked } from "@/components/Masked";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";
import type { QuotationBillStatus, LineItem } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600 border-gray-200",
  Sent: "bg-blue-100 text-blue-700 border-blue-200",
  Approved: "bg-green-100 text-green-700 border-green-200",
  Rejected: "bg-red-100 text-red-700 border-red-200",
  "Converted to Bill": "bg-emerald-100 text-emerald-700 border-emerald-200",
  Paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Overdue: "bg-red-100 text-red-700 border-red-200",
};

const emptyItem = (): LineItem => ({ id: crypto.randomUUID(), serviceName: "", description: "", quantity: 1, rate: 0, amount: 0 });

const Quotations = () => {
  const location = useLocation();
  const { isShielded, withShield } = usePrivacyShield();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [previewQ, setPreviewQ] = useState<any | null>(null);

  // Builder state — GST defaults to OFF per user request
  const [type, setType] = useState<"Quotation" | "Bill">("Quotation");
  const [recipientId, setRecipientId] = useState("");
  const [recipientType, setRecipientType] = useState<"Client" | "Lead">("Client");
  const [customRecipientName, setCustomRecipientName] = useState("");
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [gstEnabled, setGstEnabled] = useState(false); // DEFAULT OFF
  const [discountPercent, setDiscountPercent] = useState(0);
  const [terms, setTerms] = useState(DEFAULT_TERMS_QUOTATION);
  const [notes, setNotes] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [upiId, setUpiId] = useState("");

  // Update terms when type changes if they are still the default
  useEffect(() => {
    if (terms === DEFAULT_TERMS_QUOTATION && type === "Bill") {
      setTerms(DEFAULT_TERMS_BILL);
    } else if (terms === DEFAULT_TERMS_BILL && type === "Quotation") {
      setTerms(DEFAULT_TERMS_QUOTATION);
    }
  }, [type, terms]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [qRes, cRes, lRes] = await Promise.all([
        supabase.from("quotations").select("*, quotation_items(*)").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, name, phone, whatsapp, email"),
        supabase.from("leads").select("id, name, organization, phone, whatsapp, email"),
      ]);
      setQuotations(qRes.data || []);
      setAllClients(cRes.data || []);
      setAllLeads(lRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  // Must be defined BEFORE the useEffect that references it
  const allRecipients = useMemo(() => [
    ...allClients.map(c => ({ id: c.id, name: c.name, type: "Client" as const, phone: c.whatsapp || c.phone || "" })),
    ...allLeads.map(l => ({ id: l.id, name: `${l.name}${l.organization ? ` (${l.organization})` : ""}`, type: "Lead" as const, phone: l.whatsapp || l.phone || "" })),
  ], [allClients, allLeads]);

  // Handle incoming state from Leads page
  useEffect(() => {
    if (location.state && allRecipients.length > 0) {
      const { leadId, services, leadName } = location.state;
      setRecipientId(leadId);
      setRecipientType("Lead");
      setCustomRecipientName(leadName || "");
      setAddOpen(true);
      
      if (services && Array.isArray(services) && services.length > 0) {
        setItems(services.map(s => ({
          id: crypto.randomUUID(),
          serviceName: s,
          description: s,
          quantity: 1,
          rate: 0,
          amount: 0
        })));
      }
      
      // Clear state so it doesn't re-open on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, allRecipients]);

  // Update custom name when recipient changes (but only if not in edit mode or explicitly changed)
  useEffect(() => {
    if (!editingQ && recipientId) {
      const recipient = allRecipients.find(r => r.id === recipientId);
      if (recipient) setCustomRecipientName(recipient.name);
    }
  }, [recipientId, allRecipients, editingQ]);

  const filtered = useMemo(() =>
    quotations.filter(q =>
      (statusFilter === "all" || q.status === statusFilter) &&
      (search === "" || (q.client_name || "").toLowerCase().includes(search.toLowerCase()) || (q.quote_number || "").toLowerCase().includes(search.toLowerCase()))
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

  const createQuotation = async () => {
    const recipient = allRecipients.find(r => r.id === recipientId);
    if (!recipient || items.every(i => !i.serviceName && !i.description)) { toast.error("Select recipient and add items"); return; }

    const prefix = type === "Quotation" ? "QT" : "BL";
    const status: QuotationBillStatus = type === "Quotation" ? "Draft" : "Sent";
    const quoteNumber = editingQ ? editingQ.quote_number : `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const isClient = recipient.type === "Client";

    const payload = {
      quote_number: quoteNumber,
      type,
      status: editingQ ? editingQ.status : status,
      date: editingQ ? editingQ.date : new Date().toISOString().slice(0, 10),
      valid_until: type === "Quotation" ? (editingQ?.valid_until || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10)) : null,
      due_date: type === "Bill" ? (editingQ?.due_date || new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10)) : null,
      client_id: isClient ? recipientId : null,
      lead_id: !isClient ? recipientId : null,
      client_name: customRecipientName || recipient.name,
      client_phone: recipient.phone,
      subtotal,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      discount_type: "percent",
      gst_applicable: gstEnabled,
      gst_rate: gstEnabled ? 18 : 0,
      cgst: cgstAmount,
      sgst: sgstAmount,
      gst_amount: cgstAmount + sgstAmount,
      grand_total: total,
      terms,
      internal_notes: notes,
      bank_details: bankDetails,
      upi_id: upiId,
    };

    let insertedId = editingQ?.id;

    if (editingQ) {
      const { error } = await supabase.from("quotations").update(payload).eq("id", editingQ.id);
      if (error) { toast.error("Failed to update: " + error.message); return; }
      
      // Delete old items and insert new ones
      await supabase.from("quotation_items").delete().eq("quotation_id", editingQ.id);
    } else {
      const { data: inserted, error } = await supabase.from("quotations").insert(payload).select().single();
      if (error) { toast.error("Failed to create: " + error.message); return; }
      insertedId = inserted.id;
    }

    // Insert line items
    const validItems = items.filter(i => i.serviceName || i.description);
    if (validItems.length > 0 && insertedId) {
      await supabase.from("quotation_items").insert(
        validItems.map(item => ({
          quotation_id: insertedId,
          service_name: item.serviceName || item.description || "",
          description: item.description || item.serviceName || "",
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }))
      );

      // Data Sync: Update lead status
      if (recipient.type === "Lead") {
        if (type === "Quotation" && status === "Sent") {
          await supabase.from("leads").update({ quotation_status: "Sent" }).eq("id", recipientId);
        } else if (type === "Bill") {
          await supabase.from("leads").update({ 
            lifecycle_stage: "Converted", 
            payment_status: "Pending",
            payment_due_date: payload.due_date
          }).eq("id", recipientId);
        }
      }
    }

    // Refresh data
    const { data: refreshed } = await supabase.from("quotations").select("*, quotation_items(*)").order("created_at", { ascending: false });
    setQuotations(refreshed || []);
    setAddOpen(false);
    
    // Immediate share action
    toast.success(`${type} ${editingQ ? 'updated' : 'created'} — ${quoteNumber}`, {
      action: {
        label: "Share via WhatsApp",
        onClick: () => {
          const msg = type === "Bill" 
            ? WHATSAPP_TEMPLATES.BILL_SENT(recipient.name, quoteNumber, formatINR(total))
            : WHATSAPP_TEMPLATES.LEAD_QUOTE_SENT(recipient.name, formatINR(total));
          window.open(waLink(recipient.phone, msg), "_blank");
        }
      }
    });
    
    resetForm();
  };

  const resetForm = () => {
    setEditingQ(null);
    setRecipientId(""); 
    setCustomRecipientName("");
    setItems([emptyItem()]); 
    setGstEnabled(false); 
    setDiscountPercent(0);
    setTerms(type === "Bill" ? DEFAULT_TERMS_BILL : DEFAULT_TERMS_QUOTATION); 
    setNotes("");
    setBankDetails("");
    setUpiId("");
  };

  const handleEdit = (q: any) => {
    withShield(() => {
    setEditingQ(q);
    setType(q.type);
    setRecipientId(q.client_id || q.lead_id || "");
    setRecipientType(q.client_id ? "Client" : "Lead");
    setCustomRecipientName(q.client_name || "");
    setItems(q.quotation_items.map((i: any) => ({
      id: i.id,
      serviceName: i.service_name,
      description: i.description,
      quantity: i.quantity,
      rate: i.rate,
      amount: i.amount
    })));
    setGstEnabled(q.gst_applicable);
    setDiscountPercent(q.discount_percent);
    setTerms(q.terms || "");
    setNotes(q.internal_notes || "");
    setBankDetails(q.bank_details || "");
    setUpiId(q.upi_id || "");
    setAddOpen(true);
    });
  };

  const shareViaWhatsApp = (q: any) => {
    const phone = q.client_phone || "";
    let msg = "";
    
    if (q.type === "Bill") {
      msg = WHATSAPP_TEMPLATES.BILL_SENT(q.client_name, q.quote_number, formatINR(q.grand_total || 0));
    } else {
      msg = WHATSAPP_TEMPLATES.LEAD_QUOTE_SENT(q.client_name, formatINR(q.grand_total || 0));
    }

    if (phone) window.open(waLink(phone, msg), "_blank");
    else toast.error("No phone number found for this recipient");
  };

  const downloadPDF = async (q: any) => {
    // Map Supabase shape to PDF generator expected shape
    const pdfData = {
      ...q,
      quoteNumber: q.quote_number,
      clientName: q.client_name,
      clientPhone: q.client_phone,
      clientEmail: q.client_email,
      items: (q.quotation_items || []).map((i: any) => ({
        description: i.description || i.service_name,
        serviceName: i.service_name,
        quantity: i.quantity,
        rate: i.rate,
        amount: i.amount,
      })),
      grandTotal: q.grand_total,
      gstApplicable: q.gst_applicable,
      gstRate: q.gst_rate,
      cgstAmount: q.cgst,
      sgstAmount: q.sgst,
      discountPercent: q.discount_percent,
      discountAmount: q.discount_amount,
      bankDetails: q.bank_details,
      upiId: q.upi_id,
      amountPaid: q.amount_paid || 0,
    };
    await generateQuotationPDF(pdfData as any);
    toast.success("PDF downloaded");
  };

  const updateStatus = async (q: any, newStatus: string) => {
    const { error } = await supabase.from("quotations").update({ status: newStatus }).eq("id", q.id);
    if (error) { toast.error("Failed: " + error.message); return; }
    setQuotations(prev => prev.map(x => x.id === q.id ? { ...x, status: newStatus } : x));
    toast.success(`Status updated to ${newStatus}`, {
      action: newStatus === "Paid" ? {
        label: "Send Receipt",
        onClick: () => {
          const msg = WHATSAPP_TEMPLATES.PAYMENT_RECEIVED(q.client_name, q.quote_number, formatINR(q.grand_total || 0));
          window.open(waLink(q.client_phone, msg), "_blank");
        }
      } : undefined
    });
    
    // Sync lead status
    if (q.lead_id) {
      if (newStatus === "Approved") {
        await supabase.from("leads").update({ 
          quotation_status: "Accepted",
          stage: "Negotiation" // Move to negotiation once quote is approved
        }).eq("id", q.lead_id);
      } else if (newStatus === "Sent") {
        await supabase.from("leads").update({ 
          quotation_status: "Sent",
          stage: "Quotation Sent"
        }).eq("id", q.lead_id);
      } else if (newStatus === "Rejected") {
        await supabase.from("leads").update({ 
          quotation_status: "Rejected",
          stage: "Lost" 
        }).eq("id", q.lead_id);
      } else if (newStatus === "Paid") {
        await supabase.from("leads").update({ 
          payment_status: "Paid",
          stage: "Converted"
        }).eq("id", q.lead_id);
      }
    }
  };

  const convertToBill = async (q: any) => {
    const quoteNumber = `BL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

    // Update quotation directly
    const { error } = await supabase.from("quotations").update({
      type: "Bill",
      status: "Sent",
      quote_number: quoteNumber,
      due_date: dueDate,
      date: new Date().toISOString().slice(0, 10),
    }).eq("id", q.id);

    if (error) { toast.error("Conversion failed: " + error.message); return; }

    // Sync lead lifecycle if linked
    if (q.lead_id) {
      await supabase.from("leads").update({
        lifecycle_stage: "Bill Raised",
        quotation_status: "Converted to Bill",
        bill_id: q.id,
        stage: "Converted",
      }).eq("id", q.lead_id);
    }

    setQuotations(prev => prev.map(x => x.id === q.id ? { ...x, type: "Bill", status: "Sent", quote_number: quoteNumber, due_date: dueDate } : x));
    toast.success("Converted to Bill successfully");
  };

  const deleteQuotation = async (q: any) => {
    withShield(async () => {
      if (!confirm(`Are you sure you want to delete ${q.type} ${q.quote_number}?`)) return;
      const { error } = await supabase.from("quotations").delete().eq("id", q.id);
      if (error) { toast.error("Failed to delete: " + error.message); return; }
      setQuotations(prev => prev.filter(x => x.id !== q.id));
      toast.success(`${q.type} deleted`);
    });
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Quotations & Bills" subtitle="Loading…" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

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
                {(["Draft", "Sent", "Approved", "Rejected", "Converted to Bill", "Paid", "Overdue"] as QuotationBillStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />New Document</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingQ ? `Edit ${editingQ.type}` : `Create Quotation or Bill`}</DialogTitle></DialogHeader>
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

                  <div>
                    <Label>Recipient Name on Document</Label>
                    <Input 
                      value={customRecipientName} 
                      onChange={(e) => setCustomRecipientName(e.target.value)} 
                      placeholder="Enter name as it should appear on PDF"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">This allows you to customize the name without changing the client record.</p>
                  </div>

                  {/* Service Presets */}
                  <div>
                    <Label className="mb-1 block text-xs text-muted-foreground">Quick Add Service</Label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {SERVICE_PRESETS.map(preset => (
                        <Button key={preset.serviceName} variant="outline" size="sm" className="text-[11px] h-7"
                          onClick={() => setItems([...items.filter(i => i.serviceName || i.description), { id: crypto.randomUUID(), serviceName: preset.serviceName, description: preset.serviceName, quantity: 1, rate: preset.rate, amount: preset.rate }])}
                        >{preset.serviceName} — {formatINR(preset.rate)}</Button>
                      ))}
                    </div>
                  </div>

                  {/* Line Items */}
                  <div>
                    <Label className="mb-2 block">Line Items</Label>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-end">
                          <div className="col-span-5"><Input placeholder="Description" value={item.serviceName || item.description} onChange={(e) => { updateItem(i, "serviceName", e.target.value); updateItem(i, "description", e.target.value); }} /></div>
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

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label>Terms & Conditions</Label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[10px] text-primary"
                        onClick={() => setTerms(type === "Bill" ? DEFAULT_TERMS_BILL : DEFAULT_TERMS_QUOTATION)}
                      >
                        Reset to Defaults
                      </Button>
                    </div>
                    <Textarea 
                      value={terms} 
                      onChange={(e) => setTerms(e.target.value)} 
                      rows={5} 
                      className="text-xs leading-relaxed"
                      placeholder="Enter professional terms and conditions..."
                    />
                  </div>
                  <div>
                    <Label>Internal Notes</Label>
                    <Textarea 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      rows={2} 
                      placeholder="Not visible to client (e.g., project details, internal deadlines)" 
                      className="text-xs"
                    />
                  </div>
                  
                  {type === "Bill" && (
                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                      <div className="col-span-2">
                        <Label className="text-primary font-semibold">Bank Details for Payment (Optional)</Label>
                        <p className="text-[10px] text-muted-foreground mb-2">If left blank, empty placeholders will be shown for the client to fill or you to write.</p>
                      </div>
                      <div>
                        <Label>Bank Account Details</Label>
                        <Textarea 
                          value={bankDetails} 
                          onChange={(e) => setBankDetails(e.target.value)} 
                          rows={3} 
                          placeholder="Bank Name: HDFC Bank&#10;A/C Name: CreativeMark&#10;A/C No: 1234567890&#10;IFSC: HDFC0001234" 
                          className="text-xs font-mono"
                        />
                      </div>
                      <div>
                        <Label>UPI ID</Label>
                        <Input 
                          value={upiId} 
                          onChange={(e) => setUpiId(e.target.value)} 
                          placeholder="creativemark@upi" 
                          className="text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setAddOpen(false); resetForm(); }}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={createQuotation}>
                    {editingQ ? `Update ${type}` : `Create ${type}`}
                  </Button>
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
              <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((q) => (
              <TableRow key={q.id}>
                <TableCell><Badge variant="outline" className="text-[10px]">{q.type}</Badge></TableCell>
                <TableCell className="font-mono font-semibold">{q.quote_number}</TableCell>
                <TableCell className="font-semibold"><Masked>{q.client_name}</Masked> {q.lead_id ? <span className="text-[10px] text-muted-foreground ml-1">(Lead)</span> : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{q.date ? formatDateDDMMYYYY(new Date(q.date)) : ""}</TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">{(q.due_date || q.valid_until) ? formatDateDDMMYYYY(new Date(q.due_date || q.valid_until)) : "—"}</TableCell>
                <TableCell className="text-right font-bold"><Masked placeholder="₹•••••">{formatINR(q.grand_total || 0)}</Masked></TableCell>
                <TableCell className="text-right text-green-600 font-semibold text-sm"><Masked placeholder="₹•••••">{q.type === "Bill" && (q.amount_paid || 0) > 0 ? formatINR(q.amount_paid) : "—"}</Masked></TableCell>
                <TableCell className={`text-right font-bold text-sm ${q.type === "Bill" && (q.grand_total || 0) - (q.amount_paid || 0) > 0 ? "text-primary" : ""}`}><Masked placeholder="₹•••••">{q.type === "Bill" ? formatINR((q.grand_total || 0) - (q.amount_paid || 0)) : "—"}</Masked></TableCell>
                <TableCell>
                  <Select value={q.status} onValueChange={(v) => updateStatus(q, v)}>
                    <SelectTrigger className="h-7 w-auto border-0 p-0">
                      <Badge variant="outline" className={`text-[11px] cursor-pointer ${STATUS_COLORS[q.status] || ""}`}>{q.status}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {(["Draft", "Sent", "Approved", "Rejected", "Converted to Bill", "Paid", "Overdue"] as string[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {q.type === "Quotation" && q.status === "Sent" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-green-600 hover:bg-green-50" onClick={() => updateStatus(q, "Approved")}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:bg-red-50" onClick={() => updateStatus(q, "Rejected")}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {q.status === "Approved" && q.type === "Quotation" && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-600 hover:bg-emerald-50" onClick={() => convertToBill(q)} title="Convert to Bill">
                          <CreditCard className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setPreviewQ(q)} title="Preview"><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => handleEdit(q)} title="Edit"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => downloadPDF(q)} title="Download"><Download className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-green-600" onClick={() => shareViaWhatsApp(q)} title="WhatsApp"><Send className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2 text-red-600 hover:bg-red-50" onClick={() => deleteQuotation(q)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
               <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No documents found — create your first quotation</TableCell></TableRow>
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
                <FileText className="h-5 w-5 text-primary" /> {previewQ.quote_number} ({previewQ.type})
                <Badge variant="outline" className={`${STATUS_COLORS[previewQ.status]}`}>{previewQ.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">To:</span> <span className="font-semibold"><Masked>{previewQ.client_name}</Masked></span></div>
                <div><span className="text-muted-foreground">Date:</span> <span className="font-mono">{previewQ.date ? formatDateDDMMYYYY(new Date(previewQ.date)) : ""}</span></div>
                <div><span className="text-muted-foreground">{previewQ.type === "Bill" ? "Due Date:" : "Valid Until:"}</span> <span className="font-mono">{(previewQ.due_date || previewQ.valid_until) ? formatDateDDMMYYYY(new Date(previewQ.due_date || previewQ.valid_until)) : "—"}</span></div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead><TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(previewQ.quotation_items || []).map((item: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{item.description || item.service_name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right"><Masked placeholder="₹•••">{formatINR(item.rate)}</Masked></TableCell>
                      <TableCell className="text-right font-semibold"><Masked placeholder="₹•••">{formatINR(item.amount)}</Masked></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><Masked placeholder="₹•••••"><span>{formatINR(previewQ.subtotal || 0)}</span></Masked></div>
                  {(previewQ.discount_amount || 0) > 0 && <div className="flex justify-between text-green-600"><span>Discount ({previewQ.discount_percent}%)</span><Masked placeholder="-₹•••"><span>-{formatINR(previewQ.discount_amount)}</span></Masked></div>}
                  {previewQ.gst_applicable && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">CGST (9%)</span><Masked placeholder="₹•••"><span>{formatINR(previewQ.cgst || 0)}</span></Masked></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">SGST (9%)</span><Masked placeholder="₹•••"><span>{formatINR(previewQ.sgst || 0)}</span></Masked></div>
                    </>
                  )}
                  <div className="flex justify-between border-t border-border mt-2 pt-2 text-lg font-bold text-primary"><span>Total</span><Masked placeholder="₹•••••"><span>{formatINR(previewQ.grand_total || 0)}</span></Masked></div>
                  {previewQ.type === "Bill" && (previewQ.amount_paid || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-green-600 mt-1"><span>Amount Received</span><Masked placeholder="₹•••••"><span>{formatINR(previewQ.amount_paid)}</span></Masked></div>
                      <div className="flex justify-between border-t border-border pt-1 mt-1 font-bold text-lg">
                        <span>Balance Due</span>
                        <span className={(previewQ.grand_total || 0) - (previewQ.amount_paid || 0) > 0 ? "text-primary" : "text-green-600"}>
                          <Masked placeholder="₹•••••">{(previewQ.grand_total || 0) - (previewQ.amount_paid || 0) <= 0 ? "PAID IN FULL" : formatINR((previewQ.grand_total || 0) - (previewQ.amount_paid || 0))}</Masked>
                        </span>
                      </div>
                    </>
                  )}
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
              {previewQ.type === "Quotation" && previewQ.status === "Approved" && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => convertToBill(previewQ)}>
                  <FileText className="h-4 w-4 mr-1" /> Convert to Bill
                </Button>
              )}
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
