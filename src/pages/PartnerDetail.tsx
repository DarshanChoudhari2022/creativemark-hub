import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileDown, Share2, MessageCircle, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { partners as initial } from "@/data/partners";
import { leads } from "@/data/leads";
import { formatINR, formatDateDDMMYYYY } from "@/lib/format";
import { downloadPartnerAgreementPDF } from "@/lib/pdf";
import { StatusBadge } from "@/components/shared";
import { toast } from "sonner";

const PartnerDetail = () => {
  const { id } = useParams();
  const [partners, setPartners] = useState(initial);
  const partner = partners.find((p) => p.id === id);
  const [shareOpen, setShareOpen] = useState(false);
  if (!partner) return <div className="p-6">Not found</div>;

  const referredLeads = leads.filter((l) => partner.referredLeadIds.includes(l.id));

  const updateRate = (svc: string, percent: number) => {
    setPartners((ps) => ps.map((p) => p.id === partner.id ? {
      ...p,
      commissionStructure: p.commissionStructure.map((c) => c.service === svc ? { ...c, percent } : c),
    } : p));
  };

  const shareWA = () => {
    const msg = encodeURIComponent(`Hi ${partner.name}, please find your CreativeMark partnership agreement attached.`);
    window.open(`https://wa.me/${partner.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
  };
  const shareEmail = () => {
    window.open(`mailto:${partner.email}?subject=CreativeMark%20Partnership%20Agreement&body=Please%20find%20attached%20your%20signed%20agreement.`, "_blank");
  };

  return (
    <div>
      <Link to="/partners" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{partner.name}</h1>
              <Badge variant="outline" className={partner.status === "Active" ? "bg-success/15 text-success border-success/30" : "bg-muted"}>{partner.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">{partner.phone} · {partner.email}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {partner.pan && <>PAN: {partner.pan}</>}{partner.gst && <> · GST: {partner.gst}</>}
            </div>
            {partner.bankName && (
              <div className="text-xs text-muted-foreground mt-1">{partner.bankName} · A/c {partner.bankAccount} · {partner.bankIFSC}</div>
            )}
          </div>
          <div className="flex gap-2">
            <Button className="bg-primary hover:bg-primary-hover" onClick={() => downloadPartnerAgreementPDF(partner)}>
              <FileDown className="h-4 w-4" />Generate Agreement
            </Button>
            <Button variant="outline" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" />Share Agreement</Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div><div className="text-xs text-muted-foreground uppercase tracking-wider">Leads Referred</div><div className="text-2xl font-bold">{partner.leadsReferred}</div></div>
          <div><div className="text-xs text-muted-foreground uppercase tracking-wider">Total Commission</div><div className="text-2xl font-bold">{formatINR(partner.totalCommission)}</div></div>
          <div><div className="text-xs text-muted-foreground uppercase tracking-wider">Pending</div><div className={`text-2xl font-bold ${partner.pendingCommission > 0 ? "text-primary" : ""}`}>{formatINR(partner.pendingCommission)}</div></div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-5">
          <h3 className="font-bold mb-3">Commission Structure</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Service</TableHead><TableHead className="text-right w-32">Commission %</TableHead></TableRow></TableHeader>
            <TableBody>
              {partner.commissionStructure.map((c) => (
                <TableRow key={c.service}>
                  <TableCell className="font-semibold">{c.service}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" className="w-24 ml-auto text-right" value={c.percent} onChange={(e) => updateRate(c.service, +e.target.value)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-3">Referred Leads</h3>
          {referredLeads.length === 0 ? <p className="text-sm text-muted-foreground">No referrals yet.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Lead</TableHead><TableHead>Stage</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {referredLeads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell><div className="font-semibold">{l.name}</div><div className="text-xs text-muted-foreground">{l.company}</div></TableCell>
                    <TableCell><StatusBadge status={l.stage} /></TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(l.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden mb-6">
        <div className="p-5 pb-3"><h3 className="font-bold">Commission Ledger</h3></div>
        <Table>
          <TableHeader>
            <TableRow><TableHead>Invoice</TableHead><TableHead>Client</TableHead><TableHead>Service</TableHead><TableHead className="text-right">Deal Value</TableHead><TableHead className="text-right">%</TableHead><TableHead className="text-right">Commission</TableHead><TableHead>Status</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {partner.ledger.map((e) => (
              <TableRow key={e.invoiceNo}>
                <TableCell className="font-mono text-xs">{e.invoiceNo}</TableCell>
                <TableCell>{e.client}</TableCell>
                <TableCell>{e.service}</TableCell>
                <TableCell className="text-right">{formatINR(e.dealValue)}</TableCell>
                <TableCell className="text-right">{e.percent}%</TableCell>
                <TableCell className="text-right font-bold">{formatINR(e.amount)}</TableCell>
                <TableCell><StatusBadge status={e.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Agreement preview panel */}
      <Card className="p-0 overflow-hidden">
        <div className="bg-primary text-primary-foreground px-8 py-5 flex items-center justify-between">
          <div>
            <div className="font-extrabold text-2xl tracking-tight">CREATIVE MARK</div>
            <div className="text-[11px] opacity-90">Advertising · Digital Marketing · Branding · Multimedia</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">PARTNERSHIP AGREEMENT</div>
            <div className="text-xs opacity-90">Ref: AG-{partner.id}</div>
          </div>
        </div>
        <div className="p-8 bg-card text-sm">
          <div className="text-center mb-6">
            <div className="font-extrabold text-lg">REFERRAL PARTNERSHIP AGREEMENT</div>
            <div className="text-xs text-muted-foreground mt-1">Effective {formatDateDDMMYYYY()}</div>
          </div>
          {[
            { t: "1. Parties", b: `This Agreement is made between CreativeMark Advertising ("Agency") and ${partner.name} ("Partner"), contactable at ${partner.phone} / ${partner.email}.` },
            { t: "2. Scope of Engagement", b: "Partner shall refer prospective clients to the Agency for advertising, digital marketing, branding and multimedia services." },
            { t: "3. Commission", b: `Commission is computed on net deal value as per the schedule maintained by both parties. Payable within fifteen (15) business days of receipt of client payment.` },
            { t: "4. Confidentiality", b: "Each party shall keep all non-public information of the other party strictly confidential." },
            { t: "5. Term & Termination", b: "Either party may terminate this Agreement with thirty (30) days' written notice." },
            { t: "6. Governing Law", b: "Governed by laws of India. Jurisdiction: courts of Mumbai, Maharashtra." },
          ].map((s) => (
            <div key={s.t} className="mb-4">
              <div className="font-bold text-primary border-b border-primary inline-block pb-0.5 mb-1">{s.t}</div>
              <div className="text-muted-foreground">{s.b}</div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div>
              <div className="border-t border-foreground pt-1 mt-12 font-bold">For CreativeMark Advertising</div>
              <div className="text-xs text-muted-foreground">Authorised Signatory</div>
            </div>
            <div>
              <div className="border-t border-foreground pt-1 mt-12 font-bold">Partner</div>
              <div className="text-xs text-muted-foreground">{partner.name}</div>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share Agreement</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Send the agreement to {partner.name} via your preferred channel.</p>
          <div className="flex gap-2 mt-3">
            <Button className="flex-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => { shareWA(); setShareOpen(false); }}>
              <MessageCircle className="h-4 w-4" />WhatsApp
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => { shareEmail(); setShareOpen(false); }}>
              <Mail className="h-4 w-4" />Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnerDetail;
