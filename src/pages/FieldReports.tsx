import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Download, MapPin, Phone, Building, Calendar, User, TrendingUp, ShieldCheck, ShieldX, Clock, ChevronDown, CalendarDays, Users } from "lucide-react";

export default function FieldReports() {
  const [selectedEmp, setSelectedEmp] = useState<string>("all");
  const [view, setView] = useState<"table" | "day" | "employee">("table");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: employees } = useSupabaseTable<any>("employees", "id, name, role, email, status");
  const { data: visits } = useSupabaseTable<any>(
    "society_data",
    "id, employee_id, name, address, contact_person, contact_phone, number_of_flats, verification_status, lat, lng, created_at, selfie_url, building_photo_url"
  );
  const { data: shifts } = useSupabaseTable<any>(
    "employee_shifts",
    "id, employee_id, started_at, ended_at, duration_min, visit_count"
  );

  const activeEmployees = useMemo(
    () => employees.filter((e: any) => e.status === "Active"),
    [employees]
  );

  const monthStart = useMemo(() => new Date(`${month}-01T00:00:00`), [month]);
  const monthEnd = useMemo(() => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + 1);
    return d;
  }, [monthStart]);

  const filteredVisits = useMemo(() => {
    return visits.filter((v: any) => {
      const d = new Date(v.created_at);
      if (d < monthStart || d >= monthEnd) return false;
      if (selectedEmp !== "all" && v.employee_id !== selectedEmp) return false;
      return true;
    });
  }, [visits, monthStart, monthEnd, selectedEmp]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((s: any) => {
      const d = new Date(s.started_at);
      if (d < monthStart || d >= monthEnd) return false;
      if (selectedEmp !== "all" && s.employee_id !== selectedEmp) return false;
      return true;
    });
  }, [shifts, monthStart, monthEnd, selectedEmp]);

  const summaryStats = useMemo(() => {
    const total = filteredVisits.length;
    let real = 0, fake = 0, pending = 0;
    for (const v of filteredVisits) {
      const st = v.verification_status || "pending";
      if (st === "verified_real") real++;
      else if (st === "verified_fake") fake++;
      else pending++;
    }
    const totalShiftMin = filteredShifts.reduce((s: number, sh: any) => s + (sh.duration_min || 0), 0);
    const shiftHours = Math.round(totalShiftMin / 60 * 10) / 10;
    return { total, real, fake, pending, shiftHours, shiftCount: filteredShifts.length };
  }, [filteredVisits, filteredShifts]);

  const dailyChart = useMemo(() => {
    const days: Record<string, number> = {};
    for (const v of filteredVisits) {
      const day = new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      days[day] = (days[day] || 0) + 1;
    }
    return Object.entries(days).map(([label, count]) => ({ label, count }));
  }, [filteredVisits]);

  const perEmployee = useMemo(() => {
    const map: Record<string, { name: string; visits: number; real: number; fake: number; pending: number; hours: number }> = {};
    for (const e of activeEmployees) {
      map[e.id] = { name: e.name, visits: 0, real: 0, fake: 0, pending: 0, hours: 0 };
    }
    for (const v of filteredVisits) {
      if (!map[v.employee_id]) continue;
      map[v.employee_id].visits++;
      const st = v.verification_status || "pending";
      if (st === "verified_real") map[v.employee_id].real++;
      else if (st === "verified_fake") map[v.employee_id].fake++;
      else map[v.employee_id].pending++;
    }
    for (const s of filteredShifts) {
      if (!map[s.employee_id]) continue;
      map[s.employee_id].hours += (s.duration_min || 0) / 60;
    }
    return Object.values(map).filter(e => e.visits > 0).sort((a, b) => b.visits - a.visits);
  }, [filteredVisits, filteredShifts, activeEmployees]);

  const empName = (id: string) => employees.find((e: any) => e.id === id)?.name || "Unknown";

  const dayWiseVisits = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const v of filteredVisits) {
      const dateKey = new Date(v.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(v);
    }
    return Object.entries(groups).map(([date, items]) => {
      let real = 0, fake = 0, pending = 0;
      for (const item of items) {
        const st = item.verification_status || "pending";
        if (st === "verified_real") real++;
        else if (st === "verified_fake") fake++;
        else pending++;
      }
      return {
        date,
        items: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        stats: { total: items.length, real, fake, pending }
      };
    }).sort((a, b) => new Date(b.items[0].created_at).getTime() - new Date(a.items[0].created_at).getTime());
  }, [filteredVisits]);

  const employeeWiseVisits = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const v of filteredVisits) {
      const empId = v.employee_id || "unknown";
      if (!groups[empId]) groups[empId] = [];
      groups[empId].push(v);
    }
    return Object.entries(groups).map(([empId, items]) => {
      let real = 0, fake = 0, pending = 0;
      for (const item of items) {
        const st = item.verification_status || "pending";
        if (st === "verified_real") real++;
        else if (st === "verified_fake") fake++;
        else pending++;
      }
      return {
        empId,
        name: empName(empId),
        items: items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
        stats: { total: items.length, real, fake, pending }
      };
    }).sort((a, b) => b.items.length - a.items.length);
  }, [filteredVisits, employees]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const monthOptions = useMemo(() => {
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      opts.push({ val, label });
    }
    return opts;
  }, []);

  const exportCSV = () => {
    const headers = ["Date", "Employee", "Society", "Address", "Contact Person", "Contact Phone", "Flats", "Status"];
    const rows = filteredVisits.map((v: any) => [
      new Date(v.created_at).toLocaleDateString("en-IN"),
      empName(v.employee_id),
      v.name,
      v.address || "",
      v.contact_person || "",
      v.contact_phone || "",
      v.number_of_flats || "",
      v.verification_status || "pending",
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `field-report-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Field Reports</h1>
          <p className="text-sm text-muted-foreground">Monthly field activity by employee</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {monthOptions.map(o => <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedEmp} onValueChange={setSelectedEmp}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Employees" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {activeEmployees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Card className="p-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
          <div className="text-2xl font-bold">{summaryStats.total}</div>
          <div className="text-xs text-muted-foreground">Total Visits</div>
        </Card>
        <Card className="p-4 text-center">
          <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-green-600" />
          <div className="text-2xl font-bold text-green-600">{summaryStats.real}</div>
          <div className="text-xs text-muted-foreground">Verified Real</div>
        </Card>
        <Card className="p-4 text-center">
          <ShieldX className="w-5 h-5 mx-auto mb-1 text-red-600" />
          <div className="text-2xl font-bold text-red-600">{summaryStats.fake}</div>
          <div className="text-xs text-muted-foreground">Verified Fake</div>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-amber-600" />
          <div className="text-2xl font-bold text-amber-600">{summaryStats.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <Calendar className="w-5 h-5 mx-auto mb-1 text-blue-600" />
          <div className="text-2xl font-bold">{summaryStats.shiftCount}</div>
          <div className="text-xs text-muted-foreground">Shifts</div>
        </Card>
        <Card className="p-4 text-center">
          <Clock className="w-5 h-5 mx-auto mb-1 text-purple-600" />
          <div className="text-2xl font-bold">{summaryStats.shiftHours}h</div>
          <div className="text-xs text-muted-foreground">Field Hours</div>
        </Card>
      </div>

      {/* Daily chart */}
      {dailyChart.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Daily Visits</h3>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={dailyChart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="count" name="Visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Per-employee table (only when "all") */}
      {selectedEmp === "all" && perEmployee.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Employee-wise Summary</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Visits</TableHead>
                  <TableHead className="text-center">Real</TableHead>
                  <TableHead className="text-center">Fake</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perEmployee.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-center font-bold">{e.visits}</TableCell>
                    <TableCell className="text-center text-green-600">{e.real}</TableCell>
                    <TableCell className="text-center text-red-600">{e.fake}</TableCell>
                    <TableCell className="text-center text-amber-600">{e.pending}</TableCell>
                    <TableCell className="text-center">{Math.round(e.hours * 10) / 10}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Visit details */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-sm font-semibold">Visit Details ({filteredVisits.length})</h3>
          <div className="flex bg-muted rounded-lg p-0.5 border text-xs font-semibold">
            <button
              onClick={() => setView("table")}
              className={`px-3 py-1 rounded-md transition-all ${
                view === "table" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1 rounded-md transition-all ${
                view === "day" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Day-wise
            </button>
            <button
              onClick={() => setView("employee")}
              className={`px-3 py-1 rounded-md transition-all ${
                view === "employee" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Employee-wise
            </button>
          </div>
        </div>

        {view === "table" ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {selectedEmp === "all" && <TableHead>Employee</TableHead>}
                  <TableHead>Society</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-center">Flats</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVisits.slice(0, 100).map((v: any) => {
                  const st = v.verification_status || "pending";
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </TableCell>
                      {selectedEmp === "all" && (
                        <TableCell className="text-xs font-medium">{empName(v.employee_id)}</TableCell>
                      )}
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-xs max-w-[180px] truncate">{v.address || "-"}</TableCell>
                      <TableCell className="text-xs">{v.contact_person || "-"}</TableCell>
                      <TableCell className="text-xs">{v.contact_phone || "-"}</TableCell>
                      <TableCell className="text-center">{v.number_of_flats || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            st === "verified_real" ? "bg-green-50 text-green-700 border-green-200" :
                            st === "verified_fake" ? "bg-red-50 text-red-700 border-red-200" :
                            "bg-amber-50 text-amber-700 border-amber-200"
                          }
                        >
                          {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredVisits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No visits found for this period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {filteredVisits.length > 100 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Showing 100 of {filteredVisits.length} visits. Export CSV for full data.
              </p>
            )}
          </div>
        ) : view === "day" ? (
          <div className="space-y-4">
            {dayWiseVisits.map(({ date, items, stats }) => {
              const isCollapsed = collapsedGroups[date];
              return (
                <Card key={date} className="border-border overflow-hidden shadow-none">
                  <div
                    onClick={() => toggleGroup(date)}
                    className="flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                      <CalendarDays className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">{date}</span>
                      <Badge variant="secondary" className="text-[10px] ml-1 bg-primary/10 text-primary hover:bg-primary/15">{stats.total} visits</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">{stats.real} Real</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">{stats.fake} Fake</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{stats.pending} Pending</span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-4 border-t bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {items.map((v: any) => {
                          const st = v.verification_status || "pending";
                          return (
                            <Card key={v.id} className="p-3 border-border hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between shadow-none bg-slate-50/50">
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                  <span className="font-bold text-sm truncate">{v.name}</span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      st === "verified_real" ? "bg-green-50 text-green-700 border-green-200" :
                                      st === "verified_fake" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                    }
                                  >
                                    {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex items-start gap-1">
                                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                  {v.address || "No address provided"}
                                </p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground border-t pt-2 mt-2">
                                  <div className="flex items-center gap-1 truncate">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="truncate">{empName(v.employee_id)}</span>
                                  </div>
                                  {v.contact_person && (
                                    <div className="flex items-center gap-1 truncate col-span-2">
                                      <Building className="w-3 h-3 text-muted-foreground" />
                                      <span className="truncate font-medium text-foreground">{v.contact_person} {v.contact_phone && `(${v.contact_phone})`}</span>
                                    </div>
                                  )}
                                  {v.number_of_flats != null && (
                                    <div>
                                      Flats: <span className="font-semibold text-foreground">{v.number_of_flats}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {(v.selfie_url || v.building_photo_url) && (
                                <div className="flex gap-2 mt-3 pt-2 border-t text-[9px] text-muted-foreground font-semibold">
                                  {v.selfie_url && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-0.5">📸 Selfie</span>}
                                  {v.building_photo_url && <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-0.5">🏢 Photo</span>}
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {dayWiseVisits.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No visits found</div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {employeeWiseVisits.map(({ empId, name, items, stats }) => {
              const isCollapsed = collapsedGroups[empId];
              return (
                <Card key={empId} className="border-border overflow-hidden shadow-none">
                  <div
                    onClick={() => toggleGroup(empId)}
                    className="flex items-center justify-between p-3.5 bg-muted/20 hover:bg-muted/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-foreground">{name}</span>
                      <Badge variant="secondary" className="text-[10px] ml-1 bg-primary/10 text-primary hover:bg-primary/15">{stats.total} visits</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">{stats.real} Real</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold">{stats.fake} Fake</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{stats.pending} Pending</span>
                    </div>
                  </div>
                  {!isCollapsed && (
                    <div className="p-4 border-t bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {items.map((v: any) => {
                          const st = v.verification_status || "pending";
                          return (
                            <Card key={v.id} className="p-3 border-border hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between shadow-none bg-slate-50/50">
                              <div>
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                  <span className="font-bold text-sm truncate">{v.name}</span>
                                  <Badge
                                    variant="outline"
                                    className={
                                      st === "verified_real" ? "bg-green-50 text-green-700 border-green-200" :
                                      st === "verified_fake" ? "bg-red-50 text-red-700 border-red-200" :
                                      "bg-amber-50 text-amber-700 border-amber-200"
                                    }
                                  >
                                    {st === "verified_real" ? "Real" : st === "verified_fake" ? "Fake" : "Pending"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2 mb-2 flex items-start gap-1">
                                  <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                  {v.address || "No address provided"}
                                </p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted-foreground border-t pt-2 mt-2">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-muted-foreground" />
                                    <span>{new Date(v.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                                  </div>
                                  {v.contact_person && (
                                    <div className="flex items-center gap-1 truncate col-span-2">
                                      <Building className="w-3 h-3 text-muted-foreground" />
                                      <span className="truncate font-medium text-foreground">{v.contact_person} {v.contact_phone && `(${v.contact_phone})`}</span>
                                    </div>
                                  )}
                                  {v.number_of_flats != null && (
                                    <div>
                                      Flats: <span className="font-semibold text-foreground">{v.number_of_flats}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {(v.selfie_url || v.building_photo_url) && (
                                <div className="flex gap-2 mt-3 pt-2 border-t text-[9px] text-muted-foreground font-semibold">
                                  {v.selfie_url && <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-0.5">📸 Selfie</span>}
                                  {v.building_photo_url && <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-0.5">🏢 Photo</span>}
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            {employeeWiseVisits.length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-sm">No visits found</div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
