import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AppNotification {
  id: string;
  title: string;
  time: string;
  urgent: boolean;
  type: 'follow-up' | 'payment' | 'smart-lead' | 'other' | 'lead_assigned' | 'sla_breach' | 'task_assigned';
  link?: string;
  meta?: any;
  is_db?: boolean;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeRead, setIncludeRead] = useState(false);

  const fetchNotifications = useCallback(async (showRead = includeRead) => {
    if (!user) return;
    
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      // 1. Fetch from Database 'notifications' table
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!showRead) {
        query = query.eq('is_read', false);
      }

      const { data: dbNotifs } = await query;

      // 2. Fetch Follow-ups due today or overdue
      let followUpsQuery = supabase
        .from('leads')
        .select('id, name, phone, whatsapp, next_call_date, action_item')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', today)
        .not('stage', 'in', '("Converted", "Lost")');
      
      if (user.role === 'Employee') {
        followUpsQuery = followUpsQuery.eq('assigned_to', user.id);
      }
      const { data: followUps } = await followUpsQuery;

      // 3. Fetch Stale Leads (No interaction for 3 days)
      let staleLeadsQuery = supabase
        .from('leads')
        .select('id, name, last_interaction_date')
        .lt('last_interaction_date', threeDaysAgo)
        .not('stage', 'in', '("Converted", "Lost")');

      if (user.role === 'Employee') {
        staleLeadsQuery = staleLeadsQuery.eq('assigned_to', user.id);
      }
      const { data: staleLeads } = await staleLeadsQuery;

      // 4. Fetch Quotation Follow-ups (Sent but not decided after 2 days)
      let pendingQuotesQuery = supabase
        .from('leads')
        .select('id, name, last_interaction_date, quotation_status')
        .eq('quotation_status', 'Sent')
        .lte('last_interaction_date', twoDaysAgo);

      if (user.role === 'Employee') {
        pendingQuotesQuery = pendingQuotesQuery.eq('assigned_to', user.id);
      }
      const { data: pendingQuotes } = await pendingQuotesQuery;

      // 5. Fetch Overdue payments (Bills)
      const { data: payments } = await supabase
        .from('quotations')
        .select('id, quote_number, client_name, client_phone, due_date, grand_total')
        .eq('type', 'Bill')
        .lte('due_date', today)
        .not('status', 'eq', 'Paid');

      // 6. Fetch Unassigned Smart Leads (Only for Admin/Managers)
      let unassignedLeads = [];
      if (user.role === 'Admin') {
        const { data } = await supabase
          .from('smart_leads')
          .select('id, customer_name, phone, source, created_at')
          .eq('status', 'New')
          .is('assigned_to', null);
        unassignedLeads = data || [];
      }

      // 7. Fetch Overdue Lead Tasks
      let leadTasksQuery = supabase
        .from('lead_tasks')
        .select('id, description, due_date, lead_id, leads(name)')
        .eq('status', 'Pending')
        .lte('due_date', today);

      if (user.role === 'Employee') {
        leadTasksQuery = leadTasksQuery.eq('assigned_to', user.id);
      }
      const { data: leadTasks } = await leadTasksQuery;

      const mapped: AppNotification[] = [
        ...(dbNotifs || []).map(n => ({
          id: `db-${n.id}`,
          title: n.title,
          time: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          urgent: n.priority === 'urgent' || n.priority === 'high',
          type: n.type as any,
          link: n.type === 'lead_assigned' ? '/smart-leads' : '/leads',
          meta: { ...n.metadata, db_id: n.id },
          is_db: true
        })),
        ...(followUps || []).map(l => ({
          id: `follow-${l.id}`,
          title: `Follow up with ${l.name}: ${l.action_item || 'Pending task'}`,
          time: l.next_call_date === today ? 'Today' : `Overdue: ${l.next_call_date}`,
          urgent: true,
          type: 'follow-up' as const,
          link: '/leads',
          meta: { phone: l.whatsapp || l.phone, name: l.name }
        })),
        ...(leadTasks || []).map(t => ({
          id: `task-${t.id}`,
          title: `Task: ${t.description} (${(t.leads as any)?.name || 'Lead'})`,
          time: t.due_date === today ? 'Today' : `Overdue: ${t.due_date}`,
          urgent: true,
          type: 'follow-up' as const,
          link: '/leads',
          meta: { name: (t.leads as any)?.name }
        })),
        ...(staleLeads || []).map(l => ({
          id: `stale-${l.id}`,
          title: `Stale Lead: No interaction with ${l.name} for 3+ days`,
          time: 'Needs Attention',
          urgent: false,
          type: 'other' as const,
          link: '/leads',
          meta: { name: l.name }
        })),
        ...(pendingQuotes || []).map(l => ({
          id: `qfollow-${l.id}`,
          title: `Check Quote Status: ${l.name} hasn't responded to quote sent on ${l.last_interaction_date}`,
          time: '2 Days Old',
          urgent: true,
          type: 'follow-up' as const,
          link: '/leads',
          meta: { name: l.name }
        })),
        ...(payments || []).map(p => ({
          id: `pay-${p.id}`,
          title: `Payment due for ${p.quote_number} (${p.client_name})`,
          time: p.due_date === today ? 'Today' : `Overdue: ${p.due_date}`,
          urgent: true,
          type: 'payment' as const,
          link: '/recovery',
          meta: { phone: p.client_phone, name: p.client_name, amount: p.grand_total, invoice: p.quote_number }
        })),
        ...(unassignedLeads || []).map(ul => ({
          id: `smart-${ul.id}`,
          title: `New lead from ${ul.source}: ${ul.customer_name}`,
          time: 'Action Required',
          urgent: true,
          type: 'smart-lead' as const,
          link: '/smart-leads',
          meta: { phone: ul.phone, name: ul.customer_name }
        }))
      ];

      setNotifications(mapped);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [user, includeRead]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new;
          toast.info(newNotif.title, {
            description: newNotif.message,
            duration: 8000,
          });
          
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("CreativeMark CRM", {
              body: newNotif.title + ": " + newNotif.message,
            });
          }
          
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  useEffect(() => {
    fetchNotifications(includeRead);
    const interval = setInterval(() => fetchNotifications(includeRead), 5 * 60 * 1000); // Check every 5 mins
    return () => clearInterval(interval);
  }, [fetchNotifications, includeRead]);

  const markAsRead = async (id: string) => {
    if (id.startsWith('db-')) {
      const dbId = id.replace('db-', '');
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', dbId);
    }
    fetchNotifications(includeRead);
  };

  const markAllAsRead = async () => {
    const dbNotifIds = notifications
      .filter(n => n.is_db)
      .map(n => n.id.replace('db-', ''));
    
    if (dbNotifIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', dbNotifIds);
    }
    
    fetchNotifications(includeRead);
  };

  return { 
    notifications, 
    loading, 
    refresh: () => fetchNotifications(includeRead), 
    markAsRead, 
    markAllAsRead,
    includeRead,
    setIncludeRead
  };
};
