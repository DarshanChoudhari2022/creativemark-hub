import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared";

const Settings = () => (
  <div>
    <PageHeader title="Settings" subtitle="Workspace preferences" />
    <Card className="p-6">
      <p className="text-muted-foreground">Settings will be available in a future release. For now, this CRM is running with mock data — no backend connected.</p>
    </Card>
  </div>
);

export default Settings;
