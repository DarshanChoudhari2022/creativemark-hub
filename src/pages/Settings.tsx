import { useState } from "react";
import { Building2, User, Bell, Shield, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/shared";
import { toast } from "sonner";

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

  const save = () => toast.success("Settings saved successfully");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your company profile and preferences" />

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
