import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // ── Facebook Webhook Verification (GET) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "creativemark_meta_token_123";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── Handle incoming leads (POST) ──
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body.object !== "page") {
        return new Response("Not Found", { status: 404 });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseServiceKey) {
        return new Response("Server configuration error", { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field !== "leadgen") continue;

          const leadInfo = change.value;
          const leadgenId = leadInfo.leadgen_id;
          const pageId = leadInfo.page_id;
          const formId = leadInfo.form_id;

          // ── Find available salesperson ──
          const { data: roster } = await supabase
            .from("sales_roster")
            .select("*, employee_id(id, name, phone, whatsapp, status)")
            .eq("is_available", true);

          const available = (roster || []).filter((r: any) => {
            const emp = r.employee_id;
            if (!emp || emp.status !== "Active") return false;
            if (r.leave_start && r.leave_end && today >= r.leave_start && today <= r.leave_end) return false;
            return true;
          });

          let assignedTo: string | null = null;
          let assignedName = "Unassigned";

          if (available.length > 0) {
            const { data: todayLeads } = await supabase
              .from("smart_leads")
              .select("assigned_to")
              .gte("created_at", today + "T00:00:00")
              .not("assigned_to", "is", null);

            const counts: Record<string, number> = {};
            (todayLeads || []).forEach((l: any) => {
              counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
            });

            available.sort((a: any, b: any) => {
              const capA = (counts[a.employee_id.id] || 0) / (a.max_daily_leads || 50);
              const capB = (counts[b.employee_id.id] || 0) / (b.max_daily_leads || 50);
              return capA - capB;
            });

            assignedTo = available[0].employee_id.id;
            assignedName = available[0].employee_id.name;
          }

          // ── Insert lead ──
          const { data: inserted, error } = await supabase
            .from("smart_leads")
            .insert({
              customer_name: `Meta Lead (${leadgenId.substring(0, 8)})`,
              phone: "",
              whatsapp: "",
              email: null,
              source: "Meta Ads",
              vehicle_interest: `Form: ${formId}`,
              status: assignedTo ? "Assigned" : "New",
              assigned_to: assignedTo,
              assigned_at: assignedTo ? now : null,
              assignment_method: assignedTo ? "auto" : null,
              notification_sent: !!assignedTo,
              notes: `Page: ${pageId}, Leadgen: ${leadgenId}. Fetch full details via Graph API.`,
            })
            .select()
            .single();

          if (!error && inserted && assignedTo) {
            await supabase.from("lead_activity_log").insert({
              lead_id: inserted.id,
              event_type: "auto_assigned",
              details: `Auto-assigned to ${assignedName} via Meta Ads webhook`,
              created_at: now,
            });
          }

          // Update stats
          await supabase.rpc("increment_webhook_leads", { p_platform: "Meta Ads" }).catch(() => {});
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Error", { status: 500 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});
