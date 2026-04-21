import { useState, useMemo } from "react";
import { Plus, Search, Phone, Mail, Calendar, Clock, Wallet, ChevronDown, Briefcase, Users as UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared";
import { employees as initialEmployees } from "@/data/employees";
import { clients } from "@/data/clients";
import { formatINR, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Employee, EmployeeRole, WorkLog } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700 border-green-200",
  "On Leave": "bg-amber-100 text-amber-700 border-amber-200",
  Inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

const Employees = () => {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", role: "Graphic Designer" as EmployeeRole, phone: "", email: "", salary: 0 });
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), clientId: "", workType: "", location: "", hours: 0, notes: "" });

  const filtered = useMemo(() =>
    employees.filter(e =>
      search === "" ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase())
    ), [employees, search]);

  const addEmployee = () => {
    if (!form.name) { toast.error("Employee name is required"); return; }
    const newEmp: Employee = {
      id: `E-${String(employees.length + 1).padStart(3, "0")}`,
      name: form.name, role: form.role, phone: form.phone, email: form.email,
      salary: form.salary, advanceTaken: 0, duesPending: 0,
      joiningDate: new Date().toISOString().slice(0, 10),
      status: "Active", onFieldToday: false, assignedClients: [], workLogs: [],
    };
    setEmployees([...employees, newEmp]);
    setAddOpen(false);
    setForm({ name: "", role: "Graphic Designer", phone: "", email: "", salary: 0 });
    toast.success("Employee added successfully");
  };

  const addWorkLog = () => {
    if (!selectedEmp || !logForm.clientId || !logForm.workType) { toast.error("Fill all required fields"); return; }
    const client = clients.find(c => c.id === logForm.clientId);
    const newLog: WorkLog = {
      date: logForm.date, clientId: logForm.clientId,
      clientName: client?.name || "—", workType: logForm.workType,
      location: logForm.location, hours: logForm.hours, notes: logForm.notes,
    };
    setEmployees(employees.map(e => e.id === selectedEmp.id ? { ...e, workLogs: [newLog, ...e.workLogs] } : e));
    setLogOpen(false);
    setLogForm({ date: new Date().toISOString().slice(0, 10), clientId: "", workType: "", location: "", hours: 0, notes: "" });
    toast.success("Work log added");
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const sendWorkLogToClient = (emp: Employee, log: WorkLog) => {
    const msg = `Hi, this is to confirm that ${emp.name} (${emp.role}) worked on "${log.workType}" at ${log.location} on ${formatDateDDMMYYYY(new Date(log.date))} for ${log.hours} hours. — CreativeMark`;
    const client = clients.find(c => c.id === log.clientId);
    if (client?.whatsapp) window.open(waLink(client.whatsapp, msg), "_blank");
  };

  const roles: EmployeeRole[] = ["Video Editor", "Graphic Designer", "Social Media Manager", "Photographer", "Campaign Strategist", "Content Writer", "Sales Executive", "Project Manager"];

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} team members`}
        actions={
          <>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, role…" className="pl-9 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button className="bg-primary hover:bg-primary-hover"><Plus className="h-4 w-4" />Add Employee</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add New Employee</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Full Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Vikram Joshi" /></div>
                  <div><Label>Role</Label>
                    <Select value={form.role} onValueChange={(v: EmployeeRole) => setForm({ ...form, role: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                  <div><Label>Monthly Salary ₹</Label><Input type="number" value={form.salary} onChange={(e) => setForm({ ...form, salary: +e.target.value })} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addEmployee}>Save Employee</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {/* Summary Pills */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-semibold">
          <span className="h-2 w-2 bg-green-500 rounded-full" /> Active: {employees.filter(e => e.status === "Active").length}
        </div>
        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-semibold">
          <span className="h-2 w-2 bg-amber-500 rounded-full" /> On Leave: {employees.filter(e => e.status === "On Leave").length}
        </div>
        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
          <Briefcase className="h-3 w-3" /> On Field Today: {employees.filter(e => e.onFieldToday).length}
        </div>
      </div>

      {/* Employee Cards */}
      <div className="space-y-3">
        {filtered.map((emp) => {
          const isOpen = detailId === emp.id;
          const assignedClientsList = clients.filter(c => emp.assignedClients.includes(c.id));
          const totalHours = emp.workLogs.reduce((s, l) => s + l.hours, 0);

          return (
            <Collapsible key={emp.id} open={isOpen} onOpenChange={(open) => setDetailId(open ? emp.id : null)}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full text-left">
                  <div className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-11 w-11 border-2 border-border shrink-0">
                      <AvatarFallback className="font-bold text-sm bg-primary/10 text-primary">{getInitials(emp.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{emp.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[emp.status]}`}>{emp.status}</Badge>
                        {emp.onFieldToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">On Field</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{emp.role}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="text-center">
                        <div className="text-xs uppercase">Salary</div>
                        <div className="font-semibold text-foreground">{formatINR(emp.salary)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs uppercase">Dues</div>
                        <div className={`font-semibold ${emp.duesPending > 0 ? "text-primary" : "text-foreground"}`}>{formatINR(emp.duesPending)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs uppercase">Clients</div>
                        <div className="font-semibold text-foreground">{emp.assignedClients.length}</div>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="border-t border-border p-5 bg-muted/10">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      {/* Info */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-1.5"><UsersIcon className="h-4 w-4" /> Contact & Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {emp.phone}</div>
                          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {emp.email}</div>
                          <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Joined {formatDateDDMMYYYY(new Date(emp.joiningDate))}</div>
                        </div>
                        <div className="pt-2">
                          <h5 className="text-xs font-semibold text-muted-foreground mb-1.5">Assigned Clients</h5>
                          {assignedClientsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {assignedClientsList.map(c => (
                                <span key={c.id} className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">{c.name}</span>
                              ))}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">No clients assigned</span>}
                        </div>
                      </div>

                      {/* Salary & Dues */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Salary & Dues</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Monthly Salary</div>
                            <div className="text-lg font-bold">{formatINR(emp.salary)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Advance Taken</div>
                            <div className={`text-lg font-bold ${emp.advanceTaken > 0 ? "text-amber-600" : ""}`}>{formatINR(emp.advanceTaken)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Dues Pending</div>
                            <div className={`text-lg font-bold ${emp.duesPending > 0 ? "text-primary" : ""}`}>{formatINR(emp.duesPending)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Net Payable</div>
                            <div className="text-lg font-bold">{formatINR(emp.salary - emp.advanceTaken + emp.duesPending)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Work Log */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm flex items-center gap-1.5"><Clock className="h-4 w-4" /> Recent Work Log</h4>
                          <Button
                            size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => { setSelectedEmp(emp); setLogOpen(true); }}
                          >
                            <Plus className="h-3 w-3" /> Log Work
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">{totalHours} total hours logged</div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {emp.workLogs.slice(0, 5).map((log, i) => (
                            <div key={i} className="flex items-start justify-between p-2 rounded border border-border text-xs hover:bg-muted/30 transition-colors">
                              <div>
                                <div className="font-semibold">{log.workType}</div>
                                <div className="text-muted-foreground">{log.clientName} · {log.location}</div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <div className="font-mono">{formatDateDDMMYYYY(new Date(log.date))}</div>
                                <div className="text-muted-foreground">{log.hours}h</div>
                              </div>
                            </div>
                          ))}
                          {emp.workLogs.length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No work logs yet</div>}
                        </div>
                        {emp.workLogs.length > 0 && (
                          <Button
                            size="sm" variant="ghost" className="text-xs w-full"
                            onClick={() => {
                              const latestLog = emp.workLogs[0];
                              sendWorkLogToClient(emp, latestLog);
                            }}
                          >Share Latest Log via WhatsApp</Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>

      {/* Log Work Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Log Work — {selectedEmp?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Date</Label><Input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} /></div>
            <div><Label>Client *</Label>
              <Select value={logForm.clientId} onValueChange={(v) => setLogForm({ ...logForm, clientId: v })}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Work Type *</Label><Input value={logForm.workType} onChange={(e) => setLogForm({ ...logForm, workType: e.target.value })} placeholder="e.g. Reel Shoot, Post Design" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Location</Label><Input value={logForm.location} onChange={(e) => setLogForm({ ...logForm, location: e.target.value })} placeholder="e.g. Office, Hadapsar" /></div>
              <div><Label>Hours</Label><Input type="number" min={0} max={24} value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: +e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={logForm.notes} onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button className="bg-primary hover:bg-primary-hover" onClick={addWorkLog}>Save Log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
