// ═══════════════════════════════════════════════════════════════════
// Global Cash Custody
// Company-wide ledger of who is currently holding cash collected from
// bills but not yet distributed (or distributed but not marked Paid).
//
// Data model:
//   For every bill in `quotations` with amount_paid > 0 AND received_by_name
//   set, the receiver is treated as the cash custodian. Every distribution
//   linked to that bill that is marked Paid reduces the cash they're holding.
//   When fully distributed, the row vanishes — no manual cleanup.
// ═══════════════════════════════════════════════════════════════════
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wallet, UserCheck, Briefcase, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";

interface BillRow {
  id: string;
  quote_number: string;
  client_name: string;
  amount_paid: number;
  received_by_name: string | null;
  received_at: string | null;
  project_id: string | null;
}

interface DistRow {
  bill_id: string | null;
  allotted_amount: number;
  status: string;
}

interface CustodyEntry {
  receiver: string;
  billId: string;
  billNumber: string;
  billClient: string;
  projectId: string | null;
  projectTitle: string | null;
  received: number;
  distributedPaid: number;
  pending: number;
}

const CashCustody = () => {
  const [search, setSearch] = useState("");

  // 1) Fetch every bill that has a payment received and a recorded custodian.
  const { data: bills, isLoading: billsLoading } = useQuery({
    queryKey: ["cash_custody_bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, quote_number, client_name, amount_paid, received_by_name, received_at, project_id, type")
        .gt("amount_paid", 0)
        .not("received_by_name", "is", null)
        .order("received_at", { ascending: false, nullsFirst: false });
      if (error) {
        console.warn("[cash-custody] bills fetch error:", error.message);
        return [] as BillRow[];
      }
      return (data || []) as BillRow[];
    },
  });

  // 2) Fetch all paid distributions globally (we only need bill_id + amount).
  const { data: paidDistributions } = useQuery({
    queryKey: ["cash_custody_paid_distributions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_sale_distributions")
        .select("bill_id, allotted_amount, status")
        .eq("status", "Paid");
      if (error) {
        // Table not migrated yet — treat as 0 distributions, all cash still held.
        console.warn("[cash-custody] distributions fetch error:", error.message);
        return [] as DistRow[];
      }
      return (data || []) as DistRow[];
    },
  });

  // 3) Project titles for the linked-project column.
  const { data: projects } = useQuery({
    queryKey: ["cash_custody_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title");
      if (error) return [] as Array<{ id: string; title: string }>;
      return data as Array<{ id: string; title: string }>;
    },
  });

  // 4) Compute per-(receiver, bill) pending amounts. Hide rows where pending = 0.
  const entries: CustodyEntry[] = useMemo(() => {
    const projectById = new Map((projects || []).map(p => [p.id, p.title]));
    const paidByBillId = new Map<string, number>();
    for (const d of paidDistributions || []) {
      if (!d.bill_id) continue;
      paidByBillId.set(d.bill_id, (paidByBillId.get(d.bill_id) || 0) + Number(d.allotted_amount || 0));
    }

    const rows: CustodyEntry[] = [];
    for (const b of bills || []) {
      if (!b.received_by_name) continue;
      const received = Number(b.amount_paid || 0);
      const distributedPaid = paidByBillId.get(b.id) || 0;
      const pending = received - distributedPaid;
      if (pending <= 0) continue; // auto-clear settled rows

      rows.push({
        receiver: b.received_by_name,
        billId: b.id,
        billNumber: b.quote_number,
        billClient: b.client_name,
        projectId: b.project_id,
        projectTitle: b.project_id ? projectById.get(b.project_id) || null : null,
        received,
        distributedPaid,
        pending,
      });
    }
    return rows;
  }, [bills, paidDistributions, projects]);

  // 5) Aggregate per-receiver for the summary cards.
  const byReceiver = useMemo(() => {
    const m = new Map<string, { receiver: string; pending: number; bills: number }>();
    for (const e of entries) {
      const cur = m.get(e.receiver) || { receiver: e.receiver, pending: 0, bills: 0 };
      cur.pending += e.pending;
      cur.bills += 1;
      m.set(e.receiver, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.pending - a.pending);
  }, [entries]);

  const totalCash = entries.reduce((s, e) => s + e.pending, 0);

  // 6) Search filter (matches receiver, bill, client, or project)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(e =>
      e.receiver.toLowerCase().includes(q) ||
      e.billNumber.toLowerCase().includes(q) ||
      e.billClient.toLowerCase().includes(q) ||
      (e.projectTitle || "").toLowerCase().includes(q)
    );
  }, [entries, search]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-amber-600" />
            Cash Custody
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Live ledger of cash collected from bills that hasn't been fully distributed yet. Updates automatically as you mark distributions <span className="font-semibold">Paid</span>.
          </p>
        </div>
        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 px-4 py-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total in Custody</div>
          <div className="text-2xl font-extrabold text-orange-700">₹{totalCash.toLocaleString()}</div>
        </Card>
      </div>

      {/* Per-receiver summary cards */}
      {byReceiver.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {byReceiver.map(r => (
            <Card key={r.receiver} className="bg-card/60 border-amber-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                    <UserCheck className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{r.receiver}</div>
                    <div className="text-lg font-extrabold text-orange-700 truncate">₹{r.pending.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">{r.bills} bill{r.bills === 1 ? "" : "s"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Outstanding Bills</CardTitle>
            <Input
              placeholder="Search receiver, bill, client, project…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {billsLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
              <div className="font-semibold mb-1">All cash distributed</div>
              <div className="text-xs">Nobody is currently holding undistributed bill payments.</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-amber-500/10">
                    <TableHead className="text-xs">Custodian</TableHead>
                    <TableHead className="text-xs">Bill</TableHead>
                    <TableHead className="text-xs">Project</TableHead>
                    <TableHead className="text-xs text-right">Received</TableHead>
                    <TableHead className="text-xs text-right">Distributed</TableHead>
                    <TableHead className="text-xs text-right">Still in Hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => (
                    <TableRow key={`${e.billId}-${e.receiver}`}>
                      <TableCell className="font-semibold text-sm">
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                          {e.receiver}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-mono font-semibold">{e.billNumber}</div>
                        <div className="text-[10px] text-muted-foreground">{e.billClient}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.projectId && e.projectTitle ? (
                          <Link
                            to={`/projects/${e.projectId}?tab=distribution`}
                            className="text-primary hover:underline font-medium flex items-center gap-1"
                          >
                            <Briefcase className="h-3 w-3" />
                            {e.projectTitle}
                          </Link>
                        ) : e.projectId ? (
                          <Link to={`/projects/${e.projectId}`} className="text-primary hover:underline">View project</Link>
                        ) : (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Unlinked
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold whitespace-nowrap">₹{e.received.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-700 whitespace-nowrap">₹{e.distributedPaid.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-extrabold text-orange-700 whitespace-nowrap">₹{e.pending.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CashCustody;
