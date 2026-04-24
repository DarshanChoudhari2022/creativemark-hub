import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { 
  Briefcase, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  User, 
  CheckCircle2, 
  Clock,
  AlertCircle,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const Projects = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // New Project State
  const [newProject, setNewProject] = useState({
    title: "",
    description: "",
    project_type: "Client Project",
    client_id: "",
    status: "Planning",
    priority: "Medium",
    start_date: "",
    end_date: "",
    assigned_to: "",
    features_summary: "",
    project_link: ""
  });

  // Fetch Projects
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      // Try with joins first
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          client:clients(name),
          assignee:employees!assigned_to(name)
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.warn("[Projects] Join query failed, retrying with simple query:", error.message);
        // Fallback to simple query without joins
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
        if (fallbackError) throw fallbackError;
        return fallbackData;
      }
      return data;
    },
  });

  // Fetch Clients for dropdown
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name");
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

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: async (project: any) => {
      const { data, error } = await supabase
        .from("projects")
        .insert([project])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setIsCreateDialogOpen(false);
      setNewProject({
        title: "",
        description: "",
        project_type: "Client Project",
        client_id: "",
        status: "Planning",
        priority: "Medium",
        start_date: "",
        end_date: "",
        assigned_to: "",
        features_summary: "",
        project_link: ""
      });
      toast({
        title: "Project created",
        description: "The new project has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete Project Mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      deleteProjectMutation.mutate(id);
    }
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title || (newProject.project_type === "Client Project" && !newProject.client_id)) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const payload = { ...newProject };
    if (payload.project_type === "Inhouse SaaS" || !payload.client_id) {
      payload.client_id = null as any;
    }
    if (!payload.assigned_to) payload.assigned_to = null as any;
    if (!payload.start_date) payload.start_date = null as any;
    if (!payload.end_date) payload.end_date = null as any;

    createProjectMutation.mutate(payload);
  };

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Planning": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "Active": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Review": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "Completed": return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
      case "On Hold": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Urgent": return "text-red-600";
      case "High": return "text-orange-600";
      case "Medium": return "text-yellow-600";
      case "Low": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Hub</h1>
          <p className="text-muted-foreground mt-1">Manage and track your creative deliverables.</p>
        </div>
        <div className="flex items-center gap-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Project Title *</Label>
                    <Input 
                      id="title" 
                      placeholder="e.g. Summer Campaign 2024" 
                      value={newProject.title}
                      onChange={(e) => setNewProject({...newProject, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_type">Project Type *</Label>
                    <Select value={newProject.project_type} onValueChange={(value) => setNewProject({...newProject, project_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Client Project">Client Project</SelectItem>
                        <SelectItem value="Inhouse SaaS">Inhouse SaaS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {newProject.project_type === "Client Project" && (
                  <div className="space-y-2">
                    <Label htmlFor="client">Client *</Label>
                    <Select onValueChange={(value) => setNewProject({...newProject, client_id: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {newProject.project_type === "Inhouse SaaS" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="project_link">SaaS Link</Label>
                      <Input 
                        id="project_link" 
                        placeholder="e.g. https://saas.creativemark.com" 
                        value={newProject.project_link}
                        onChange={(e) => setNewProject({...newProject, project_link: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="features_summary">Features Summary</Label>
                      <Textarea 
                        id="features_summary" 
                        placeholder="Key features of the SaaS product..." 
                        className="h-20"
                        value={newProject.features_summary}
                        onChange={(e) => setNewProject({...newProject, features_summary: e.target.value})}
                      />
                    </div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select defaultValue="Medium" onValueChange={(value) => setNewProject({...newProject, priority: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignee">Assignee</Label>
                    <Select onValueChange={(value) => setNewProject({...newProject, assigned_to: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input 
                      type="date" 
                      id="start_date" 
                      value={newProject.start_date}
                      onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input 
                      type="date" 
                      id="end_date" 
                      value={newProject.end_date}
                      onChange={(e) => setNewProject({...newProject, end_date: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Brief overview of the project..." 
                    className="h-24"
                    value={newProject.description}
                    onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full mt-4" disabled={createProjectMutation.isPending}>
                  {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.length || 0}</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-green-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === 'Active').length || 0}</div>
            <p className="text-xs text-muted-foreground">Working on deliverables</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-yellow-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Review</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === 'Review').length || 0}</div>
            <p className="text-xs text-muted-foreground">Waiting for feedback</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-blue-500/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.filter(p => p.status === 'Completed').length || 0}</div>
            <p className="text-xs text-muted-foreground">Total successful projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/30 p-4 rounded-xl border border-border/50">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search projects or clients..." 
            className="pl-9 bg-background/50 border-border/50 focus:border-primary/50 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px] bg-background/50">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Planning">Planning</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Review">Review</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[250px] rounded-xl bg-card/30 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : filteredProjects?.length === 0 ? (
        <div className="text-center py-20 bg-card/20 rounded-2xl border-2 border-dashed border-border/50">
          <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-medium text-foreground">No projects found</h3>
          <p className="text-muted-foreground mt-1">Try adjusting your filters or create a new project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects?.map((project) => (
            <Card 
              key={project.id} 
              className="group hover:shadow-xl transition-all duration-500 border-primary/5 hover:border-primary/20 bg-card/40 backdrop-blur-md overflow-hidden cursor-pointer relative"
              onClick={() => navigate(`/projects/${project.id}`)}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(project.status)} border-none px-2 py-0.5 rounded-md font-medium text-[10px] uppercase tracking-wider`}>
                      {project.status}
                    </Badge>
                    <Badge variant="outline" className="border-primary/20 text-primary px-2 py-0.5 rounded-md font-medium text-[10px] uppercase tracking-wider">
                      {project.project_type || 'Client Project'}
                    </Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/5">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/projects/${project.id}`); }}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toast({ title: "Coming soon", description: "Edit functionality will be available soon." }); }}>
                        Edit Project
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600" 
                        onClick={(e) => handleDeleteProject(e, project.id)}
                      >
                        Delete Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="text-xl font-bold mt-3 group-hover:text-primary transition-colors line-clamp-1">{project.title}</CardTitle>
                <p className="text-sm text-muted-foreground font-medium flex items-center gap-1 mt-1">
                  {project.project_type === "Inhouse SaaS" ? "Internal Product" : (project.client?.name || "No Client")}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-2 h-10 italic">
                  {project.description || "No description provided."}
                </p>

                {project.project_type === "Inhouse SaaS" && (
                  <div className="text-xs space-y-1 mt-2">
                    {project.project_link && (
                      <p><span className="font-semibold text-foreground">Link:</span> <a href={project.project_link} target="_blank" rel="noreferrer" className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{project.project_link}</a></p>
                    )}
                    {project.features_summary && (
                      <p className="line-clamp-2"><span className="font-semibold text-foreground">Features:</span> {project.features_summary}</p>
                    )}
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{project.progress || 0}%</span>
                  </div>
                  <Progress value={project.progress || 0} className="h-1.5" />
                </div>

                <div className="pt-4 border-t border-border/50 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{project.end_date ? format(new Date(project.end_date), "MMM d, yyyy") : "No deadline"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                    <User className="h-3 w-3" />
                    <span className="truncate">{project.assignee?.name || "Unassigned"}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-2">
                  <AlertCircle className={`h-3 w-3 ${getPriorityColor(project.priority)}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${getPriorityColor(project.priority)}`}>
                    {project.priority} Priority
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Projects;
