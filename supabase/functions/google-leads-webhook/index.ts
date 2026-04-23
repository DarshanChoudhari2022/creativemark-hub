import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const body = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Server configuration error", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    // Google Ads sends: user_column_data array with fields like Full Name, Email, Phone Number
    const fields: Record<string, string> = {};
    if (body.user_column_data) {
      body.user_column_data.forEach((col: any) => {
        fields[col.column_id] = col.string_value || col.value || "";
      });
    }

    const customerName = fields["FULL_NAME"] || body.name || "Google Ads Lead";
    const phone = fields["PHONE_NUMBER"] || body.phone || "";
    const email = fields["EMAIL"] || body.email || "";

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
        customer_name: customerName,
        phone,
        whatsapp: phone,
        email: email || null,
        source: "Google Ads",
        vehicle_interest: body.campaign_name || fields["VEHICLE_INTEREST"] || "",
        status: assignedTo ? "Assigned" : "New",
        assigned_to: assignedTo,
        assigned_at: assignedTo ? now : null,
        assignment_method: assignedTo ? "auto" : null,
        notification_sent: !!assignedTo,
        notes: `Campaign: ${body.campaign_id || "N/A"}. Form: ${body.form_id || "N/A"}. Raw fields: ${JSON.stringify(fields).slice(0, 500)}`,
      })
      .select()
      .single();

    if (!error && inserted && assignedTo) {
      await supabase.from("lead_activity_log").insert({
        lead_id: inserted.id,
        event_type: "auto_assigned",
        details: `Auto-assigned to ${assignedName} via Google Ads webhook`,
        created_at: now,
      });
    }

    await supabase.rpc("increment_webhook_leads", { p_platform: "Google Ads" }).catch(() => {});

    return new Response(
      JSON.stringify({
        status: "success",
        lead_id: inserted?.id,
        assigned_to: assignedName,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Processing error" }), { status: 400 });
  }
});
