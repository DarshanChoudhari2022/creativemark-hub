import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Phone, Mail, Share2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { employees } from "@/data/employees";
import { formatINR } from "@/lib/format";
import { StatusBadge } from "@/components/shared";
import { toast } from "sonner";

const EmployeeDetail = () => {
  const { id } = useParams();
  const emp = employees.find((e) => e.id === id);
  const [shareOpen, setShareOpen] = useState<string | null>(null);
  if (!emp) return <div className="p-6">Not found</div>;

  // Build a simple monthly grid for current month
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOffset = new Date(year, month, 1).getDay();
  const cells = Array.from({ length: firstDayOffset + daysInMonth }, (_, i) => (i < firstDayOffset ? null : i - firstDayOffset + 1));

  const workDays = new Set(emp.workLog.map((w) => parseInt(w.date.split("/")[0])));

  return (
    <div>
      <Link to="/employees" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <Card className="p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold">{emp.name.split(" ").map((n) => n[0]).join("")}</div>
            <div>
              <h1 className="text-2xl font-bold">{emp.name}</h1>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                <Badge variant="outline">{emp.role}</Badge>
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{emp.contact}</span>
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{emp.email}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-6 text-right">
            <div><div className="text-xs text-muted-foreground">Cleared</div><div className="text-lg font-bold text-success">{formatINR(emp.duesCleared)}</div></div>
            <div><div className="text-xs text-muted-foreground">Pending</div><div className={`text-lg font-bold ${emp.duesPending > 0 ? "text-primary" : ""}`}>{formatINR(emp.duesPending)}</div></div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-5 lg:col-span-1">
          <h3 className="font-bold mb-3">Work Calendar — {today.toLocaleString("en-IN", { month: "long", year: "numeric" })}</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground mb-1">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => (
              <div key={i} className={`aspect-square text-xs flex items-center justify-center rounded ${d === null ? "" : workDays.has(d) ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"}`}>
                {d ?? ""}
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-3">Red squares = scheduled work days</div>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-5 pb-3"><h3 className="font-bold">Work Log</h3></div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Work</TableHead><TableHead>Reporting</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {emp.workLog.map((w, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{w.date}</TableCell>
                  <TableCell className="font-semibold">{w.clientName}</TableCell>
                  <TableCell>{w.workType}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{w.reportingTime}</TableCell>
                  <TableCell className="text-right font-semibold">{formatINR(w.agreedAmount)}</TableCell>
                  <TableCell><StatusBadge status={w.status} /></TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setShareOpen(w.clientName)}>
                      <Share2 className="h-3.5 w-3.5" />Share
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={!!shareOpen} onOpenChange={() => setShareOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share with {shareOpen}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A summary of {emp.name}'s assigned work will be shared with the client via WhatsApp and email.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareOpen(null)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary-hover" onClick={() => { toast.success("Shared with client"); setShareOpen(null); }}>Share Now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeDetail;
