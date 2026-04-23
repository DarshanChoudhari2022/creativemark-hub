import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus, LayoutGrid, List, Phone, Users, Search, Filter, MessageCircle, MessageSquare } from "lucide-react";
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
import { useSupabaseTable } from "@/hooks/useSupabase";
import { formatINR, isValidIndianPhone, waLink, smsLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
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
  const { data: clientsData, loading, insert } = useSupabaseTable<any>('clients', '*, client_services(*), client_assignments(employee_id, employees(name))');
  const [view, setView] = useState<"cards" | "table">("cards");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [payFilter, setPayFilter] = useState<string>("all");
  const [form, setForm] = useState({
    name: "", category: "Other" as ClientCategory, phone: "", email: "",
    area: "", whatsapp: "", serviceType: "", notes: "",
    customCategory: "",
  });
  const [phoneError, setPhoneError] = useState("");
  const [whatsappError, setWhatsappError] = useState("");

  const clients = useMemo(() => {
    return clientsData.map(c => ({
      ...c,
      serviceLabels: c.client_services?.filter((s: any) => s.active).map((s: any) => s.service_name) || [],
      assignedEmployees: c.client_assignments?.map((a: any) => a.employee_id) || [],
      assignedEmployeeNames: c.client_assignments?.map((a: any) => a.employees?.name).filter(Boolean) || [],
      paymentStatus: c.payment_status, // map snake_case to camelCase if needed
    }));
  }, [clientsData]);

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

  const validatePhone = (phone: string, field: "phone" | "whatsapp") => {
    if (phone && !isValidIndianPhone(phone)) {
      if (field === "phone") setPhoneError("Enter valid Indian number (10 digits, starting 6-9)");
      else setWhatsappError("Enter valid Indian number (10 digits, starting 6-9)");
      return false;
    }
    if (field === "phone") setPhoneError("");
    else setWhatsappError("");
    return true;
  };

  const addClient = async () => {
    if (!form.name) { toast.error("Client name is required"); return; }
    
    // Validate phone numbers
    const phoneValid = !form.phone || validatePhone(form.phone, "phone");
    const waValid = !form.whatsapp || validatePhone(form.whatsapp, "whatsapp");
    if (!phoneValid || !waValid) return;
    
    const { error } = await insert({
      name: form.name,
      category: form.category === "Other" ? form.customCategory : form.category,
      contact_person: form.name,
      phone: form.phone,
      whatsapp: form.whatsapp || form.phone.replace(/[^0-9+]/g, ""),
      email: form.email,
      service_type: form.serviceType,
      notes: form.notes,
      area: form.area,
      status: "Active",
    });

    if (error) {
      toast.error("Failed to add client: " + error.message);
    } else {
      setOpen(false);
      setForm({ name: "", category: "Other", phone: "", email: "", area: "", whatsapp: "", serviceType: "", notes: "" });
      setPhoneError("");
      setWhatsappError("");
      toast.success("Client added successfully");
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    window.open(waLink(phone, WHATSAPP_TEMPLATES.LEAD_GENERAL(name)), "_blank");
  };

  const openSMS = (phone: string, name: string) => {
    const msg = `Hi ${name}, this is from CreativeMark. `;
    window.open(smsLink(phone, msg), "_blank");
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
                  {(form.category === "Other" || !["Politician", "Clothing", "Motors"].includes(form.category)) && (
                    <div className="col-span-2">
                      <Label>Specify Role *</Label>
                      <Input 
                        value={form.customCategory} 
                        onChange={(e) => setForm({ ...form, customCategory: e.target.value })} 
                        placeholder="e.g. Real Estate Agent, Boutique Owner"
                      />
                    </div>
                  )}
                  <div><Label>Constituency / Area</Label><Input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="e.g. Pune East" /></div>
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      value={form.phone} 
                      onChange={(e) => { setForm({ ...form, phone: e.target.value }); validatePhone(e.target.value, "phone"); }} 
                      placeholder="+91 98765 43210"
                      className={phoneError ? "border-red-500" : ""}
                    />
                    {phoneError && <p className="text-[11px] text-red-500 mt-0.5">{phoneError}</p>}
                  </div>
                  <div>
                    <Label>WhatsApp</Label>
                    <Input 
                      value={form.whatsapp} 
                      onChange={(e) => { setForm({ ...form, whatsapp: e.target.value }); validatePhone(e.target.value, "whatsapp"); }} 
                      placeholder="+91 98765 43210"
                      className={whatsappError ? "border-red-500" : ""}
                    />
                    {whatsappError && <p className="text-[11px] text-red-500 mt-0.5">{whatsappError}</p>}
                  </div>
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
                  <div><Label>Type of Services</Label><Input value={form.serviceType} onChange={(e) => setForm({ ...form, serviceType: e.target.value })} placeholder="e.g. Social Media, Branding" /></div>
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

      {loading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading clients...</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-semibold text-muted-foreground">No clients found</h3>
          <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
        </Card>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            return (
              <Card key={c.id} className="p-5 hover:shadow-md transition-shadow group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <Link to={`/clients/${c.id}`} className="font-bold text-lg hover:text-primary transition-colors">{c.name}</Link>
                    {c.area && <div className="text-xs text-muted-foreground mt-0.5">{c.area}</div>}
                  </div>
                  <Badge variant="outline" className={`font-semibold text-xs ${CATEGORY_COLORS[c.category as ClientCategory] || CATEGORY_COLORS.Other}`}>{c.category}</Badge>
                </div>
                {c.service_type && (
                  <div className="text-xs text-muted-foreground mb-2">Services: <span className="font-semibold text-foreground">{c.service_type}</span></div>
                )}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {c.serviceLabels.map((s: string) => (
                    <span key={s} className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${SERVICE_COLORS[s] || "bg-muted text-muted-foreground"}`}>{s}</span>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>
                  {c.whatsapp && (
                    <button 
                      onClick={(e) => { e.preventDefault(); openWhatsApp(c.whatsapp, c.name); }}
                      className="flex items-center gap-1 text-green-600 hover:text-green-700 transition-colors"
                      title="Open WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {c.phone && (
                    <button 
                      onClick={(e) => { e.preventDefault(); openSMS(c.phone, c.name); }}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
                      title="Send SMS"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {c.assignedEmployeeNames?.length > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    {c.assignedEmployeeNames.slice(0, 3).map((name: string) => (
                      <Avatar key={name} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[9px] bg-muted font-bold">{getInitials(name)}</AvatarFallback>
                      </Avatar>
                    ))}
                    {c.assignedEmployeeNames.length > 3 && <span className="text-[10px] text-muted-foreground ml-1">+{c.assignedEmployeeNames.length - 3}</span>}
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
                <TableHead>Actions</TableHead>
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
                    {c.service_type && <div className="text-xs text-muted-foreground mb-1">{c.service_type}</div>}
                    <div className="flex flex-wrap gap-1">
                      {c.serviceLabels.slice(0, 3).map(s => <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-full ${SERVICE_COLORS[s] || "bg-muted text-muted-foreground"}`}>{s}</span>)}
                      {c.serviceLabels.length > 3 && <span className="text-[10px] text-muted-foreground">+{c.serviceLabels.length - 3}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {c.whatsapp && (
                        <button onClick={() => openWhatsApp(c.whatsapp, c.name)} className="p-1 rounded hover:bg-green-50 text-green-600" title="WhatsApp">
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      )}
                      {c.phone && (
                        <button onClick={() => openSMS(c.phone, c.name)} className="p-1 rounded hover:bg-blue-50 text-blue-600" title="SMS">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
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
