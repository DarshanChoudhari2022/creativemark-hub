import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { formatINR, formatINRCompact } from "@/lib/format";
import { Wallet, Briefcase, FileSignature, Target, Users, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Masked } from "@/components/Masked";
import { supabase } from "@/lib/supabase";

const KPICard = ({ icon: Icon, label, value, hint, color }: {
  icon: React.ElementType; label: string; value: string; hint?: string; color?: string;
}) => (
  <Card className="p-5 flex items-center gap-4">
    <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${color || "bg-primary/10 text-primary"}`}>
      <Icon className="h-6 w-6" />
    </div>
    <div>
      <div className="text-sm font-semibold text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold"><Masked placeholder="•••••">{value}</Masked></div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  </Card>
);

const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#F97316", "#06B6D4"];

export default function Analytics() {
  const [clients, setClients] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [cRes, eRes, qRes, lRes, pRes, payRes, expRes] = await Promise.all([
        supabase.from("clients").select("*"),
        supabase.from("employees").select("*"),
        supabase.from("quotations").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("partners").select("*, partner_leads(*), partner_ledger(*)"),
        supabase.from("payment_history").select("*"),
        supabase.from("expenses").select("*"),
      ]);
      setClients(cRes.data || []);
      setEmployees(eRes.data || []);
      setQuotations(qRes.data || []);
      setLeads(lRes.data || []);
      setPartners(pRes.data || []);
      setPayments(payRes.data || []);
      setExpenses(expRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Single source of truth: quotations table (type='Bill') — matches Recovery tab ──
  const allBills = useMemo(() => 
    quotations.filter(q => q.type === "Bill" && q.status !== "Cancelled" && q.status !== "Draft"),
  [quotations]);

  // ── KPI computations ──
  const totalReceived = useMemo(() => 
    allBills.reduce((s, q) => s + (q.amount_paid || 0), 0), 
  [allBills]);

  const totalOutstanding = useMemo(() => 
    allBills
      .filter(q => q.status !== "Paid")
      .reduce((s, q) => s + ((q.grand_total || 0) - (q.amount_paid || 0)), 0),
  [allBills]);
  
  const totalPayroll = useMemo(() => 
    expenses.filter(e => e.category === 'Salary').reduce((s, e) => s + (e.amount || 0), 0), 
  [expenses]);

  const totalDistributed = totalPayroll;

  const activeEmployees = useMemo(() => employees.filter(e => e.status === "Active").length, [employees]);
  const roi = totalDistributed > 0 ? (totalReceived / totalDistributed).toFixed(1) : "0";

  // ── Revenue by category (from clients) ──
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    clients.forEach(c => {
      const cat = c.category || c.service_type || "Other";
      map[cat] = (map[cat] || 0) + (c.total_billed || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  }, [clients]);

  // ── Monthly revenue (from quotations — single source of truth) ──
  const revenueData = useMemo(() => {
    const months: Record<string, { name: string; billed: number; received: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months[key] = { name: key, billed: 0, received: 0 };
    }
    allBills.forEach(q => {
      if (!q.date) return;
      const d = new Date(q.date);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[key]) {
        months[key].billed += q.grand_total || 0;
        months[key].received += q.amount_paid || 0;
      }
    });
    return Object.values(months);
  }, [allBills]);

  // ── Lead conversion funnel ──
  const leadFunnel = useMemo(() => {
    const stages = ["New", "Contacted", "Quotation Sent", "Negotiation", "Converted", "Lost"];
    return stages.map(stage => ({
      stage,
      count: leads.filter(l => l.stage === stage).length,
    }));
  }, [leads]);

  // ── Lead sources ──
  const leadSources = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const src = l.source || "Unknown";
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [leads]);

  // ── Employee workload (assigned clients) ──
  const employeeWorkload = useMemo(() => {
    const map: Record<string, { name: string; clients: number; salary: number }> = {};
    employees.forEach(e => {
      map[e.id] = { name: e.name?.split(" ")[0] || "?", clients: 0, salary: e.salary || 0 };
    });
    clients.forEach(c => {
      if (c.assigned_employee_id && map[c.assigned_employee_id]) {
        map[c.assigned_employee_id].clients++;
      }
    });
    return Object.values(map).sort((a, b) => b.clients - a.clients).slice(0, 10);
  }, [employees, clients]);

  // ── Partner performance ──
  const partnerStats = useMemo(() => {
    return partners.map(p => ({
      name: p.name?.split(" ")[0] || "?",
      leads: p.partner_leads?.length || 0,
      earned: p.partner_ledger?.reduce((s: number, e: any) => s + (e.commission_amount || 0), 0) || 0,
    })).sort((a, b) => b.leads - a.leads).slice(0, 8);
  }, [partners]);

  // ── Quotation stats ──
  const quotationStats = useMemo(() => {
    const total = quotations.length;
    const approved = quotations.filter(q => q.status === "Approved" || q.status === "Converted to Bill" || q.status === "Paid").length;
    const rate = total > 0 ? ((approved / total) * 100).toFixed(0) : "0";
    const avgValue = total > 0 ? quotations.reduce((s, q) => s + (q.grand_total || 0), 0) / total : 0;
    return { total, approved, rate, avgValue };
  }, [quotations]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics & Performance" subtitle="Loading…" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & Performance" subtitle="Deep dive into team and revenue metrics" />

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Wallet} label="Total Received" value={formatINRCompact(totalReceived)} />
        <KPICard icon={Briefcase} label="Distributed" value={formatINRCompact(totalDistributed)} color="bg-orange-100 text-orange-600" hint={`${activeEmployees} active employees`} />
        <KPICard icon={FileSignature} label="Quotation Win Rate" value={`${quotationStats.rate}%`} color="bg-blue-100 text-blue-600" hint={`${quotationStats.approved}/${quotationStats.total} approved`} />
        <KPICard icon={Target} label="ROI (Received/Distributed)" value={`${roi}x`} color="bg-green-100 text-green-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Trend */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Revenue Trend</h3>
          <p className="text-xs text-muted-foreground mb-4">Billed vs Received — Last 12 months</p>
          <div className="h-72">
            {revenueData.some(r => r.billed > 0 || r.received > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="received" name="Received" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="billed" name="Billed" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No revenue data yet</div>
            )}
          </div>
        </Card>

        {/* Revenue by Category (Pie) */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Revenue by Category</h3>
          <p className="text-xs text-muted-foreground mb-4">Total billed by client industry/service</p>
          {categoryData.length > 0 ? (
            <div className="h-72 flex items-center">
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
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <Masked><span className="truncate">{c.name}</span>: {formatINRCompact(c.value)}</Masked>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">No client data yet</div>
          )}
        </Card>

        {/* Lead Funnel */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Lead Conversion Funnel</h3>
          <p className="text-xs text-muted-foreground mb-4">Leads by pipeline stage</p>
          <div className="h-64">
            {leads.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leadFunnel} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" name="Leads" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No leads yet</div>
            )}
          </div>
        </Card>

        {/* Lead Sources */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Lead Sources</h3>
          <p className="text-xs text-muted-foreground mb-4">Where your leads come from</p>
          {leadSources.length > 0 ? (
            <div className="h-64 flex items-center">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie data={leadSources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={3}>
                    {leadSources.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-[40%] space-y-2">
                {leadSources.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground text-xs">{s.name}</span>
                    <Masked><span className="font-semibold text-xs ml-auto">{s.value}</span></Masked>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">No lead data yet</div>
          )}
        </Card>

        {/* Employee Workload */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Employee Workload</h3>
          <p className="text-xs text-muted-foreground mb-4">Assigned clients per team member</p>
          <div className="h-64">
            {employeeWorkload.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={employeeWorkload} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="clients" name="Assigned Clients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No employees yet</div>
            )}
          </div>
        </Card>

        {/* Partner Performance */}
        <Card className="p-5">
          <h3 className="font-bold text-lg mb-1">Partner Performance</h3>
          <p className="text-xs text-muted-foreground mb-4">Leads referred & commission earned</p>
          <div className="h-64">
            {partnerStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={partnerStats} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="leads" name="Leads Referred" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="earned" name="Commission Earned" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No partners yet</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
