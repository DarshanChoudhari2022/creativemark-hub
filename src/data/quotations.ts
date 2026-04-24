import type { Quotation } from "@/types";

export const DEFAULT_TERMS_QUOTATION = `1. Validity: This quotation is valid for a period of 15 days from the date of issue.
2. Payment Terms: A 50% advance payment is mandatory to initiate the project. The balance 50% is payable upon completion.
3. Scope of Work: The project will be executed strictly as per the requirements mentioned here. Changes will be billed separately.
4. Client Responsibilities: Timely delivery depends on the client providing all necessary content and approvals.
5. Intellectual Property: All creative rights and deliverables remain the property of CreativeMark until the final invoice is paid in full.
6. Revisions: Includes up to two rounds of minor revisions. Major changes will incur extra charges.
7. Statutory Levies: GST (18%) and other government taxes are applied as per the prevailing rates.`;

export const DEFAULT_TERMS_BILL = `1. Payment Due Date: This invoice is payable immediately upon receipt or within 7 days.
2. Late Payment: Payments delayed beyond 15 days will attract a late fee of 2% per month.
3. Disputed Invoices: Any discrepancies must be reported in writing within 48 hours of receipt.
4. Statutory Compliance: GST has been applied based on the service category.
5. Jurisdiction: All legal disputes are subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.
6. Digital Binding: This is a system-generated document and is legally binding without a physical signature.`;

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
