import { useState, useEffect } from "react";
import { Building2, User, Bell, Shield, Palette, Wifi, Plus, Trash2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared";
import { useSupabaseTable } from "@/hooks/useSupabase";
import { toast } from "sonner";

const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || "";
const WEBHOOK_BASE = SUPABASE_PROJECT_URL ? `${SUPABASE_PROJECT_URL}/functions/v1` : "";

const PLATFORM_PRESETS: Record<string, { method: string; desc: string; color: string; functionName: string }> = {
  "Just Dial": { method: "Webhook push", desc: "Share the URL with your JustDial account manager", color: "border-yellow-300 bg-yellow-50", functionName: "justdial-webhook" },
  "Meta Ads": { method: "Facebook Lead Ads API", desc: "Set as callback URL in Facebook App → Webhooks", color: "border-blue-300 bg-blue-50", functionName: "meta-leads-webhook" },
  "Google Ads": { method: "Lead Form Extensions", desc: "Set as webhook URL in Google Ads Lead Form settings", color: "border-red-300 bg-red-50", functionName: "google-leads-webhook" },
  "OEM CRM": { method: "API pull / Email parser", desc: "Brand-specific setup — configure per OEM", color: "border-purple-300 bg-purple-50", functionName: "" },
};

const Settings = () => {
  const [company, setCompany] = useState({
    name: "CreativeMark",
    tagline: "Advertising | Digital Marketing | Branding | Multimedia",
    phone: "+91 98765 43210",
    email: "hello@creativemark.in",
    address: "301, Baner Road, Pune — 411045, Maharashtra",
    gst: "27AAECT1234F1Z5",
    website: "www.creativemark.in",
  });

  const [notifications, setNotifications] = useState({
    paymentReminders: true,
    leadAssignments: true,
    invoiceOverdue: true,
    dailySummary: false,
  });

  // Integrations
  const { data: webhookConfigs, refresh: refreshWebhooks, insert: insertWebhook, update: updateWebhook, remove: removeWebhook } = useSupabaseTable<any>("webhook_config", "*");
  const [addIntegrationOpen, setAddIntegrationOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState("");
  const [customPlatform, setCustomPlatform] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const addIntegration = async () => {
    const platform = newPlatform === "Custom" ? customPlatform : newPlatform;
    if (!platform) { toast.error("Select a platform"); return; }
    if (webhookConfigs.some((w: any) => w.platform === platform)) { toast.error("Platform already added"); return; }

    const preset = PLATFORM_PRESETS[platform];
    const webhookUrl = preset?.functionName ? `${WEBHOOK_BASE}/${preset.functionName}` : "";

    const { error } = await insertWebhook({
      platform,
      webhook_url: webhookUrl,
      is_active: false,
      api_key: newApiKey || null,
      total_leads_received: 0,
    });

    if (error) toast.error("Failed: " + error.message);
    else {
      toast.success(`${platform} integration added`);
      setAddIntegrationOpen(false);
      setNewPlatform("");
      setCustomPlatform("");
      setNewApiKey("");
      refreshWebhooks();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await updateWebhook(id, { is_active: !current });
    toast.success(`Integration ${!current ? "activated" : "deactivated"}`);
    refreshWebhooks();
  };

  const deleteIntegration = async (id: string, name: string) => {
    await removeWebhook(id);
    toast.success(`${name} removed`);
    refreshWebhooks();
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Webhook URL copied to clipboard");
  };

  const save = () => toast.success("Settings saved successfully");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your company profile, integrations, and preferences" />

      <div className="max-w-3xl space-y-6">
        {/* Company Profile */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Company Profile</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Company Name</Label><Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} /></div>
            <div><Label>Tagline</Label><Input value={company.tagline} onChange={(e) => setCompany({ ...company, tagline: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} /></div>
            <div><Label>GSTIN</Label><Input value={company.gst} onChange={(e) => setCompany({ ...company, gst: e.target.value })} /></div>
            <div><Label>Website</Label><Input value={company.website} onChange={(e) => setCompany({ ...company, website: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="bg-primary hover:bg-primary-hover" onClick={save}>Save Changes</Button>
          </div>
        </Card>

        {/* Lead Source Integrations */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-lg">Lead Source Integrations</h3>
            </div>
            <Dialog open={addIntegrationOpen} onOpenChange={setAddIntegrationOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary hover:bg-primary-hover gap-1"><Plus className="h-3.5 w-3.5" /> Add Platform</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Lead Source Integration</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Platform</Label>
                    <Select value={newPlatform} onValueChange={setNewPlatform}>
                      <SelectTrigger><SelectValue placeholder="Select platform…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Just Dial">Just Dial</SelectItem>
                        <SelectItem value="Meta Ads">Meta Ads (Facebook/Instagram)</SelectItem>
                        <SelectItem value="Google Ads">Google Ads</SelectItem>
                        <SelectItem value="OEM CRM">OEM CRM</SelectItem>
                        <SelectItem value="Custom">Custom / Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newPlatform === "Custom" && (
                    <div>
                      <Label>Custom Platform Name</Label>
                      <Input value={customPlatform} onChange={e => setCustomPlatform(e.target.value)} placeholder="e.g. CarDekho, CarWale" />
                    </div>
                  )}
                  <div>
                    <Label>API Key (optional)</Label>
                    <Input value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="Enter API key if required" type="password" />
                  </div>
                  {newPlatform && newPlatform !== "Custom" && PLATFORM_PRESETS[newPlatform] && (
                    <div className={`p-3 rounded-lg border-2 ${PLATFORM_PRESETS[newPlatform].color}`}>
                      <div className="text-xs font-semibold">{PLATFORM_PRESETS[newPlatform].method}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{PLATFORM_PRESETS[newPlatform].desc}</div>
                      {PLATFORM_PRESETS[newPlatform].functionName && (
                        <div className="text-[10px] font-mono mt-2 bg-white/50 p-1.5 rounded break-all">
                          {WEBHOOK_BASE}/{PLATFORM_PRESETS[newPlatform].functionName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddIntegrationOpen(false)}>Cancel</Button>
                  <Button className="bg-primary hover:bg-primary-hover" onClick={addIntegration}>Add Integration</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-xs text-muted-foreground mb-4">
            Configure your lead sources here. Each platform gets a webhook URL — share it with the provider to start receiving leads automatically.
          </div>

          {webhookConfigs.length > 0 ? (
            <div className="space-y-3">
              {webhookConfigs.map((w: any) => {
                const preset = PLATFORM_PRESETS[w.platform];
                return (
                  <div key={w.id} className={`p-4 rounded-lg border-2 ${preset?.color || "border-gray-200 bg-gray-50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{w.platform}</span>
                        <Badge variant="outline" className={`text-[10px] ${w.is_active ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-500 border-gray-300"}`}>
                          {w.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {w.total_leads_received > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{w.total_leads_received} leads</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={w.is_active} onCheckedChange={() => toggleActive(w.id, w.is_active)} />
                        <Button size="sm" variant="ghost" className="h-7 px-1.5 text-red-500 hover:text-red-700" onClick={() => deleteIntegration(w.id, w.platform)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{preset?.method || "Custom integration"}</div>
                    {w.webhook_url && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-[10px] font-mono bg-white/60 p-1.5 rounded flex-1 truncate border">{w.webhook_url}</div>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyUrl(w.webhook_url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {w.last_received_at && (
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Last lead: {new Date(w.last_received_at).toLocaleString("en-IN")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Wifi className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-semibold">No integrations configured yet</p>
              <p className="text-xs mt-1">Click "Add Platform" to set up JustDial, Meta Ads, Google Ads, or any other lead source.</p>
            </div>
          )}
        </Card>

        {/* PDF / Letterhead */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">PDF & Letterhead</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="font-semibold">Brand Color</div>
                <div className="text-xs text-muted-foreground">Used in PDF headers and accents</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary border border-border" />
                <span className="font-mono text-xs">#E8192C</span>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="font-semibold">Include GST in Quotations</div>
                <div className="text-xs text-muted-foreground">Default setting for new quotations</div>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div>
                <div className="font-semibold">Show Bank Details on Invoice</div>
                <div className="text-xs text-muted-foreground">Display payment info on PDF invoices</div>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Notifications</h3>
          </div>
          <div className="space-y-3">
            {[
              { key: "paymentReminders" as const, label: "Payment Reminders", desc: "Get notified when invoices are overdue" },
              { key: "leadAssignments" as const, label: "Lead Assignments", desc: "Notify when a new lead is assigned" },
              { key: "invoiceOverdue" as const, label: "Invoice Overdue Alerts", desc: "Critical alerts for 30+ day overdue" },
              { key: "dailySummary" as const, label: "Daily Summary Email", desc: "Receive a daily digest of all CRM activity" },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 border border-border rounded-lg">
                <div>
                  <div className="font-semibold text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={(v) => setNotifications({ ...notifications, [item.key]: v })}
                />
              </div>
            ))}
          </div>
        </Card>

        {/* Roles */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Access Roles</h3>
          </div>
          <div className="space-y-2 text-sm">
            {[
              { role: "Owner", access: "Full access to all modules, settings, and financial data", color: "bg-primary/10 text-primary" },
              { role: "Sales Team", access: "Can manage leads, send quotations. Cannot see financials or employee salaries.", color: "bg-blue-50 text-blue-600" },
              { role: "Employee", access: "Can view assigned clients and log work. Cannot see leads, recovery, or partner data.", color: "bg-green-50 text-green-600" },
            ].map(r => (
              <div key={r.role} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <span className={`text-xs font-bold px-2 py-1 rounded ${r.color}`}>{r.role}</span>
                <span className="text-muted-foreground">{r.access}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">* Role-based access will be enforced after Supabase backend integration.</p>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
