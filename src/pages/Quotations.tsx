import { useState, useMemo, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Plus, FileText, Download, Send, Eye, Search, Trash2, CheckCircle, XCircle, CreditCard, Wallet, Briefcase, UserCheck, Users, DollarSign } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { ConfirmEditDialog } from "@/components/ConfirmEditDialog";
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
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editingQ, setEditingQ] = useState<any | null>(null);
  const [previewQ, setPreviewQ] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [editGateTarget, setEditGateTarget] = useState<any | null>(null);

  // Payment recording from Bills tab
  const [payBillOpen, setPayBillOpen] = useState(false);
  const [payBillTarget, setPayBillTarget] = useState<any | null>(null);
  const [billPayForm, setBillPayForm] = useState({ amount: 0, date: "", paymentMode: "UPI", chequeNo: "", transactionId: "", notes: "", receivedByName: "" });

  // Bill distribution dialog
  const [distBillOpen, setDistBillOpen] = useState(false);
  const [distBillTarget, setDistBillTarget] = useState<any | null>(null);
  const [distExpenses, setDistExpenses] = useState<Array<{ id: string; title: string; amount: string; category: string }>>([]);
  const [distShares, setDistShares] = useState<Array<{ id: string; employee_id: string; employee_name: string; job_role: string; amount: string }>>([]);
  const [distSaving, setDistSaving] = useState(false);

  // Builder state — GST defaults to OFF per user request
  const [type, setType] = useState<"Quotation" | "Bill">("Quotation");
  const [recipientId, setRecipientId] = useState("");
  const [recipientType, setRecipientType] = useState<"Client" | "Lead">("Client");
  const [customRecipientName, setCustomRecipientName] = useState("");
  const [projectId, setProjectId] = useState<string>("");
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
      const [qRes, cRes, lRes, pRes, eRes] = await Promise.all([
        supabase.from("quotations").select("*, quotation_items(*)").order("created_at", { ascending: false }),
        supabase.from("clients").select("id, name, phone, whatsapp, email"),
        supabase.from("leads").select("id, name, organization, phone, whatsapp, email"),
        supabase.from("projects").select("id, title, status, client_id").order("created_at", { ascending: false }),
        supabase.from("employees").select("id, name").order("name"),
      ]);
      setQuotations(qRes.data || []);
      setAllClients(cRes.data || []);
      setAllLeads(lRes.data || []);
      setAllProjects(pRes.data || []);
      setAllEmployees(eRes.data || []);
      if (pRes.error) console.warn("[Quotations] projects fetch error:", pRes.error.message);
      if (eRes.error) console.warn("[Quotations] employees fetch error:", eRes.error.message);
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

    const payload: any = {
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
      project_id: projectId || null,
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
    setProjectId("");
    setItems([emptyItem()]); 
    setGstEnabled(false); 
    setDiscountPercent(0);
    setTerms(type === "Bill" ? DEFAULT_TERMS_BILL : DEFAULT_TERMS_QUOTATION); 
    setNotes("");
    setBankDetails("");
    setUpiId("");
  };

  // Request an edit — shows confirmation gate first
  const handleEdit = (q: any) => {
    setEditGateTarget(q);
  };

  // Only called after user types EDIT in the gate dialog
  const openEditForm = (q: any) => {
    withShield(() => {
    setEditingQ(q);
    setType(q.type);
    setRecipientId(q.client_id || q.lead_id || "");
    setRecipientType(q.client_id ? "Client" : "Lead");
    setCustomRecipientName(q.client_name || "");
    setProjectId(q.project_id || "");
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

  const shareViaWhatsApp = async (q: any) => {
    const phone = q.client_phone || "";
    if (!phone) { toast.error("No phone number found for this recipient"); return; }

    // First download the PDF so user has it ready to attach
    toast.info("Downloading PDF first…");
    await downloadPDF(q);

    // Then open WhatsApp with the message
    let msg = "";
    if (q.type === "Bill") {
      msg = WHATSAPP_TEMPLATES.BILL_SENT(q.client_name, q.quote_number, formatINR(q.grand_total || 0));
    } else {
      msg = WHATSAPP_TEMPLATES.LEAD_QUOTE_SENT(q.client_name, formatINR(q.grand_total || 0));
    }

    // Small delay to let PDF download complete
    setTimeout(() => {
      window.open(waLink(phone, msg), "_blank");
    }, 800);
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
    try {
      await generateQuotationPDF(pdfData as any);
      toast.success("PDF ready");
    } catch (err: any) {
      toast.error(err?.message || "Could not save PDF");
    }
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
      setDeleteTarget(q);
    });
  };

  const executeDeleteQuotation = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from("quotations").delete().eq("id", deleteTarget.id);
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    setQuotations(prev => prev.filter(x => x.id !== deleteTarget.id));
    toast.success(`${deleteTarget.type} deleted`);
    setDeleteTarget(null);
  };

  // ── Record payment against a bill ──
  const openPayBill = (q: any) => {
    setPayBillTarget(q);
    setBillPayForm({
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      paymentMode: "UPI",
      chequeNo: "",
      transactionId: "",
      notes: "",
      receivedByName: user?.name || "",
    });
    setPayBillOpen(true);
  };

  const openDistributeBill = (q: any) => {
    setDistBillTarget(q);
    setDistExpenses([]);
    const initialShare = { id: crypto.randomUUID(), employee_id: "", employee_name: q.received_by_name || "", job_role: "Salesperson", amount: "" };
    setDistShares([initialShare]);
    setDistBillOpen(true);
  };

  const handleSaveDistribution = async () => {
    if (!distBillTarget) return;
    setDistSaving(true);
    try {
      const amountReceived = Number(distBillTarget.amount_paid || 0);
      const totalExpenses = distExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const netAmount = amountReceived - totalExpenses;
      const totalShares = distShares.reduce((s, sh) => s + (Number(sh.amount) || 0), 0);
      if (totalShares > netAmount + 0.01) {
        toast.error(`Total shares (${formatINR(totalShares)}) exceed net distributable (${formatINR(netAmount)}). Adjust shares or reduce expenses.`);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);

      // 1. Save each employee share as a project_sale_distribution + work_log
      for (const sh of distShares) {
        if (!sh.employee_name.trim() || !(Number(sh.amount) > 0)) continue;
        const emp = allEmployees.find(e => e.name === sh.employee_name || e.id === sh.employee_id);

        if (distBillTarget.project_id) {
          await supabase.from("project_sale_distributions").insert({
            project_id: distBillTarget.project_id,
            bill_id: distBillTarget.id,
            employee_id: emp?.id || null,
            employee_name: sh.employee_name,
            job_role: sh.job_role,
            allotted_amount: Number(sh.amount),
            status: "Pending",
            notes: `Bill ${distBillTarget.quote_number} distribution`,
          });
        }

        if (emp?.id) {
          await supabase.from("work_logs").insert({
            employee_id: emp.id,
            date: today,
            client_id: distBillTarget.client_id || null,
            work_type: "Sale Distribution",
            location: "Office",
            hours: 0,
            amount: Number(sh.amount),
            notes: `Distribution for bill ${distBillTarget.quote_number} — ${sh.job_role}`,
          });
        }
      }

      // 2. Save expenses as work_log entries tagged to receiver (so they appear in employee costs)
      for (const ex of distExpenses) {
        if (!ex.title.trim() || !(Number(ex.amount) > 0)) continue;
        const receiverEmp = allEmployees.find(e => e.name === distBillTarget.received_by_name);
        if (receiverEmp) {
          await supabase.from("work_logs").insert({
            employee_id: receiverEmp.id,
            date: today,
            client_id: distBillTarget.client_id || null,
            work_type: `Expense — ${ex.category || "Other"}`,
            location: "Expense",
            hours: 0,
            amount: -(Number(ex.amount)),
            notes: `${ex.title} (expense for bill ${distBillTarget.quote_number})`,
          });
        }
      }

      toast.success("Distribution saved and work logs updated!");
      setDistBillOpen(false);
      setDistBillTarget(null);
      setDistExpenses([]);
      setDistShares([]);
    } catch (err: any) {
      toast.error("Save failed: " + (err.message || "unknown error"));
    } finally {
      setDistSaving(false);
    }
  };

  const handleRecordBillPayment = async () => {
    if (!payBillTarget || !billPayForm.amount || !billPayForm.date) { toast.error("Amount and date required"); return; }
    if (!billPayForm.receivedByName.trim()) { toast.error("Please enter who received the payment"); return; }

    const billTotal = payBillTarget.grand_total || payBillTarget.total_amount || 0;
    const currentPaid = payBillTarget.amount_paid || 0;
    const newPaid = currentPaid + Number(billPayForm.amount);
    const newStatus = newPaid >= billTotal ? "Paid" : "Partial";

    // 1. Update quotation's amount_paid, status, and received-by tracking
    const { error: qErr } = await supabase.from("quotations").update({
      amount_paid: newPaid,
      status: newStatus,
      received_by_id: user?.id || null,
      received_by_name: billPayForm.receivedByName.trim(),
      received_at: new Date().toISOString(),
    }).eq("id", payBillTarget.id);
    if (qErr) { toast.error("Failed to update bill: " + qErr.message); return; }

    // Auto-create a work log for the receiving employee so their earnings are tracked
    const receiverEmp = allEmployees.find(e => e.name === billPayForm.receivedByName.trim());
    if (receiverEmp) {
      await supabase.from("work_logs").insert({
        employee_id: receiverEmp.id,
        date: billPayForm.date,
        client_id: payBillTarget.client_id || null,
        work_type: "Payment Collection",
        location: "Field",
        hours: 0,
        amount: Number(billPayForm.amount),
        notes: `Collected payment for bill ${payBillTarget.quote_number}`,
      });
    }

    // 2. Insert into payment_history so ClientDetail stays in sync
    if (payBillTarget.client_id) {
      await supabase.from("payment_history").insert({
        client_id: payBillTarget.client_id,
        invoice_no: payBillTarget.quote_number || "",
        date: billPayForm.date,
        amount: Number(billPayForm.amount),
        status: "Paid",
        payment_mode: billPayForm.paymentMode,
        cheque_no: billPayForm.chequeNo || null,
        transaction_id: billPayForm.transactionId || null,
        notes: billPayForm.notes || `Payment against ${payBillTarget.quote_number}`,
        received_by_id: user?.id || null,
        received_by_name: billPayForm.receivedByName.trim(),
      });

      // 3. Recalculate client outstanding from all bills
      const { data: allClientBills } = await supabase
        .from("quotations")
        .select("grand_total, total_amount, is_bill, type, quotation_number, quote_number")
        .eq("client_id", payBillTarget.client_id);
      const { data: allClientPayments } = await supabase
        .from("payment_history")
        .select("amount")
        .eq("client_id", payBillTarget.client_id);

      const invoices = (allClientBills || []).filter((b: any) => b.is_bill || b.type === "Bill" || (b.quotation_number || b.quote_number || "").startsWith("BL-"));
      const totalBilled = invoices.reduce((s: number, b: any) => s + (b.grand_total || b.total_amount || 0), 0);
      const totalPaid = (allClientPayments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const outstanding = Math.max(0, totalBilled - totalPaid);

      await supabase.from("clients").update({
        outstanding,
        payment_status: outstanding <= 0 ? "Paid" : "Overdue",
      }).eq("id", payBillTarget.client_id);
    }

    // 4. Refresh local quotation state
    setQuotations(prev => prev.map(x => x.id === payBillTarget.id ? {
      ...x,
      amount_paid: newPaid,
      status: newStatus,
      received_by_id: user?.id || null,
      received_by_name: billPayForm.receivedByName.trim(),
      received_at: new Date().toISOString(),
    } : x));

    toast.success(`₹${billPayForm.amount} recorded against ${payBillTarget.quote_number} by ${billPayForm.receivedByName}`);
    setPayBillOpen(false);
    setPayBillTarget(null);
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

                  {/* Project link — makes the bill reflect inside the Project's Sales tab */}
                  <div>
                    <Label className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                      Link to Project {type === "Bill" && <span className="text-[10px] text-muted-foreground">(recommended for bills)</span>}
                    </Label>
                    {(() => {
                      const filteredProjects = recipientId && recipientType === "Client"
                        ? allProjects.filter(p => p.client_id === recipientId)
                        : allProjects;
                      if (allProjects.length === 0) {
                        return <p className="text-[11px] text-amber-700 mt-1">No projects found in your CRM yet — create one in the Projects section first.</p>;
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="No project (standalone)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No project (standalone)</SelectItem>
                              {filteredProjects.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.title} {p.status ? <span className="text-[10px] text-muted-foreground ml-1">· {p.status}</span> : null}
                                </SelectItem>
                              ))}
                              {filteredProjects.length === 0 && allProjects.length > 0 && (
                                <SelectItem value="__all__" disabled>No projects for this client — pick from all:</SelectItem>
                              )}
                              {filteredProjects.length === 0 && allProjects.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {projectId && (
                            <Button variant="ghost" size="sm" className="h-9" onClick={() => setProjectId("")} title="Clear project link">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })()}
                    <p className="text-[10px] text-muted-foreground mt-1">Linked bills appear inside the Project &gt; Sales tab and count toward project sales totals.</p>
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
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Recipient</TableHead><TableHead>Date</TableHead>
              <TableHead>Due / Valid</TableHead><TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead>
              <TableHead>Received By</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
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
                <TableCell className="text-sm">
                  {q.received_by_name ? (
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-green-600" />
                      <span className="font-medium">{q.received_by_name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
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
                      {q.type === "Bill" && q.status !== "Paid" && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-amber-600 hover:bg-amber-50" onClick={() => openPayBill(q)} title="Record Payment">
                          <Wallet className="h-4 w-4" />
                        </Button>
                      )}
                      {q.type === "Bill" && (q.amount_paid || 0) > 0 && (
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-purple-600 hover:bg-purple-50" onClick={() => openDistributeBill(q)} title="Distribute Payment">
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
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
               <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No documents found — create your first quotation</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        </div>
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

              <div className="overflow-x-auto">
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
              </div>

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

      {/* Record Payment Dialog */}
      <Dialog open={payBillOpen} onOpenChange={(open) => { if (!open) { setPayBillOpen(false); setPayBillTarget(null); } }}>
        {payBillTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-amber-600" />
                Record Payment — {payBillTarget.quote_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Bill Total:</span><span className="font-bold">{formatINR(payBillTarget.grand_total || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Already Paid:</span><span className="text-green-600 font-semibold">{formatINR(payBillTarget.amount_paid || 0)}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Balance Due:</span><span className="font-bold text-primary">{formatINR((payBillTarget.grand_total || 0) - (payBillTarget.amount_paid || 0))}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount (₹) *</Label><Input type="number" value={billPayForm.amount || ""} onChange={e => setBillPayForm(f => ({ ...f, amount: Number(e.target.value) }))} placeholder="Enter amount" /></div>
                <div><Label>Date *</Label><Input type="date" value={billPayForm.date} onChange={e => setBillPayForm(f => ({ ...f, date: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={billPayForm.paymentMode} onValueChange={v => setBillPayForm(f => ({ ...f, paymentMode: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["UPI", "Cash", "Bank Transfer", "Cheque", "Other"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {billPayForm.paymentMode === "Cheque" && (
                <div><Label>Cheque Number</Label><Input value={billPayForm.chequeNo} onChange={e => setBillPayForm(f => ({ ...f, chequeNo: e.target.value }))} /></div>
              )}
              {billPayForm.paymentMode !== "Cash" && billPayForm.paymentMode !== "Cheque" && (
                <div><Label>Transaction ID / Ref</Label><Input value={billPayForm.transactionId} onChange={e => setBillPayForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="UTR / Ref number" /></div>
              )}
              <div><Label>Notes</Label><Input value={billPayForm.notes} onChange={e => setBillPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" /></div>

              {/* Received By — full employee dropdown + custom option.
                  This name drives the Cash in Hand / Cash Custody log that tracks
                  who is currently holding this payment until it's distributed. */}
              <div className="border-t pt-3 space-y-2">
                <Label className="flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-green-600" />
                  Received By *
                </Label>
                <Select
                  value={
                    billPayForm.receivedByName === ""
                      ? ""
                      : billPayForm.receivedByName === (user?.name || "__me__")
                      ? "__me__"
                      : allEmployees.some(e => e.name === billPayForm.receivedByName)
                      ? `emp:${allEmployees.find(e => e.name === billPayForm.receivedByName)!.id}`
                      : "__custom__"
                  }
                  onValueChange={(v) => {
                    if (v === "__me__") setBillPayForm(f => ({ ...f, receivedByName: user?.name || "" }));
                    else if (v === "__custom__") setBillPayForm(f => ({ ...f, receivedByName: "" }));
                    else if (v.startsWith("emp:")) {
                      const emp = allEmployees.find(e => e.id === v.slice(4));
                      if (emp) setBillPayForm(f => ({ ...f, receivedByName: emp.name }));
                    }
                  }}
                >
                  <SelectTrigger className="font-semibold">
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {user?.name && (
                      <SelectItem value="__me__">Me ({user.name})</SelectItem>
                    )}
                    {allEmployees.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          All Employees ({allEmployees.length})
                        </div>
                        {allEmployees.map(emp => (
                          <SelectItem key={emp.id} value={`emp:${emp.id}`}>{emp.name}</SelectItem>
                        ))}
                      </>
                    )}
                    <SelectItem value="__custom__">✏️ Custom name…</SelectItem>
                  </SelectContent>
                </Select>
                {/* Show free-text input when Custom is picked OR name doesn't match any employee */}
                {(!allEmployees.some(e => e.name === billPayForm.receivedByName) && billPayForm.receivedByName !== (user?.name || "__never__")) && (
                  <Input
                    value={billPayForm.receivedByName}
                    onChange={e => setBillPayForm(f => ({ ...f, receivedByName: e.target.value }))}
                    placeholder="Type a name (e.g. Cashier, Partner-XYZ)"
                    className="font-semibold"
                  />
                )}
                <p className="text-[10px] text-muted-foreground">
                  This person becomes the custodian of the cash. A cash-in-hand entry is created automatically and clears once they distribute the amount in the project's Money Distribution tab.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayBillOpen(false)}>Cancel</Button>
              <Button className="bg-primary hover:bg-primary-hover" onClick={handleRecordBillPayment}>Record Payment</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Bill Distribution Dialog */}
      <Dialog open={distBillOpen} onOpenChange={(open) => { if (!open) { setDistBillOpen(false); setDistBillTarget(null); } }}>
        {distBillTarget && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600" />
                Distribute Payment — {distBillTarget.quote_number}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Summary */}
              <div className="p-3 bg-muted/30 rounded-lg text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Amount Received:</span><span className="font-bold text-green-600">{formatINR(distBillTarget.amount_paid || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total Expenses:</span><span className="font-semibold text-red-500">−{formatINR(distExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span></div>
                <div className="flex justify-between border-t pt-1"><span className="font-semibold">Net to Distribute:</span><span className="font-bold text-primary">{formatINR((distBillTarget.amount_paid || 0) - distExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0))}</span></div>
                {distBillTarget.received_by_name && <div className="text-[10px] text-muted-foreground">Custodian: {distBillTarget.received_by_name}</div>}
              </div>

              {/* Expenses Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold"><DollarSign className="h-3.5 w-3.5 text-red-500" />Bill Expenses</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDistExpenses(ex => [...ex, { id: crypto.randomUUID(), title: "", amount: "", category: "Other" }])}>
                    <Plus className="h-3 w-3 mr-1" />Add Expense
                  </Button>
                </div>
                {distExpenses.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No expenses — full amount distributable</p>}
                {distExpenses.map((ex, i) => (
                  <div key={ex.id} className="grid grid-cols-12 gap-1 mb-1 items-center">
                    <div className="col-span-5"><Input placeholder="Expense title" value={ex.title} onChange={e => setDistExpenses(prev => prev.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} className="h-8 text-xs" /></div>
                    <div className="col-span-3">
                      <Select value={ex.category} onValueChange={v => setDistExpenses(prev => prev.map((x, j) => j === i ? { ...x, category: v } : x))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Travel", "Material", "Food", "Commission", "Other"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input type="number" placeholder="₹" value={ex.amount} onChange={e => setDistExpenses(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className="h-8 text-xs" /></div>
                    <div className="col-span-1 flex justify-center"><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setDistExpenses(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></div>
                  </div>
                ))}
              </div>

              {/* Employee Shares Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-1.5 text-sm font-semibold"><Users className="h-3.5 w-3.5 text-purple-600" />Employee Shares</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDistShares(sh => [...sh, { id: crypto.randomUUID(), employee_id: "", employee_name: "", job_role: "Salesperson", amount: "" }])}>
                    <Plus className="h-3 w-3 mr-1" />Add Employee
                  </Button>
                </div>
                {distShares.map((sh, i) => (
                  <div key={sh.id} className="grid grid-cols-12 gap-1 mb-1 items-center">
                    <div className="col-span-4">
                      <Select value={sh.employee_id || "__custom__"} onValueChange={v => {
                        const emp = allEmployees.find(e => e.id === v);
                        setDistShares(prev => prev.map((x, j) => j === i ? { ...x, employee_id: v === "__custom__" ? "" : v, employee_name: emp?.name || x.employee_name } : x));
                      }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select employee" /></SelectTrigger>
                        <SelectContent>
                          {allEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                          <SelectItem value="__custom__">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input placeholder="Role" value={sh.job_role} onChange={e => setDistShares(prev => prev.map((x, j) => j === i ? { ...x, job_role: e.target.value } : x))} className="h-8 text-xs" /></div>
                    <div className="col-span-4"><Input type="number" placeholder="₹ Amount" value={sh.amount} onChange={e => setDistShares(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} className="h-8 text-xs" /></div>
                    <div className="col-span-1 flex justify-center"><Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setDistShares(prev => prev.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button></div>
                  </div>
                ))}
                <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                  <span>Total allocated:</span>
                  <span className={distShares.reduce((s, sh) => s + (Number(sh.amount) || 0), 0) > (distBillTarget.amount_paid || 0) - distExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0) + 0.01 ? "text-red-500 font-bold" : "font-semibold"}>
                    {formatINR(distShares.reduce((s, sh) => s + (Number(sh.amount) || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDistBillOpen(false)}>Cancel</Button>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveDistribution} disabled={distSaving}>
                {distSaving ? "Saving…" : "Save Distribution"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        onConfirm={executeDeleteQuotation}
        title={`Delete ${deleteTarget?.type || "Document"}`}
        description={`Are you sure you want to delete ${deleteTarget?.type} "${deleteTarget?.quote_number}"? This action cannot be undone.`}
      />

      <ConfirmEditDialog
        open={!!editGateTarget}
        onOpenChange={(v) => { if (!v) setEditGateTarget(null); }}
        onConfirm={() => { if (editGateTarget) { openEditForm(editGateTarget); setEditGateTarget(null); } }}
        title={`Edit ${editGateTarget?.type || "Document"}?`}
        description={`You're about to edit ${editGateTarget?.type} "${editGateTarget?.quote_number}". Changes to totals, recipient or line items will be saved once you submit. Please type EDIT to confirm.`}
      />
    </div>
  );
};

export default Quotations;
