import type { Quotation } from "@/types";

export const DEFAULT_TERMS = `1. Payment is due within 15 days of invoice date.
2. Goods once sold will not be taken back.
3. Subject to jurisdiction.`;

export const SERVICE_PRESETS = [
  { serviceName: "Social Media Management", rate: 15000, unit: "month" },
  { serviceName: "Reel Production (Batch of 4)", rate: 12000, unit: "batch" },
  { serviceName: "Event Photography (Half Day)", rate: 8000, unit: "event" },
  { serviceName: "Event Photography (Full Day)", rate: 15000, unit: "event" },
  { serviceName: "Banner Design", rate: 1500, unit: "piece" },
  { serviceName: "Logo Design", rate: 10000, unit: "project" },
  { serviceName: "Website Development", rate: 35000, unit: "project" },
];

export const quotations: Quotation[] = [];
