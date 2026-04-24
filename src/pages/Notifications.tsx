import { Bell, Check, Filter, MessageCircle, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/hooks/useNotifications";
import { formatINR, waLink } from "@/lib/format";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const Notifications = () => {
  const { 
    notifications, 
    loading, 
    refresh, 
    markAsRead, 
    markAllAsRead, 
    includeRead, 
    setIncludeRead 
  } = useNotifications();
  const navigate = useNavigate();

  const handleResolve = async (n: any) => {
    if (n.id.startsWith('db-')) {
      await markAsRead(n.id);
      toast.success("Notification dismissed");
      return;
    }

    const firstDashIndex = n.id.indexOf("-");
    const type = n.id.substring(0, firstDashIndex);
    const id = n.id.substring(firstDashIndex + 1);

    try {
      if (type === "follow") {
        await supabase.from('leads').update({ next_call_date: null, last_interaction_date: new Date().toISOString().slice(0, 10) }).eq('id', id);
      } else if (type === "task") {
        await supabase.from('lead_tasks').update({ status: 'Done' }).eq('id', id);
      } else if (type === "pay") {
        await supabase.from('quotations').update({ status: 'Paid' }).eq('id', id);
      } else if (type === "smart") {
        await supabase.from('smart_leads').update({ status: 'Contacted' }).eq('id', id);
      } else if (type === "stale" || type === "qfollow") {
        await supabase.from('leads').update({ last_interaction_date: new Date().toISOString().slice(0, 10) }).eq('id', id);
      }
      refresh();
      toast.success("Task completed");
    } catch (err) {
      toast.error("Failed to update task");
    }
  };

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Manage your alerts, follow-ups, and tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()}>
            Refresh
          </Button>
          <Button size="sm" onClick={markAllAsRead} disabled={notifications.length === 0}>
            <Check className="h-4 w-4 mr-2" /> Mark all as Done
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Inbox
            </CardTitle>
            <Tabs defaultValue="unread" onValueChange={(v) => setIncludeRead(v === "all")}>
              <TabsList className="grid w-[200px] grid-cols-2">
                <TabsTrigger value="unread">Unread</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={`flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-lg transition-all hover:border-primary/50 group ${n.urgent ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.urgent ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <div>
                      <h3 className="font-semibold text-sm leading-none mb-1 group-hover:text-primary transition-colors">
                        {n.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-medium">
                        <span>{n.time}</span>
                        <span>•</span>
                        <span className="capitalize">{n.type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4 md:mt-0 w-full md:w-auto">
                    <div className="flex items-center gap-1 mr-4">
                      {n.type === 'payment' ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs text-green-600 border-green-200 bg-green-50/50 hover:bg-green-50"
                          onClick={() => {
                            const msg = n.meta.amount > 10000 ? WHATSAPP_TEMPLATES.RECOVERY_FIRM(n.meta.name, formatINR(n.meta.amount), n.meta.invoice) : WHATSAPP_TEMPLATES.RECOVERY_SOFT(n.meta.name, formatINR(n.meta.amount), n.meta.invoice);
                            window.open(waLink(n.meta.phone, msg), "_blank");
                          }}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" /> Reminder
                        </Button>
                      ) : (n.type === 'smart-lead' || n.type === 'lead_assigned') ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-xs text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                          onClick={() => navigate(n.link || "/smart-leads")}
                        >
                          <Plus className="h-4 w-4 mr-2" /> View & Assign
                        </Button>
                      ) : n.meta?.phone ? (
                        <>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-green-600 hover:bg-green-50"
                            onClick={() => {
                              const msg = WHATSAPP_TEMPLATES.LEAD_FOLLOWUP(n.meta.name, n.title.split(': ')[1] || "your requirement");
                              window.open(waLink(n.meta.phone, msg), "_blank");
                            }}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-amber-600 hover:bg-amber-50"
                            onClick={() => window.open(`tel:${n.meta.phone}`, "_self")}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>

                    <Button 
                      size="sm" 
                      variant="secondary"
                      className="h-8 font-semibold"
                      onClick={() => handleResolve(n)}
                    >
                      <Check className="h-4 w-4 mr-2" /> Done
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
                <Bell className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-lg">All caught up!</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {includeRead ? "You don't have any notifications at the moment." : "No new notifications to show. Check 'All' to see past alerts."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
