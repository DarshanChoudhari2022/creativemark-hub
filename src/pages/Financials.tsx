import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon,
  Plus,
  Filter,
  Calendar,
  Receipt,
  Download,
  AlertCircle,
  Pencil,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatINRCompact } from "@/lib/format";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { exportToCSV } from "@/lib/export";
import { Masked, useMask } from "@/components/Masked";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Financials = () => {
  const { maskAmount } = useMask();
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // New Expense State
  const [newExpense, setNewExpense] = useState({
    title: "",
    amount: "",
    category: "Other",
    date: new Date().toISOString().split('T')[0],
    description: ""
  });
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
  const { isShielded, withShield } = usePrivacyShield();
  const { update: updateExpense, remove: removeExpense } = useSupabaseTable("expenses");

  // Fetch Data
  const { data: quotations } = useQuery({
    queryKey: ["quotations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quotations").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_history").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*, client:clients(name)");
      if (error) throw error;
      return data;
    },
  });

  // Single source of truth: quotations table (type='Bill') — matches Recovery tab
  const allBills = quotations?.filter(q => q.type === "Bill" && q.status !== "Cancelled" && q.status !== "Draft") || [];
  const totalRevenue = allBills.reduce((acc, q) => acc + (q.amount_paid || 0), 0);
  const totalBilled = allBills.reduce((acc, q) => acc + (q.grand_total || 0), 0);
  const totalOutstanding = allBills.filter(q => q.status !== "Paid").reduce((acc, q) => acc + ((q.grand_total || 0) - (q.amount_paid || 0)), 0);
  const totalExpenses = expenses?.reduce((acc, e) => acc + (Number(e.amount) || 0), 0) || 0;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  const unpaidCount = allBills.filter(q => q.status !== "Paid").length;

  // Charts Data — uses allBills (quotations) as single source of truth
  const getMonthlyData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const data = months.map(m => ({ name: m, revenue: 0, expenses: 0 }));

    allBills.forEach(q => {
      if (q.date) {
        const date = new Date(q.date);
        if (date.getFullYear() === currentYear) {
          data[date.getMonth()].revenue += (q.amount_paid || 0);
        }
      }
    });

    expenses?.forEach(e => {
      if (e.date) {
        const date = new Date(e.date);
        if (date.getFullYear() === currentYear) {
          data[date.getMonth()].expenses += (Number(e.amount) || 0);
        }
      }
    });

    // filter to show at least current month and previous months
    const currentMonthIndex = new Date().getMonth();
    return data.slice(Math.max(0, currentMonthIndex - 5), currentMonthIndex + 1); // Last 6 months
  };

  const monthlyData = getMonthlyData();

  const categoryData: { name: string; value: number; color: string }[] = expenses ? Object.entries(
    expenses.reduce((acc: Record<string, number>, curr: any) => {
      const cat = curr.category || "Other";
      acc[cat] = (acc[cat] || 0) + Number(curr.amount || 0);
      return acc;
    }, {})
  ).map(([name, value], index) => {
    const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];
    return { name, value: Number(value), color: colors[index % colors.length] };
  }).sort((a, b) => b.value - a.value) : [];

  const totalExpenseForPie = categoryData.reduce((acc, item) => acc + item.value, 0) || 1; // avoid division by 0

  // Create Expense Mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (expense: any) => {
      const { data, error } = await supabase.from("expenses").insert([expense]).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsAddExpenseOpen(false);
      toast({ title: "Expense logged", description: "The transaction has been recorded." });
    },
  });
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpense.title || !newExpense.amount) {
      toast({ 
        title: "Missing Fields", 
        description: "Please fill in all required fields.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        });
        toast({ title: "Expense updated", description: "The transaction has been updated." });
      } else {
        await createExpenseMutation.mutateAsync({
          ...newExpense,
          amount: parseFloat(newExpense.amount),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsAddExpenseOpen(false);
      setEditingExpense(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (expense: any) => {
    withShield(() => {
    setEditingExpense(expense);
    setNewExpense({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      date: expense.date,
      description: expense.description || ""
    });
    setIsAddExpenseOpen(true);
    });
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await removeExpense(expenseToDelete.id);
      toast({ title: "Expense deleted", description: "The transaction has been removed." });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setExpenseToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (!expenses) return;
    
    const exportData = expenses.map(e => ({
      Title: e.title,
      Amount: e.amount,
      Category: e.category,
      Date: e.date,
      Description: e.description || ""
    }));
    
    exportToCSV(exportData, "Financial_Report");
    toast({ title: "Report Exported", description: "Your financial report has been downloaded." });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground text-primary">Financial Intelligence</h1>
          <p className="text-muted-foreground mt-1">Real-time profitability and cash flow insights.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Dialog open={isAddExpenseOpen} onOpenChange={(open) => {
            setIsAddExpenseOpen(open);
            if (!open) {
              setEditingExpense(null);
              setNewExpense({
                title: "",
                amount: "",
                category: "Other",
                date: new Date().toISOString().split('T')[0],
                description: ""
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 gap-2">
                <Plus className="h-4 w-4" />
                Log Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Edit Expense" : "Record New Expense"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddExpense} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Expense Title *</Label>
                  <Input 
                    placeholder="e.g. Monthly Rent, Adobe Subscription" 
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({...newExpense, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Amount (₹) *</Label>
                    <Input 
                      type="number" 
                      placeholder="0.00"
                      value={newExpense.amount}
                      onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newExpense.category} onValueChange={(v) => setNewExpense({...newExpense, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Salary">Salary</SelectItem>
                        <SelectItem value="Rent">Rent</SelectItem>
                        <SelectItem value="Software">Software</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Hardware">Hardware</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input 
                    type="date" 
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({...newExpense, date: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createExpenseMutation.isPending}>
                  {createExpenseMutation.isPending ? "Processing..." : editingExpense ? "Update Transaction" : "Log Transaction"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Collected Revenue</p>
                <h3 className="text-2xl font-bold mt-1"><Masked placeholder="₹•••••">{formatINR(totalRevenue)}</Masked></h3>
              </div>
              <div className="p-2 bg-primary/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
            {/* Dynamic change could be added here later */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Total revenue collected across all paid invoices</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-transparent border-red-500/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <h3 className="text-2xl font-bold mt-1"><Masked placeholder="₹•••••">{formatINR(totalExpenses)}</Masked></h3>
              </div>
              <div className="p-2 bg-red-500/20 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
            </div>
            {/* Dynamic change could be added here later */}
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Total logged expenses</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <h3 className="text-2xl font-bold mt-1"><Masked placeholder="₹•••••">{formatINR(netProfit)}</Masked></h3>
              </div>
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Margin</span>
                <span className="font-bold">{profitMargin.toFixed(1)}%</span>
              </div>
              <Progress value={profitMargin} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Outstanding Dues</p>
                <h3 className="text-2xl font-bold mt-1"><Masked placeholder="₹•••••">{formatINR(totalOutstanding)}</Masked></h3>
              </div>
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-yellow-600 font-medium">
              <span>{unpaidCount > 0 ? `Attention required for ${unpaidCount} invoice${unpaidCount === 1 ? '' : 's'}` : 'All caught up'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cash Flow Chart */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Cash Flow Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} />
                  <YAxis axisLine={false} tickLine={false} fontSize={12} tickFormatter={(v) => formatINRCompact(v)} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    formatter={(v: any) => formatINR(v)}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="expenses" fill="hsl(var(--destructive) / 0.5)" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="bg-card/40 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              Expense Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="h-[250px] w-full md:w-1/2">
                {categoryData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-full w-48 h-48 mx-auto">
                    No Data
                  </div>
                )}
              </div>
              <div className="w-full md:w-1/2 space-y-4">
                {categoryData.map((item) => (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-bold">{formatINRCompact(item.value)}</span>
                    </div>
                    <Progress value={(item.value / totalExpenseForPie) * 100} className="h-1" />
                  </div>
                ))}
                {categoryData.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4 border border-dashed rounded-lg">No expenses recorded</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Profitability */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Project Profitability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-widest border-b border-border/50">
                <tr>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                  <th className="px-6 py-4 text-right">Budget Cost</th>
                  <th className="px-6 py-4 text-right">Profit</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {projects?.slice(0, 5).map((project) => (
                  <tr key={project.id} className="hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4 font-bold">{project.title}</td>
                    <td className="px-6 py-4 text-muted-foreground"><Masked>{project.client?.name}</Masked></td>
                    <td className="px-6 py-4 text-right font-mono"><Masked placeholder="₹•••••">{formatINR(project.budget_revenue || 0)}</Masked></td>
                    <td className="px-6 py-4 text-right font-mono"><Masked placeholder="₹•••••">{formatINR(project.budget_cost || 0)}</Masked></td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${((project.budget_revenue || 0) - (project.budget_cost || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <Masked placeholder="₹•••••">{formatINR((project.budget_revenue || 0) - (project.budget_cost || 0))}</Masked>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span className="text-xs font-bold text-green-600">High</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-card/40 backdrop-blur-md border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Recent Transactions
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5">View All</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenses?.slice(0, 10).map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30 hover:border-primary/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${expense.category === 'Salary' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                    <Receipt className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-sm group-hover:text-primary transition-colors"><Masked>{expense.title}</Masked></p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{expense.category} • {format(new Date(expense.date), "MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-red-500"><Masked placeholder="-₹•••••">-{formatINR(expense.amount)}</Masked></p>
                    <p className="text-[10px] text-muted-foreground">Successful</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        withShield(() => {
                          setExpenseToDelete(expense);
                        });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the expense entry for "{expenseToDelete?.title}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Financials;
