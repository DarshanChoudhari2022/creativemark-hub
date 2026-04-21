import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutGrid, List, Phone, Users, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader, PaymentBadge } from "@/components/shared";
import { clients as initialClients } from "@/data/clients";
import { employees } from "@/data/employees";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";
import type { ClientCategory, PaymentStatus, Client } from "@/types";

const CATEGORY_COLORS: Record<ClientCategory, string> = {
  Politician: "bg-red-100 text-red-700 border-red-200",
  Clothing: "bg-blue-100 text-blue-700 border-blue-200",
  Motors: "bg-amber-100 text-amber-700 border-amber-200",
  Other: "bg-gray-100 text-gray-600 border-gray-200",
};

const SERVICE_COLORS: Record<string, string> = {
  "Campaign": "bg-red-50 text-red-600",
  "Social Media": "bg-blue-50 text-blue-600",
  "Reels": "bg-purple-50 text-purple-600",
  "Branding": "bg-emerald-50 text-emerald-600",
  "Photography": "bg-amber-50 text-amber-600",
  "Graphics": "bg-cyan-50 text-cyan-600",
  "Banners": "bg-orange-50 text-orange-600",
  "Videography": "bg-rose-50 text-rose-600",
};

import { useAuth } from "@/contexts/AuthContext";

const Clients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState(initialClients);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [payFilter, setPayFilter] = useState<string>("all");
  const [form, setForm] = useState({
    name: "", category: "Other" as ClientCategory, contact: "", email: "",
    area: "", whatsapp: "", monthlyRetainer: 0, notes: "",
  });

  const filtered = useMemo(() => {
    return clients.filter(c => {
      // Role-Based Access Control logic
      if (user?.role === "Employee" && !c.assignedEmployees.includes(user.id)) return false;

      // Other Filters
      if (catFilter !== "all" && c.category !== catFilter) return false;
      if (payFilter !== "all" && c.paymentStatus !== payFilter) return false;
      if (search !== "") {
        const query = search.toLowerCase();
        if (!c.name.toLowerCase().includes(query) && !c.serviceLabels.some(s => s.toLowerCase().includes(query))) {
          return false;
        }
      }
      return true;
    });
  }, [clients, catFilter, payFilter, search, user]);

  const addClient = () => {
    if (!form.name) { toast.error("Client name is required"); return; }
    const newClient: Client = {
      id: `C-${String(clients.length + 1).padStart(3, "0")}`,
      name: form.name,
      category: form.category,
      contactPerson: form.name,
      phone: form.contact,
      whatsapp: form.whatsapp || form.contact.replace(/[^0-9]/g, ""),
      email: form.email,
      address: "",
      contractStart: new Date().toISOString().slice(0, 10),
      monthlyRetainer: form.monthlyRetainer,
      notes: form.notes,
      area: form.area,
      status: "Active",
      services: [],
      serviceLabels: [],
      totalBilled: 0,
      outstanding: 0,
      paymentStatus: "Paid",
      assignedEmployees: [],
      assignedEmployeeNames: [],
      posts: [],
      shoots: [],
      paymentHistory: [],
    };
    setClients([...clients, newClient]);
    setOpen(false);
    setForm({ name: "", category: "Other", contact: "", email: "", area: "", whatsapp: "", monthlyRetainer: 0, notes: "" });
    toast.success("Client added successfully");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`${filtered.length} of ${clients.length} clients`}
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
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Client Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Adv. Rajesh Kumar" /></div>
                  <div><Label>Category</Label>
                    <Select value={form.category} onValueChange={(v: ClientCategory) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Constituency / Area</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Pune East" /></div>
                  <div><Label>Phone</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="+91 98765 43210" /></div>
                  <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+91 98765 43210" /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
                  <div><Label>Monthly Retainer ₹</Label><Input type="number" value={form.monthlyRetainer} onChange={(e) => setForm({ ...form, monthlyRetainer: +e.target.value })} /></div>
                  <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
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

      {/* Search & Filters */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name, service…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-40"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(["Politician", "Clothing", "Motors", "Other"] as ClientCategory[]).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={payFilter} onValueChange={setPayFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Payment Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {(["Paid", "Partial", "Overdue"] as PaymentStatus[]).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-semibold text-muted-foreground">No clients found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const assigned = employees.filter(e => c.assignedEmployees.includes(e.id));
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link to={`/clients/${c.id}`} className="font-bold text-lg hover:text-primary transition-colors">{c.name}</Link>
                    {c.area && <div className="text-xs text-muted-foreground mt-0.5">{c.area}</div>}
                  </div>
                  <Badge variant="outline" className={`font-semibold text-xs ${CATEGORY_COLORS[c.category]}`}>{c.category}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {c.serviceLabels.map((s) => (
                    <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${SERVICE_COLORS[s] || "bg-muted text-muted-foreground"}`}>{s}</span>
                  ))}
                </div>
                {c.monthlyRetainer > 0 && (
                  <div className="text-xs text-muted-foreground mb-2">Monthly Retainer: <span className="font-semibold text-foreground">{formatINR(c.monthlyRetainer)}</span></div>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                </div>
                {assigned.length > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    {assigned.slice(0, 3).map(e => (
                      <Avatar key={e.id} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[9px] bg-muted font-bold">{getInitials(e.name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {assigned.length > 3 && <span className="text-[10px] text-muted-foreground ml-1">+{assigned.length - 3}</span>}
                  </div>
                )}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">Outstanding<div className={`font-bold text-base ${c.outstanding > 0 ? "text-primary" : "text-foreground"}`}>{formatINR(c.outstanding)}</div></div>
                  <div className="flex items-center gap-2">
                    <PaymentBadge status={c.paymentStatus} />
                    <Link to={`/clients/${c.id}`}>
                      <Button size="sm" variant="outline" className="text-xs h-7 opacity-0 group-hover:opacity-100 transition-opacity">View Details</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead><TableHead>Category</TableHead>
                <TableHead>Services</TableHead><TableHead>Contact</TableHead>
                <TableHead>Retainer</TableHead>
                <TableHead className="text-right">Outstanding</TableHead><TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/clients/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link>
                    {c.area && <div className="text-xs text-muted-foreground">{c.area}</div>}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[c.category]}`}>{c.category}</Badge></TableCell>
                  <TableCell className="max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {c.serviceLabels.slice(0, 3).map(s => <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[s] || "bg-muted text-muted-foreground"}`}>{s}</span>)}
                      {c.serviceLabels.length > 3 && <span className="text-[10px] text-muted-foreground">+{c.serviceLabels.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-sm">{c.monthlyRetainer > 0 ? formatINR(c.monthlyRetainer) : "—"}</TableCell>
                  <TableCell className={`text-right font-semibold ${c.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(c.outstanding)}</TableCell>
                  <TableCell><PaymentBadge status={c.paymentStatus} /></TableCell>
                  <TableCell><Link to={`/clients/${c.id}`}><Button size="sm" variant="ghost" className="text-xs">View</Button></Link></TableCell>
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
