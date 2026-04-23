import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface AppNotification {
  id: string;
  title: string;
  time: string;
  urgent: boolean;
  type: 'follow-up' | 'payment' | 'smart-lead' | 'other';
  link?: string;
  meta?: any;
}

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      
      // 1. Fetch Follow-ups due today or overdue
      const { data: followUps } = await supabase
        .from('leads')
        .select('id, name, phone, whatsapp, next_call_date, action_item')
        .not('next_call_date', 'is', null)
        .lte('next_call_date', today)
        .not('stage', 'in', '("Converted", "Lost")');

      // 2. Fetch Stale Leads (No interaction for 3 days)
      const { data: staleLeads } = await supabase
        .from('leads')
        .select('id, name, last_interaction_date')
        .lt('last_interaction_date', threeDaysAgo)
        .not('stage', 'in', '("Converted", "Lost")');

      // 3. Fetch Quotation Follow-ups (Sent but not decided after 2 days)
      const { data: pendingQuotes } = await supabase
        .from('leads')
        .select('id, name, last_interaction_date, quotation_status')
        .eq('quotation_status', 'Sent')
        .lte('last_interaction_date', twoDaysAgo);

      // 4. Fetch Overdue payments (Bills)
      const { data: payments } = await supabase
        .from('quotations')
        .select('id, quote_number, client_name, client_phone, due_date, grand_total')
        .eq('type', 'Bill')
        .lte('due_date', today)
        .not('status', 'eq', 'Paid');

      // 5. Fetch Unassigned Smart Leads
      const { data: unassignedLeads } = await supabase
        .from('smart_leads')
        .select('id, customer_name, phone, source, created_at')
        .eq('status', 'New')
        .is('assigned_to', null);

      // 6. Fetch Overdue Lead Tasks
      const { data: leadTasks } = await supabase
        .from('lead_tasks')
        .select('id, description, due_date, lead_id, leads(name)')
        .eq('status', 'Pending')
        .lte('due_date', today);

      const mapped: AppNotification[] = [
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
  };

  const showBrowserNotification = (notification: AppNotification) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    new Notification("CreativeMark CRM", {
      body: notification.title,
      icon: "/favicon.ico", // Ensure this exists or use a generic icon
    });
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const [prevUrgentCount, setPrevUrgentCount] = useState(0);

  useEffect(() => {
    const urgentCount = notifications.filter(n => n.urgent).length;
    if (urgentCount > prevUrgentCount) {
      const newUrgent = notifications.find(n => n.urgent && !notifications.some(pn => pn.id === n.id));
      if (newUrgent) {
        showBrowserNotification(newUrgent);
      }
    }
    setPrevUrgentCount(urgentCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000); // Check every 2 mins
    return () => clearInterval(interval);
  }, []);

  return { notifications, loading, refresh: fetchNotifications };
};
