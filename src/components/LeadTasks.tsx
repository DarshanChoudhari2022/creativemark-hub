import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { formatDateDDMMYYYY } from "@/lib/format";
import { toast } from "sonner";
import type { LeadTask, TaskStatus } from "@/types";

interface LeadTasksProps {
  leadId: string;
  initialTasks: LeadTask[];
  employees: { id: string; name: string }[];
  onUpdate?: () => void;
}

export function LeadTasks({ leadId, initialTasks, employees, onUpdate }: LeadTasksProps) {
  const { insert, update, remove } = useSupabaseTable<LeadTask>("lead_tasks");
  const [isAdding, setIsAdding] = useState(false);
  const [newTask, setNewTask] = useState({
    description: "",
    assignedToId: "",
    dueDate: new Date().toISOString().slice(0, 10),
  });

  const handleAddTask = async () => {
    if (!newTask.description || !newTask.assignedToId) {
      toast.error("Please fill in description and assignee");
      return;
    }

    const assignee = employees.find(e => e.id === newTask.assignedToId);
    
    const { error } = await insert({
      lead_id: leadId,
      description: newTask.description,
      assigned_to_id: newTask.assignedToId,
      assigned_to: assignee?.name || "Unknown",
      due_date: newTask.dueDate,
      status: "Pending" as TaskStatus,
    } as any);

    if (error) {
      toast.error("Failed to add task");
    } else {
      toast.success("Task added successfully");
      setIsAdding(false);
      setNewTask({
        description: "",
        assignedToId: "",
        dueDate: new Date().toISOString().slice(0, 10),
      });
      if (onUpdate) onUpdate();
    }
  };

  const toggleTaskStatus = async (task: LeadTask) => {
    const newStatus: TaskStatus = task.status === "Pending" ? "Done" : "Pending";
    const { error } = await update(task.id, { status: newStatus } as any);
    
    if (error) {
      toast.error("Failed to update task");
    } else {
      toast.success(`Task marked as ${newStatus}`);
      if (onUpdate) onUpdate();
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await remove(id);
    if (error) {
      toast.error("Failed to delete task");
    } else {
      toast.success("Task deleted");
      if (onUpdate) onUpdate();
    }
  };

  const sortedTasks = [...initialTasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Pending" ? -1 : 1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" /> Pending Tasks
        </h4>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-7 text-[10px] font-bold"
          onClick={() => setIsAdding(!isAdding)}
        >
          {isAdding ? "Cancel" : <><Plus className="h-3 w-3 mr-1" /> Add Task</>}
        </Button>
      </div>

      {isAdding && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase">Description</Label>
            <Input 
              className="h-8 text-xs" 
              placeholder="What needs to be done?" 
              value={newTask.description}
              onChange={(e) => setNewTask({...newTask, description: e.target.value})}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Assign To</Label>
              <Select 
                value={newTask.assignedToId} 
                onValueChange={(v) => setNewTask({...newTask, assignedToId: v})}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Due Date</Label>
              <Input 
                type="date" 
                className="h-8 text-xs" 
                value={newTask.dueDate}
                onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
              />
            </div>
          </div>
          <Button className="w-full h-8 text-xs font-bold" onClick={handleAddTask}>
            Create Task
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {sortedTasks.length === 0 && !isAdding && (
          <div className="text-center py-6 text-muted-foreground text-xs italic">
            No tasks found for this lead.
          </div>
        )}
        {sortedTasks.map((task) => {
          const dueDateStr = (task as any).due_date || task.dueDate;
          const isOverdue = task.status === "Pending" && new Date(dueDateStr) < new Date(new Date().setHours(0,0,0,0));
          const isToday = dueDateStr === new Date().toISOString().slice(0, 10);

          return (
            <div 
              key={task.id} 
              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-all group ${
                task.status === "Done" ? "bg-muted/20 border-transparent opacity-60" : 
                isOverdue ? "bg-red-50 border-red-100 shadow-sm" : "bg-white border-muted shadow-sm hover:shadow-md"
              }`}
            >
              <button 
                onClick={() => toggleTaskStatus(task)}
                className={`mt-0.5 transition-transform active:scale-90 ${task.status === "Done" ? "text-green-500" : isOverdue ? "text-red-500" : "text-muted-foreground hover:text-primary"}`}
              >
                {task.status === "Done" ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium leading-tight ${task.status === "Done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {task.description}
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <User className="h-3 w-3" /> {(task as any).assigned_to || task.assignedTo || "Unassigned"}
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-semibold ${
                    task.status === "Done" ? "text-muted-foreground" :
                    isOverdue ? "text-red-600" : isToday ? "text-amber-600" : "text-blue-600"
                  }`}>
                    <Clock className="h-3 w-3" /> {formatDateDDMMYYYY(new Date((task as any).due_date || task.dueDate))}
                    {isOverdue && <Badge className="h-3.5 px-1 text-[8px] bg-red-600 border-0 ml-1">OVERDUE</Badge>}
                    {isToday && <Badge className="h-3.5 px-1 text-[8px] bg-amber-500 border-0 ml-1">TODAY</Badge>}
                  </div>
                </div>
              </div>

              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
