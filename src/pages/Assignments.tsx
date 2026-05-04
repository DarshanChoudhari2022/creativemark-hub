import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ClipboardList, Plus, Calendar, Users, MapPin, CheckCircle2, Circle,
  Search, Trash2, Route, Target, ArrowUpDown, Filter,
} from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";

interface Assignment {
  id: string;
  employee_id: string;
  assigned_date: string;
  society_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  priority: number;
  notes: string | null;
  visited_at: string | null;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
  employees?: { id: string; name: string };
  visits?: { id: string; name: string; created_at: string } | null;
}

interface Employee {
  id: string;
  name: string;
  role: string | null;
}

interface AssignmentStats {
  total: number;
  visited: number;
  pending: number;
  completionPct: number;
}

const Assignments = () => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState<string>(todayStr);
  const [empFilter, setEmpFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "visited">("all");
  const [search, setSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newAssign, setNewAssign] = useState<{
    employee_id: string;
    assigned_date: string;
    society_name: string;
    address: string;
    lat: string;
    lng: string;
    priority: string;
    notes: string;
  }>({
    employee_id: "",
    assigned_date: todayStr,
    society_name: "",
    address: "",
    lat: "",
    lng: "",
    priority: "0",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  // Bulk create dialog
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkEmployeeId, setBulkEmployeeId] = useState("");
  const [bulkDate, setBulkDate] = useState(todayStr);
  const [bulkCreating, setBulkCreating] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const dateStart = new Date(dateFilter + "T00:00:00").toISOString();
    const dateEnd = new Date(dateFilter + "T23:59:59.999").toISOString();

    let query = supabase
      .from("assigned_societies")
      .select("*, employees:employees!employee_id(id, name), visits:society_data!visit_id(id, name, created_at)")
      .gte("assigned_date", dateStart)
      .lte("assigned_date", dateEnd)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (empFilter !== "all") {
      query = query.eq("employee_id", empFilter);
    }

    const [aRes, eRes] = await Promise.all([
      query.limit(500),
      supabase.from("employees").select("id, name, role").order("name"),
    ]);

    if (aRes.data) setAssignments(aRes.data as any);
    if (eRes.data) setEmployees(eRes.data as Employee[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, empFilter]);

  const stats: AssignmentStats = useMemo(() => {
    const total = assignments.length;
    const visited = assignments.filter((a) => a.visited_at).length;
    return {
      total,
      visited,
      pending: total - visited,
      completionPct: total > 0 ? Math.round((visited / total) * 100) : 0,
    };
  }, [assignments]);

  const filtered = useMemo(() => {
    let rows = assignments;
    if (statusFilter === "pending") rows = rows.filter((a) => !a.visited_at);
    if (statusFilter === "visited") rows = rows.filter((a) => a.visited_at);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.society_name.toLowerCase().includes(q) ||
          (a.address || "").toLowerCase().includes(q) ||
          (a.employees?.name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [assignments, statusFilter, search]);

  const createAssignment = async () => {
    if (!newAssign.employee_id || !newAssign.society_name) {
      toast.error("Employee and Society Name are required");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("assigned_societies").insert({
      employee_id: newAssign.employee_id,
      assigned_date: newAssign.assigned_date || todayStr,
      society_name: newAssign.society_name,
      address: newAssign.address || null,
      lat: newAssign.lat ? parseFloat(newAssign.lat) : null,
      lng: newAssign.lng ? parseFloat(newAssign.lng) : null,
      priority: parseInt(newAssign.priority) || 0,
      notes: newAssign.notes || null,
    });
    setCreating(false);
    if (error) {
      toast.error("Failed to create assignment: " + error.message);
      return;
    }
    toast.success("Assignment created");
    setCreateOpen(false);
    setNewAssign({
      employee_id: "",
      assigned_date: todayStr,
      society_name: "",
      address: "",
      lat: "",
      lng: "",
      priority: "0",
      notes: "",
    });
    load();
  };

  const createBulkAssignments = async () => {
    if (!bulkEmployeeId) {
      toast.error("Select an employee");
      return;
    }
    const lines = bulkText.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Enter at least one society name");
      return;
    }
    setBulkCreating(true);
    const rows = lines.map((name) => ({
      employee_id: bulkEmployeeId,
      assigned_date: bulkDate,
      society_name: name,
      priority: 0,
    }));
    const { error } = await supabase.from("assigned_societies").insert(rows);
    setBulkCreating(false);
    if (error) {
      toast.error("Bulk creation failed: " + error.message);
      return;
    }
    toast.success(`Created ${rows.length} assignments`);
    setBulkOpen(false);
    setBulkText("");
    load();
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from("assigned_societies").delete().eq("id", deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Assignment deleted");
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Society Assignments"
        subtitle="Plan field routes and track completion"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Bulk Add
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Assignment
            </Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Assigned</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Circle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visited</p>
              <p className="text-2xl font-bold">{stats.visited}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Route className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Completion</p>
              <p className="text-2xl font-bold">{stats.completionPct}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Date
            </label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> Employee
            </label>
            <Select value={empFilter} onValueChange={setEmpFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-3 w-3" /> Status
            </label>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="visited">Visited</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-48">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" /> Search
            </label>
            <Input
              placeholder="Search society, address, employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Assignments List */}
      <Card className="overflow-hidden">
        <div className="divide-y">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading assignments...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No assignments found for the selected filters.
            </div>
          ) : (
            filtered.map((a) => (
              <div key={a.id} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">{a.society_name}</span>
                      {a.visited_at ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Visited
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <Circle className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                      {a.priority > 0 && (
                        <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                          <ArrowUpDown className="h-3 w-3 mr-1" /> P{a.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {a.employees?.name || "Unknown"} • {format(parseISO(a.assigned_date), "MMM d, yyyy")}
                    </div>
                    {a.address && (
                      <div className="mt-1 text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {a.address}
                      </div>
                    )}
                    {a.notes && <div className="mt-2 text-sm italic text-muted-foreground">{a.notes}</div>}
                    {a.visited_at && a.visits && (
                      <div className="mt-2 text-sm text-green-700 bg-green-50 inline-block px-2 py-1 rounded">
                        Visit logged: {a.visits.name} at {format(parseISO(a.visits.created_at), "h:mm a")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!a.visited_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(a.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee *</label>
              <Select
                value={newAssign.employee_id}
                onValueChange={(v) => setNewAssign((s) => ({ ...s, employee_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={newAssign.assigned_date}
                onChange={(e) => setNewAssign((s) => ({ ...s, assigned_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Society Name *</label>
              <Input
                value={newAssign.society_name}
                onChange={(e) => setNewAssign((s) => ({ ...s, society_name: e.target.value }))}
                placeholder="e.g., Green Valley Apartments"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                value={newAssign.address}
                onChange={(e) => setNewAssign((s) => ({ ...s, address: e.target.value }))}
                placeholder="Full address (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <Input
                  value={newAssign.lat}
                  onChange={(e) => setNewAssign((s) => ({ ...s, lat: e.target.value }))}
                  placeholder="e.g., 19.0760"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <Input
                  value={newAssign.lng}
                  onChange={(e) => setNewAssign((s) => ({ ...s, lng: e.target.value }))}
                  placeholder="e.g., 72.8777"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Priority (0-10)</label>
              <Input
                type="number"
                min={0}
                max={10}
                value={newAssign.priority}
                onChange={(e) => setNewAssign((s) => ({ ...s, priority: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={newAssign.notes}
                onChange={(e) => setNewAssign((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Planning notes for the field executive"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createAssignment} disabled={creating}>
              {creating ? "Creating..." : "Create Assignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Add Assignments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Employee *</label>
              <Select value={bulkEmployeeId} onValueChange={setBulkEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Date *</label>
              <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">Society Names (one per line)</label>
              <Textarea
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Green Valley Apartments&#10;Sunshine Society&#10;Royal Residency&#10;..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createBulkAssignments} disabled={bulkCreating}>
              {bulkCreating ? "Creating..." : `Create ${bulkText.split(/\n/).filter(Boolean).length || 0} Assignments`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Assignment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the assignment. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Assignments;
