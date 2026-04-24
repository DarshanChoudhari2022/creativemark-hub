import type { Quotation } from "@/types";

export const DEFAULT_TERMS_QUOTATION = `1. This quotation is valid for 15 days from the date of issue.
2. A 50% advance payment is required to commence work. Balance due upon completion.
3. Any changes in scope after approval will be quoted separately.
4. Delivery timelines begin after receipt of advance payment and all required materials from the client.
5. All intellectual property rights shall be transferred to the client only after full payment.
6. Cancellation after work has commenced will attract charges for work already completed.
7. GST will be charged as applicable at the prevailing rate.`;

export const DEFAULT_TERMS_BILL = `1. Payment is due within 15 days from the date of this invoice.
2. Late payments will attract an interest of 2% per month on the outstanding amount.
3. All disputes are subject to the jurisdiction of courts in Pune, Maharashtra.
4. Services rendered are non-refundable once delivered and approved by the client.
5. GST has been charged as applicable at the prevailing rate.
6. Please quote the invoice number in all payment communications.`;

// Keep backward-compatible export
export const DEFAULT_TERMS = DEFAULT_TERMS_QUOTATION;

export const SERVICE_PRESETS = [
  { serviceName: "Social Media Management", rate: 15000, unit: "month" },
  { serviceName: "Reel Production (Batch of 4)", rate: 12000, unit: "batch" },
  { serviceName: "Event Photography (Half Day)", rate: 8000, unit: "event" },
  { serviceName: "Event Photography (Full Day)", rate: 15000, unit: "event" },
  { serviceName: "Banner Design", rate: 1500, unit: "piece" },
  { serviceName: "Logo Design", rate: 10000, unit: "project" },
  { serviceName: "Website Development", rate: 35000, unit: "project" },
  { serviceName: "Brand Identity Package", rate: 25000, unit: "project" },
  { serviceName: "Video Production (1 min)", rate: 20000, unit: "video" },
  { serviceName: "Political Campaign Package", rate: 50000, unit: "campaign" },
];

export const quotations: Quotation[] = [];
