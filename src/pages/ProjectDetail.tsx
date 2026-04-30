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
  ShoppingCart
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
  const { data: project, isLoading: isProjectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          client:clients(name, company_name, email, phone),
          assignee:employees(name)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
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

  // Sales & Commission State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isAddSaleOpen, setIsAddSaleOpen] = useState(false);
  const [commissionPct, setCommissionPct] = useState(10);
  const [newCustomer, setNewCustomer] = useState({ customer_name: "", customer_email: "", customer_phone: "", company_name: "", plan_name: "", monthly_value: "0", subscription_status: "Active" });
  const [newSale, setNewSale] = useState({ customer_id: "", salesperson_id: "", amount: "0", sale_type: "New", sale_date: new Date().toISOString().slice(0, 10), notes: "" });

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

  if (isProjectLoading) return <div className="p-8 text-center">Loading project...</div>;
  if (!project) return <div className="p-8 text-center text-red-500">Project not found</div>;

  // Commission calculations
  const liveCustomers = projectCustomers?.filter(c => c.subscription_status === "Active") || [];
  const totalEarnings = projectSales?.reduce((s, sale) => s + Number(sale.amount || 0), 0) || 0;
  const totalCommission = projectSales?.reduce((s, sale) => s + Number(sale.commission_amount || 0), 0) || 0;
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
    const commAmt = (amount * effectiveCommPct) / 100;
    const payload = { ...newSale, amount, commission_percentage: effectiveCommPct, commission_amount: commAmt, project_id: id, customer_id: newSale.customer_id || null, salesperson_id: newSale.salesperson_id || null };
    const { error } = await supabase.from("project_sales").insert([payload]);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    queryClient.invalidateQueries({ queryKey: ["project_sales", id] });
    setIsAddSaleOpen(false);
    setNewSale({ customer_id: "", salesperson_id: "", amount: "0", sale_type: "New", sale_date: new Date().toISOString().slice(0, 10), notes: "" });
    toast({ title: "Sale recorded" });
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
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
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
                <span>Active since {format(new Date(project.created_at), "MMM yyyy")}</span>
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
        <div className="flex items-center justify-between">
          <TabsList className="bg-background/50 border border-border/50">
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
              Sales & Commission
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="kanban">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 h-[calc(100vh-400px)] min-h-[500px]">
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
          <Card className="bg-card/40 backdrop-blur-md border-border/50">
            <CardContent className="p-0">
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
                    <Label className="text-xs text-muted-foreground uppercase">Revenue (Budget)</Label>
                    <div className="text-2xl font-bold text-primary">₹{(project.budget_revenue || 0).toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">Actual Expenses</Label>
                    <div className="text-2xl font-bold text-red-500">₹{(projectExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0).toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="space-y-2 pt-4 border-t border-border/50">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase">Estimated Profit</Label>
                      <div className="text-xl font-bold text-green-600">
                        ₹{((project.budget_revenue || 0) - (projectExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0)).toLocaleString()}
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                      {(project.budget_revenue || 0) > 0 
                        ? (((project.budget_revenue - (projectExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0)) / project.budget_revenue) * 100).toFixed(1)
                        : 0}% Margin
                    </Badge>
                  </div>
                  <Progress 
                    value={(project.budget_revenue || 0) > 0 
                      ? ((project.budget_revenue - (projectExpenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0)) / project.budget_revenue) * 100 
                      : 0} 
                    className="h-2" 
                  />
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><Users className="h-5 w-5 text-blue-500" /></div>
                  <div><div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Live Customers</div><div className="text-2xl font-extrabold">{liveCustomers.length}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-green-500" /></div>
                  <div><div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Earnings</div><div className="text-2xl font-extrabold text-green-600">₹{totalEarnings.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center"><Percent className="h-5 w-5 text-purple-500" /></div>
                  <div><div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Commission Rate</div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} max={100} className="h-8 w-20 text-lg font-extrabold" value={effectiveCommPct} onChange={(e) => handleUpdateCommission(parseFloat(e.target.value) || 0)} />
                      <span className="text-lg font-bold">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center"><UserCheck className="h-5 w-5 text-amber-500" /></div>
                  <div><div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Commission</div><div className="text-2xl font-extrabold text-amber-600">₹{totalCommission.toLocaleString()}</div></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Customers */}
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
                        <div><Label>Amount (₹) *</Label><Input type="number" value={newSale.amount} onChange={e => setNewSale({...newSale, amount: e.target.value})} /></div>
                        <div><Label>Sale Type</Label>
                          <Select value={newSale.sale_type} onValueChange={v => setNewSale({...newSale, sale_type: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="New">New</SelectItem><SelectItem value="Renewal">Renewal</SelectItem><SelectItem value="Upgrade">Upgrade</SelectItem><SelectItem value="One-time">One-time</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div><Label>Date</Label><Input type="date" value={newSale.sale_date} onChange={e => setNewSale({...newSale, sale_date: e.target.value})} /></div>
                      </div>
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                        <div className="text-xs text-amber-700 dark:text-amber-400 font-bold uppercase">Auto Commission Calculator</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm">₹{(parseFloat(newSale.amount) || 0).toLocaleString()} × {effectiveCommPct}%</span>
                          <span className="text-lg font-extrabold text-amber-600">= ₹{((parseFloat(newSale.amount) || 0) * effectiveCommPct / 100).toLocaleString()}</span>
                        </div>
                      </div>
                      <div><Label>Notes</Label><Textarea value={newSale.notes} onChange={e => setNewSale({...newSale, notes: e.target.value})} rows={2} /></div>
                      <Button type="submit" className="w-full">Record Sale</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[10px] uppercase"><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Salesperson</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(projectSales || []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No sales recorded yet.</TableCell></TableRow>
                      ) : (projectSales || []).map(sale => (
                        <TableRow key={sale.id} className="hover:bg-primary/5">
                          <TableCell className="text-muted-foreground text-sm">{sale.sale_date ? format(new Date(sale.sale_date), "MMM d, yyyy") : "—"}</TableCell>
                          <TableCell>
                            <div className="font-semibold text-sm">{sale.customer?.customer_name || "—"}</div>
                            <Badge variant="secondary" className="text-[9px] px-1.5 mt-0.5">{sale.sale_type}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{sale.salesperson?.name || "—"}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">₹{Number(sale.amount || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="font-bold text-amber-600">₹{Number(sale.commission_amount || 0).toLocaleString()}</div>
                            <div className="text-[10px] text-muted-foreground">{sale.commission_percentage}%</div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
};

export default ProjectDetail;
