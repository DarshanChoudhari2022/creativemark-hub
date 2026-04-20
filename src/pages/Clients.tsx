import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutGrid, List, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, PaymentBadge } from "@/components/shared";
import { clients as initialClients, ClientCategory } from "@/data/clients";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const Clients = () => {
  const [clients, setClients] = useState(initialClients);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Other" as ClientCategory, contact: "", email: "" });

  const addClient = () => {
    if (!form.name) return;
    setClients([
      ...clients,
      {
        id: `C-${String(clients.length + 1).padStart(3, "0")}`,
        name: form.name, category: form.category,
        services: ["Branding"], paymentStatus: "Paid",
        contact: form.contact, email: form.email,
        totalBilled: 0, outstanding: 0, assignedEmployees: [],
        posts: [], reelShoots: [], socialCalendar: [],
      },
    ]);
    setOpen(false);
    setForm({ name: "", category: "Other", contact: "", email: "" });
    toast.success("Client added");
  };

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients across all categories`}
        actions={
          <>
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button size="sm" variant={view === "cards" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("cards")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button size="sm" variant={view === "table" ? "default" : "ghost"} className="rounded-none" onClick={() => setView("table")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Client</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add new client</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v: ClientCategory) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Contact</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addClient}>Save Client</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Link to={`/clients/${c.id}`} className="font-bold text-lg hover:text-primary transition-colors">{c.name}</Link>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.id}</div>
                </div>
                <Badge variant="outline" className="font-semibold">{c.category}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {c.services.map((s) => (
                  <span key={s} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.contact}</span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">Outstanding<div className={`font-bold text-base ${c.outstanding > 0 ? "text-primary" : "text-foreground"}`}>{formatINR(c.outstanding)}</div></div>
                <PaymentBadge status={c.paymentStatus} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead><TableHead>Category</TableHead>
                <TableHead>Services</TableHead><TableHead>Contact</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell><Link to={`/clients/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link></TableCell>
                  <TableCell><Badge variant="outline">{c.category}</Badge></TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{c.services.join(", ")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.contact}</TableCell>
                  <TableCell className={`text-right font-semibold ${c.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(c.outstanding)}</TableCell>
                  <TableCell><PaymentBadge status={c.paymentStatus} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
};

export default Clients;
