import type { Quotation } from "@/types";

export const DEFAULT_TERMS = `1. Payment is due within 15 days of invoice date.
2. 50% advance required before work commencement.
3. Delay beyond 30 days will attract interest at 2% per month.
4. Cancellation after work commencement will not be refunded.
5. All creative assets remain property of CreativeMark until full payment is received.
6. Non-payment beyond 60 days may result in suspension of services and legal action under applicable Indian law.
7. Disputes subject to jurisdiction of Pune courts.
8. This quotation is valid for 30 days from date of issue.`;

export const SERVICE_PRESETS = [
  "Social Media Management",
  "Reel Production (per piece)",
  "Photography (per day)",
  "Graphic Design (monthly)",
  "Videography",
  "Banner Design",
  "Political Campaign Package",
  "Full Service Retainer",
  "Custom",
];

export const quotations: Quotation[] = [
  {
    id: "Q-001", quoteNumber: "CM-Q-2026-001", type: "Quotation",
    clientName: "Vastra Couture", clientId: "C-003",
    clientAddress: "12, Lane 6, Koregaon Park, Pune 411001",
    clientPhone: "+91 88001 23456", clientEmail: "hello@vastracouture.com",
    clientGst: "27AABCV5678G1ZQ",
    date: "2026-04-10", validUntil: "2026-05-10",
    items: [
      { id: "QI-001", serviceName: "E-commerce Product Photography (200 products)", quantity: 1, unit: "lot", rate: 150000, amount: 150000 },
      { id: "QI-002", serviceName: "Social Media Management — 3 months", quantity: 3, unit: "month", rate: 45000, amount: 135000 },
      { id: "QI-003", serviceName: "Influencer Collaboration", quantity: 3, unit: "influencer", rate: 25000, amount: 75000 },
    ],
    subtotal: 360000, discountPercent: 0, discountAmount: 0, discountType: "percent",
    gstApplicable: true, gstRate: 18, cgst: 32400, sgst: 32400, gstAmount: 64800,
    grandTotal: 424800,
    status: "Approved",
    terms: DEFAULT_TERMS,
    notes: "Summer collection shoot + 3-month social media package",
    createdAt: "2026-04-10",
  },
  {
    id: "Q-002", quoteNumber: "CM-Q-2026-002", type: "Quotation",
    clientName: "Gowda Motors", leadId: "L-003",
    clientAddress: "Pimpri-Chinchwad, Pune",
    clientPhone: "+91 99003 33333", clientEmail: "mahesh@gowdamotors.com",
    date: "2026-04-17", validUntil: "2026-05-17",
    items: [
      { id: "QI-004", serviceName: "Digital Marketing Setup + 6-month management", quantity: 6, unit: "month", rate: 40000, amount: 240000 },
      { id: "QI-005", serviceName: "Showroom Photography", quantity: 1, unit: "day", rate: 80000, amount: 80000 },
      { id: "QI-006", serviceName: "Banner Design & Printing", quantity: 10, unit: "banner", rate: 8000, amount: 80000 },
    ],
    subtotal: 400000, discountPercent: 10, discountAmount: 40000, discountType: "percent",
    gstApplicable: true, gstRate: 18, cgst: 32400, sgst: 32400, gstAmount: 64800,
    grandTotal: 424800,
    status: "Sent",
    terms: DEFAULT_TERMS,
    notes: "Includes Google Ads setup, social media, and outdoor banners. 10% discount applied.",
    sentVia: "Email",
    createdAt: "2026-04-17",
  },
  {
    id: "Q-003", quoteNumber: "CM-Q-2026-003", type: "Quotation",
    clientName: "MLA Priya Deshmukh", clientId: "C-001",
    clientAddress: "Ward Office, Yerawada, Pune 411006",
    clientPhone: "+91 98765 00001", clientEmail: "priya.deshmukh@email.com",
    date: "2026-04-05", validUntil: "2026-05-05",
    items: [
      { id: "QI-007", serviceName: "Campaign Management — April", quantity: 1, unit: "month", rate: 75000, amount: 75000 },
      { id: "QI-008", serviceName: "Rally Event Coverage (Photography + Videography)", quantity: 1, unit: "event", rate: 50000, amount: 50000 },
      { id: "QI-009", serviceName: "Social Media — 30 posts + 4 reels", quantity: 1, unit: "month", rate: 60000, amount: 60000 },
    ],
    subtotal: 185000, discountPercent: 0, discountAmount: 0, discountType: "percent",
    gstApplicable: false, gstRate: 0, cgst: 0, sgst: 0, gstAmount: 0,
    grandTotal: 185000,
    status: "Converted to Bill",
    terms: DEFAULT_TERMS,
    notes: "April campaign package. No GST — political client.",
    createdAt: "2026-04-05",
  },
  {
    id: "Q-004", quoteNumber: "CM-Q-2026-004", type: "Quotation",
    clientName: "Green Earth NGO", clientId: "C-004",
    clientAddress: "FC Road, Deccan Gymkhana, Pune 411004",
    clientPhone: "+91 99876 11111", clientEmail: "info@greenearthngo.org",
    date: "2026-04-18", validUntil: "2026-05-18",
    items: [
      { id: "QI-010", serviceName: "Earth Day Campaign Video Production", quantity: 1, unit: "video", rate: 120000, amount: 120000 },
      { id: "QI-011", serviceName: "Social Media Promotion — 2 weeks", quantity: 1, unit: "lot", rate: 30000, amount: 30000 },
    ],
    subtotal: 150000, discountPercent: 0, discountAmount: 0, discountType: "percent",
    gstApplicable: false, gstRate: 0, cgst: 0, sgst: 0, gstAmount: 0,
    grandTotal: 150000,
    status: "Draft",
    terms: DEFAULT_TERMS,
    notes: "Pro-bono discount applied. Earth Day 2026 special.",
    createdAt: "2026-04-18",
  },
  {
    id: "Q-005", quoteNumber: "CM-B-2026-015", type: "Bill",
    clientName: "MLA Priya Deshmukh", clientId: "C-001",
    clientAddress: "Ward Office, Yerawada, Pune 411006",
    clientPhone: "+91 98765 00001", clientEmail: "priya.deshmukh@email.com",
    date: "2026-04-01", dueDate: "2026-04-15",
    items: [
      { id: "QI-012", serviceName: "Monthly Retainer — April 2026", quantity: 1, unit: "month", rate: 75000, amount: 75000 },
    ],
    subtotal: 75000, discountPercent: 0, discountAmount: 0, discountType: "percent",
    gstApplicable: false, gstRate: 0, cgst: 0, sgst: 0, gstAmount: 0,
    grandTotal: 75000,
    status: "Paid",
    terms: DEFAULT_TERMS,
    createdAt: "2026-04-01",
  },
  {
    id: "Q-006", quoteNumber: "CM-B-2026-012", type: "Bill",
    clientName: "Adv. Rajesh Kumar", clientId: "C-002",
    clientAddress: "15, Sasane Nagar, Hadapsar, Pune 411028",
    clientPhone: "+91 97654 32100", clientEmail: "rajesh.kumar.adv@email.com",
    clientGst: "27AABCR1234F1ZP",
    date: "2026-03-01", dueDate: "2026-03-15",
    items: [
      { id: "QI-013", serviceName: "Social Media + Reel Production — Q1", quantity: 3, unit: "month", rate: 50000, amount: 150000 },
      { id: "QI-014", serviceName: "Branding Collateral", quantity: 1, unit: "lot", rate: 25000, amount: 25000 },
    ],
    subtotal: 175000, discountPercent: 0, discountAmount: 0, discountType: "percent",
    gstApplicable: false, gstRate: 0, cgst: 0, sgst: 0, gstAmount: 0,
    grandTotal: 175000,
    status: "Overdue",
    terms: DEFAULT_TERMS,
    createdAt: "2026-03-01",
  },
];
