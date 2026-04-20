export type QuotationStatus = "Draft" | "Sent" | "Approved" | "Billed";

export interface QuotationItem {
  description: string;
  qty: number;
  rate: number;
}

export interface Quotation {
  id: string;
  clientId: string;
  clientName: string;
  date: string;
  items: QuotationItem[];
  status: QuotationStatus;
  validity: string;
  notes?: string;
}

export const quotations: Quotation[] = [
  {
    id: "QT-2026-0014", clientId: "C-001", clientName: "Adv. Rajesh Kumar", date: "12/04/2026",
    status: "Approved", validity: "30 days",
    items: [
      { description: "Monthly Social Media Management", qty: 3, rate: 35000 },
      { description: "Reel Production (10 reels)", qty: 1, rate: 60000 },
      { description: "Campaign Strategy", qty: 1, rate: 45000 },
    ],
  },
  {
    id: "QT-2026-0015", clientId: "C-002", clientName: "Vastra Couture", date: "14/04/2026",
    status: "Billed", validity: "30 days",
    items: [
      { description: "Lookbook Photography", qty: 1, rate: 120000 },
      { description: "E-commerce Product Shoot", qty: 1, rate: 80000 },
    ],
  },
  {
    id: "QT-2026-0016", clientId: "C-003", clientName: "Speedway Motors", date: "16/04/2026",
    status: "Sent", validity: "15 days",
    items: [
      { description: "Launch Video Production", qty: 1, rate: 180000 },
      { description: "Digital Ad Management (1 month)", qty: 1, rate: 50000 },
    ],
  },
  {
    id: "QT-2026-0017", clientId: "C-005", clientName: "Urban Threads", date: "18/04/2026",
    status: "Draft", validity: "30 days",
    items: [
      { description: "Influencer Campaign", qty: 1, rate: 90000 },
      { description: "Content Calendar (Quarterly)", qty: 1, rate: 60000 },
    ],
  },
];

export const quotationTerms = [
  "50% advance payable on approval, balance 50% on delivery / monthly retainer billing.",
  "All amounts are exclusive of applicable GST @ 18%.",
  "Payment due within 7 days of invoice date. Overdue invoices attract interest @ 1.5% per month.",
  "All creative assets remain the intellectual property of CreativeMark Advertising until full payment is received.",
  "Cancellation after work commencement will be billed pro-rata for time and resources already committed.",
  "Disputes, if any, shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.",
];
