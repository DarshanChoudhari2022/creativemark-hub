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
import { useSupabaseTable } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import { formatINR, formatDateDDMMYYYY, waLink, isValidIndianPhone } from "@/lib/format";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Employee, EmployeeRole, WorkLog } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700 border-green-200",
  "On Leave": "bg-amber-100 text-amber-700 border-amber-200",
  Inactive: "bg-gray-100 text-gray-500 border-gray-200",
};

const Employees = () => {
  const { data: employeesData, loading, insert: insertEmployee } = useSupabaseTable<any>('employees', '*, work_logs(*), client_assignments(client_id, clients(name))');
  const { data: clients } = useSupabaseTable<any>('clients', 'id, name, whatsapp');
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ 
    name: "", 
    role: "Graphic Designer" as EmployeeRole, 
    customRole: "",
    phone: "", 
    email: "", 
    salary: 0 
  });
  const [phoneError, setPhoneError] = useState("");
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), clientId: "", workType: "", location: "", hours: 0, notes: "" });

  const employees = useMemo(() => {
    return employeesData.map(e => ({
      ...e,
      assignedClients: e.client_assignments?.map((ca: any) => ca.client_id) || [],
      assignedClientNames: e.client_assignments?.map((ca: any) => ca.clients?.name).filter(Boolean) || [],
      displayRole: e.role === "Others" && e.custom_role ? e.custom_role : e.role,
    }));
  }, [employeesData]);

  const filtered = useMemo(() =>
    employees.filter(e =>
      search === "" ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.displayRole || e.role).toLowerCase().includes(search.toLowerCase())
    ), [employees, search]);

  const addEmployee = async () => {
    if (!form.name) { toast.error("Employee name is required"); return; }
    if (form.role === "Others" && !form.customRole.trim()) { toast.error("Please specify the custom role"); return; }
    if (form.phone && !isValidIndianPhone(form.phone)) { setPhoneError("Enter valid Indian number"); return; }
    
    const { error } = await insertEmployee({
      name: form.name,
      role: form.role === "Others" ? "Employee" : form.role,
      custom_role: form.role === "Others" ? form.customRole : null,
      phone: form.phone,
      whatsapp: form.phone,
      email: form.email,
      base_rate: form.salary,
      salary: form.salary,
      status: "Active",
    });

    if (error) {
      toast.error("Failed to add employee: " + error.message);
    } else {
      setAddOpen(false);
      setForm({ name: "", role: "Graphic Designer", customRole: "", phone: "", email: "", salary: 0 });
      setPhoneError("");
      toast.success("Employee added successfully");
    }
  };

  const addWorkLog = async () => {
    if (!selectedEmp || !logForm.clientId || !logForm.workType) { toast.error("Fill all required fields"); return; }
    
    const { error } = await supabase.from('work_logs').insert({
      employee_id: selectedEmp.id,
      date: logForm.date,
      client_id: logForm.clientId,
      work_type: logForm.workType,
      location: logForm.location,
      hours: logForm.hours,
      notes: logForm.notes,
      status: "Completed",
    });

    if (error) {
      toast.error("Failed to add work log: " + error.message);
    } else {
      setLogOpen(false);
      setLogForm({ date: new Date().toISOString().slice(0, 10), clientId: "", workType: "", location: "", hours: 0, notes: "" });
      toast.success("Work log added");
    }
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const sendWorkLogToClient = (emp: any, log: any) => {
    const msg = `Hi, this is to confirm that ${emp.name} (${emp.displayRole || emp.role}) worked on "${log.workType}" at ${log.location} on ${formatDateDDMMYYYY(new Date(log.date))} for ${log.hours} hours. — CreativeMark`;
    const client = clients?.find((c: any) => c.id === log.client_id);
    if (client?.whatsapp) window.open(waLink(client.whatsapp, msg), "_blank");
  };

  const roles: EmployeeRole[] = ["Video Editor", "Graphic Designer", "Social Media Manager", "Photographer", "Campaign Strategist", "Content Writer", "Sales Executive", "Project Manager", "Others"];

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
                    <Select value={form.role} onValueChange={(v: EmployeeRole) => setForm({ ...form, role: v, customRole: v === "Others" ? form.customRole : "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{roles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {form.role === "Others" && (
                    <div>
                      <Label>Specify Role *</Label>
                      <Input 
                        value={form.customRole} 
                        onChange={(e) => setForm({ ...form, customRole: e.target.value })} 
                        placeholder="e.g. Brand Consultant, Coordinator"
                        className="mt-1"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Phone</Label>
                      <Input 
                        value={form.phone} 
                        onChange={(e) => { setForm({ ...form, phone: e.target.value }); setPhoneError(""); }} 
                        placeholder="+91 98765 43210"
                        className={phoneError ? "border-red-500" : ""}
                      />
                      {phoneError && <p className="text-[11px] text-red-500 mt-0.5">{phoneError}</p>}
                    </div>
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

      <div className="space-y-3">
        {filtered.map((emp) => {
          const isOpen = detailId === emp.id;
          const assignedClientsList = clients?.filter((c: any) => emp.assignedClients.includes(c.id)) || [];
          const salary = emp.salary ?? emp.base_rate ?? 0;
          const advanceTaken = emp.advance_taken ?? 0;
          const duesPending = emp.dues_pending ?? 0;
          const netPayable = salary - advanceTaken + duesPending;
          const joiningDateVal = emp.date_joined || new Date().toISOString();

          const totalHours = emp.work_logs?.reduce((s, l) => {
            if (l.hours) return s + l.hours;
            return s;
          }, 0) || 0;

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
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[emp.status] || ""}`}>{emp.status}</Badge>
                        {emp.onFieldToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">On Field</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{emp.displayRole || emp.role}</div>
                    </div>
                    <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="text-center">
                        <div className="text-xs uppercase">Salary</div>
                        <div className="font-semibold text-foreground">{formatINR(salary)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs uppercase">Dues</div>
                        <div className={`font-semibold ${duesPending > 0 ? "text-primary" : "text-foreground"}`}>{formatINR(duesPending)}</div>
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
                      {/* Info Section */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-1.5"><UsersIcon className="h-4 w-4" /> Contact &amp; Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {emp.phone}</div>
                          <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {emp.email}</div>
                          <div className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Joined {formatDateDDMMYYYY(joiningDateVal)}</div>
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

                      {/* Salary Section */}
                      <div className="space-y-3">
                        <h4 className="font-bold text-sm flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Salary &amp; Dues</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Monthly Salary</div>
                            <div className="text-lg font-bold">{formatINR(salary)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Advance Taken</div>
                            <div className={`text-lg font-bold ${advanceTaken > 0 ? "text-amber-600" : ""}`}>{formatINR(advanceTaken)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Dues Pending</div>
                            <div className={`text-lg font-bold ${duesPending > 0 ? "text-primary" : ""}`}>{formatINR(duesPending)}</div>
                          </div>
                          <div className="p-3 bg-card rounded-lg border border-border">
                            <div className="text-xs text-muted-foreground">Net Payable</div>
                            <div className="text-lg font-bold">{formatINR(netPayable)}</div>
                          </div>
                        </div>
                      </div>

                      {/* Work Log Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm flex items-center gap-1.5"><Clock className="h-4 w-4" /> Recent Work</h4>
                          <Button 
                            size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => { setSelectedEmp(emp); setLogOpen(true); }}
                          >
                            <Plus className="h-3 w-3" /> Log Work
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">{totalHours.toFixed(1)} total hours logged</div>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {(emp.work_logs || []).slice(0, 5).map((log: any, i: number) => {
                            const duration = log.hours ?? (log.reportingTime && log.endTime ? ((new Date(`2000-01-01T${log.endTime}`).getTime() - new Date(`2000-01-01T${log.reportingTime}`).getTime()) / (1000 * 60 * 60)).toFixed(1) : null);
                            return (
                              <div key={i} className="flex items-start justify-between p-2 rounded border border-border text-xs hover:bg-muted/30 transition-colors">
                                <div className="min-w-0 flex-1">
                                  <div className="font-semibold truncate">{log.work_type}</div>
                                  <div className="text-muted-foreground truncate">{log.client_name || ''} · {log.location}</div>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <div className="font-mono">{formatDateDDMMYYYY(log.date)}</div>
                                  <div className="text-muted-foreground">{duration ?? "—"}h</div>
                                </div>
                              </div>
                            );
                          })}
                          {(emp.work_logs || []).length === 0 && <div className="text-xs text-muted-foreground text-center py-3">No work logged yet</div>}
                        </div>
                        {(emp.work_logs || []).length > 0 && (
                          <Button 
                            size="sm" variant="ghost" className="text-xs w-full"
                            onClick={() => sendWorkLogToClient(emp, emp.work_logs[0])}
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
