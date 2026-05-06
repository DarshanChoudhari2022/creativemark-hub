import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Trophy, Handshake, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared";
import { Masked } from "@/components/Masked";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { generatePartnerAgreementPDF, DEFAULT_PARTNER_TERMS } from "@/lib/pdf";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";
import type { CommissionType } from "@/types";

const Partners = () => {
  const { withShield } = usePrivacyShield();
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editPartnerId, setEditPartnerId] = useState<string | null>(null);
  const [detailPartner, setDetailPartner] = useState<any | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [commOpen, setCommOpen] = useState(false);
  const [editingComm, setEditingComm] = useState<any | null>(null);
  const [commForm, setCommForm] = useState({
    client_name: "", project_value: 0, commission_amount: 0, status: "Pending" as "Pending" | "Paid",
  });
  const [form, setForm] = useState({
    name: "", phone: "", email: "", whatsapp: "", category: "",
    businessName: "", address: "", pan: "",
    bankAccount: "", ifsc: "", accountHolder: "", bankName: "", upi: "",
    commissionType: "Percentage" as CommissionType, commissionRate: 10,
    agreementTerms: DEFAULT_PARTNER_TERMS.join('\n'),
  });

  const fetchPartners = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("partners")
      .select("*, partner_leads(*), partner_ledger(*)")
      .order("created_at", { ascending: false });

    const mapped = (data || []).map(p => ({
      ...p,
      totalLeadsReferred: p.partner_leads?.length || 0,
      totalCommissionEarned: p.partner_ledger?.reduce((s: number, e: any) => s + (e.commission_amount || 0), 0) || 0,
      pendingCommission: p.partner_ledger?.filter((e: any) => e.status === "Pending").reduce((s: number, e: any) => s + (e.commission_amount || 0), 0) || 0,
      commissionType: p.commission_type || "Percentage",
      commissionRate: p.commission_rate || 10,
      agreementDate: p.agreement_date || p.created_at?.slice(0, 10),
      businessName: p.business_name,
      bankAccount: p.bank_account,
      accountHolder: p.account_holder,
      bankName: p.bank_name,
      agreementTerms: p.agreement_terms || DEFAULT_PARTNER_TERMS.join('\n'),
    }));
    setPartners(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const filtered = useMemo(() =>
    partners.filter(p => search === "" || p.name.toLowerCase().includes(search.toLowerCase()) || (p.businessName || "").toLowerCase().includes(search.toLowerCase())),
    [partners, search]);

  const savePartner = async () => {
    if (!form.name) { toast.error("Partner name is required"); return; }

    const partnerData = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      whatsapp: form.whatsapp || form.phone.replace(/[^0-9]/g, ""),
      category: form.category,
      business_name: form.businessName,
      address: form.address,
      pan: form.pan,
      bank_account: form.bankAccount,
      ifsc: form.ifsc,
      account_holder: form.accountHolder,
      bank_name: form.bankName,
      upi: form.upi,
      commission_type: form.commissionType,
      commission_rate: form.commissionRate,
      agreement_terms: form.agreementTerms,
    };

    let error;
    if (editPartnerId) {
      const res = await supabase.from("partners").update(partnerData).eq("id", editPartnerId);
      error = res.error;
    } else {
      const res = await supabase.from("partners").insert({
        ...partnerData,
        agreement_date: new Date().toISOString().slice(0, 10),
        partner_since: new Date().toISOString().slice(0, 10),
        status: "Active",
      });
      error = res.error;
    }

    if (error) { toast.error(`Failed to ${editPartnerId ? "update" : "add"}: ` + error.message); return; }

    setAddOpen(false);
    setEditPartnerId(null);
    setForm({ 
      name: "", phone: "", email: "", whatsapp: "", category: "", 
      businessName: "", address: "", pan: "",
      bankAccount: "", ifsc: "", accountHolder: "", bankName: "", upi: "",
      commissionType: "Percentage", commissionRate: 10,
      agreementTerms: DEFAULT_PARTNER_TERMS.join('\n')
    });
    toast.success(`Partner ${editPartnerId ? "updated" : "added"} successfully`);
    fetchPartners();
  };

  const openDetail = async (p: any) => {
    setDetailPartner(p);
    const { data } = await supabase
      .from("partner_ledger")
      .select("*")
      .eq("partner_id", p.id)
      .order("created_at", { ascending: false });
    setLedger(data || []);
  };

  const saveCommission = async () => {
    if (!detailPartner) return;
    if (!commForm.client_name) { toast.error("Client name is required"); return; }

    const payload = {
      partner_id: detailPartner.id,
      client_name: commForm.client_name,
      project_value: commForm.project_value,
      commission_amount: commForm.commission_amount,
      status: commForm.status,
    };

    let error;
    if (editingComm) {
      const res = await supabase.from("partner_ledger").update(payload).eq("id", editingComm.id);
      error = res.error;
    } else {
      const res = await supabase.from("partner_ledger").insert(payload);
      error = res.error;
    }

    if (error) {
      toast.error("Failed to save commission: " + error.message);
      return;
    }

    toast.success(editingComm ? "Commission updated" : "Commission added");
    setCommOpen(false);
    setEditingComm(null);
    setCommForm({ client_name: "", project_value: 0, commission_amount: 0, status: "Pending" });
    // Refresh ledger
    const { data } = await supabase.from("partner_ledger").select("*").eq("partner_id", detailPartner.id).order("created_at", { ascending: false });
    setLedger(data || []);
    fetchPartners();
  };

  const deleteCommission = async (entryId: string) => {
    if (!confirm("Delete this commission entry?")) return;
    const { error } = await supabase.from("partner_ledger").delete().eq("id", entryId);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Commission deleted");
    setLedger(ledger.filter(e => e.id !== entryId));
    fetchPartners();
  };

  const saveTerms = async () => {
    if (!detailPartner) return;
    const { error } = await supabase
      .from("partners")
      .update({ agreement_terms: detailPartner.agreementTerms })
      .eq("id", detailPartner.id);

    if (error) {
      toast.error("Failed to save terms: " + error.message);
    } else {
      toast.success("Agreement terms updated");
      fetchPartners();
    }
  };

  const totalPending = partners.reduce((s, p) => s + (p.pendingCommission || 0), 0);
  const totalPaid = partners.reduce((s, p) => s + (p.totalCommissionEarned || 0) - (p.pendingCommission || 0), 0);
  const getInitials = (name: string) => name.split(" ").map((n: string) => n[0]).join("").slice(0, 2);
  const medals = ["🥇", "🥈", "🥉"];

  if (loading) {
    return (
      <div>
        <PageHeader title="Partners" subtitle="Loading…" />
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Partners"
        subtitle={`${partners.length} referral partners`}
        actions={
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search…" className="pl-9 w-48" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Dialog open={addOpen} onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) {
                setEditPartnerId(null);
                setForm({ 
                  name: "", phone: "", email: "", whatsapp: "", category: "", 
                  businessName: "", address: "", pan: "",
                  bankAccount: "", ifsc: "", accountHolder: "", bankName: "", upi: "",
                  commissionType: "Percentage", commissionRate: 10,
                  agreementTerms: DEFAULT_PARTNER_TERMS.join('\n')
                });
              }
            }}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover" onClick={() => setEditPartnerId(null)}><Plus className="h-4 w-4" />Add Partner</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editPartnerId ? "Edit Partner" : "Add New Partner"}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Basic Information</h3>
                    <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                    <div><Label>Business / Agency Name</Label><Input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
                    <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Business Consultant" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                      <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                    </div>
                    <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Address</Label><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></div>
                    <div><Label>PAN Number</Label><Input value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} /></div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Payment & Commission</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Commission Type</Label>
                        <Select value={form.commissionType} onValueChange={(v: CommissionType) => setForm({ ...form, commissionType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Percentage">Percentage</SelectItem>
                            <SelectItem value="Flat">Flat Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>{form.commissionType === "Percentage" ? "Rate (%)" : "Amount (₹)"}</Label>
                        <Input type="number" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: +e.target.value })} />
                      </div>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <h3 className="text-xs font-bold uppercase tracking-tight text-muted-foreground mb-2">Bank Details</h3>
                      <div><Label>Account Holder Name</Label><Input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} /></div>
                      <div><Label>Bank Name</Label><Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} /></div>
                      <div><Label>Account Number</Label><Input value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></div>
                      <div><Label>IFSC Code</Label><Input value={form.ifsc} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></div>
                      <div><Label>UPI ID</Label><Input value={form.upi} onChange={(e) => setForm({ ...form, upi: e.target.value })} /></div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Agreement Terms & Conditions (One per line)</Label>
                  <Textarea 
                    value={form.agreementTerms} 
                    onChange={(e) => setForm({ ...form, agreementTerms: e.target.value })} 
                    rows={8}
                    placeholder="Enter agreement terms, one per line..."
                    className="mt-1 font-mono text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">These terms will appear on the generated Partnership Agreement PDF.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={savePartner}>{editPartnerId ? "Save Changes" : "Save Partner"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Total Partners</div>
          <div className="text-3xl font-extrabold mt-1">{partners.length}</div>
          <div className="text-xs text-muted-foreground">{partners.filter(p => p.status === "Active").length} active</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Commission Paid</div>
          <div className="text-3xl font-extrabold mt-1 text-green-600"><Masked placeholder="₹•••••">{formatINR(totalPaid)}</Masked></div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Commission Pending</div>
          <div className="text-3xl font-extrabold mt-1 text-primary"><Masked placeholder="₹•••••">{formatINR(totalPending)}</Masked></div>
          <div className="text-xs text-muted-foreground">Awaiting payout</div>
        </div>
      </div>

      {/* Leaderboard */}
      {partners.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-lg">Partner Leaderboard</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[...partners].sort((a, b) => b.totalLeadsReferred - a.totalLeadsReferred).slice(0, 3).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 p-4 rounded-lg border border-border hover:shadow-sm transition-shadow cursor-pointer" onClick={() => openDetail(p)}>
                <div className="text-3xl">{medals[i] || ""}</div>
                <Avatar className="h-10 w-10 border-2 border-border">
                  <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">{getInitials(p.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate"><Masked>{p.name}</Masked></div>
                  <div className="text-xs text-muted-foreground">{p.totalLeadsReferred} leads · {p.category}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary"><Masked placeholder="₹•••••">{formatINR(p.totalCommissionEarned)}</Masked></div>
                  <div className="text-[10px] text-muted-foreground">total earned</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Partner Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead><TableHead>Category</TableHead><TableHead>Commission</TableHead>
              <TableHead className="text-center">Leads</TableHead><TableHead className="text-right">Earned</TableHead>
              <TableHead className="text-right">Pending</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => openDetail(p)}>
                <TableCell className="font-semibold"><Masked>{p.name}</Masked></TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                <TableCell className="text-sm">{p.commissionType === "Percentage" ? `${p.commissionRate}%` : `${formatINR(p.commissionRate)} flat`}</TableCell>
                <TableCell className="text-center font-semibold">{p.totalLeadsReferred}</TableCell>
                <TableCell className="text-right font-semibold text-green-600"><Masked placeholder="₹•••••">{formatINR(p.totalCommissionEarned)}</Masked></TableCell>
                <TableCell className={`text-right font-semibold ${p.pendingCommission > 0 ? "text-primary" : ""}`}><Masked placeholder="₹•••••">{formatINR(p.pendingCommission)}</Masked></TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] ${p.status === "Active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}`}>{p.status}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => {
                    try {
                      await generatePartnerAgreementPDF(p);
                      toast.success("Agreement PDF ready");
                    } catch (err: any) {
                      toast.error(err?.message || "Could not save PDF");
                    }
                  }}>
                    <FileText className="h-3.5 w-3.5" /> Agreement
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No partners found — add your first partner</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Partner Detail Dialog */}
      <Dialog open={!!detailPartner} onOpenChange={(open) => !open && setDetailPartner(null)}>
        {detailPartner && (
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Handshake className="h-5 w-5 text-primary" />
                  {detailPartner.name}
                  <Badge variant="outline" className={`${detailPartner.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{detailPartner.status}</Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-primary hover:bg-primary/10" onClick={() => {
                  withShield(() => {
                    setEditPartnerId(detailPartner.id);
                    setForm({
                      name: detailPartner.name || "",
                      phone: detailPartner.phone || "",
                      email: detailPartner.email || "",
                      whatsapp: detailPartner.whatsapp || "",
                      category: detailPartner.category || "",
                      businessName: detailPartner.businessName || "",
                      address: detailPartner.address || "",
                      pan: detailPartner.pan || "",
                      bankAccount: detailPartner.bankAccount || "",
                      ifsc: detailPartner.ifsc || "",
                      accountHolder: detailPartner.accountHolder || "",
                      bankName: detailPartner.bankName || "",
                      upi: detailPartner.upi || "",
                      commissionType: detailPartner.commissionType || "Percentage",
                      commissionRate: detailPartner.commissionRate || 10,
                      agreementTerms: detailPartner.agreementTerms || DEFAULT_PARTNER_TERMS.join('\n'),
                    });
                    setAddOpen(true);
                  });
                }}>
                  Edit
                </Button>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Category</div><div className="font-semibold">{detailPartner.category || "General Partner"}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Commission</div><div className="font-semibold">{detailPartner.commissionType === "Percentage" ? `${detailPartner.commissionRate}%` : formatINR(detailPartner.commissionRate)}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Agreement</div><div className="font-mono text-xs">{detailPartner.agreementDate ? formatDateDDMMYYYY(new Date(detailPartner.agreementDate)) : "—"}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Phone</div><div className="text-xs">{detailPartner.phone}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-2 border p-3 rounded-lg">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Business Details</h4>
                <div className="text-sm"><span className="text-muted-foreground">Agency:</span> {detailPartner.businessName || "—"}</div>
                <div className="text-sm"><span className="text-muted-foreground">PAN:</span> {detailPartner.pan || "—"}</div>
                <div className="text-sm"><span className="text-muted-foreground">Address:</span> {detailPartner.address || "—"}</div>
              </div>
              <div className="space-y-2 border p-3 rounded-lg">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Bank / Payment Details</h4>
                <div className="text-sm"><span className="text-muted-foreground">Bank:</span> {detailPartner.bankName || "—"}</div>
                <div className="text-sm"><span className="text-muted-foreground">A/C No:</span> {detailPartner.bankAccount || "—"}</div>
                <div className="text-sm"><span className="text-muted-foreground">IFSC:</span> {detailPartner.ifsc || "—"}</div>
                <div className="text-sm"><span className="text-muted-foreground">UPI:</span> {detailPartner.upi || "—"}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 my-2">
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className="text-2xl font-extrabold">{detailPartner.totalLeadsReferred}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Leads Referred</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className="text-2xl font-extrabold text-green-600"><Masked placeholder="₹•••••">{formatINR(detailPartner.totalCommissionEarned)}</Masked></div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Earned</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className={`text-2xl font-extrabold ${detailPartner.pendingCommission > 0 ? "text-primary" : ""}`}><Masked placeholder="₹•••••">{formatINR(detailPartner.pendingCommission)}</Masked></div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
              </div>
            </div>

            {/* Commission Ledger */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Commission Ledger</h4>
                <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary-hover" onClick={() => {
                  setEditingComm(null);
                  setCommForm({ client_name: "", project_value: 0, commission_amount: 0, status: "Pending" });
                  setCommOpen(true);
                }}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Commission
                </Button>
              </div>

              {/* Commission Add/Edit Form */}
              {commOpen && (
                <div className="border rounded-lg p-3 mb-3 bg-muted/30 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Client Name *</Label><Input value={commForm.client_name} onChange={(e) => setCommForm({ ...commForm, client_name: e.target.value })} placeholder="Client name" /></div>
                    <div><Label className="text-xs">Status</Label>
                      <Select value={commForm.status} onValueChange={(v: "Pending" | "Paid") => setCommForm({ ...commForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Project Value (₹)</Label><Input type="number" value={commForm.project_value} onChange={(e) => setCommForm({ ...commForm, project_value: +e.target.value })} /></div>
                    <div><Label className="text-xs">Commission Amount (₹)</Label><Input type="number" value={commForm.commission_amount} onChange={(e) => setCommForm({ ...commForm, commission_amount: +e.target.value })} /></div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCommOpen(false); setEditingComm(null); }}>Cancel</Button>
                    <Button size="sm" className="h-7 text-xs bg-primary hover:bg-primary-hover" onClick={saveCommission}>{editingComm ? "Update" : "Save"}</Button>
                  </div>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Project Value</TableHead>
                    <TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">{entry.created_at ? formatDateDDMMYYYY(new Date(entry.created_at)) : ""}</TableCell>
                      <TableCell className="font-semibold"><Masked>{entry.client_name || "—"}</Masked></TableCell>
                      <TableCell className="text-right"><Masked placeholder="₹•••••">{formatINR(entry.project_value || 0)}</Masked></TableCell>
                      <TableCell className="text-right font-semibold"><Masked placeholder="₹•••••">{formatINR(entry.commission_amount || 0)}</Masked></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${entry.status === "Paid" ? "bg-green-100 text-green-700" : entry.status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{entry.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                          setEditingComm(entry);
                          setCommForm({
                            client_name: entry.client_name || "",
                            project_value: entry.project_value || 0,
                            commission_amount: entry.commission_amount || 0,
                            status: entry.status || "Pending",
                          });
                          setCommOpen(true);
                        }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => deleteCommission(entry.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-4 text-muted-foreground">No commissions recorded yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Agreement Terms Editing */}
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm">Agreement Terms</h4>
                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={saveTerms}>Save Changes</Button>
              </div>
              <Textarea 
                value={detailPartner.agreementTerms}
                onChange={(e) => setDetailPartner({ ...detailPartner, agreementTerms: e.target.value })}
                rows={10}
                className="font-mono text-[11px] leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Tip: Edit these terms and click "Save Changes" to update the partner's legal agreement.
              </p>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={async () => {
                try {
                  await generatePartnerAgreementPDF(detailPartner);
                  toast.success("Agreement PDF ready");
                } catch (err: any) {
                  toast.error(err?.message || "Could not save PDF");
                }
              }}>
                <Download className="h-4 w-4" /> Download Agreement
              </Button>
              <a href={waLink(detailPartner.whatsapp || detailPartner.phone, WHATSAPP_TEMPLATES.PARTNER_GREETING(detailPartner.name))} target="_blank" rel="noopener">
                <Button className="bg-green-600 hover:bg-green-700 text-white">WhatsApp</Button>
              </a>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Partners;
