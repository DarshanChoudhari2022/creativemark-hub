import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Phone, Mail, Calendar, Camera, Users as UsersIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { clients } from "@/data/clients";
import { employees } from "@/data/employees";
import { PaymentBadge } from "@/components/shared";
import { formatINR } from "@/lib/format";

const ClientDetail = () => {
  const { id } = useParams();
  const client = clients.find((c) => c.id === id);
  if (!client) return <div className="p-6">Client not found. <Link to="/clients" className="text-primary">Back</Link></div>;
  const assigned = employees.filter((e) => client.assignedEmployees.includes(e.id));

  return (
    <div>
      <Link to="/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Back to Clients</Link>
      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <Badge variant="outline">{client.category}</Badge>
              <PaymentBadge status={client.paymentStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.contact}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.email}</span>
              <span>ID: {client.id}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6 text-right">
            <div><div className="text-xs text-muted-foreground">Total Billed</div><div className="text-lg font-bold">{formatINR(client.totalBilled)}</div></div>
            <div><div className="text-xs text-muted-foreground">Outstanding</div><div className={`text-lg font-bold ${client.outstanding > 0 ? "text-primary" : ""}`}>{formatINR(client.outstanding)}</div></div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="calendar">Social Calendar</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="reels">Reel Shoots</TabsTrigger>
          <TabsTrigger value="team">Assigned Team</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {client.services.map((s) => (
                <div key={s} className="p-4 border border-border rounded-lg flex items-center gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Camera className="h-5 w-5" /></div>
                  <div className="font-semibold">{s}</div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="calendar">
          <Card className="p-5">
            {client.socialCalendar.length === 0 ? <p className="text-sm text-muted-foreground">No scheduled activity yet.</p> : (
              <div className="space-y-2">
                {client.socialCalendar.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="font-semibold w-28">{s.date}</span>
                    <span>{s.activity}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="posts">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Platform</TableHead><TableHead>Caption</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {client.posts.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No posts yet.</TableCell></TableRow> :
                  client.posts.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{p.date}</TableCell>
                      <TableCell>{p.platform}</TableCell>
                      <TableCell>{p.caption}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="reels">
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Location</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {client.reelShoots.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No shoots scheduled.</TableCell></TableRow> :
                  client.reelShoots.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.date}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
        <TabsContent value="team">
          <Card className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {assigned.length === 0 ? <p className="text-sm text-muted-foreground">No employees assigned.</p> :
                assigned.map((e) => (
                  <Link key={e.id} to={`/employees/${e.id}`} className="p-4 border border-border rounded-lg hover:border-primary transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{e.name.split(" ").map((n) => n[0]).join("")}</div>
                      <div>
                        <div className="font-semibold">{e.name}</div>
                        <div className="text-xs text-muted-foreground">{e.role}</div>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClientDetail;
