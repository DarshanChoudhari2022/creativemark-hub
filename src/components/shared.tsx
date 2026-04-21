import React from "react";
import { Badge } from "@/components/ui/badge";

/**
 * Page header with title, subtitle, and optional action buttons.
 */
export const PageHeader = ({ title, subtitle, actions }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

/**
 * Payment status badge — Paid (green), Partial (amber), Overdue (red)
 */
export const PaymentBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    Paid: "bg-green-100 text-green-700 border-green-200",
    Partial: "bg-amber-100 text-amber-700 border-amber-200",
    Overdue: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`font-semibold text-[11px] ${map[status] || "bg-muted text-muted-foreground"}`}>
      {status}
    </Badge>
  );
};

/**
 * Stage badge for leads — dynamic colors per pipeline stage
 */
export const StageBadge = ({ stage }: { stage: string }) => {
  const map: Record<string, string> = {
    New: "bg-gray-100 text-gray-700 border-gray-200",
    Contacted: "bg-amber-100 text-amber-700 border-amber-200",
    "Quotation Sent": "bg-blue-100 text-blue-700 border-blue-200",
    Negotiation: "bg-orange-100 text-orange-700 border-orange-200",
    Converted: "bg-green-100 text-green-700 border-green-200",
    Lost: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`font-semibold text-[11px] ${map[stage] || "bg-muted text-muted-foreground"}`}>
      {stage}
    </Badge>
  );
};

/**
 * Empty state component
 */
export const EmptyState = ({ icon: Icon, title, description }: {
  icon: React.ElementType; title: string; description?: string;
}) => (
  <div className="text-center py-16">
    <Icon className="h-14 w-14 mx-auto text-muted-foreground/25 mb-4" />
    <h3 className="text-lg font-semibold text-muted-foreground mb-1">{title}</h3>
    {description && <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>}
  </div>
);
