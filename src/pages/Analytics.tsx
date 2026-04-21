import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { employees } from "@/data/employees";
import { clients } from "@/data/clients";
import { formatINRCompact } from "@/lib/format";
import { Wallet, Briefcase, FileSignature, Target } from "lucide-react";

export default function Analytics() {
  // 1. Employee Productivity (Assigned clients count / workload)
  const employeeProductivity = employees.map(emp => ({
    name: emp.name.split(" ")[0],
    assignments: emp.assignedClients?.length || 0,
    logs: emp.workLogs.length,
  })).sort((a, b) => b.logs - a.logs);

  // 2. Total Business Value by Category
  const categoryMap: Record<string, number> = {};
  clients.forEach(c => {
    categoryMap[c.category] = (categoryMap[c.category] || 0) + c.totalBilled;
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({
    name, value,
  }));
  const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444"];

  // 3. Employee Payroll Stats
  const payrollStats = employees.map(e => ({
    name: e.name.split(" ")[0],
    paid: e.salaryPayments.reduce((s, p) => s + p.amountPaid, 0),
    pending: e.salaryPayments.reduce((s, p) => s + p.amountPending, 0),
  }));

  const totalPayroll = payrollStats.reduce((s, p) => s + p.paid + p.pending, 0);
  const totalBilled = clients.reduce((s, c) => s + c.totalBilled, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & Performance" subtitle="Deep dive into team and revenue metrics" />

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-muted-foreground">Total Revenue</div>
            <div className="text-2xl font-bold">{formatINRCompact(totalBilled)}</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-muted-foreground">Total Payroll Expenses</div>
            <div className="text-2xl font-bold">{formatINRCompact(totalPayroll)}</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <FileSignature className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-muted-foreground">Active Work Logs</div>
            <div className="text-2xl font-bold">{employees.reduce((s, e) => s + e.workLogs.length, 0)}</div>
          </div>
        </Card>
        <Card className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold text-muted-foreground">ROI (Revenue / Expense)</div>
            <div className="text-2xl font-bold">{(totalBilled / (totalPayroll || 1)).toFixed(1)}x</div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employee Productivity Chart */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-4">Employee Content Production</h3>
          <p className="text-xs text-muted-foreground mb-4">Work logs and assignments per team member</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={employeeProductivity} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8 }} />
                <Bar dataKey="logs" name="Work Logs Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="assignments" name="Assigned Clients" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Revenue by Client Category (Pie) */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-4">Revenue Concentration</h3>
          <p className="text-xs text-muted-foreground mb-4">Total billed amount separated by client industry</p>
          <div className="h-64 flex items-center">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50} paddingAngle={2}>
                  {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatINRCompact(value)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] space-y-2">
              {categoryData.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2 text-sm font-medium">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.name}: {formatINRCompact(c.value)}
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Employee Payroll Breakdown */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-bold text-lg mb-4">Employee Payroll Tracking</h3>
          <p className="text-xs text-muted-foreground mb-4">Paid vs Pending salaries</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollStats} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8 }} formatter={(v: number) => formatINRCompact(v)} />
                <Bar dataKey="paid" stackId="a" name="Paid Salaries" fill="#10B981" maxBarSize={48} />
                <Bar dataKey="pending" stackId="a" name="Pending Salaries" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
