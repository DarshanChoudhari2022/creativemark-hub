import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PaymentStatus } from "@/data/clients";

export const PaymentBadge = ({ status }: { status: PaymentStatus }) => {
  const map: Record<PaymentStatus, string> = {
    Paid: "bg-success/15 text-success border-success/30 hover:bg-success/15",
    Partial: "bg-warning/15 text-warning-foreground border-warning/40 hover:bg-warning/15",
    Overdue: "bg-primary/10 text-primary border-primary/30 hover:bg-primary/10",
  };
  return <Badge variant="outline" className={cn("font-semibold", map[status])}>{status}</Badge>;
};

export const StatusBadge = ({ status }: { status: string }) => {
  const lower = status.toLowerCase();
  let cls = "bg-muted text-muted-foreground border-border";
  if (["approved", "paid", "completed", "active", "converted"].includes(lower)) cls = "bg-success/15 text-success border-success/30";
  else if (["sent", "in progress", "negotiation", "scheduled", "contacted"].includes(lower)) cls = "bg-warning/15 text-warning-foreground border-warning/40";
  else if (["billed", "draft", "new", "quotation sent"].includes(lower)) cls = "bg-foreground/5 text-foreground border-border";
  else if (["overdue", "lost", "pending", "inactive"].includes(lower)) cls = "bg-primary/10 text-primary border-primary/30";
  return <Badge variant="outline" className={cn("font-semibold capitalize", cls)}>{status}</Badge>;
};

export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2">{actions}</div>}
  </div>
);
