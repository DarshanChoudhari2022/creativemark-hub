import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Users, Target, Wallet, UserCog, Handshake, TrendingUp, Calendar, AlertTriangle, Clock, ArrowUpRight, MessageSquare, Zap, Bell, PiggyBank, Package, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, CartesianGrid, AreaChart, Area } from "recharts";
import { WA_TEMPLATES } from "@/data/recoveries";
import { formatINR, formatINRCompact, formatDateDDMMYYYY, waLink } from "@/lib/format";
import { PageHeader } from "@/components/shared";
import { Masked, useMask } from "@/components/Masked";
import { FieldTeamWidget } from "@/components/FieldTeamWidget";
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
  const [tasks, setTasks] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [cRes, lRes, eRes, qRes, pRes, evRes, tRes, payRes, expRes, projRes, salesRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("leads").select("*, employees!leads_assigned_to_fkey(name)"),
        supabase.from("employees").select("*"),
        supabase.from("quotations").select("*"),
        supabase.from("partners").select("*, partner_leads(*), partner_ledger(*)"),
        supabase.from("calendar_events").select("*, calendar_event_assignments(employee_id, employees(name))"),
        supabase.from("lead_tasks").select("*, leads(name, organization)"),
        supabase.from("payment_history").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("projects").select("id, title, project_type, status").then(r => r, () => ({ data: [] as any[], error: null as any })),
        supabase.from("project_sales").select("project_id, amount, extra_charges, sale_expenses, commission_amount, sale_date").then(r => r, () => ({ data: [] as any[], error: null as any })),
      ]);
      setClients(cRes.data || []);
      setLeads(lRes.data || []);
      setEmployees(eRes.data || []);
      setQuotations(qRes.data || []);
      setPartners(pRes.data || []);
      setEvents(evRes.data || []);
      setTasks(tRes.data || []);
      setPayments(payRes.data || []);
      setExpenses(expRes.data || []);
      setProjects(projRes.data || []);
      setProductSales(salesRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Single source of truth: quotations table (type='Bill') — matches Recovery tab ──
  const allBills = useMemo(() => 
    quotations.filter(q => q.type === "Bill" && q.status !== "Cancelled" && q.status !== "Draft"),
  [quotations]);

  const totalReceived = useMemo(() => 
    allBills.reduce((s, q) => s + (q.amount_paid || 0), 0), 
  [allBills]);

  const totalOutstanding = useMemo(() => 
    allBills
      .filter(q => q.status !== "Paid")
      .reduce((s, q) => s + ((q.grand_total || 0) - (q.amount_paid || 0)), 0),
  [allBills]);
  
  const totalDistributed = useMemo(() => 
    expenses.filter(e => e.category === 'Salary').reduce((s, e) => s + (e.amount || 0), 0), 
  [expenses]);

  const activeClients = useMemo(() => clients.filter(c => c.status === "Active").length, [clients]);
  const activeLeads = useMemo(() => leads.filter(l => l.stage !== "Converted" && l.stage !== "Lost").length, [leads]);
  const overdueQuotations = useMemo(() =>
    quotations.filter(q => q.type === "Bill" && q.status === "Overdue").length, [quotations]);
  const partnerLeads = useMemo(() =>
    partners.reduce((s, p) => s + (p.partner_leads?.length || 0), 0), [partners]);

  // ── Revenue chart (monthly from quotations — single source of truth) ──
  const revenueData = useMemo(() => {
    const months: Record<string, { received: number; billed: number }> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      months[key] = { received: 0, billed: 0 };
    }
    allBills.forEach(q => {
      if (!q.date) return;
      const d = new Date(q.date);
      const key = d.toLocaleString("default", { month: "short" });
      if (months[key]) {
        months[key].billed += q.grand_total || 0;
        months[key].received += q.amount_paid || 0;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [allBills]);

  // ── Product (Project) sales aggregations ────────────────────────
  const productPerformance = useMemo(() => {
    const map: Record<string, { id: string; name: string; type: string; salesCount: number; revenue: number; extra: number; commission: number; expenses: number; netProfit: number }> = {};
    (projects || []).forEach((p: any) => {
      map[p.id] = { id: p.id, name: p.title || "Untitled", type: p.project_type || "Project", salesCount: 0, revenue: 0, extra: 0, commission: 0, expenses: 0, netProfit: 0 };
    });
    (productSales || []).forEach((s: any) => {
      const pid = s.project_id;
      if (!pid || !map[pid]) return;
      const amt = Number(s.amount || 0);
      const ex = Number(s.extra_charges || 0);
      const cm = Number(s.commission_amount || 0);
      const xp = Number(s.sale_expenses || 0);
      map[pid].salesCount += 1;
      map[pid].revenue += amt;
      map[pid].extra += ex;
      map[pid].commission += cm;
      map[pid].expenses += xp;
      map[pid].netProfit += amt + ex - cm - xp;
    });
    return Object.values(map)
      .filter(p => p.salesCount > 0 || p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [projects, productSales]);

  const totalProductRevenue = productPerformance.reduce((s, p) => s + p.revenue, 0);
  const totalProductProfit = productPerformance.reduce((s, p) => s + p.netProfit, 0);

  // ── Monthly Profit chart (last 6 months) ────────────────────────
  // Profit = product-sale revenue + extras − commission − sale-expenses − general expenses
  const monthlyProfitData = useMemo(() => {
    const months: Record<string, { key: string; label: string; revenue: number; expenses: number; profit: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });
      months[key] = { key, label, revenue: 0, expenses: 0, profit: 0 };
    }
    (productSales || []).forEach((s: any) => {
      if (!s.sale_date) return;
      const d = new Date(s.sale_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) return;
      const amt = Number(s.amount || 0);
      const ex = Number(s.extra_charges || 0);
      const cm = Number(s.commission_amount || 0);
      const xp = Number(s.sale_expenses || 0);
      months[key].revenue += amt + ex;
      months[key].expenses += cm + xp;
      months[key].profit += amt + ex - cm - xp;
    });
    (expenses || []).forEach((e: any) => {
      if (!e.date) return;
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!months[key]) return;
      const amt = Number(e.amount || 0);
      months[key].expenses += amt;
      months[key].profit -= amt;
    });
    return Object.values(months);
  }, [productSales, expenses]);

  const netProfitThisMonth = monthlyProfitData[monthlyProfitData.length - 1]?.profit || 0;
  const netProfitPrevMonth = monthlyProfitData[monthlyProfitData.length - 2]?.profit || 0;
  const profitTrendPct = netProfitPrevMonth !== 0
    ? ((netProfitThisMonth - netProfitPrevMonth) / Math.abs(netProfitPrevMonth)) * 100
    : (netProfitThisMonth > 0 ? 100 : 0);

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

  // ── Pending Lead Tasks ──
  const pendingTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === "Pending")
      .map(t => {
        const isOverdue = new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0));
        return {
          id: t.id,
          description: t.description,
          leadName: t.leads?.name || "Unknown",
          dueDate: t.due_date,
          isOverdue,
          assignedTo: t.assigned_to || "Unassigned"
        };
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [tasks]);

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

  const { maskAmount } = useMask();
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
    { title: "Amount Received", value: maskAmount(formatINRCompact(totalReceived)), accent: false, nav: "/financials" },
    { title: "Amount Pending", value: maskAmount(formatINRCompact(totalOutstanding)), accent: totalOutstanding > 0, nav: "/recovery" },
    { title: "Distributed", value: maskAmount(formatINRCompact(totalDistributed)), accent: false, nav: "/financials" },
    { title: "Active Leads", value: String(activeLeads), accent: false, nav: "/leads" },
    { title: "Overdue Bills", value: String(overdueQuotations), accent: true, nav: "/quotations" },
    { title: "Active Clients", value: String(activeClients), accent: false, nav: "/clients" },
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

      {/* Field Team overview — live tracking + verification + fraud watch */}
      <div className="mb-6">
        <FieldTeamWidget />
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

      {/* ── Profit & Product Performance ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Monthly Profit chart (modern area chart) */}
        <Card className="lg:col-span-2 p-5 relative overflow-hidden bg-gradient-to-br from-emerald-50 via-card to-card dark:from-emerald-950/20 dark:via-card dark:to-card border-emerald-500/20">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="flex items-start justify-between mb-4 relative">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${netProfitThisMonth >= 0 ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}>
                <PiggyBank className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Monthly Profit</h3>
                <p className="text-xs text-muted-foreground">Last 6 months · revenue − commission − expenses</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">This month</div>
              <div className={`text-2xl font-extrabold ${netProfitThisMonth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                <Masked placeholder="₹•••••">{formatINRCompact(netProfitThisMonth)}</Masked>
              </div>
              {netProfitPrevMonth !== 0 && (
                <div className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${profitTrendPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  <ArrowUpRight className={`h-3 w-3 ${profitTrendPct < 0 ? "rotate-90" : ""}`} />
                  {profitTrendPct >= 0 ? "+" : ""}{profitTrendPct.toFixed(1)}% vs prev
                </div>
              )}
            </div>
          </div>
          <div className="h-64 relative">
            {monthlyProfitData.some(m => m.revenue > 0 || m.expenses > 0 || m.profit !== 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyProfitData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
                    formatter={(v: number, name: string) => [formatINR(v), name === "profit" ? "Net Profit" : name === "revenue" ? "Revenue" : "Expenses"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} fill="url(#revGrad)" />
                  <Area type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2.5} fill="url(#profitGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm">
                <PiggyBank className="h-10 w-10 mb-2 opacity-30" />
                <span>No product sales recorded yet — record sales from any project to see profit trends</span>
              </div>
            )}
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px]">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-emerald-500" /> Net Profit</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-sm bg-blue-500" /> Revenue</div>
          </div>
        </Card>

        {/* Product Performance Leaderboard */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-indigo-50 via-card to-card dark:from-indigo-950/20 dark:via-card dark:to-card border-indigo-500/20">
          <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-3 relative">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/15 text-indigo-600 flex items-center justify-center"><Package className="h-4 w-4" /></div>
              <div>
                <h3 className="font-bold text-base">Product Performance</h3>
                <p className="text-[11px] text-muted-foreground">By revenue · all-time</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => navigate("/projects")}>View all</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3 relative">
            <div className="rounded-lg bg-card/50 border border-border/40 p-2.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Revenue</div>
              <div className="text-base font-extrabold text-blue-600 mt-0.5"><Masked placeholder="₹•••••">{formatINRCompact(totalProductRevenue)}</Masked></div>
            </div>
            <div className="rounded-lg bg-card/50 border border-border/40 p-2.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total Profit</div>
              <div className={`text-base font-extrabold mt-0.5 ${totalProductProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}><Masked placeholder="₹•••••">{formatINRCompact(totalProductProfit)}</Masked></div>
            </div>
          </div>
          <div className="space-y-2 relative max-h-72 overflow-y-auto">
            {productPerformance.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-muted-foreground text-xs">
                <ShoppingCart className="h-8 w-8 mb-2 opacity-30" />
                <span>No sales yet</span>
              </div>
            ) : (
              productPerformance.slice(0, 6).map((p, idx) => {
                const maxRev = productPerformance[0].revenue || 1;
                const pct = (p.revenue / maxRev) * 100;
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="group p-2.5 rounded-lg border border-border/40 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold w-5 h-5 rounded bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">{idx + 1}</span>
                        <span className="text-sm font-semibold truncate group-hover:text-indigo-600 transition-colors">{p.name}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{p.salesCount} sales</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Revenue: <span className="font-bold text-foreground"><Masked placeholder="₹•••">{formatINRCompact(p.revenue)}</Masked></span></span>
                      <span className={`font-bold ${p.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>Profit: <Masked placeholder="₹•••">{formatINRCompact(p.netProfit)}</Masked></span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Multi-column Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
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
                  <div className="text-sm font-semibold truncate"><Masked>{p.client}</Masked></div>
                  <div className="text-xs text-muted-foreground font-mono">{p.invoiceNo}</div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="cursor-pointer" onClick={() => navigate("/recovery")}>
                    <div className="text-sm font-bold text-primary"><Masked placeholder="₹•••••">{formatINRCompact(p.amount)}</Masked></div>
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
                  <div className="text-sm font-semibold truncate"><Masked>{f.name}</Masked></div>
                  <div className="text-xs text-muted-foreground truncate"><Masked>{f.organization}</Masked></div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className={`text-xs font-semibold px-1.5 py-0.5 rounded ${f.heat === "Hot" ? "bg-red-100 text-red-700" : f.heat === "Warm" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-700"}`}>{f.heat}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{f.assignedTo}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pending Tasks */}
        <Card className="p-5 lg:col-span-3 xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base">Pending Tasks</h3>
              <p className="text-xs text-muted-foreground">Individual lead actions</p>
            </div>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="space-y-2">
            {pendingTasks.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-4">No pending tasks</div>
            )}
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${t.isOverdue ? "border-red-100 bg-red-50/50" : "border-border hover:bg-muted/40"}`}
                onClick={() => navigate("/leads")}
              >
                <div className="min-w-0 flex-1 cursor-pointer">
                  <div className={`text-sm font-semibold truncate ${t.isOverdue ? "text-red-700" : ""}`}>{t.description}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.leadName}</div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className={`text-[10px] font-bold ${t.isOverdue ? "text-red-600" : "text-muted-foreground"}`}>{formatDateDDMMYYYY(new Date(t.dueDate))}</div>
                  <div className="text-[10px] text-muted-foreground">{t.assignedTo}</div>
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
                    <div className="font-bold truncate"><Masked>{p.name}</Masked></div>
                    <div className="text-xs text-muted-foreground">{p.totalLeads} leads referred</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-primary"><Masked placeholder="₹•••••">{formatINRCompact(p.totalEarned)}</Masked></div>
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
                  <div className="font-bold truncate"><Masked>{e.name}</Masked></div>
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
