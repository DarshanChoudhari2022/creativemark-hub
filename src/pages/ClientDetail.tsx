import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { ArrowLeft, Phone, Mail, MapPin, Calendar, Camera, FileText, Wallet, Instagram, Facebook, Twitter, Linkedin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, PaymentBadge } from "@/components/shared";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";

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

  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      setLoading(true);

      const [cRes, eRes] = await Promise.all([
        supabase.from("clients").select("*, client_services(*), client_shoots(*), client_posts(*), payment_history(*)").eq("id", id).single(),
        supabase.from("employees").select("id, name, role, phone"),
      ]);

      if (cRes.data) {
        const c = cRes.data;
        setClient({
          ...c,
          totalBilled: c.total_billed || 0,
          outstanding: c.outstanding || 0,
          monthlyRetainer: c.monthly_retainer || 0,
          paymentStatus: c.payment_status || "Current",
          services: c.client_services || [],
          shoots: c.client_shoots || [],
          posts: c.client_posts || [],
          paymentHistory: c.payment_history || [],
          assignedEmployees: c.assigned_employees || [],
        });
      }
      setEmployees(eRes.data || []);
      setLoading(false);
    };
    fetchClient();
  }, [id]);

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
              <a href={waLink(client.whatsapp)} target="_blank" rel="noopener">
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
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Outstanding</div>
            <div className={`text-xl font-extrabold ${client.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(client.outstanding)}</div>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Monthly Retainer</div>
            <div className="text-xl font-extrabold">{client.monthlyRetainer > 0 ? formatINR(client.monthlyRetainer) : "—"}</div>
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
              <h3 className="font-bold text-base mb-3">Active Services</h3>
              <div className="space-y-2">
                {client.services.map((s: any) => {
                  const serviceName = typeof s === 'string' ? s : (s.service_name || s.serviceName);
                  const serviceId = typeof s === 'string' ? s : (s.id || s.service_name);
                  return (
                    <div key={serviceId} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-sm font-medium">{serviceName}</span>
                    </div>
                  );
                })}
                {client.services.length === 0 && <div className="text-sm text-muted-foreground text-center py-4">No services assigned</div>}
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-bold text-base mb-3">Assigned Team</h3>
              <div className="space-y-2">
                {assigned.length > 0 ? assigned.map(emp => (
                  <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div>
                      <div className="text-sm font-semibold">{emp.name}</div>
                      <div className="text-xs text-muted-foreground">{emp.role}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">{emp.phone}</div>
                  </div>
                )) : <div className="text-sm text-muted-foreground text-center py-4">No team members assigned</div>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Social Calendar */}
        <TabsContent value="social">
          <Card className="p-5">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Upcoming Social Calendar Events</h3>
            {client.posts.length > 0 ? (
              <div className="space-y-2">
                {client.posts.map((post: any) => (
                  <div key={post.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div>
                      <div className="text-sm font-semibold">{post.caption}</div>
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
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(client.paymentHistory || []).length > 0 ? (client.paymentHistory || []).map((entry: any, i: number) => (
                  <TableRow key={entry.id || i}>
                    <TableCell className="font-mono font-semibold text-sm">{entry.invoice_no || entry.invoiceNo}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDateDDMMYYYY(new Date(entry.date))}</TableCell>
                    <TableCell className="text-right font-semibold">{formatINR(entry.amount)}</TableCell>
                    <TableCell><PaymentBadge status={entry.status} /></TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No payment records</TableCell></TableRow>
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
