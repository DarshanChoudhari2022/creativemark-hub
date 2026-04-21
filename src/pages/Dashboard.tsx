import { Card } from "@/components/ui/card";
import { Users, Target, Wallet, UserCog, Handshake, TrendingUp, Calendar, AlertTriangle, Clock, ArrowUpRight, MessageSquare } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import {
  revenueData, kpiCards, leadsByStage,
  upcomingEvents, overduePayments, followUpsDue,
  partnerPerformance, employeesOnField
} from "@/data/dashboard";
import { WA_TEMPLATES } from "@/data/recoveries";
import { formatINR, formatINRCompact, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { PageHeader } from "@/components/shared";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/* KPI card with accent strip */
const KPI = ({ icon: Icon, label, value, hint, hintColor, accent }: {
  icon: React.ElementType; label: string; value: string; hint?: string; hintColor?: string; accent?: boolean;
}) => (
  <div className="kpi-card relative overflow-hidden">
    <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
    <div className="flex items-start justify-between pt-1">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
        <div className={`mt-2 text-3xl font-extrabold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
        {hint && <div className={`text-xs mt-1 font-medium ${hintColor || "text-muted-foreground"}`}>{hint}</div>}
      </div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();

  const kpiIcons = [Wallet, Wallet, Users, Target, AlertTriangle, Handshake];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back · ${formatDateDDMMYYYY()}`} />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map((k, i) => (
          <KPI
            key={k.title}
            icon={kpiIcons[i] || Wallet}
            label={k.title}
            value={k.format === "currency" ? formatINRCompact(k.value) : String(k.value)}
            accent={k.title.includes("Outstanding") || k.title.includes("Overdue")}
            hint={k.change ? `${k.change} vs last month` : undefined}
            hintColor={k.up === true ? "text-green-600" : k.up === false ? "text-primary" : undefined}
          />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">Monthly Revenue</h3>
              <p className="text-xs text-muted-foreground">Billed vs Received — Last 7 months</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-primary" /> Received</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-muted-foreground/40" /> Billed</div>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [formatINR(v), name === "received" ? "Received" : "Billed"]}
                />
                <Bar dataKey="received" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={36} />
                <Bar dataKey="billed" fill="hsl(var(--muted-foreground) / 0.35)" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-lg">Lead Pipeline</h3>
          <p className="text-xs text-muted-foreground mb-2">Current stage breakdown</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leadsByStage} dataKey="count" nameKey="stage" cx="50%" cy="50%" innerRadius={44} outerRadius={76} paddingAngle={2} strokeWidth={0}>
                  {leadsByStage.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-1">
            {leadsByStage.map((s) => (
              <div key={s.stage} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-muted-foreground text-xs">{s.stage}</span>
                </div>
                <span className="font-semibold text-xs">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Three-column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Upcoming Events */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Upcoming Schedule</h3>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {upcomingEvents.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No upcoming events</div>
            )}
            {upcomingEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                <div className="text-xs font-bold w-14 text-muted-foreground pt-0.5">
                  <div>{e.date}</div>
                  <div className="font-mono">{e.time}</div>
                </div>
                <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${e.type === "Shoot" ? "bg-primary" : e.type === "Meeting" ? "bg-foreground" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.client} · {e.team}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Overdue Payments */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Overdue Payments</h3>
              <p className="text-xs text-muted-foreground">Sorted by days overdue</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-primary" />
          </div>
          <div className="space-y-2">
            {overduePayments.length === 0 && (
              <div className="text-sm text-green-600 text-center py-4">🎉 No overdue payments!</div>
            )}
            {overduePayments.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${p.daysOverdue > 30 ? "border-primary/30 bg-primary/5" : "border-border hover:bg-muted/40"}`}
              >
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate("/recovery")}>
                  <div className="text-sm font-semibold truncate">{p.client}</div>
                  <div className="text-xs text-muted-foreground font-mono">{p.invoiceNo}</div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="cursor-pointer" onClick={() => navigate("/recovery")}>
                    <div className="text-sm font-bold text-primary">{formatINRCompact(p.amount)}</div>
                    <div className={`text-xs font-medium ${p.daysOverdue > 30 ? "text-primary" : "text-muted-foreground"}`}>{p.daysOverdue}d overdue</div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      const msg = WA_TEMPLATES.soft(p.client, formatINRCompact(p.amount), p.invoiceNo);
                      window.open(waLink(p.whatsapp, msg), "_blank");
                      toast.success("Soft reminder opened in WhatsApp");
                    }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Follow-ups Due */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Follow-ups Due Today</h3>
              <p className="text-xs text-muted-foreground">Leads needing attention</p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            {followUpsDue.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No follow-ups due today</div>
            )}
            {followUpsDue.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => navigate("/leads")}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.organization}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className={`text-xs font-semibold px-1.5 py-0.5 rounded ${f.heat === "Hot" ? "bg-red-100 text-red-700" : f.heat === "Warm" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{f.heat}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.assignedTo}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row: Partners + Employees on Field */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">Partner Leaderboard</h3>
              <p className="text-xs text-muted-foreground">Top referral partners</p>
            </div>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {partnerPerformance.map((p, i) => {
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-4 rounded-lg border border-border hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => navigate("/partners")}
                >
                  <div className="text-2xl">{medals[i] || `#${i + 1}`}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.totalLeads} leads referred</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-primary">{formatINRCompact(p.totalEarned)}</div>
                    {p.pending > 0 && <div className="text-[10px] text-amber-600">{formatINRCompact(p.pending)} pending</div>}
                    {p.pending === 0 && <div className="text-[10px] text-muted-foreground">all settled</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">Employees On Field</h3>
              <p className="text-xs text-muted-foreground">Currently active today</p>
            </div>
            <UserCog className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-3">
            {employeesOnField.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No employees on field today</div>
            )}
            {employeesOnField.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 p-4 rounded-lg border border-border hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate("/employees")}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  {e.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.role}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground truncate max-w-[160px]">{e.clients}</div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
