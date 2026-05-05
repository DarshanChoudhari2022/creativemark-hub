import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  MoreVertical, 
  User,
  Users,
  MessageSquare,
  Paperclip,
  Trash2,
  Layout,
  Trello,
  Settings as SettingsIcon,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Receipt,
  DollarSign,
  ArrowUpRight,
  Percent,
  IndianRupee,
  UserCheck,
  ShoppingCart,
  FileText,
  Briefcase,
  Coins,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/export";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { ConfirmEditDialog } from "@/components/ConfirmEditDialog";
import { Wallet, Pencil, PiggyBank } from "lucide-react";
import { formatINR } from "@/lib/format";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [deleteTaskInfo, setDeleteTaskInfo] = useState<string | null>(null);
  const [deleteCustomerInfo, setDeleteCustomerInfo] = useState<string | null>(null);

  // New Task State
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "Medium",
    due_date: "",
    assigned_to: "",
    status: "Todo",
    estimated_hours: "0",
    actual_hours: "0"
  });

  // Fetch Project Details
  // We fetch with embedded joins for client + assignee, but if any embed fails
  // (missing FK relationship in user's DB schema, deleted client row, etc.) we
  // FALL BACK to a plain select so the page still renders. Without this fallback
  // the whole page shows "Project not found" even when the project exists.
  const { data: project, isLoading: isProjectLoading, isError: isProjectError } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const withEmbed = await supabase
        .from("projects")
        .select(`
          *,
          client:clients(name, company_name, email, phone),
          assignee:employees(name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (!withEmbed.error && withEmbed.data) return withEmbed.data;

      if (withEmbed.error) {
        console.warn("[project] embedded select failed, retrying without joins:", withEmbed.error.message);
      }

      // Fallback: plain row, no joins
      const plain = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (plain.error) {
        console.error("[project] plain fetch also failed:", plain.error.message);
        throw plain.error;
      }
      return plain.data;
    },
  });

  // Fetch Project Tasks
  const { data: tasks } = useQuery({
    queryKey: ["project_tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_tasks")
        .select(`
          *,
          assignee:employees(name)
        `)
        .eq("project_id", id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch Project Expenses
  const { data: projectExpenses } = useQuery({
    queryKey: ["project_expenses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("project_id", id)
        .order("date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch Employees for dropdown
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Partners for distribution dropdown
  const { data: partners } = useQuery({
    queryKey: ["partners_dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, commission_type, commission_rate")
        .eq("status", "Active");
      if (error) throw error;
      return data;
    },
  });

  // Fetch Project Customers
  const { data: projectCustomers } = useQuery({
    queryKey: ["project_customers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_customers")
        .select("*")
        .eq("project_id", id)
        .order("joined_date", { ascending: false });
      if (error) { console.warn("project_customers not ready:", error.message); return []; }
      return data;
    },
  });

  // Fetch Project Sales
  const { data: projectSales } = useQuery({
    queryKey: ["project_sales", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_sales")
        .select("*, salesperson:employees!salesperson_id(name), customer:project_customers!customer_id(customer_name)")
        .eq("project_id", id)
        .order("sale_date", { ascending: false });
      if (error) { console.warn("project_sales not ready:", error.message); return []; }
      return data;
    },
  });

  // ── Fetch Bills (quotations of type 'Bill') linked to this project ──
  const { data: linkedBills } = useQuery({
    queryKey: ["project_bills", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id, quote_number, type, status, client_name, client_id, lead_id, date, due_date, grand_total, amount_paid, received_by_name, received_at, project_id")
        .eq("project_id", id)
        .order("date", { ascending: false });
      if (error) { console.warn("linked bills fetch error:", error.message); return []; }
      return data;
    },
  });

  // ── Fetch Distributions for this project (money + job distribution per sale) ──
  const { data: distributions } = useQuery({
    queryKey: ["project_distributions", id],
    queryFn: async () => {
      // IMPORTANT: do NOT embed project_sales / project_customers here. Those
      // tables are part of an older migration that may not exist in every
      // deployment, and a missing relationship causes PostgREST to return 400
      // for the whole query. We only embed `quotations` (always present) and
      // `employees`, then enrich with sales/customers in a separate query
      // below if those tables exist.
      const { data, error } = await supabase
        .from("project_sale_distributions")
        .select("*, employee:employees(name), bill:quotations(quote_number, grand_total, client_name)")
        .eq("project_id", id)
        .order("created_at", { ascending: false });
      if (error) { console.warn("distributions not ready:", error.message); return []; }
      return data;
    },
  });

  // Sales & Commission State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState(10);
  const [newCustomer, setNewCustomer] = useState({ customer_name: "", customer_email: "", customer_phone: "", company_name: "", plan_name: "", monthly_value: "0", subscription_status: "Active" });
  const [newSale, setNewSale] = useState({ customer_id: "", salesperson_id: "", amount: "0", sale_type: "New", sale_date: new Date().toISOString().slice(0, 10), notes: "", extra_charges: "0", sale_expenses: "0", expense_notes: "" });
  // Edit-sale + delete-sale state (per-product-sale log)
  const [editSale, setEditSale] = useState<any | null>(null);
  const [editSaleGate, setEditSaleGate] = useState<any | null>(null); // confirmation gate before edit
  const [deleteSaleTarget, setDeleteSaleTarget] = useState<any | null>(null);

  // ── Distribution dialog state ──
  const [isAddDistOpen, setIsAddDistOpen] = useState(false);
  const [editDist, setEditDist] = useState<any | null>(null);
  const [editDistGate, setEditDistGate] = useState<any | null>(null); // confirmation gate before edit
  const [deleteDistTarget, setDeleteDistTarget] = useState<any | null>(null);
  const [newDist, setNewDist] = useState({
    linkType: "bill" as "bill" | "sale",
    bill_id: "",
    sale_id: "",
    recipientType: "employee" as "employee" | "partner",
    employee_id: "",
    employee_name: "",
    partner_id: "",
    partner_name: "",
    job_role: "Salesperson",
    allotted_amount: "0",
    status: "Pending" as "Pending" | "Paid",
    paid_date: "",
    notes: "",
  });

  // ── Expense dialog state ──
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    category: "Other" as "Salary" | "Rent" | "Software" | "Marketing" | "Hardware" | "Travel" | "Other",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [expenseToDelete, setExpenseToDelete] = useState<any | null>(null);

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      const { data, error } = await supabase
        .from("project_tasks")
        .insert([{ ...task, project_id: id }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_tasks", id] });
      setIsAddTaskOpen(false);
      setNewTask({ title: "", description: "", priority: "Medium", due_date: "", assigned_to: "", status: "Todo", estimated_hours: "0", actual_hours: "0" });
      toast({ title: "Task added", description: "The deliverable has been assigned." });
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { data, error } = await supabase
        .from("project_tasks")
        .update({ status })
        .eq("id", taskId);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_tasks", id] });
      toast({ title: "Status updated" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("project_tasks")
        .delete()
        .eq("id", taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_tasks", id] });
      toast({ title: "Task deleted", variant: "destructive" });
    },
  });

  const updateProjectBudgetMutation = useMutation({
    mutationFn: async (budgets: { budget_revenue: number; budget_cost: number }) => {
      const { data, error } = await supabase
        .from("projects")
        .update(budgets)
        .eq("id", id);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast({ title: "Budgets updated" });
    },
  });

  if (isProjectLoading) return <div className="p-4 md:p-8 text-center">Loading project...</div>;
  if (isProjectError) return <div className="p-4 md:p-8 text-center text-red-500">Failed to load project. Please go back and try again.</div>;
  if (!project) return <div className="p-4 md:p-8 text-center text-red-500">Project not found</div>;

  // Linked-bills aggregates — declared here so they can be used in calculations below
  const linkedBillsCount = (linkedBills || []).length;
  const linkedBillsTotal = (linkedBills || []).reduce((s: number, b: any) => s + Number(b.grand_total || 0), 0);
  const linkedBillsPaid = (linkedBills || []).reduce((s: number, b: any) => s + Number(b.amount_paid || 0), 0);

  // Commission calculations + per-product profitability
  const liveCustomers = projectCustomers?.filter(c => c.subscription_status === "Active") || [];
  const rawSalesTotal = projectSales?.reduce((s, sale) => s + Number(sale.amount || 0), 0) || 0;
  const totalCommission = projectSales?.reduce((s, sale) => s + Number(sale.commission_amount || 0), 0) || 0;
  const totalExtraCharges = projectSales?.reduce((s, sale) => s + Number(sale.extra_charges || 0), 0) || 0;
  const totalSaleExpenses = projectSales?.reduce((s, sale) => s + Number(sale.sale_expenses || 0), 0) || 0;
  const projectExpensesTotal = projectExpenses?.reduce((acc, e) => acc + Number(e.amount || 0), 0) || 0;

  // Sync linked bills with sales totals so paid bills count as revenue
  const totalEarnings = rawSalesTotal + linkedBillsPaid;
  const salesCount = (projectSales?.length || 0) + linkedBillsCount;

  // Net profit = (Money received + Extra charges) − (Commission + Sale expenses + Project expenses)
  const netSalesProfit = totalEarnings + totalExtraCharges - totalCommission - totalSaleExpenses - projectExpensesTotal;
  const effectiveCommPct = project.commission_percentage || commissionPct;

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title) return;
    createTaskMutation.mutate(newTask);
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.customer_name) { toast({ title: "Name required", variant: "destructive" }); return; }
    const { error } = await supabase.from("project_customers").insert([{ ...newCustomer, monthly_value: parseFloat(newCustomer.monthly_value) || 0, project_id: id }]);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_customers", id] });
    setIsAddCustomerOpen(false);
    setNewCustomer({ customer_name: "", customer_email: "", customer_phone: "", company_name: "", plan_name: "", monthly_value: "0", subscription_status: "Active" });
    toast({ title: "Customer added" });
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(newSale.amount) || 0;
    const extra = parseFloat(newSale.extra_charges) || 0;
    const expenses = parseFloat(newSale.sale_expenses) || 0;
    const commAmt = (amount * effectiveCommPct) / 100;
    const payload = {
      ...newSale,
      amount,
      extra_charges: extra,
      sale_expenses: expenses,
      expense_notes: newSale.expense_notes || null,
      commission_percentage: effectiveCommPct,
      commission_amount: commAmt,
      project_id: id,
      customer_id: newSale.customer_id || null,
      salesperson_id: newSale.salesperson_id || null,
    };
    const { error } = await supabase.from("project_sales").insert([payload]);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_sales", id] });
    setIsAddSaleOpen(false);
    setNewSale({ customer_id: "", salesperson_id: "", amount: "0", sale_type: "New", sale_date: new Date().toISOString().slice(0, 10), notes: "", extra_charges: "0", sale_expenses: "0", expense_notes: "" });
    toast({ title: "Sale recorded" });
  };

  const handleUpdateSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSale?.id) return;
    const amount = parseFloat(String(editSale.amount)) || 0;
    const extra = parseFloat(String(editSale.extra_charges)) || 0;
    const expenses = parseFloat(String(editSale.sale_expenses)) || 0;
    const pct = parseFloat(String(editSale.commission_percentage)) || effectiveCommPct;
    const commAmt = (amount * pct) / 100;
    const { error } = await supabase.from("project_sales").update({
      amount,
      extra_charges: extra,
      sale_expenses: expenses,
      expense_notes: editSale.expense_notes || null,
      sale_type: editSale.sale_type,
      sale_date: editSale.sale_date,
      commission_percentage: pct,
      commission_amount: commAmt,
      notes: editSale.notes || null,
    }).eq("id", editSale.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_sales", id] });
    setEditSale(null);
    toast({ title: "Sale updated" });
  };

  const executeDeleteSale = async () => {
    if (!deleteSaleTarget?.id) return;
    const { error } = await supabase.from("project_sales").delete().eq("id", deleteSaleTarget.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_sales", id] });
    setDeleteSaleTarget(null);
    toast({ title: "Sale deleted" });
  };

  const handleUpdateCommission = async (newPct: number) => {
    setCommissionPct(newPct);
    await supabase.from("projects").update({ commission_percentage: newPct }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    toast({ title: "Commission updated", description: `Set to ${newPct}%` });
  };

  const handleDeleteCustomer = (custId: string) => {
    setDeleteCustomerInfo(custId);
  };

  const executeDeleteCustomer = async () => {
    if (!deleteCustomerInfo) return;
    await supabase.from("project_customers").delete().eq("id", deleteCustomerInfo);
    queryClient.invalidateQueries({ queryKey: ["project_customers", id] });
    toast({ title: "Customer removed" });
    setDeleteCustomerInfo(null);
  };

  // ── Money / Job Distribution handlers ──
  const resetDistForm = () => setNewDist({
    linkType: "bill", bill_id: "", sale_id: "",
    recipientType: "employee",
    employee_id: "", employee_name: "",
    partner_id: "", partner_name: "",
    job_role: "Salesperson", allotted_amount: "0", status: "Pending", paid_date: "", notes: "",
  });

  const handleAddDist = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipientName = newDist.recipientType === "partner" ? newDist.partner_name : newDist.employee_name;
    if (!recipientName.trim()) { toast({ title: "Recipient name required", variant: "destructive" }); return; }
    if (!newDist.job_role.trim()) { toast({ title: "Job role required", variant: "destructive" }); return; }
    if (newDist.linkType === "bill" && !newDist.bill_id) { toast({ title: "Select a bill", variant: "destructive" }); return; }
    if (newDist.linkType === "sale" && !newDist.sale_id) { toast({ title: "Select a sale", variant: "destructive" }); return; }
    const payload = {
      project_id: id,
      bill_id: newDist.linkType === "bill" ? newDist.bill_id : null,
      sale_id: newDist.linkType === "sale" ? newDist.sale_id : null,
      employee_id: newDist.recipientType === "employee" ? (newDist.employee_id || null) : null,
      employee_name: recipientName.trim(),
      job_role: newDist.job_role.trim(),
      allotted_amount: parseFloat(newDist.allotted_amount) || 0,
      status: newDist.status,
      paid_date: newDist.status === "Paid" ? (newDist.paid_date || new Date().toISOString().slice(0, 10)) : null,
      notes: newDist.notes || null,
    };
    const { error } = await supabase.from("project_sale_distributions").insert([payload]);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }

    // Auto-create a work_log so the amount shows in the employee's Recent Work
    if (payload.employee_id && payload.allotted_amount > 0) {
      const billRef = newDist.linkType === "bill"
        ? (linkedBills || []).find((b: any) => b.id === newDist.bill_id)?.quote_number || newDist.bill_id
        : (projectSales || []).find((s: any) => s.id === newDist.sale_id)?.sale_date || newDist.sale_id;
      await supabase.from("work_logs").insert({
        employee_id: payload.employee_id,
        date: payload.paid_date || new Date().toISOString().slice(0, 10),
        client_id: null,
        work_type: "Sale Distribution",
        location: "Office",
        hours: 0,
        amount: payload.allotted_amount,
        notes: `Distribution — ${payload.job_role} — ${billRef}`,
        status: "Completed",
      });
    }

    // Auto-create a partner_ledger entry so the commission shows in the Partners page
    if (newDist.recipientType === "partner" && newDist.partner_id && payload.allotted_amount > 0) {
      const bill = newDist.linkType === "bill" ? (linkedBills || []).find((b: any) => b.id === newDist.bill_id) : null;
      const sale = newDist.linkType === "sale" ? (projectSales || []).find((s: any) => s.id === newDist.sale_id) : null;
      await supabase.from("partner_ledger").insert({
        partner_id: newDist.partner_id,
        client_name: bill?.client_name || sale?.customer?.customer_name || project?.client?.name || "—",
        project_value: bill ? Number(bill.grand_total || 0) : sale ? Number(sale.amount || 0) : 0,
        commission_amount: payload.allotted_amount,
        status: payload.status,
      });
    }

    queryClient.invalidateQueries({ queryKey: ["project_distributions", id] });
    setIsAddDistOpen(false);
    resetDistForm();
    toast({ title: "Distribution added" });
  };

  const handleUpdateDist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDist?.id) return;
    const { error } = await supabase.from("project_sale_distributions").update({
      employee_name: editDist.employee_name,
      job_role: editDist.job_role,
      allotted_amount: parseFloat(String(editDist.allotted_amount)) || 0,
      status: editDist.status,
      paid_date: editDist.status === "Paid" ? (editDist.paid_date || new Date().toISOString().slice(0, 10)) : null,
      notes: editDist.notes || null,
    }).eq("id", editDist.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_distributions", id] });
    setEditDist(null);
    toast({ title: "Distribution updated" });
  };

  const executeDeleteDist = async () => {
    if (!deleteDistTarget?.id) return;
    const { error } = await supabase.from("project_sale_distributions").delete().eq("id", deleteDistTarget.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_distributions", id] });
    setDeleteDistTarget(null);
    toast({ title: "Distribution deleted" });
  };

  // ── Expense handlers ──
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("expenses").insert([{
      title: newExpense.title,
      amount: parseFloat(newExpense.amount) || 0,
      category: newExpense.category,
      date: newExpense.date,
      description: newExpense.description || null,
      project_id: id,
    }]);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_expenses", id] });
    setIsAddExpenseOpen(false);
    setNewExpense({ title: "", amount: "", category: "Other", date: new Date().toISOString().slice(0, 10), description: "" });
    toast({ title: "Expense added" });
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete?.id) return;
    const { error } = await supabase.from("expenses").delete().eq("id", expenseToDelete.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_expenses", id] });
    setExpenseToDelete(null);
    toast({ title: "Expense deleted" });
  };

  // Distribution aggregates
  const totalDistributed = (distributions || []).reduce((s: number, d: any) => s + Number(d.allotted_amount || 0), 0);
  const totalDistPending = (distributions || []).filter((d: any) => d.status === "Pending").reduce((s: number, d: any) => s + Number(d.allotted_amount || 0), 0);
  const totalDistPaid = (distributions || []).filter((d: any) => d.status === "Paid").reduce((s: number, d: any) => s + Number(d.allotted_amount || 0), 0);

  // ── Cash in Hand (computed, no DB writes) ──
  // For each linked bill that has amount_paid > 0 AND a received_by_name, figure
  // out: how much did the receiver collect, how much have they already paid out
  // as distributions (status = Paid), and what's still with them.
  // When pending = 0, the row is hidden — the "work log" auto-clears itself.
  const cashInHand: Array<{
    key: string;
    receiver: string;
    billId: string;
    billNumber: string;
    billClient: string;
    received: number;
    distributedPaid: number;
    distributedPending: number;
    pending: number;
    receivedAt: string | null;
  }> = (linkedBills || [])
    .filter((b: any) => Number(b.amount_paid || 0) > 0 && b.received_by_name)
    .map((b: any) => {
      const billDistributions = (distributions || []).filter((d: any) => d.bill_id === b.id);
      const distributedPaid = billDistributions
        .filter((d: any) => d.status === "Paid")
        .reduce((s: number, d: any) => s + Number(d.allotted_amount || 0), 0);
      const distributedPending = billDistributions
        .filter((d: any) => d.status === "Pending")
        .reduce((s: number, d: any) => s + Number(d.allotted_amount || 0), 0);
      const received = Number(b.amount_paid || 0);
      return {
        key: `${b.id}-${b.received_by_name}`,
        receiver: b.received_by_name,
        billId: b.id,
        billNumber: b.quote_number,
        billClient: b.client_name,
        received,
        distributedPaid,
        distributedPending,
        pending: received - distributedPaid,
        receivedAt: b.received_at,
      };
    })
    .filter(row => row.pending > 0); // auto-clear fully-distributed rows

  const totalCashInHand = cashInHand.reduce((s, r) => s + r.pending, 0);

  const kanbanColumns = ["Todo", "In Progress", "In Review", "Approved", "Completed"];

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Urgent": return <AlertCircle className="h-3 w-3 text-red-500" />;
      case "High": return <AlertCircle className="h-3 w-3 text-orange-500" />;
      default: return null;
    }
  };

  const getColumnColor = (col: string) => {
    switch (col) {
      case "Todo": return "bg-gray-100/50 border-gray-200 text-gray-600";
      case "In Progress": return "bg-blue-50 border-blue-100 text-blue-600";
      case "In Review": return "bg-yellow-50 border-yellow-100 text-yellow-600";
      case "Approved": return "bg-purple-50 border-purple-100 text-purple-600";
      case "Completed": return "bg-green-50 border-green-100 text-green-600";
      default: return "";
    }
  };

  const handleExportProject = () => {
    const taskData = tasks?.map(t => ({
      Task: t.title,
      Status: t.status,
      Priority: t.priority,
      Assignee: t.assignee?.name || "Unassigned",
      Estimated_Hours: t.estimated_hours,
      Actual_Hours: t.actual_hours,
      Due_Date: t.due_date
    })) || [];

    const expenseData = projectExpenses?.map(e => ({
      Expense: e.title,
      Category: e.category,
      Amount: e.amount,
      Date: e.date
    })) || [];

    // Summary data
    const summary = [{
      Project: project.title,
      Client: project.client?.company_name,
      Progress: `${project.progress}%`,
      Revenue_Budget: project.budget_revenue,
      Cost_Budget: project.budget_cost,
      Actual_Expenses: expenseData.reduce((acc, curr) => acc + Number(curr.Amount), 0),
      Profit: project.budget_revenue - expenseData.reduce((acc, curr) => acc + Number(curr.Amount), 0)
    }];

    exportToCSV([...summary, { "": "" }, { "TASKS": "---" }, ...taskData, { "": "" }, { "EXPENSES": "---" }, ...expenseData], `${project.title}_Report`);
    toast({ title: "Report Exported", description: "Project summary and tasks saved to CSV." });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Breadcrumbs & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate("/projects")} className="rounded-full h-10 w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <span>Projects</span>
              <ChevronRight className="h-3 w-3" />
              <span>{project.client?.company_name}</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{project.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExportProject}>
            <ArrowUpRight className="h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Project Settings
          </Button>
          <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" />
                Add Deliverable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Task / Deliverable</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddTask} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="t-title">Task Title *</Label>
                  <Input 
                    id="t-title" 
                    placeholder="e.g. Design Logo Concepts" 
                    value={newTask.title}
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select defaultValue="Medium" onValueChange={(v) => setNewTask({...newTask, priority: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select onValueChange={(v) => setNewTask({...newTask, assigned_to: v})}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input 
                    type="date" 
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Est. Hours</Label>
                    <Input 
                      type="number" 
                      value={newTask.estimated_hours}
                      onChange={(e) => setNewTask({...newTask, estimated_hours: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Actual Hours</Label>
                    <Input 
                      type="number" 
                      value={newTask.actual_hours}
                      onChange={(e) => setNewTask({...newTask, actual_hours: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Provide details for the deliverable..."
                    value={newTask.description}
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? "Adding..." : "Add Deliverable"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Project Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-card/40 backdrop-blur-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layout className="h-5 w-5 text-primary" />
              Project Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              {project.description || "No description provided for this project."}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Status</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/20">{project.status}</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Deadline</span>
                <div className="flex items-center gap-2 font-medium">
                  <Calendar className="h-4 w-4 text-primary" />
                  {project.end_date ? format(new Date(project.end_date), "MMM d") : "None"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Manager</span>
                <div className="flex items-center gap-2 font-medium">
                  <User className="h-4 w-4 text-primary" />
                  {project.assignee?.name || "Unassigned"}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Progress</span>
                <div className="text-lg font-bold text-primary">{project.progress || 0}%</div>
              </div>
            </div>
            <Progress value={project.progress || 0} className="h-2 shadow-inner" />
          </CardContent>
        </Card>

        <Card className="bg-card/40 backdrop-blur-md border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Client Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-foreground">{project.client?.company_name}</h3>
              <p className="text-sm text-muted-foreground">{project.client?.name}</p>
            </div>
            <div className="space-y-2 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Active since {project.created_at ? format(new Date(project.created_at), "MMM yyyy") : "—"}</span>
              </div>
              <Button variant="ghost" className="w-full justify-start h-9 px-2 text-primary hover:bg-primary/5 text-sm gap-2">
                <MessageSquare className="h-4 w-4" />
                Contact Client
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <Tabs defaultValue="kanban" className="space-y-6">
        <div className="overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="bg-background/50 border border-border/50 flex-nowrap w-max md:w-auto">
            <TabsTrigger value="kanban" className="gap-2">
              <Trello className="h-4 w-4" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <Layout className="h-4 w-4" />
              List View
            </TabsTrigger>
            <TabsTrigger value="financials" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="expenses" className="gap-2">
              <Receipt className="h-4 w-4" />
              Expenses
              {projectExpenses && projectExpenses.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">{projectExpenses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2">
              <Coins className="h-4 w-4" />
              Distribution
              {distributions && distributions.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">{distributions.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 min-h-[300px] md:h-[calc(100vh-400px)] md:min-h-[500px]">
            {kanbanColumns.map((column) => (
              <div key={column} className="flex flex-col h-full bg-card/20 rounded-xl border border-border/50 overflow-hidden">
                <div className={`p-3 border-b flex items-center justify-between ${getColumnColor(column)}`}>
                  <h3 className="font-bold text-sm uppercase tracking-wider">{column}</h3>
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-background/50 border-none">
                    {tasks?.filter(t => t.status === column).length || 0}
                  </Badge>
                </div>
                <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                  {tasks?.filter(t => t.status === column).map((task) => (
                    <Card key={task.id} className="shadow-sm hover:shadow-md transition-all duration-300 border-primary/5 group relative cursor-move">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {task.title}
                          </h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {kanbanColumns.filter(c => c !== column).map(c => (
                                <DropdownMenuItem 
                                  key={c} 
                                  onClick={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: c })}
                                >
                                  Move to {c}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTaskInfo(task.id)}>
                                Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-1.5">
                            {getPriorityIcon(task.priority)}
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {task.due_date ? format(new Date(task.due_date), "MMM d") : "No date"}
                            </span>
                          </div>
                          <div className="flex -space-x-2">
                            <Badge variant="secondary" className="h-6 w-6 p-0 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold" title={task.assignee?.name}>
                              {task.assignee?.name?.charAt(0) || "?"}
                            </Badge>
                          </div>
                        </div>
                        {task.estimated_hours > 0 && (
                          <div className="pt-1 flex items-center gap-2">
                            <Progress value={(task.actual_hours / task.estimated_hours) * 100} className="h-1 flex-1" />
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">{task.actual_hours}h / {task.estimated_hours}h</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  <Button 
                    variant="ghost" 
                    className="w-full h-10 border border-dashed border-border/50 text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all text-xs gap-2"
                    onClick={() => {
                      setNewTask({...newTask, status: column});
                      setIsAddTaskOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                    Add Task
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          <Card className="bg-card/40 backdrop-blur-md border-border/50 overflow-x-auto">
            <CardContent className="p-0 min-w-[600px]">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-widest border-b border-border/50">
                  <tr>
                    <th className="px-6 py-4">Deliverable</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Priority</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Assignee</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {tasks?.map((task) => (
                    <tr key={task.id} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-4 font-medium text-foreground">{task.title}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={`px-2 py-0.5 rounded-md text-[10px] font-medium uppercase border-none ${getColumnColor(task.status)}`}>
                          {task.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {getPriorityIcon(task.priority)}
                          <span className="text-xs">{task.priority}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {task.assignee?.name?.charAt(0) || "?"}
                          </div>
                          <span>{task.assignee?.name || "Unassigned"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTaskInfo(task.id)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="financials">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Profitability Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">Actual Revenue</Label>
                    <div className="text-2xl font-bold text-primary">₹{(totalEarnings + totalExtraCharges).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Sales + Bills + Extras</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">Actual Expenses</Label>
                    <div className="text-2xl font-bold text-red-500">₹{(projectExpensesTotal + totalCommission + totalSaleExpenses).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">Project + Commission + Sale</div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-border/50">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase">Net Profit</Label>
                      <div className={`text-xl font-bold ${netSalesProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        ₹{netSalesProfit.toLocaleString()}
                      </div>
                    </div>
                    <Badge className={`${netSalesProfit >= 0 ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"}`}>
                      {(totalEarnings + totalExtraCharges) > 0
                        ? ((netSalesProfit / (totalEarnings + totalExtraCharges)) * 100).toFixed(1)
                        : 0}% Margin
                    </Badge>
                  </div>
                  <Progress
                    value={(totalEarnings + totalExtraCharges) > 0
                      ? Math.max(0, Math.min(100, ((netSalesProfit / (totalEarnings + totalExtraCharges)) * 100)))
                      : 0}
                    className="h-2"
                  />
                </div>

                <div className="pt-2 border-t border-border/50 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Revenue Budget</span>
                    <span>₹{(project.budget_revenue || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Cost Budget</span>
                    <span>₹{(project.budget_cost || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <h4 className="text-sm font-bold">Update Project Budget</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Revenue Budget (₹)</Label>
                      <Input 
                        type="number" 
                        defaultValue={project.budget_revenue} 
                        onBlur={(e) => updateProjectBudgetMutation.mutate({ 
                          budget_revenue: parseFloat(e.target.value) || 0,
                          budget_cost: project.budget_cost
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cost Budget (₹)</Label>
                      <Input 
                        type="number" 
                        defaultValue={project.budget_cost} 
                        onBlur={(e) => updateProjectBudgetMutation.mutate({ 
                          budget_revenue: project.budget_revenue,
                          budget_cost: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Project Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-widest border-b border-border/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Expense</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {projectExpenses?.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                            No expenses linked to this project.
                          </td>
                        </tr>
                      ) : (
                        projectExpenses?.map((expense) => (
                          <tr key={expense.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-medium">{expense.title}</div>
                              <div className="text-[10px] text-muted-foreground uppercase">{expense.category}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-red-500">
                              -₹{Number(expense.amount).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sales & Commission Tab */}
        <TabsContent value="sales">
          {/* Summary Cards — Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-3">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0"><ShoppingCart className="h-4 w-4 text-blue-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sales</div><div className="text-xl font-extrabold">{salesCount}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-sky-500/10 to-sky-600/5 border-sky-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-sky-500/20 flex items-center justify-center shrink-0"><Users className="h-4 w-4 text-sky-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Live Customers</div><div className="text-xl font-extrabold">{liveCustomers.length}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0"><IndianRupee className="h-4 w-4 text-green-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Money Received</div><div className="text-xl font-extrabold text-green-600 truncate">₹{totalEarnings.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0"><Wallet className="h-4 w-4 text-cyan-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Extra Charges</div><div className="text-xl font-extrabold text-cyan-700 truncate">₹{totalExtraCharges.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0"><UserCheck className="h-4 w-4 text-amber-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Commission</div><div className="text-xl font-extrabold text-amber-600 truncate">₹{totalCommission.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-rose-500/10 to-rose-600/5 border-rose-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0"><Receipt className="h-4 w-4 text-rose-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Sale Expenses</div><div className="text-xl font-extrabold text-rose-600 truncate">₹{totalSaleExpenses.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards — Row 2 (Net Profit + Commission Rate hero) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Card className={`bg-gradient-to-br ${netSalesProfit >= 0 ? "from-emerald-500/15 to-emerald-600/5 border-emerald-500/30" : "from-red-500/15 to-red-600/5 border-red-500/30"}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${netSalesProfit >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"}`}>
                    <PiggyBank className={`h-6 w-6 ${netSalesProfit >= 0 ? "text-emerald-500" : "text-red-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Net Profit (this product)</div>
                    <div className={`text-3xl font-extrabold ${netSalesProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      ₹{netSalesProfit.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">Received + Extra − Commission − Expenses</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-purple-500/20 flex items-center justify-center shrink-0"><Percent className="h-6 w-6 text-purple-500" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Default Commission Rate</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min={0} max={100} className="h-9 w-24 text-xl font-extrabold" value={effectiveCommPct} onChange={(e) => handleUpdateCommission(parseFloat(e.target.value) || 0)} />
                      <span className="text-xl font-bold">%</span>
                      <span className="text-[11px] text-muted-foreground ml-2">applies to new sales</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Live Customers (compact, full width) */}
            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Live Customers ({liveCustomers.length})</CardTitle>
                <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Add</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddCustomer} className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Name *</Label><Input value={newCustomer.customer_name} onChange={e => setNewCustomer({...newCustomer, customer_name: e.target.value})} placeholder="Customer name" /></div>
                        <div><Label>Company</Label><Input value={newCustomer.company_name} onChange={e => setNewCustomer({...newCustomer, company_name: e.target.value})} placeholder="Company" /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Email</Label><Input value={newCustomer.customer_email} onChange={e => setNewCustomer({...newCustomer, customer_email: e.target.value})} /></div>
                        <div><Label>Phone</Label><Input value={newCustomer.customer_phone} onChange={e => setNewCustomer({...newCustomer, customer_phone: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label>Plan</Label><Input value={newCustomer.plan_name} onChange={e => setNewCustomer({...newCustomer, plan_name: e.target.value})} placeholder="e.g. Pro" /></div>
                        <div><Label>Monthly ₹</Label><Input type="number" value={newCustomer.monthly_value} onChange={e => setNewCustomer({...newCustomer, monthly_value: e.target.value})} /></div>
                        <div><Label>Status</Label>
                          <Select value={newCustomer.subscription_status} onValueChange={v => setNewCustomer({...newCustomer, subscription_status: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Trial">Trial</SelectItem><SelectItem value="Paused">Paused</SelectItem><SelectItem value="Churned">Churned</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" className="w-full">Add Customer</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[10px] uppercase"><TableHead>Customer</TableHead><TableHead>Plan</TableHead><TableHead>Monthly</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(projectCustomers || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers yet. Add your first customer above.</TableCell></TableRow>
                      ) : (projectCustomers || []).map(cust => (
                        <TableRow key={cust.id} className="hover:bg-primary/5">
                          <TableCell>
                            <div className="font-semibold">{cust.customer_name}</div>
                            {cust.company_name && <div className="text-[10px] text-muted-foreground">{cust.company_name}</div>}
                            {cust.customer_phone && <div className="text-[10px] text-muted-foreground">{cust.customer_phone}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{cust.plan_name || "—"}</TableCell>
                          <TableCell className="font-semibold">₹{Number(cust.monthly_value || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cust.subscription_status === "Active" ? "bg-green-50 text-green-700 border-green-200" : cust.subscription_status === "Trial" ? "bg-blue-50 text-blue-700 border-blue-200" : cust.subscription_status === "Churned" ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-50 text-gray-600 border-gray-200"}>{cust.subscription_status}</Badge>
                          </TableCell>
                          <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDeleteCustomer(cust.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Linked Bills — bills created in Quotations & linked to this project */}
            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Linked Bills</CardTitle>
                  {linkedBillsCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {linkedBillsCount} · ₹{linkedBillsTotal.toLocaleString()} total · ₹{linkedBillsPaid.toLocaleString()} paid
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => navigate("/quotations")}>
                  <Plus className="h-3 w-3" /> Create Bill
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px] uppercase">
                        <TableHead>Bill #</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Received By</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(linkedBills || []).length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No bills linked to this project yet. Go to <span className="font-semibold">Quotations & Bills</span> and pick this project when creating a bill.
                        </TableCell></TableRow>
                      ) : (linkedBills || []).map((b: any) => {
                        const balance = Number(b.grand_total || 0) - Number(b.amount_paid || 0);
                        return (
                          <TableRow key={b.id} className="hover:bg-primary/5">
                            <TableCell className="font-mono font-semibold text-xs">{b.quote_number}</TableCell>
                            <TableCell className="text-sm">{b.client_name}</TableCell>
                            <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{b.date ? format(new Date(b.date), "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell className="text-right font-bold whitespace-nowrap">{formatINR(b.grand_total || 0)}</TableCell>
                            <TableCell className="text-right text-green-600 font-semibold whitespace-nowrap">{formatINR(b.amount_paid || 0)}</TableCell>
                            <TableCell className={`text-right font-bold whitespace-nowrap ${balance > 0 ? "text-primary" : "text-muted-foreground"}`}>{formatINR(balance)}</TableCell>
                            <TableCell className="text-sm">
                              {b.received_by_name ? (
                                <div className="flex items-center gap-1">
                                  <UserCheck className="h-3 w-3 text-green-600" />
                                  <span className="text-xs">{b.received_by_name}</span>
                                </div>
                              ) : <span className="text-muted-foreground text-xs">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${b.status === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : b.status === "Overdue" ? "bg-red-50 text-red-700 border-red-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{b.status}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Sales & Commission Records */}
            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Sales Records</CardTitle>
                <Dialog open={isAddSaleOpen} onOpenChange={setIsAddSaleOpen}>
                  <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Record Sale</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record New Sale</DialogTitle></DialogHeader>
                    <form onSubmit={handleAddSale} className="space-y-3 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Customer</Label>
                          <Select value={newSale.customer_id} onValueChange={v => setNewSale({...newSale, customer_id: v})}>
                            <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                            <SelectContent>{(projectCustomers || []).map(c => <SelectItem key={c.id} value={c.id}>{c.customer_name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div><Label>Salesperson</Label>
                          <Select value={newSale.salesperson_id} onValueChange={v => setNewSale({...newSale, salesperson_id: v})}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>{(employees || []).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label>Money Received (₹) *</Label><Input type="number" value={newSale.amount} onChange={e => setNewSale({...newSale, amount: e.target.value})} /></div>
                        <div><Label>Sale Type</Label>
                          <Select value={newSale.sale_type} onValueChange={v => setNewSale({...newSale, sale_type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="New">New</SelectItem><SelectItem value="Renewal">Renewal</SelectItem><SelectItem value="Upgrade">Upgrade</SelectItem><SelectItem value="One-time">One-time</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div><Label>Date</Label><Input type="date" value={newSale.sale_date} onChange={e => setNewSale({...newSale, sale_date: e.target.value})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Extra Charges (₹)</Label><Input type="number" min={0} value={newSale.extra_charges} onChange={e => setNewSale({...newSale, extra_charges: e.target.value})} placeholder="Setup / addons / GST" /></div>
                        <div><Label>Expenses for this sale (₹)</Label><Input type="number" min={0} value={newSale.sale_expenses} onChange={e => setNewSale({...newSale, sale_expenses: e.target.value})} placeholder="Optional" /></div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase">Auto Commission Calculator</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm">₹{(parseFloat(newSale.amount) || 0).toLocaleString()} × {effectiveCommPct}%</span>
                          <span className="text-lg font-extrabold text-amber-600">= ₹{((parseFloat(newSale.amount) || 0) * effectiveCommPct / 100).toLocaleString()}</span>
                        </div>
                        {(parseFloat(newSale.amount) || 0) + (parseFloat(newSale.extra_charges) || 0) - (parseFloat(newSale.amount) || 0) * effectiveCommPct / 100 - (parseFloat(newSale.sale_expenses) || 0) !== 0 && (
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-200 dark:border-amber-800">
                            <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Net Profit</span>
                            <span className={`text-lg font-extrabold ${((parseFloat(newSale.amount) || 0) + (parseFloat(newSale.extra_charges) || 0) - (parseFloat(newSale.amount) || 0) * effectiveCommPct / 100 - (parseFloat(newSale.sale_expenses) || 0)) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              ₹{((parseFloat(newSale.amount) || 0) + (parseFloat(newSale.extra_charges) || 0) - (parseFloat(newSale.amount) || 0) * effectiveCommPct / 100 - (parseFloat(newSale.sale_expenses) || 0)).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div><Label>Expense Notes</Label><Textarea value={newSale.expense_notes} onChange={e => setNewSale({...newSale, expense_notes: e.target.value})} rows={2} placeholder="What were the expenses for? (optional)" /></div>
                      <div><Label>Notes</Label><Textarea value={newSale.notes} onChange={e => setNewSale({...newSale, notes: e.target.value})} rows={2} /></div>
                      <Button type="submit" className="w-full">Record Sale</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px] uppercase">
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Salesperson</TableHead>
                        <TableHead className="text-right">Money Received</TableHead>
                        <TableHead className="text-right">Extra Charges</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                        <TableHead className="text-right w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(projectSales || []).length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No sales recorded yet. Click <span className="font-semibold">Record Sale</span> to log your first sale of this product.</TableCell></TableRow>
                      ) : (projectSales || []).map(sale => {
                        const amt = Number(sale.amount || 0);
                        const extra = Number(sale.extra_charges || 0);
                        const comm = Number(sale.commission_amount || 0);
                        const expn = Number(sale.sale_expenses || 0);
                        const net = amt + extra - comm - expn;
                        return (
                          <TableRow key={sale.id} className="hover:bg-primary/5">
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{sale.sale_date ? format(new Date(sale.sale_date), "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell>
                              <div className="font-semibold text-sm">{sale.customer?.customer_name || "—"}</div>
                              <Badge variant="secondary" className="text-[9px] px-1.5 mt-0.5">{sale.sale_type}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{sale.salesperson?.name || "—"}</TableCell>
                            <TableCell className="text-right font-bold text-green-600 whitespace-nowrap">₹{amt.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-semibold text-cyan-700 whitespace-nowrap">₹{extra.toLocaleString()}</TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="font-bold text-amber-600">₹{comm.toLocaleString()}</div>
                              <div className="text-[10px] text-muted-foreground">{sale.commission_percentage}%</div>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="font-semibold text-rose-600">₹{expn.toLocaleString()}</div>
                              {sale.expense_notes && (
                                <div className="text-[10px] text-muted-foreground max-w-[140px] truncate" title={sale.expense_notes}>{sale.expense_notes}</div>
                              )}
                            </TableCell>
                            <TableCell className={`text-right font-extrabold whitespace-nowrap ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>₹{net.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditSaleGate({ ...sale })} title="Edit / add expenses">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteSaleTarget(sale)} title="Delete sale">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Edit Sale Dialog */}
          <Dialog open={!!editSale} onOpenChange={(v) => { if (!v) setEditSale(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Sale</DialogTitle></DialogHeader>
              {editSale && (
                <form onSubmit={handleUpdateSale} className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Money Received (₹) *</Label><Input type="number" value={editSale.amount ?? 0} onChange={e => setEditSale({ ...editSale, amount: e.target.value })} /></div>
                    <div><Label>Sale Type</Label>
                      <Select value={editSale.sale_type || "New"} onValueChange={v => setEditSale({ ...editSale, sale_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="New">New</SelectItem><SelectItem value="Renewal">Renewal</SelectItem><SelectItem value="Upgrade">Upgrade</SelectItem><SelectItem value="One-time">One-time</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={editSale.sale_date || ""} onChange={e => setEditSale({ ...editSale, sale_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Extra Charges (₹)</Label><Input type="number" min={0} value={editSale.extra_charges ?? 0} onChange={e => setEditSale({ ...editSale, extra_charges: e.target.value })} /></div>
                    <div><Label>Expenses (₹)</Label><Input type="number" min={0} value={editSale.sale_expenses ?? 0} onChange={e => setEditSale({ ...editSale, sale_expenses: e.target.value })} /></div>
                    <div><Label>Commission %</Label><Input type="number" min={0} max={100} value={editSale.commission_percentage ?? effectiveCommPct} onChange={e => setEditSale({ ...editSale, commission_percentage: e.target.value })} /></div>
                  </div>
                  <div><Label>Expense Notes</Label><Textarea value={editSale.expense_notes || ""} onChange={e => setEditSale({ ...editSale, expense_notes: e.target.value })} rows={2} placeholder="What were the expenses for?" /></div>
                  <div><Label>Notes</Label><Textarea value={editSale.notes || ""} onChange={e => setEditSale({ ...editSale, notes: e.target.value })} rows={2} /></div>
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-wider">Net Profit (preview)</span>
                    <span className="text-lg font-extrabold text-emerald-600">
                      ₹{((parseFloat(String(editSale.amount)) || 0) + (parseFloat(String(editSale.extra_charges)) || 0) - ((parseFloat(String(editSale.amount)) || 0) * (parseFloat(String(editSale.commission_percentage)) || effectiveCommPct) / 100) - (parseFloat(String(editSale.sale_expenses)) || 0)).toLocaleString()}
                    </span>
                  </div>
                  <Button type="submit" className="w-full">Save Changes</Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══ Money / Job Distribution Tab ═══════════════════════════ */}
        <TabsContent value="distribution">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/5 border-indigo-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0"><Coins className="h-4 w-4 text-indigo-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Distributed</div><div className="text-xl font-extrabold text-indigo-700 truncate">₹{totalDistributed.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0"><Clock className="h-4 w-4 text-amber-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Pending Payout</div><div className="text-xl font-extrabold text-amber-600 truncate">₹{totalDistPending.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div>
                  <div className="min-w-0"><div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Already Paid Out</div><div className="text-xl font-extrabold text-emerald-600 truncate">₹{totalDistPaid.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Cash in Hand (per-project) ────────────────────────────
              Shows who currently holds project cash. Auto-computed from each
              bill's amount_paid + received_by_name minus the sum of distributions
              from that bill marked as 'Paid'. When fully distributed, the row
              disappears — no manual cleanup needed. */}
          {cashInHand.length > 0 && (
            <Card className="mb-4 bg-gradient-to-br from-amber-500/5 to-orange-500/10 border-amber-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  Cash in Hand (this project)
                  <Badge variant="outline" className="ml-1 bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                    Total: ₹{totalCashInHand.toLocaleString()}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  These employees received bill payments and haven't yet distributed all of it. Mark distributions as <span className="font-semibold">Paid</span> below to clear the entry automatically.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-amber-500/10">
                        <TableHead className="text-xs">Custodian</TableHead>
                        <TableHead className="text-xs">From Bill</TableHead>
                        <TableHead className="text-xs text-right">Received</TableHead>
                        <TableHead className="text-xs text-right">Distributed (Paid)</TableHead>
                        <TableHead className="text-xs text-right">Pending Distribute</TableHead>
                        <TableHead className="text-xs text-right">Still in Hand</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cashInHand.map(row => (
                        <TableRow key={row.key}>
                          <TableCell className="font-semibold text-sm">
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-amber-600" />
                              {row.receiver}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-mono font-semibold">{row.billNumber}</div>
                            <div className="text-[10px] text-muted-foreground">{row.billClient}</div>
                          </TableCell>
                          <TableCell className="text-right font-semibold whitespace-nowrap">₹{row.received.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-emerald-700 whitespace-nowrap">₹{row.distributedPaid.toLocaleString()}</TableCell>
                          <TableCell className="text-right text-amber-700 whitespace-nowrap">₹{row.distributedPending.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-extrabold text-orange-700 whitespace-nowrap">₹{row.pending.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/40 backdrop-blur-md border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Money & Job Distribution
                </CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Break down each sale / bill into per-person allocations — who did what job, how much they get, and whether they've been paid.
                </p>
              </div>
              <Dialog open={isAddDistOpen} onOpenChange={(v) => { setIsAddDistOpen(v); if (!v) resetDistForm(); }}>
                <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="h-3 w-3" />Add Distribution</Button></DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Allocate Payout for a Sale</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddDist} className="space-y-3 pt-2">
                    <div>
                      <Label>Link to *</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        <Button type="button" variant={newDist.linkType === "bill" ? "default" : "outline"} size="sm" onClick={() => setNewDist({ ...newDist, linkType: "bill", sale_id: "" })}>
                          <FileText className="h-3 w-3 mr-1" /> Bill ({(linkedBills || []).length})
                        </Button>
                        <Button type="button" variant={newDist.linkType === "sale" ? "default" : "outline"} size="sm" onClick={() => setNewDist({ ...newDist, linkType: "sale", bill_id: "" })}>
                          <ShoppingCart className="h-3 w-3 mr-1" /> Project Sale ({(projectSales || []).length})
                        </Button>
                      </div>
                    </div>
                    {newDist.linkType === "bill" ? (
                      <div>
                        <Label>Select Bill *</Label>
                        <Select value={newDist.bill_id} onValueChange={v => setNewDist({ ...newDist, bill_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Pick a linked bill" /></SelectTrigger>
                          <SelectContent>
                            {(linkedBills || []).length === 0 ? (
                              <SelectItem value="__none__" disabled>No bills linked to this project</SelectItem>
                            ) : (linkedBills || []).map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.quote_number} · {b.client_name} · ₹{Number(b.grand_total || 0).toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label>Select Sale *</Label>
                        <Select value={newDist.sale_id} onValueChange={v => setNewDist({ ...newDist, sale_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Pick a sale" /></SelectTrigger>
                          <SelectContent>
                            {(projectSales || []).length === 0 ? (
                              <SelectItem value="__none__" disabled>No project sales yet</SelectItem>
                            ) : (projectSales || []).map((s: any) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.sale_date ? format(new Date(s.sale_date), "MMM d") : "—"} · {s.customer?.customer_name || "—"} · ₹{Number(s.amount || 0).toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Recipient *</Label>
                        <div className="grid grid-cols-2 gap-1 mt-1 mb-2">
                          <Button
                            type="button" size="sm"
                            variant={newDist.recipientType === "employee" ? "default" : "outline"}
                            onClick={() => setNewDist({ ...newDist, recipientType: "employee", partner_id: "", partner_name: "" })}
                          >Employee</Button>
                          <Button
                            type="button" size="sm"
                            variant={newDist.recipientType === "partner" ? "default" : "outline"}
                            onClick={() => setNewDist({ ...newDist, recipientType: "partner", employee_id: "", employee_name: "" })}
                          >Partner</Button>
                        </div>
                        {newDist.recipientType === "employee" ? (
                          <>
                            <Select
                              value={newDist.employee_id || "custom"}
                              onValueChange={v => {
                                if (v === "custom") { setNewDist({ ...newDist, employee_id: "", employee_name: "" }); return; }
                                const emp = employees?.find(e => e.id === v);
                                setNewDist({ ...newDist, employee_id: v, employee_name: emp?.name || "" });
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custom">Custom name…</SelectItem>
                                {(employees || []).map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Input className="mt-1" placeholder="Name" value={newDist.employee_name} onChange={e => setNewDist({ ...newDist, employee_name: e.target.value })} />
                          </>
                        ) : (
                          <>
                            <Select
                              value={newDist.partner_id || "custom"}
                              onValueChange={v => {
                                if (v === "custom") { setNewDist({ ...newDist, partner_id: "", partner_name: "" }); return; }
                                const p = (partners || []).find((x: any) => x.id === v);
                                setNewDist({ ...newDist, partner_id: v, partner_name: p?.name || "", employee_name: p?.name || "" });
                              }}
                            >
                              <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="custom">Custom name…</SelectItem>
                                {(partners || []).map((p: any) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input className="mt-1" placeholder="Partner name" value={newDist.partner_name} onChange={e => setNewDist({ ...newDist, partner_name: e.target.value, employee_name: e.target.value })} />
                          </>
                        )}
                      </div>
                      <div>
                        <Label>Job Role *</Label>
                        <Select value={newDist.job_role} onValueChange={v => setNewDist({ ...newDist, job_role: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {["Salesperson", "Designer", "Developer", "Account Manager", "Project Manager", "Lead Generator", "Content Writer", "Video Editor", "Photographer", "Partner", "Referrer", "Other"].map(r => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Allotted ₹ *</Label>
                        <Input type="number" min={0} value={newDist.allotted_amount} onChange={e => setNewDist({ ...newDist, allotted_amount: e.target.value })} />
                      </div>
                      <div>
                        <Label>Status</Label>
                        <Select value={newDist.status} onValueChange={(v: "Pending" | "Paid") => setNewDist({ ...newDist, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Paid Date</Label>
                        <Input type="date" value={newDist.paid_date} onChange={e => setNewDist({ ...newDist, paid_date: e.target.value })} disabled={newDist.status !== "Paid"} />
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea rows={2} value={newDist.notes} onChange={e => setNewDist({ ...newDist, notes: e.target.value })} placeholder="Optional — scope, deliverable, etc." />
                    </div>

                    <Button type="submit" className="w-full">Add Distribution</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-[10px] uppercase">
                      <TableHead>Recipient</TableHead>
                      <TableHead>Job Role</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead className="text-right">Allotted</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                      <TableHead className="text-right w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(distributions || []).length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Coins className="h-10 w-10 mx-auto mb-2 text-muted-foreground/40" />
                        <div className="font-semibold mb-1">No distributions yet</div>
                        <div className="text-xs">Click <span className="font-semibold">Add Distribution</span> to split a sale or bill between the team.</div>
                      </TableCell></TableRow>
                    ) : (distributions || []).map((d: any) => (
                      <TableRow key={d.id} className="hover:bg-primary/5">
                        <TableCell>
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-primary" />
                            {d.employee?.name || d.employee_name}
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{d.job_role}</Badge></TableCell>
                        <TableCell className="text-xs">
                          {d.bill_id && d.bill ? (
                            <div><span className="font-mono font-semibold">{d.bill.quote_number}</span><div className="text-[10px] text-muted-foreground">{d.bill.client_name}</div></div>
                          ) : d.sale_id ? (() => {
                            // Resolve sale from already-fetched projectSales (no embed needed,
                            // so this works even when the project_sales table is missing).
                            const s = (projectSales || []).find((x: any) => x.id === d.sale_id);
                            if (!s) return <span className="font-mono text-[10px] text-muted-foreground">Sale #{String(d.sale_id).slice(0, 8)}…</span>;
                            return (
                              <div>
                                <span className="font-semibold">{s.customer?.customer_name || "Sale"}</span>
                                <div className="text-[10px] text-muted-foreground">
                                  {s.sale_date ? format(new Date(s.sale_date), "MMM d, yyyy") : ""} · ₹{Number(s.amount || 0).toLocaleString()}
                                </div>
                              </div>
                            );
                          })() : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-bold text-indigo-700 whitespace-nowrap">₹{Number(d.allotted_amount || 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${d.status === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{d.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{d.paid_date ? format(new Date(d.paid_date), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditDistGate({ ...d })} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setDeleteDistTarget(d)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Edit Distribution Dialog */}
          <Dialog open={!!editDist} onOpenChange={(v) => { if (!v) setEditDist(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Edit Distribution</DialogTitle></DialogHeader>
              {editDist && (
                <form onSubmit={handleUpdateDist} className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Employee</Label><Input value={editDist.employee_name || ""} onChange={e => setEditDist({ ...editDist, employee_name: e.target.value })} /></div>
                    <div><Label>Job Role</Label>
                      <Select value={editDist.job_role} onValueChange={v => setEditDist({ ...editDist, job_role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Salesperson", "Designer", "Developer", "Account Manager", "Project Manager", "Lead Generator", "Content Writer", "Video Editor", "Photographer", "Partner", "Referrer", "Other"].map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Allotted ₹</Label><Input type="number" min={0} value={editDist.allotted_amount ?? 0} onChange={e => setEditDist({ ...editDist, allotted_amount: e.target.value })} /></div>
                    <div><Label>Status</Label>
                      <Select value={editDist.status} onValueChange={(v: "Pending" | "Paid") => setEditDist({ ...editDist, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Paid">Paid</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Paid Date</Label><Input type="date" value={editDist.paid_date || ""} onChange={e => setEditDist({ ...editDist, paid_date: e.target.value })} disabled={editDist.status !== "Paid"} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea rows={2} value={editDist.notes || ""} onChange={e => setEditDist({ ...editDist, notes: e.target.value })} /></div>
                  <Button type="submit" className="w-full">Save Changes</Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ═══ Expenses Tab ═══════════════════════════ */}
        <TabsContent value="expenses">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Project Expenses</h3>
                <p className="text-sm text-muted-foreground">Track costs tied to this project.</p>
              </div>
              <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1">
                    <Plus className="h-3 w-3" /> Log Expense
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log Project Expense</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddExpense} className="space-y-3 pt-2">
                    <div className="space-y-2">
                      <Label>Title *</Label>
                      <Input value={newExpense.title} onChange={e => setNewExpense({ ...newExpense, title: e.target.value })} placeholder="e.g. Printing cost, vendor payment" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Amount (₹) *</Label>
                        <Input type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })} placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select value={newExpense.category} onValueChange={v => setNewExpense({ ...newExpense, category: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Salary">Salary</SelectItem>
                            <SelectItem value="Rent">Rent</SelectItem>
                            <SelectItem value="Software">Software</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Hardware">Hardware</SelectItem>
                            <SelectItem value="Travel">Travel</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input type="date" value={newExpense.date} onChange={e => setNewExpense({ ...newExpense, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea rows={2} value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })} placeholder="Optional note..." />
                    </div>
                    <Button type="submit" className="w-full">Save Expense</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-card/40 backdrop-blur-md border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[10px] uppercase">
                        <TableHead>Expense</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(projectExpenses || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No expenses yet. Click <span className="font-semibold">Log Expense</span> to record costs.
                          </TableCell>
                        </TableRow>
                      ) : (projectExpenses || []).map((exp: any) => (
                        <TableRow key={exp.id} className="hover:bg-primary/5">
                          <TableCell>
                            <div className="font-medium text-sm">{exp.title}</div>
                            {exp.description && <div className="text-[10px] text-muted-foreground max-w-[200px] truncate">{exp.description}</div>}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{exp.category}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{exp.date ? format(new Date(exp.date), "MMM d, yyyy") : "—"}</TableCell>
                          <TableCell className="text-right font-bold text-red-500 whitespace-nowrap">₹{Number(exp.amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => setExpenseToDelete(exp)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDeleteDialog
        isOpen={!!deleteTaskInfo}
        onClose={() => setDeleteTaskInfo(null)}
        onConfirm={() => {
          if (deleteTaskInfo) {
            deleteTaskMutation.mutate(deleteTaskInfo);
            setDeleteTaskInfo(null);
          }
        }}
        entityName="task"
      />
      <ConfirmDeleteDialog
        isOpen={!!deleteCustomerInfo}
        onClose={() => setDeleteCustomerInfo(null)}
        onConfirm={executeDeleteCustomer}
        entityName="customer"
      />
      <ConfirmDeleteDialog
        isOpen={!!deleteSaleTarget}
        onClose={() => setDeleteSaleTarget(null)}
        onConfirm={executeDeleteSale}
        title="Delete Sale Entry?"
        description={`This will permanently delete the sale of ₹${Number(deleteSaleTarget?.amount || 0).toLocaleString()}${deleteSaleTarget?.customer?.customer_name ? ` to ${deleteSaleTarget.customer.customer_name}` : ""}. The product totals (revenue, commission, expenses, profit) will be recomputed. This action cannot be undone. Please type DELETE to confirm.`}
      />
      <ConfirmDeleteDialog
        isOpen={!!deleteDistTarget}
        onClose={() => setDeleteDistTarget(null)}
        onConfirm={executeDeleteDist}
        title="Delete Distribution?"
        description={`This will permanently delete the ₹${Number(deleteDistTarget?.allotted_amount || 0).toLocaleString()} allocation to ${deleteDistTarget?.employee_name || "this employee"}. This action cannot be undone. Please type DELETE to confirm.`}
      />
      <ConfirmDeleteDialog
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleDeleteExpense}
        entityName="expense"
        title="Delete Expense?"
        description={`This will permanently delete the expense "${expenseToDelete?.title || ""}" of ₹${Number(expenseToDelete?.amount || 0).toLocaleString()}. This action cannot be undone. Please type DELETE to confirm.`}
      />

      {/* ── Edit-confirmation gates (require typing EDIT) ── */}
      <ConfirmEditDialog
        open={!!editSaleGate}
        onOpenChange={(v) => { if (!v) setEditSaleGate(null); }}
        onConfirm={() => { if (editSaleGate) { setEditSale(editSaleGate); setEditSaleGate(null); } }}
        title="Edit Sale Entry?"
        description={`You're about to edit the sale of ₹${Number(editSaleGate?.amount || 0).toLocaleString()}${editSaleGate?.customer?.customer_name ? ` to ${editSaleGate.customer.customer_name}` : ""}. Changes will recompute commission, profit and project totals. Please type EDIT to confirm.`}
      />
      <ConfirmEditDialog
        open={!!editDistGate}
        onOpenChange={(v) => { if (!v) setEditDistGate(null); }}
        onConfirm={() => { if (editDistGate) { setEditDist(editDistGate); setEditDistGate(null); } }}
        title="Edit Distribution?"
        description={`You're about to edit the ₹${Number(editDistGate?.allotted_amount || 0).toLocaleString()} allocation to ${editDistGate?.employee_name || "this employee"}. Please type EDIT to confirm.`}
      />
    </div>
  );
};

export default ProjectDetail;
