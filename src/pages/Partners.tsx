import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Trophy, Handshake, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { generatePartnerAgreementPDF } from "@/lib/pdf";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { CommissionType } from "@/types";

const Partners = () => {
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailPartner, setDetailPartner] = useState<any | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", whatsapp: "", category: "",
    commissionType: "Percentage" as CommissionType, commissionRate: 10,
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
    }));
    setPartners(mapped);
    setLoading(false);
  };

  useEffect(() => { fetchPartners(); }, []);

  const filtered = useMemo(() =>
    partners.filter(p => search === "" || p.name.toLowerCase().includes(search.toLowerCase())),
    [partners, search]);

  const addPartner = async () => {
    if (!form.name) { toast.error("Partner name is required"); return; }

    const { error } = await supabase.from("partners").insert({
      name: form.name,
      phone: form.phone,
      email: form.email,
      whatsapp: form.whatsapp || form.phone.replace(/[^0-9]/g, ""),
      category: form.category,
      commission_type: form.commissionType,
      commission_rate: form.commissionRate,
      agreement_date: new Date().toISOString().slice(0, 10),
      status: "Active",
    });

    if (error) { toast.error("Failed: " + error.message); return; }

    setAddOpen(false);
    setForm({ name: "", phone: "", email: "", whatsapp: "", category: "", commissionType: "Percentage", commissionRate: 10 });
    toast.success("Partner added successfully");
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
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Partner</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add New Partner</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Business Consultant" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
                  </div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
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
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addPartner}>Save Partner</Button>
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
          <div className="text-3xl font-extrabold mt-1 text-green-600">{formatINR(totalPaid)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Commission Pending</div>
          <div className="text-3xl font-extrabold mt-1 text-primary">{formatINR(totalPending)}</div>
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
                  <div className="font-bold truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.totalLeadsReferred} leads · {p.category}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">{formatINR(p.totalCommissionEarned)}</div>
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
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                <TableCell className="text-sm">{p.commissionType === "Percentage" ? `${p.commissionRate}%` : `${formatINR(p.commissionRate)} flat`}</TableCell>
                <TableCell className="text-center font-semibold">{p.totalLeadsReferred}</TableCell>
                <TableCell className="text-right font-semibold text-green-600">{formatINR(p.totalCommissionEarned)}</TableCell>
                <TableCell className={`text-right font-semibold ${p.pendingCommission > 0 ? "text-primary" : ""}`}>{formatINR(p.pendingCommission)}</TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] ${p.status === "Active" ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500"}`}>{p.status}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                    generatePartnerAgreementPDF(p);
                    toast.success("Agreement PDF downloaded");
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
              <DialogTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-primary" />
                {detailPartner.name}
                <Badge variant="outline" className={`${detailPartner.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100"}`}>{detailPartner.status}</Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Category</div><div className="font-semibold">{detailPartner.category || "General Partner"}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Commission</div><div className="font-semibold">{detailPartner.commissionType === "Percentage" ? `${detailPartner.commissionRate}%` : formatINR(detailPartner.commissionRate)}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Agreement</div><div className="font-mono text-xs">{detailPartner.agreementDate ? formatDateDDMMYYYY(new Date(detailPartner.agreementDate)) : "—"}</div></div>
              <div className="p-3 bg-muted/30 rounded-lg"><div className="text-xs text-muted-foreground">Phone</div><div className="text-xs">{detailPartner.phone}</div></div>
            </div>

            <div className="grid grid-cols-3 gap-3 my-2">
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className="text-2xl font-extrabold">{detailPartner.totalLeadsReferred}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Leads Referred</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className="text-2xl font-extrabold text-green-600">{formatINR(detailPartner.totalCommissionEarned)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Total Earned</div>
              </div>
              <div className="p-3 bg-card border rounded-lg text-center">
                <div className={`text-2xl font-extrabold ${detailPartner.pendingCommission > 0 ? "text-primary" : ""}`}>{formatINR(detailPartner.pendingCommission)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">Pending</div>
              </div>
            </div>

            {/* Commission Ledger */}
            <div>
              <h4 className="font-bold text-sm mb-2">Commission Ledger</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead className="text-right">Project Value</TableHead>
                    <TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-xs">{entry.created_at ? formatDateDDMMYYYY(new Date(entry.created_at)) : ""}</TableCell>
                      <TableCell className="font-semibold">{entry.client_name || "—"}</TableCell>
                      <TableCell className="text-right">{formatINR(entry.project_value || 0)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(entry.commission_amount || 0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${entry.status === "Paid" ? "bg-green-100 text-green-700" : entry.status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{entry.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No commissions recorded yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => {
                generatePartnerAgreementPDF(detailPartner);
                toast.success("Agreement PDF downloaded");
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
