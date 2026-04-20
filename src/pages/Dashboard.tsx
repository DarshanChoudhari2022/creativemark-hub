import { Card } from "@/components/ui/card";
import { Users, Target, Wallet, UserCog, TrendingUp, Camera, Briefcase, Coffee } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { monthlyRevenue, leadConversion, todaysSchedule } from "@/data/dashboard";
import { clients } from "@/data/clients";
import { leads } from "@/data/leads";
import { employees } from "@/data/employees";
import { recoveries } from "@/data/recoveries";
import { formatINR, formatINRCompact, formatDateDDMMYYYY } from "@/lib/format";
import { PageHeader } from "@/components/shared";

const PIE_COLORS = ["hsl(354 81% 50%)", "hsl(38 92% 50%)", "hsl(0 0% 30%)", "hsl(0 0% 75%)"];

const KPI = ({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: boolean }) => (
  <div className="kpi-card">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className={`mt-2 text-3xl font-extrabold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const totalClients = clients.length;
  const activeLeads = leads.filter((l) => !["Converted", "Lost"].includes(l.stage)).length;
  const pendingPayments = recoveries.reduce((s, r) => s + r.amountDue, 0);
  const onField = employees.filter((e) => e.onFieldToday).length;

  const eventDot: Record<string, string> = {
    shoot: "bg-primary",
    meeting: "bg-foreground",
    internal: "bg-muted-foreground",
  };
  const eventIcon: Record<string, any> = { shoot: Camera, meeting: Briefcase, internal: Coffee };

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back · ${formatDateDDMMYYYY()}`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPI icon={Users} label="Total Clients" value={String(totalClients)} hint="across 4 categories" />
        <KPI icon={Target} label="Active Leads" value={String(activeLeads)} hint="in pipeline" />
        <KPI icon={Wallet} label="Pending Payments" value={formatINRCompact(pendingPayments)} accent hint={`${recoveries.length} invoices overdue`} />
        <KPI icon={UserCog} label="On Field Today" value={String(onField)} hint={`of ${employees.length} employees`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">Monthly Revenue</h3>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
            <div className="flex items-center gap-1 text-success text-sm font-semibold">
              <TrendingUp className="h-4 w-4" /> +10.9%
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [formatINR(v), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-lg">Lead Conversion</h3>
          <p className="text-xs text-muted-foreground mb-2">Current quarter</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadConversion} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={2}>
                  {leadConversion.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {leadConversion.map((s, i) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-muted-foreground">{s.name}</span>
                </div>
                <span className="font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-lg">Today's Schedule</h3>
            <p className="text-xs text-muted-foreground">{formatDateDDMMYYYY()}</p>
          </div>
        </div>
        <div className="space-y-2">
          {todaysSchedule.map((e, i) => {
            const Icon = eventIcon[e.type];
            return (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                <div className="text-sm font-bold w-14 text-muted-foreground">{e.time}</div>
                <span className={`h-2.5 w-2.5 rounded-full ${eventDot[e.type]}`} />
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-sm font-medium">{e.title}</div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{e.type}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default Dashboard;
