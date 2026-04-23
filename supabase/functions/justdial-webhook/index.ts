import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ error: "Server configuration error" }), { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Find available salesperson (not on leave, within shift) ──
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const { data: roster } = await supabase
      .from("sales_roster")
      .select("*, employee_id(id, name, phone, whatsapp, status)")
      .eq("is_available", true);

    // Filter: active employee, not on leave today
    const available = (roster || []).filter((r: any) => {
      const emp = r.employee_id;
      if (!emp || emp.status !== "Active") return false;
      if (r.leave_start && r.leave_end && today >= r.leave_start && today <= r.leave_end) return false;
      return true;
    });

    // Pick person with fewest leads assigned today (round-robin by workload)
    let assignedTo: string | null = null;
    let assignedName = "Unassigned";

    if (available.length > 0) {
      // Count today's leads per salesperson
      const { data: todayLeads } = await supabase
        .from("smart_leads")
        .select("assigned_to")
        .gte("created_at", today + "T00:00:00")
        .not("assigned_to", "is", null);

      const counts: Record<string, number> = {};
      (todayLeads || []).forEach((l: any) => {
        counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
      });

      // Sort by fewest leads today, then by max_daily_leads capacity
      available.sort((a: any, b: any) => {
        const countA = counts[a.employee_id.id] || 0;
        const countB = counts[b.employee_id.id] || 0;
        const capA = countA / (a.max_daily_leads || 50);
        const capB = countB / (b.max_daily_leads || 50);
        return capA - capB;
      });

      assignedTo = available[0].employee_id.id;
      assignedName = available[0].employee_id.name;
    }

    // ── 2. Insert lead with auto-assignment ──
    const newLead = {
      customer_name: body.name || body.leadname || "JustDial Lead",
      phone: body.mobile || body.phone || "",
      whatsapp: body.mobile || body.phone || "",
      email: body.email || null,
      source: "Just Dial",
      vehicle_interest: body.category || body.product || "",
      status: assignedTo ? "Assigned" : "New",
      assigned_to: assignedTo,
      assigned_at: assignedTo ? now : null,
      assignment_method: assignedTo ? "auto" : null,
      notification_sent: !!assignedTo,
      notes: `Auto-imported from JustDial. Area: ${body.area || body.city || "N/A"}. Raw: ${JSON.stringify(body).slice(0, 500)}`,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("smart_leads")
      .insert(newLead)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save lead", details: insertError }), { status: 500 });
    }

    // ── 3. Log the assignment event ──
    if (assignedTo) {
      await supabase.from("lead_activity_log").insert({
        lead_id: inserted.id,
        event_type: "auto_assigned",
        details: `Auto-assigned to ${assignedName} via JustDial webhook`,
        created_at: now,
      });
    }

    // ── 4. Update webhook stats ──
    await supabase
      .from("webhook_config")
      .update({ last_received_at: now, total_leads_received: supabase.rpc ? undefined : undefined })
      .eq("platform", "Just Dial");

    // Increment counter via RPC if available, otherwise skip
    await supabase.rpc("increment_webhook_leads", { p_platform: "Just Dial" }).catch(() => {});

    return new Response(
      JSON.stringify({
        status: "success",
        lead_id: inserted.id,
        assigned_to: assignedName,
        message: assignedTo
          ? `Lead saved and auto-assigned to ${assignedName}`
          : "Lead saved — no salespeople available, needs manual assignment",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(JSON.stringify({ error: "Invalid request body or processing error" }), { status: 400 });
  }
});
