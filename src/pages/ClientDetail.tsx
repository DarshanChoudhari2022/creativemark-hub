import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Camera, FileText, Wallet, Instagram, Facebook, Twitter, Linkedin, Send, Plus, Trash2, Bell, MessageSquare, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PaymentBadge } from "@/components/shared";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";
import { formatINR, formatDateDDMMYYYY, waLink, smsLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { generateReceiptPDF } from "@/lib/pdf";
import { toast } from "sonner";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  Instagram,
  Facebook,
  "Twitter/X": Twitter,
  LinkedIn: Linkedin,
};

const PLATFORM_COLORS: Record<string, string> = {
  Instagram: "text-pink-500",
  Facebook: "text-blue-600",
  "Twitter/X": "text-gray-700",
  LinkedIn: "text-blue-700",
};

const POST_STATUS_COLORS: Record<string, string> = {
  Published: "bg-green-100 text-green-700",
  Scheduled: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
};

const ClientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<any | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shootOpen, setShootOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [svcOpen, setSvcOpen] = useState(false);
  const [svcName, setSvcName] = useState("");
  const [teamEmpId, setTeamEmpId] = useState("");
  const [shootForm, setShootForm] = useState({ date: "", time: "", location: "", crew: [] as string[], notes: "", billAmount: 0 });
  const [postForm, setPostForm] = useState({ date: "", platform: "Instagram", postType: "Image", caption: "", status: "Draft" });
  const [payForm, setPayForm] = useState({ invoiceNo: "", date: "", amount: 0, status: "Paid", notes: "", paymentMode: "UPI" as string, chequeNo: "", transactionId: "" });

  const fetchClient = async () => {
    if (!id) return;
    setLoading(true);

    const { data: clientData, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (clientError || !clientData) {
      console.error("Client fetch error:", clientError?.message);
      setLoading(false);
      return;
    }

    const [servicesRes, shootsRes, postsRes, paymentsRes, eRes] = await Promise.all([
      supabase.from("client_services").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("client_shoots").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("client_posts").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("payment_history").select("*").eq("client_id", id).then(r => r.data || [], () => []),
      supabase.from("employees").select("id, name, role, phone"),
    ]);

    setClient({
      ...clientData,
      totalBilled: clientData.total_billed || 0,
      outstanding: clientData.outstanding || 0,
      monthlyRetainer: clientData.monthly_retainer || 0,
      paymentStatus: clientData.payment_status || "Current",
      services: servicesRes || [],
      shoots: shootsRes || [],
      posts: postsRes || [],
      paymentHistory: paymentsRes || [],
      assignedEmployees: clientData.assigned_employees || [],
    });
    setEmployees(eRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchClient();
  }, [id]);

  const handleAssignTeam = async () => {
    if (!teamEmpId) return;
    const current = client.assignedEmployees || [];
    if (current.includes(teamEmpId)) return toast.error("Already assigned");
    const updated = [...current, teamEmpId];
    
    const { error } = await supabase.from('clients').update({ assigned_employees: updated }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success("Team member assigned");
    setTeamEmpId("");
    fetchClient();
  };

  const handleRemoveTeam = async (empId: string) => {
    const updated = (client.assignedEmployees || []).filter((e: string) => e !== empId);
    const { error } = await supabase.from('clients').update({ assigned_employees: updated }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success("Team member removed");
    fetchClient();
  };

  const handleAddShoot = async () => {
    if (!shootForm.date || !shootForm.location) return toast.error("Date and Location required");
    const { error } = await supabase.from('client_shoots').insert({
      client_id: id,
      date: shootForm.date,
      reporting_time: shootForm.time,
      location: shootForm.location,
      assigned_employees: shootForm.crew,
      notes: shootForm.notes
    });
    if (error) return toast.error(error.message);
    
    if (shootForm.billAmount > 0) {
      // create a bill
      await supabase.from('quotations').insert({
        client_id: id,
        client_name: client.name,
        total_amount: shootForm.billAmount,
        status: 'Unpaid',
        is_bill: true,
        issue_date: shootForm.date,
        due_date: new Date(new Date(shootForm.date).getTime() + 7*24*60*60*1000).toISOString().split('T')[0]
      });
      // update client outstanding
      await supabase.from('clients').update({
        total_billed: (client.totalBilled || 0) + Number(shootForm.billAmount),
        outstanding: (client.outstanding || 0) + Number(shootForm.billAmount)
      }).eq('id', id);
    }
    
    toast.success("Shoot logged");
    setShootOpen(false);
    setShootForm({ date: "", time: "", location: "", crew: [], notes: "", billAmount: 0 });
    fetchClient();
  };

  const handleAddPost = async () => {
    if (!postForm.date) return toast.error("Date required");
    const { error } = await supabase.from('client_posts').insert({
      client_id: id,
      date: postForm.date,
      platform: postForm.platform,
      post_type: postForm.postType,
      caption: postForm.caption,
      status: postForm.status
    });
    if (error) return toast.error(error.message);
    toast.success("Post scheduled");
    setPostOpen(false);
    setPostForm({ date: "", platform: "Instagram", postType: "Image", caption: "", status: "Draft" });
    fetchClient();
  };

  const handleAddPayment = async () => {
    if (!payForm.amount || !payForm.date) return toast.error("Amount and date required");
    const { error } = await supabase.from('payment_history').insert({
      client_id: id,
      invoice_no: payForm.invoiceNo,
      date: payForm.date,
      amount: payForm.amount,
      status: payForm.status,
      payment_mode: payForm.paymentMode,
      cheque_no: payForm.chequeNo || null,
      transaction_id: payForm.transactionId || null,
      notes: payForm.notes
    });
    if (error) return toast.error(error.message);
    
    // Always update outstanding when recording a received payment
    await supabase.from('clients').update({
      outstanding: Math.max(0, (client.outstanding || 0) - Number(payForm.amount))
    }).eq('id', id);
    
    const savedForm = { ...payForm };
    toast.success("Payment recorded! ✅", {
      action: {
        label: "Generate Receipt",
        onClick: () => {
          generateReceiptPDF({
            clientName: client.name,
            invoiceNo: savedForm.invoiceNo,
            date: savedForm.date,
            amount: savedForm.amount,
            paymentMode: savedForm.paymentMode,
            chequeNo: savedForm.chequeNo,
            transactionId: savedForm.transactionId,
            notes: savedForm.notes,
            totalBilled: client.totalBilled,
            totalPaid: totalReceived + savedForm.amount,
            balanceDue: Math.max(0, client.totalBilled - totalReceived - savedForm.amount),
          });
        }
      }
    });
    setPayOpen(false);
    setPayForm({ invoiceNo: "", date: "", amount: 0, status: "Paid", notes: "", paymentMode: "UPI", chequeNo: "", transactionId: "" });
    fetchClient();
  };

  const handleAddService = async () => {
    if (!svcName.trim()) return toast.error("Service name required");
    const { error } = await supabase.from('client_services').insert({ client_id: id, service_name: svcName.trim(), active: true });
    if (error) return toast.error(error.message);
    toast.success("Service added");
    setSvcOpen(false);
    setSvcName("");
    fetchClient();
  };

  const handleRemoveService = async (svcId: string) => {
    const { error } = await supabase.from('client_services').delete().eq('id', svcId);
    if (error) return toast.error(error.message);
    toast.success("Service removed");
    fetchClient();
  };

  const handleGenerateReceipt = (entry: any) => {
    generateReceiptPDF({
      clientName: client.name,
      invoiceNo: entry.invoice_no || entry.invoiceNo || "",
      date: entry.date,
      amount: entry.amount,
      paymentMode: entry.payment_mode || entry.paymentMode || "Cash",
      chequeNo: entry.cheque_no || "",
      transactionId: entry.transaction_id || "",
      notes: entry.notes,
      totalBilled: client.totalBilled,
      totalPaid: totalReceived,
      balanceDue: client.outstanding,
    });
  };

  const sendPaymentReminder = () => {
    const msg = WHATSAPP_TEMPLATES.RECOVERY_SOFT(client.name, formatINR(client.outstanding), "");
    window.open(waLink(client.whatsapp, msg), "_blank");
  };

  const sendPaymentReminderSMS = () => {
    const msg = `Hi ${client.name}, this is a friendly reminder from CreativeMark regarding your pending balance of ${formatINR(client.outstanding)}. Kindly process the payment at the earliest. Thank you!`;
    window.open(smsLink(client.phone, msg), "_blank");
  };


  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Loading client…</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-muted-foreground mb-2">Client not found</h2>
        <Link to="/clients"><Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to Clients</Button></Link>
      </div>
    );
  }

  const assigned = employees.filter((e) => client.assignedEmployees.includes(e.id));
  const totalReceived = useMemo(() => (client.paymentHistory || []).reduce((s: number, p: any) => s + (p.amount || 0), 0), [client.paymentHistory]);

  return (
    <div>
      <div className="mb-4">
        <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Clients
        </Link>
      </div>

      {/* Header Card */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-extrabold">{client.name}</h1>
              <Badge variant="outline" className="text-xs font-semibold">{client.category}</Badge>
              <PaymentBadge status={client.paymentStatus} />
            </div>
            {client.area && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {client.area}</div>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {client.phone}</span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {client.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.whatsapp && (
              <a href={waLink(client.whatsapp, WHATSAPP_TEMPLATES.CLIENT_GREETING(client.name))} target="_blank" rel="noopener">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"><Send className="h-4 w-4" /> WhatsApp</Button>
              </a>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-border">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Total Billed</div>
            <div className="text-xl font-extrabold">{formatINR(client.totalBilled)}</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-xs text-muted-foreground">Received</div>
            <div className="text-xl font-extrabold text-green-600">{formatINR(totalReceived)}</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className={`text-xl font-extrabold ${client.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(client.outstanding)}</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Team Members</div>
            <div className="text-xl font-extrabold">{assigned.length}</div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="services" className="space-y-4">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0">
          {[
            { value: "services", label: "Services & Team" },
            { value: "social", label: "Social Calendar" },
            { value: "posts", label: "Post Log" },
            { value: "shoots", label: "Shoots" },
            { value: "payments", label: "Payment History" },
          ].map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 text-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Services & Team */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">Active Services</h3>
                <Dialog open={svcOpen} onOpenChange={setSvcOpen}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button></DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Add Service</DialogTitle></DialogHeader>
                    <div><Label>Service Name</Label><Input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. Social Media, Reels, Logo Design" /></div>
                    <DialogFooter><Button onClick={handleAddService}>Save</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="space-y-2">
                {client.services.map((s: any) => {
                  const serviceName = typeof s === 'string' ? s : (s.service_name || s.serviceName);
                  const serviceId = typeof s === 'string' ? s : s.id;
                  return (
                    <div key={serviceId} className="flex items-center justify-between p-2 rounded-lg border border-border">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{serviceName}</span>
                      </div>
                      {typeof s !== 'string' && s.id && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveService(s.id)}><Trash2 className="h-3 w-3" /></Button>}
                    </div>
                  );
                })}
                {client.services.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No services assigned</div>}
              </div>
            </Card>
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base">Assigned Team</h3>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Select value={teamEmpId} onValueChange={setTeamEmpId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => !(client.assignedEmployees || []).includes(e.id)).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssignTeam} disabled={!teamEmpId}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                {assigned.length > 0 ? assigned.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div>
                      <div className="text-sm font-semibold">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.role}</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveTeam(emp.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-4">No team members assigned</div>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Social Calendar — shows next meeting from calendar_events */}
        <TabsContent value="social">
          <Card className="p-5">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Upcoming Events & Next Meeting</h3>
            {client.posts.length > 0 ? (
              <div className="space-y-2">
                {client.posts.map((post: any) => (
                  <div key={post.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <div className="text-sm font-semibold">{post.caption || "Untitled"}</div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{post.post_type || post.postType}</Badge>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">{formatDateDDMMYYYY(new Date(post.date))}</div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-muted-foreground text-center py-6">No upcoming events</div>}
          </Card>
        </TabsContent>

        {/* Post Log */}
        <TabsContent value="posts">
          <div className="flex justify-end mb-3">
            <Dialog open={postOpen} onOpenChange={setPostOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Post</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Schedule a Post</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div><Label>Date</Label><Input type="date" value={postForm.date} onChange={e => setPostForm(p => ({ ...p, date: e.target.value }))} /></div>
                  <div><Label>Platform</Label>
                    <Select value={postForm.platform} onValueChange={v => setPostForm(p => ({ ...p, platform: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Instagram","Facebook","Twitter/X","LinkedIn","YouTube","Other"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Type</Label>
                    <Select value={postForm.postType} onValueChange={v => setPostForm(p => ({ ...p, postType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Image","Video","Reel","Story","Carousel","Other"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Caption</Label><Textarea value={postForm.caption} onChange={e => setPostForm(p => ({ ...p, caption: e.target.value }))} /></div>
                  <div><Label>Status</Label>
                    <Select value={postForm.status} onValueChange={v => setPostForm(p => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["Draft","Scheduled","Published"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={handleAddPost}>Save Post</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead>Type</TableHead>
                  <TableHead>Caption</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.posts.length > 0 ? client.posts.map((post: any) => {
                  const platform = post.platform || "Instagram";
                  const PlatformIcon = PLATFORM_ICONS[platform] || Instagram;
                  return (
                    <TableRow key={post.id}>
                      <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(post.date))}</TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 ${PLATFORM_COLORS[platform] || ""}`}>
                          <PlatformIcon className="h-4 w-4" /> {platform}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{post.post_type || post.postType}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{post.caption}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${POST_STATUS_COLORS[post.status] || ""}`}>{post.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                }) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No posts logged</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Shoots */}
        <TabsContent value="shoots">
          <div className="flex justify-end mb-3">
            <Dialog open={shootOpen} onOpenChange={setShootOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Log Shoot</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Shoot / Development Work</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date</Label><Input type="date" value={shootForm.date} onChange={e => setShootForm(p => ({ ...p, date: e.target.value }))} /></div>
                    <div><Label>Reporting Time</Label><Input type="time" value={shootForm.time} onChange={e => setShootForm(p => ({ ...p, time: e.target.value }))} /></div>
                  </div>
                  <div><Label>Location</Label><Input value={shootForm.location} onChange={e => setShootForm(p => ({ ...p, location: e.target.value }))} placeholder="Studio / On-site address" /></div>
                  <div>
                    <Label>Crew (who did the shoot)</Label>
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {shootForm.crew.map(eid => {
                        const emp = employees.find(e => e.id === eid);
                        return <Badge key={eid} variant="secondary" className="cursor-pointer" onClick={() => setShootForm(p => ({ ...p, crew: p.crew.filter(x => x !== eid) }))}>{emp?.name || eid} ✕</Badge>;
                      })}
                    </div>
                    <Select onValueChange={v => { if (!shootForm.crew.includes(v)) setShootForm(p => ({ ...p, crew: [...p.crew, v] })); }}>
                      <SelectTrigger><SelectValue placeholder="Add crew member" /></SelectTrigger>
                      <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bill Amount (₹)</Label><Input type="number" value={shootForm.billAmount || ""} onChange={e => setShootForm(p => ({ ...p, billAmount: Number(e.target.value) }))} placeholder="0 = no bill" /></div>
                  <div><Label>Notes</Label><Textarea value={shootForm.notes} onChange={e => setShootForm(p => ({ ...p, notes: e.target.value }))} /></div>
                </div>
                <DialogFooter><Button onClick={handleAddShoot}>Save Shoot</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Location</TableHead>
                  <TableHead>Crew</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.shoots.length > 0 ? client.shoots.map((shoot: any) => (
                  <TableRow key={shoot.id}>
                    <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(shoot.date))}</TableCell>
                    <TableCell className="font-mono text-sm">{shoot.reporting_time || shoot.reportingTime}</TableCell>
                    <TableCell className="text-sm">{shoot.location}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(shoot.assigned_employees || shoot.assignedEmployees || []).map((eid: string) => {
                          const emp = employees.find(e => e.id === eid);
                          return <span key={eid} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted font-medium">{emp?.name.split(" ")[0] || eid}</span>;
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${shoot.status === "Completed" ? "bg-green-100 text-green-700" : shoot.status === "Scheduled" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{shoot.status}</Badge>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No shoots scheduled</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Payment History */}
        <TabsContent value="payments">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            {client.outstanding > 0 && client.whatsapp && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={sendPaymentReminder}><Send className="h-4 w-4 mr-1" /> WhatsApp Reminder</Button>
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-50" onClick={sendPaymentReminderSMS}><MessageSquare className="h-4 w-4 mr-1" /> SMS Reminder</Button>
              </div>
            )}
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Payment</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Payment Received</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Invoice #</Label><Input value={payForm.invoiceNo} onChange={e => setPayForm(p => ({ ...p, invoiceNo: e.target.value }))} placeholder="INV-001" /></div>
                    <div><Label>Date *</Label><Input type="date" value={payForm.date} onChange={e => setPayForm(p => ({ ...p, date: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Amount (₹) *</Label><Input type="number" value={payForm.amount || ""} onChange={e => setPayForm(p => ({ ...p, amount: Number(e.target.value) }))} /></div>
                    <div><Label>Payment Mode</Label>
                      <Select value={payForm.paymentMode} onValueChange={v => setPayForm(p => ({ ...p, paymentMode: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["Cash","UPI","NEFT","Cheque","Bank Transfer","Google Pay","PhonePe"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  {payForm.paymentMode === "Cheque" && (
                    <div><Label>Cheque Number</Label><Input value={payForm.chequeNo} onChange={e => setPayForm(p => ({ ...p, chequeNo: e.target.value }))} placeholder="e.g. 123456" /></div>
                  )}
                  {["UPI","NEFT","Bank Transfer","Google Pay","PhonePe"].includes(payForm.paymentMode) && (
                    <div><Label>Transaction ID / Reference</Label><Input value={payForm.transactionId} onChange={e => setPayForm(p => ({ ...p, transactionId: e.target.value }))} placeholder="e.g. TXN202604240001" /></div>
                  )}
                  <div><Label>Notes</Label><Textarea value={payForm.notes} onChange={e => setPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="e.g. Partial payment for April services" /></div>
                </div>
                <DialogFooter><Button onClick={handleAddPayment}>Save & Record Payment</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Bill Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Total Billed</div><div className="text-lg font-bold">{formatINR(client.totalBilled)}</div></Card>
            <Card className="p-3 text-center bg-green-50"><div className="text-xs text-muted-foreground">Received</div><div className="text-lg font-bold text-green-600">{formatINR(totalReceived)}</div></Card>
            <Card className="p-3 text-center"><div className="text-xs text-muted-foreground">Pending</div><div className={`text-lg font-bold ${client.outstanding > 0 ? "text-red-600" : "text-green-600"}`}>{formatINR(client.outstanding)}</div></Card>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(client.paymentHistory || []).length > 0 ? (client.paymentHistory || []).map((entry: any, i: number) => (
                  <TableRow key={entry.id || i}>
                    <TableCell className="font-mono font-semibold text-sm">{entry.invoice_no || entry.invoiceNo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(entry.date))}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(entry.amount)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{entry.payment_mode || entry.paymentMode || "Cash"}</Badge></TableCell>
                    <TableCell><PaymentBadge status={entry.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{entry.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleGenerateReceipt(entry)}><Download className="h-3 w-3 mr-1" />Receipt</Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No payment records</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetail;
