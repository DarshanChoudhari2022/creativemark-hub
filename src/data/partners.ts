export interface CommissionRate {
  service: string;
  percent: number;
}

export interface CommissionEntry {
  invoiceNo: string;
  client: string;
  service: string;
  dealValue: number;
  percent: number;
  amount: number;
  status: "Paid" | "Pending";
}

export interface Partner {
  id: string;
  name: string;
  phone: string;
  email: string;
  pan?: string;
  gst?: string;
  bankName?: string;
  bankAccount?: string;
  bankIFSC?: string;
  status: "Active" | "Inactive";
  leadsReferred: number;
  totalCommission: number;
  pendingCommission: number;
  commissionStructure: CommissionRate[];
  referredLeadIds: string[];
  ledger: CommissionEntry[];
}

export const partners: Partner[] = [
  {
    id: "P-01", name: "Anil Verma", phone: "+91 99100 11223", email: "anil.verma@partners.in",
    pan: "ABCPV1234E", gst: "27ABCPV1234E1Z5",
    bankName: "HDFC Bank", bankAccount: "501010101010", bankIFSC: "HDFC0001234",
    status: "Active", leadsReferred: 8, totalCommission: 245000, pendingCommission: 65000,
    commissionStructure: [
      { service: "Campaign Management", percent: 8 },
      { service: "Branding", percent: 10 },
      { service: "Social Media", percent: 7 },
      { service: "Photography", percent: 6 },
    ],
    referredLeadIds: ["L-101", "L-104", "L-107"],
    ledger: [
      { invoiceNo: "INV-2026-0210", client: "Adv. Rajesh Kumar", service: "Campaign Management", dealValue: 450000, percent: 8, amount: 36000, status: "Pending" },
      { invoiceNo: "INV-2026-0198", client: "Speedway Motors", service: "Social Media", dealValue: 280000, percent: 7, amount: 19600, status: "Pending" },
      { invoiceNo: "INV-2026-0182", client: "Vastra Couture", service: "Branding", dealValue: 320000, percent: 10, amount: 32000, status: "Paid" },
    ],
  },
  {
    id: "P-02", name: "Priya Deshmukh", phone: "+91 99200 22334", email: "priya@partners.in",
    pan: "DEFPV5678F",
    bankName: "ICICI Bank", bankAccount: "602020202020", bankIFSC: "ICIC0005678",
    status: "Active", leadsReferred: 5, totalCommission: 180000, pendingCommission: 45000,
    commissionStructure: [
      { service: "Campaign Management", percent: 10 },
      { service: "Branding", percent: 8 },
    ],
    referredLeadIds: ["L-103"],
    ledger: [
      { invoiceNo: "INV-2026-0205", client: "MLA Priya Deshmukh", service: "Campaign Management", dealValue: 600000, percent: 10, amount: 60000, status: "Paid" },
    ],
  },
  {
    id: "P-03", name: "Rohit Khanna", phone: "+91 99300 33445", email: "rohit.k@partners.in",
    status: "Inactive", leadsReferred: 2, totalCommission: 28000, pendingCommission: 0,
    commissionStructure: [
      { service: "Photography", percent: 5 },
    ],
    referredLeadIds: [],
    ledger: [],
  },
];
