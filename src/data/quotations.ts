import type { Quotation } from "@/types";

import { PROFESSIONAL_TERMS_QUOTATION, PROFESSIONAL_TERMS_BILL } from "@/lib/pdf";

export const DEFAULT_TERMS_QUOTATION = PROFESSIONAL_TERMS_QUOTATION.join("\n");
export const DEFAULT_TERMS_BILL = PROFESSIONAL_TERMS_BILL.join("\n");

// Keep backward-compatible export
export const DEFAULT_TERMS = DEFAULT_TERMS_QUOTATION;

export const SERVICE_PRESETS = [
  { serviceName: "Social Media Management (Standard)", rate: 15000, unit: "month" },
  { serviceName: "Social Media Management (Premium)", rate: 25000, unit: "month" },
  { serviceName: "Reel Production (Batch of 4)", rate: 12000, unit: "batch" },
  { serviceName: "Product Photography", rate: 10000, unit: "session" },
  { serviceName: "Logo & Brand Identity", rate: 15000, unit: "project" },
  { serviceName: "WordPress Website (Basic)", rate: 25000, unit: "project" },
  { serviceName: "E-commerce Website", rate: 45000, unit: "project" },
  { serviceName: "Meta Ads Management", rate: 10000, unit: "month" },
  { serviceName: "Video Production (60 Sec)", rate: 18000, unit: "video" },
  { serviceName: "Political Branding Package", rate: 75000, unit: "campaign" },
];

export const quotations: Quotation[] = [];
