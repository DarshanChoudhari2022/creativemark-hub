import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // ── Facebook Webhook Verification (GET) ──
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "creativemark_meta_token_123";

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Meta webhook verified successfully!");
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── Handle incoming leads (POST) ──
  if (req.method === "POST") {
    try {
      const body = await req.json();
      
      // Basic validation of Meta webhook payload
      if (body.object !== "page") {
        return new Response("Invalid object type", { status: 400 });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing Supabase configuration");
        return new Response("Server configuration error", { status: 500 });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();

      // Meta can send multiple entries and changes in one request
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field !== "leadgen") continue;

          const leadInfo = change.value;
          const leadgenId = leadInfo.leadgen_id;
          const pageId = leadInfo.page_id;
          const formId = leadInfo.form_id;

          console.log(`Processing Meta lead: ${leadgenId} from form: ${formId}`);

          // ── Fetch full lead details from Meta Graph API ──
          const accessToken = Deno.env.get("META_ACCESS_TOKEN");
          let customerName = "Meta Lead";
          let phone = "";
          let email = null;
          let vehicleInterest = "";
          let rawData = {};

          if (accessToken) {
            try {
              // Using v20.0 as it is the current stable version, fallback to v19.0 if needed
              const graphUrl = `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${accessToken}`;
              const graphRes = await fetch(graphUrl);
              const graphData = await graphRes.json();

              if (graphData.error) {
                console.error("Meta Graph API error:", graphData.error);
              } else if (graphData && graphData.field_data) {
                rawData = graphData;
                graphData.field_data.forEach((field: any) => {
                  const name = field.name.toLowerCase();
                  const value = field.values[0];
                  
                  // Improved field mapping
                  if (name === "full_name" || name === "first_name" || name === "name") {
                    customerName = value;
                  } else if (name === "phone_number" || name === "phone") {
                    phone = value;
                  } else if (name === "email") {
                    email = value;
                  } else if (name.includes("interest") || name.includes("vehicle") || name.includes("service") || name.includes("product")) {
                    vehicleInterest = value;
                  }
                });
              }
            } catch (err) {
              console.error("Error fetching lead details from Meta:", err);
            }
          } else {
            console.warn("META_ACCESS_TOKEN not set, skipping detailed lead fetch");
          }

          // ── Find available salesperson (Round-Robin logic) ──
          const { data: roster } = await supabase
            .from("sales_roster")
            .select("*, employee_id(id, name, phone, whatsapp, status)")
            .eq("is_available", true);

          const available = (roster || []).filter((r: any) => {
            const emp = r.employee_id;
            if (!emp || emp.status !== "Active") return false;
            // Check leave status
            if (r.leave_start && r.leave_end && today >= r.leave_start && today <= r.leave_end) return false;
            return true;
          });

          let assignedTo: string | null = null;
          let assignedName = "Unassigned";

          if (available.length > 0) {
            // Count today's leads per available salesperson to distribute evenly
            const { data: todayLeads } = await supabase
              .from("smart_leads")
              .select("assigned_to")
              .gte("created_at", today + "T00:00:00")
              .not("assigned_to", "is", null);

            const counts: Record<string, number> = {};
            (todayLeads || []).forEach((l: any) => {
              counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1;
            });

            // Sort by utilization ratio (leads/max_daily_leads)
            available.sort((a: any, b: any) => {
              const capA = (counts[a.employee_id.id] || 0) / (a.max_daily_leads || 50);
              const capB = (counts[b.employee_id.id] || 0) / (b.max_daily_leads || 50);
              return capA - capB;
            });

            assignedTo = available[0].employee_id.id;
            assignedName = available[0].employee_id.name;
          }

          // ── Insert lead into smart_leads ──
          const { data: inserted, error: insertError } = await supabase
            .from("smart_leads")
            .insert({
              customer_name: customerName,
              phone: phone,
              whatsapp: phone,
              email: email,
              source: "Meta Ads",
              vehicle_interest: vehicleInterest || `Form: ${formId}`,
              status: assignedTo ? "Assigned" : "New",
              assigned_to: assignedTo,
              assigned_at: assignedTo ? now : null,
              assignment_method: assignedTo ? "auto" : null,
              notification_sent: !!assignedTo,
              notes: `Page ID: ${pageId}\nLeadgen ID: ${leadgenId}\nForm ID: ${formId}\nAssigned via Meta Ads Webhook.`,
            })
            .select()
            .single();

          if (insertError) {
            console.error("Database insert error:", insertError);
            continue;
          }

          // ── Log activity ──
          if (inserted && assignedTo) {
            await supabase.from("lead_activity_log").insert({
              lead_id: inserted.id,
              event_type: "auto_assigned",
              details: `Auto-assigned to ${assignedName} via Meta Ads webhook`,
              created_at: now,
            });
          }

          // ── Update global stats ──
          await supabase.rpc("increment_webhook_leads", { p_platform: "Meta Ads" }).catch((e: Error) => {
            console.error("RPC increment failed:", e);
          });
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});

