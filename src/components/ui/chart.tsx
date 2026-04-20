// Stubbed shadcn chart wrapper — the app uses Recharts directly.
import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label?: string; color?: string }>;

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { config?: ChartConfig; children: React.ReactElement }
>(({ className, children, ...props }, ref) => (
  <div ref={ref} className={cn("h-72 w-full", className)} {...props}>
    <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
  </div>
));
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartTooltipContent: React.FC = () => null;
const ChartLegend = RechartsPrimitive.Legend;
const ChartLegendContent: React.FC = () => null;
const ChartStyle: React.FC = () => null;

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, ChartStyle };
