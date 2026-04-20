import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Phone, Mail } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared";
import { partners as initial } from "@/data/partners";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const Partners = () => {
  const [partners, setPartners] = useState(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const add = () => {
    if (!form.name) return;
    setPartners([...partners, {
      id: `P-${String(partners.length + 1).padStart(2, "0")}`, ...form,
      status: "Active", leadsReferred: 0, totalCommission: 0, pendingCommission: 0,
      commissionStructure: [{ service: "Branding", percent: 8 }],
      referredLeadIds: [], ledger: [],
    }]);
    setOpen(false);
    setForm({ name: "", phone: "", email: "" });
    toast.success("Partner added");
  };

  return (
    <div>
      <PageHeader
        title="Partners"
        subtitle={`${partners.length} referral partners`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Partner</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add partner</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="bg-primary hover:bg-primary-hover" onClick={add}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {partners.map((p) => (
          <Card key={p.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <Link to={`/partners/${p.id}`} className="font-bold text-lg hover:text-primary">{p.name}</Link>
                <div className="text-xs text-muted-foreground">{p.id}</div>
              </div>
              <Badge variant="outline" className={p.status === "Active" ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"}>{p.status}</Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground mb-3">
              <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{p.phone}</div>
              <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{p.email}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads</div>
                <div className="font-bold">{p.leadsReferred}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Earned</div>
                <div className="font-bold text-sm">{formatINR(p.totalCommission)}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</div>
                <div className={`font-bold text-sm ${p.pendingCommission > 0 ? "text-primary" : ""}`}>{formatINR(p.pendingCommission)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Partners;
