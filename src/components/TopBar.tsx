import { useState } from "react";
import { Bell, Search, LogOut, MessageCircle, MessageSquare, Phone, Plus, Check, EyeOff, Eye, Lock } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDateDDMMYYYY, waLink, smsLink, formatINR } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate, Link } from "react-router-dom";
import { WHATSAPP_TEMPLATES } from "@/data/whatsappTemplates";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const TopBar = () => {
  const { user, logout } = useAuth();
  const { isShielded, requestUnlock, lock, isDialogOpen, setDialogOpen, tryUnlock } = usePrivacyShield();
  const { notifications, loading, refresh, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const today = formatDateDDMMYYYY();
  const unread = notifications.filter((n) => n.urgent).length;
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tryUnlock(password)) {
      setPassword("");
      setPasswordError("");
      toast.success("Data unlocked successfully");
    } else {
      setPasswordError("Incorrect password");
      setPassword("");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <>
    <header className="h-16 border-b border-border bg-background flex items-center gap-3 px-4 sticky top-0 z-30">
      <SidebarTrigger className="text-foreground" />
      <div className="hidden md:flex items-center gap-2 max-w-md w-full ml-2">
        <div className="relative w-full">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search clients, leads, invoices…" className="pl-9 bg-muted/40 border-transparent focus-visible:bg-background" />
        </div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-muted-foreground">{today}</span>
        {/* Privacy Shield Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className={`relative transition-colors ${isShielded ? "text-red-500 hover:text-red-600 hover:bg-red-50" : "text-green-500 hover:text-green-600 hover:bg-green-50"}`}
          onClick={() => isShielded ? requestUnlock() : lock()}
          title={isShielded ? "Data hidden — click to unlock" : "Data visible — click to lock"}
        >
          {isShielded ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          {isShielded && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background" />
          )}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  className="h-auto p-0 text-[10px] font-bold text-primary hover:bg-transparent"
                  onClick={async () => {
                    const loadingToast = toast.loading("Marking all as read...");
                    try {
                      // Group IDs by type for efficient updates
                      const followUpIds = notifications.filter(n => n.id.startsWith("follow-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                      const taskIds = notifications.filter(n => n.id.startsWith("task-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                      const paymentIds = notifications.filter(n => n.id.startsWith("pay-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                      const smartIds = notifications.filter(n => n.id.startsWith("smart-")).map(n => n.id.substring(n.id.indexOf("-") + 1));
                      const otherIds = notifications.filter(n => n.id.startsWith("stale-") || n.id.startsWith("qfollow-")).map(n => n.id.substring(n.id.indexOf("-") + 1));

                      const promises = [];
                      if (followUpIds.length) promises.push(supabase.from('leads').update({ next_call_date: null, last_interaction_date: new Date().toISOString().slice(0, 10) }).in('id', followUpIds));
                      if (taskIds.length) promises.push(supabase.from('lead_tasks').update({ status: 'Completed' }).in('id', taskIds));
                      if (paymentIds.length) promises.push(supabase.from('quotations').update({ status: 'Paid' }).in('id', paymentIds));
                      if (smartIds.length) promises.push(supabase.from('smart_leads').update({ status: 'Archived' }).in('id', smartIds));
                      if (otherIds.length) promises.push(supabase.from('leads').update({ last_interaction_date: new Date().toISOString().slice(0, 10) }).in('id', otherIds));
                      
                      // Also mark all DB notifications as read
                      promises.push(markAllAsRead());

                      await Promise.all(promises);
                      toast.dismiss(loadingToast);
                      toast.success("All notifications resolved");
                    } catch (err) {
                      toast.dismiss(loadingToast);
                      toast.error("Failed to resolve notifications");
                    }
                  }}
                >
                  Mark all as Done
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-auto">
              {notifications.length > 0 ? notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors group">
                  <Link to={n.link || "#"} className="flex items-start gap-2 cursor-pointer mb-2">
                    {n.urgent && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
                    <div className="flex-1">
                      <div className="text-sm font-medium leading-tight">{n.title}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 uppercase font-semibold">{n.time}</div>
                    </div>
                  </Link>
                  <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-1">
                      {n.type === 'payment' ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] px-2 text-green-600 border-green-200 bg-green-50/50 hover:bg-green-50"
                          onClick={() => {
                            const msg = n.meta.amount > 10000 ? WHATSAPP_TEMPLATES.RECOVERY_FIRM(n.meta.name, formatINR(n.meta.amount), n.meta.invoice) : WHATSAPP_TEMPLATES.RECOVERY_SOFT(n.meta.name, formatINR(n.meta.amount), n.meta.invoice);
                            window.open(waLink(n.meta.phone, msg), "_blank");
                          }}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp Reminder
                        </Button>
                      ) : n.type === 'smart-lead' || n.type === 'lead_assigned' ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] px-2 text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                          onClick={() => navigate(n.link || "/smart-leads")}
                        >
                          <Plus className="h-3 w-3 mr-1" /> View & Assign
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                            onClick={() => {
                              const msg = WHATSAPP_TEMPLATES.LEAD_FOLLOWUP(n.meta.name, n.title.split(': ')[1] || "your requirement");
                              window.open(waLink(n.meta.phone, msg), "_blank");
                            }}
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50"
                            onClick={() => window.open(`tel:${n.meta.phone}`, "_self")}
                            title="Call"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10"
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
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
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" /> Done
                    </Button>
                  </div>

                </div>
              )) : (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No new notifications
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <div className="pl-2 border-l border-border">
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                    {user.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block leading-tight text-left">
                  <div className="text-sm font-semibold">{user.name}</div>
                  <div className="text-[11px] text-muted-foreground">{user.role}</div>
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48 p-2">
              <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </header>

    {/* Privacy Shield Password Dialog */}
    <Dialog open={isDialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setPassword(""); setPasswordError(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Unlock Confidential Data
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="shield-password">Enter Password</Label>
            <Input
              id="shield-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
              autoFocus
              className={passwordError ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {passwordError && (
              <p className="text-xs text-red-500 font-medium">{passwordError}</p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Financial data and client names are hidden for privacy. Enter the password to reveal all information.
          </p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setPassword(""); setPasswordError(""); }}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 gap-2">
              <Eye className="h-4 w-4" />
              Unlock
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};
