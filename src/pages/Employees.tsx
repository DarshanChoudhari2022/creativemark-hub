import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Phone, Mail, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared";
import { employees as initialEmps, EmployeeRole } from "@/data/employees";
import { formatINR } from "@/lib/format";
import { toast } from "sonner";

const Employees = () => {
  const [emps, setEmps] = useState(initialEmps);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Reel Shooter" as EmployeeRole, contact: "", email: "" });

  const add = () => {
    if (!form.name) return;
    setEmps([...emps, { id: `E-${String(emps.length + 1).padStart(3, "0")}`, ...form, duesCleared: 0, duesPending: 0, onFieldToday: false, workLog: [] }]);
    setOpen(false);
    setForm({ name: "", role: "Reel Shooter", contact: "", email: "" });
    toast.success("Employee added");
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${emps.length} contract employees`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Employee</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add employee</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div><Label>Role</Label>
                  <Select value={form.role} onValueChange={(v: EmployeeRole) => setForm({ ...form, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["Reel Shooter", "Graphic Designer", "Photographer", "Videographer"] as EmployeeRole[]).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Contact</Label><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
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
        {emps.map((e) => (
          <Card key={e.id} className="p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">{e.name.split(" ").map((n) => n[0]).join("")}</div>
              <div className="flex-1">
                <Link to={`/employees/${e.id}`} className="font-bold hover:text-primary">{e.name}</Link>
                <div className="text-xs text-muted-foreground">{e.role}</div>
              </div>
              {e.onFieldToday && <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15" variant="outline">On Field</Badge>}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{e.contact}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Cleared</div>
                <div className="font-bold text-success">{formatINR(e.duesCleared)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider">Pending</div>
                <div className={`font-bold ${e.duesPending > 0 ? "text-primary" : ""}`}>{formatINR(e.duesPending)}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Employees;
