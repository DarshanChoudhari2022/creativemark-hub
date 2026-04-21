import { clients } from "./clients";
import { employees } from "./employees";
import { leads } from "./leads";
import { recoveries } from "./recoveries";
import { partners } from "./partners";
import { calendarEvents } from "./calendar";

/* ── Revenue Chart Data ─────────────────────────────────── */
export const revenueData = [
  { month: "Oct", billed: 280000, received: 250000 },
  { month: "Nov", billed: 310000, received: 280000 },
  { month: "Dec", billed: 450000, received: 390000 },
  { month: "Jan", billed: 420000, received: 350000 },
  { month: "Feb", billed: 485000, received: 420000 },
  { month: "Mar", billed: 520000, received: 460000 },
  { month: "Apr", billed: 350000, received: 195000 },
];

/* ── KPI Calculations ───────────────────────────────────── */
const totalBilled = clients.reduce((s, c) => s + c.totalBilled, 0);
const totalOutstanding = clients.reduce((s, c) => s + c.outstanding, 0);
const totalReceived = totalBilled - totalOutstanding;
const activeClients = clients.filter((c) => c.status === "Active").length;
const activeLeads = leads.filter((l) => !["Converted", "Lost"].includes(l.stage)).length;
const overdueRecoveries = recoveries.filter((r) => r.status === "Overdue").length;

export const kpiCards = [
  { title: "Total Revenue", value: totalReceived, format: "currency" as const, change: "+12%", up: true },
  { title: "Outstanding", value: totalOutstanding, format: "currency" as const, change: "-5%", up: false },
  { title: "Active Clients", value: activeClients, format: "number" as const },
  { title: "Active Leads", value: activeLeads, format: "number" as const },
  { title: "Overdue Invoices", value: overdueRecoveries, format: "number" as const },
  { title: "Partner Leads", value: partners.reduce((s, p) => s + p.totalLeadsReferred, 0), format: "number" as const },
];

/* ── Lead Stage Breakdown ───────────────────────────────── */
export const leadsByStage = [
  { stage: "New", count: leads.filter((l) => l.stage === "New").length, color: "#3B82F6" },
  { stage: "Contacted", count: leads.filter((l) => l.stage === "Contacted").length, color: "#8B5CF6" },
  { stage: "Quotation Sent", count: leads.filter((l) => l.stage === "Quotation Sent").length, color: "#F59E0B" },
  { stage: "Negotiation", count: leads.filter((l) => l.stage === "Negotiation").length, color: "#EF4444" },
  { stage: "Converted", count: leads.filter((l) => l.stage === "Converted").length, color: "#16A34A" },
  { stage: "Lost", count: leads.filter((l) => l.stage === "Lost").length, color: "#94A3B8" },
];

/* ── Today's Field Schedule ─────────────────────────────── */
const today = new Date().toISOString().slice(0, 10);
export const todaySchedule = calendarEvents
  .filter((e) => e.start.slice(0, 10) === today && e.type === "Shoot")
  .map((e) => ({
    id: e.id,
    time: new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    client: e.clientName || "Internal",
    location: e.location || "—",
    team: e.assignedEmployeeNames?.join(", ") || "—",
    type: e.type,
  }));

/* ── Upcoming Shoots & Events (next 7 days) ─────────────── */
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
export const upcomingEvents = calendarEvents
  .filter((e) => {
    const d = new Date(e.start);
    return d >= new Date() && d <= nextWeek && e.status === "Scheduled";
  })
  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  .slice(0, 5)
  .map((e) => ({
    id: e.id,
    title: e.title,
    date: new Date(e.start).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    time: new Date(e.start).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    type: e.type,
    client: e.clientName || "Internal",
    team: e.assignedEmployeeNames?.join(", ") || "—",
  }));

/* ── Overdue Payments ───────────────────────────────────── */
export const overduePayments = recoveries
  .filter((r) => r.status === "Overdue")
  .sort((a, b) => b.daysOverdue - a.daysOverdue)
  .map((r) => ({
    id: r.id,
    client: r.clientName,
    invoiceNo: r.invoiceNo,
    amount: r.amountDue - r.amountPaid,
    daysOverdue: r.daysOverdue,
    whatsapp: r.whatsapp,
  }));

/* ── Follow-ups Due Today ───────────────────────────────── */
export const followUpsDue = leads
  .filter((l) => l.nextFollowupDate === today)
  .map((l) => ({
    id: l.id,
    name: l.name,
    organization: l.organization || "",
    stage: l.stage,
    heat: l.heat,
    assignedTo: l.assignedToName || "—",
  }));

/* ── Partner Performance ────────────────────────────────── */
export const partnerPerformance = partners.map((p) => ({
  id: p.id,
  name: p.name,
  totalLeads: p.totalLeadsReferred,
  totalEarned: p.totalCommissionEarned,
  pending: p.pendingCommission,
}));

/* ── Employee On-Field ──────────────────────────────────── */
export const employeesOnField = employees
  .filter((e) => e.onFieldToday)
  .map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    clients: e.assignedClientNames?.join(", ") || "—",
  }));

/* ── Notifications ──────────────────────────────────────── */
export const notifications = [
  { id: "N-001", type: "payment" as const, message: "Green Earth NGO — ₹95,000 overdue (52 days)", time: "2h ago", read: false },
  { id: "N-002", type: "payment" as const, message: "Speedway Motors — ₹2,20,000 overdue (37 days)", time: "2h ago", read: false },
  { id: "N-003", type: "lead" as const, message: "Lead: Mahesh Gowda — Quotation follow-up due", time: "5h ago", read: false },
  { id: "N-004", type: "shoot" as const, message: "Reel Shoot tomorrow — Adv. Rajesh Kumar", time: "6h ago", read: true },
  { id: "N-005", type: "general" as const, message: "Monthly reports due — April 30", time: "1d ago", read: true },
  { id: "N-006", type: "payment" as const, message: "Adv. Rajesh Kumar — ₹1,75,000 overdue (37 days)", time: "1d ago", read: false },
  { id: "N-007", type: "lead" as const, message: "New lead: Suresh Patil — Patil Industries (via Anil Verma)", time: "2d ago", read: true },
];
