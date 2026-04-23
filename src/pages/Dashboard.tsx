import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Users, Target, Wallet, UserCog, Handshake, TrendingUp, Calendar, AlertTriangle, Clock, ArrowUpRight, MessageSquare, Zap, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { WA_TEMPLATES } from "@/data/recoveries";
import { formatINR, formatINRCompact, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { PageHeader } from "@/components/shared";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/* KPI card with accent strip */
const KPI = ({ icon: Icon, label, value, hint, hintColor, accent, onClick }: {
  icon: React.ElementType; label: string; value: string; hint?: string; hintColor?: string; accent?: boolean; onClick?: () => void;
}) => (
  <div className={`kpi-card relative overflow-hidden ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`} onClick={onClick}>
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

const STAGE_COLORS: Record<string, string> = {
  New: "#3B82F6", Contacted: "#8B5CF6", "Quotation Sent": "#F59E0B",
  Negotiation: "#F97316", Converted: "#10B981", Lost: "#6B7280",
};

const Dashboard = () => {
  const navigate = useNavigate();

  // Live data state
  const [clients, setClients] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [cRes, lRes, eRes, qRes, pRes, evRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("leads").select("*, employees!leads_assigned_to_fkey(name)"),
        supabase.from("employees").select("*"),
        supabase.from("quotations").select("*"),
        supabase.from("partners").select("*, partner_leads(*), partner_ledger(*)"),
        supabase.from("calendar_events").select("*, calendar_event_assignments(employee_id, employees(name))"),
      ]);
      setClients(cRes.data || []);
      setLeads(lRes.data || []);
      setEmployees(eRes.data || []);
      setQuotations(qRes.data || []);
      setPartners(pRes.data || []);
      setEvents(evRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Computed KPIs ──
  const totalBilled = useMemo(() => clients.reduce((s, c) => s + (c.total_billed || 0), 0), [clients]);
  const totalOutstanding = useMemo(() => clients.reduce((s, c) => s + (c.outstanding || 0), 0), [clients]);
  const activeClients = useMemo(() => clients.filter(c => c.status === "Active").length, [clients]);
  const activeLeads = useMemo(() => leads.filter(l => l.stage !== "Converted" && l.stage !== "Lost").length, [leads]);
  const overdueQuotations = useMemo(() =>
    quotations.filter(q => q.type === "Bill" && q.status === "Overdue").length, [quotations]);
  const partnerLeads = useMemo(() =>
    partners.reduce((s, p) => s + (p.partner_leads?.length || 0), 0), [partners]);

  // ── Revenue chart (monthly from quotations) ──
  const revenueData = useMemo(() => {
    const months: Record<string, { received: number; billed: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      months[key] = { received: 0, billed: 0 };
    }
    quotations.forEach(q => {
      if (!q.date) return;
      const d = new Date(q.date);
      const key = d.toLocaleString("default", { month: "short" });
      if (months[key]) {
        months[key].billed += q.grand_total || 0;
        if (q.status === "Paid") months[key].received += q.grand_total || 0;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [quotations]);

  // ── Lead pipeline ──
  const leadsByStage = useMemo(() => {
    const stageCount: Record<string, number> = {};
    leads.forEach(l => { stageCount[l.stage] = (stageCount[l.stage] || 0) + 1; });
    return Object.entries(stageCount).map(([stage, count]) => ({
      stage, count, color: STAGE_COLORS[stage] || "#94A3B8",
    }));
  }, [leads]);

  // ── Upcoming events (next 7 days) ──
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const next7 = new Date(now.getTime() + 7 * 86400000);
    return events
      .filter(e => {
        const d = new Date(e.start_time);
        return d >= now && d <= next7 && e.status !== "Cancelled";
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5)
      .map(e => ({
        id: e.id,
        date: formatDateDDMMYYYY(new Date(e.start_time)),
        time: new Date(e.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        title: e.title,
        type: e.type,
        client: e.client_name || "",
        team: e.calendar_event_assignments?.map((a: any) => a.employees?.name).filter(Boolean).join(", ") || "",
      }));
  }, [events]);

  // ── Overdue bills ──
  const overduePayments = useMemo(() => {
    return quotations
      .filter(q => q.type === "Bill" && (q.status === "Overdue" || (q.status === "Sent" && q.due_date && new Date(q.due_date) < new Date())))
      .map(q => {
        const daysOverdue = q.due_date ? Math.max(0, Math.floor((Date.now() - new Date(q.due_date).getTime()) / 86400000)) : 0;
        return {
          id: q.id,
          client: q.client_name || "Unknown",
          invoiceNo: q.quote_number,
          amount: q.grand_total || 0,
          daysOverdue,
          whatsapp: q.client_phone || "",
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);
  }, [quotations]);

  // ── Follow-ups due today ──
  const followUpsDue = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return leads
      .filter(l => (l.next_followup_date === today || l.next_call_date === today) && l.stage !== "Converted" && l.stage !== "Lost")
      .map(l => ({
        id: l.id,
        name: l.name,
        organization: l.organization || "",
        heat: l.heat || "Warm",
        assignedTo: l.employees?.name || "Unassigned",
      }))
      .slice(0, 5);
  }, [leads]);

  // ── Partner leaderboard ──
  const partnerPerformance = useMemo(() => {
    return partners
      .map(p => ({
        id: p.id,
        name: p.name,
        totalLeads: p.partner_leads?.length || 0,
        totalEarned: p.partner_ledger?.reduce((s: number, e: any) => s + (e.commission_amount || 0), 0) || 0,
        pending: p.partner_ledger?.filter((e: any) => e.status === "Pending").reduce((s: number, e: any) => s + (e.commission_amount || 0), 0) || 0,
      }))
      .sort((a, b) => b.totalLeads - a.totalLeads)
      .slice(0, 5);
  }, [partners]);

  // ── Employees on field ──
  const employeesOnField = useMemo(() => {
    return employees
      .filter(e => e.on_field_today && e.status === "Active")
      .map(e => ({
        id: e.id,
        name: e.name,
        role: e.role,
        clients: "",
      }));
  }, [employees]);

  const kpiIcons = [Wallet, Wallet, Users, Target, AlertTriangle, Handshake];

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle={`Welcome back · ${formatDateDDMMYYYY()}`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi-card animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const kpiData = [
    { title: "Total Revenue", value: formatINRCompact(totalBilled), accent: false, nav: "/analytics" },
    { title: "Outstanding", value: formatINRCompact(totalOutstanding), accent: true, nav: "/recovery" },
    { title: "Active Clients", value: String(activeClients), accent: false, nav: "/clients" },
    { title: "Active Leads", value: String(activeLeads), accent: false, nav: "/leads" },
    { title: "Overdue Invoices", value: String(overdueQuotations), accent: true, nav: "/quotations" },
    { title: "Partner Leads", value: String(partnerLeads), accent: false, nav: "/partners" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back · ${formatDateDDMMYYYY()}`} />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpiData.map((k, i) => (
          <KPI
            key={k.title}
            icon={kpiIcons[i] || Wallet}
            label={k.title}
            value={k.value}
            accent={k.accent}
            onClick={() => navigate(k.nav)}
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
            {revenueData.some(r => r.billed > 0 || r.received > 0) ? (
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
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No billing data yet — create your first quotation or bill
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold text-lg">Lead Pipeline</h3>
          <p className="text-xs text-muted-foreground mb-2">Current stage breakdown</p>
          {leadsByStage.length > 0 ? (
            <>
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
            </>
          ) : (
            <div className="h-52 flex items-center justify-center text-muted-foreground text-sm">
              No leads yet — add your first lead
            </div>
          )}
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
              <div key={e.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => navigate("/calendar")}>
                <div className="text-xs font-bold w-14 text-muted-foreground pt-0.5">
                  <div>{e.date}</div>
                  <div className="font-mono">{e.time}</div>
                </div>
                <span className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${e.type === "Shoot" ? "bg-primary" : e.type === "Meeting" ? "bg-foreground" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.client}{e.client && e.team ? " · " : ""}{e.team}</div>
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
                  {p.whatsapp && (
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
                  )}
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
            {partnerPerformance.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No partners yet</div>
            )}
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
                  {e.name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.role}</div>
                </div>
                <div className="text-right">
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
