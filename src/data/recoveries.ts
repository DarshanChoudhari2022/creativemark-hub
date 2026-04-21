import type { Recovery, WATemplates } from "@/types";

export const recoveries: Recovery[] = [
  {
    id: "R-001", clientId: "C-004", clientName: "Green Earth NGO",
    invoiceNo: "CM-B-2026-007", invoiceDate: "2026-02-15",
    amountDue: 95000, amountPaid: 0, dueDate: "2026-02-28",
    daysOverdue: 52, contact: "+91 99876 11111", whatsapp: "9987611111",
    email: "info@greenearthngo.org", status: "Overdue",
    lastReminderSent: "2026-04-15",
    reminderHistory: [
      { id: "RL-001", quotationId: "Q-006", type: "whatsapp", templateUsed: "Firm", sentBy: "Neha Kapoor", sentAt: "2026-04-15 10:30" },
      { id: "RL-002", quotationId: "Q-006", type: "email", templateUsed: "Friendly", sentBy: "Neha Kapoor", sentAt: "2026-03-15 14:00" },
      { id: "RL-003", quotationId: "Q-006", type: "whatsapp", templateUsed: "Friendly", sentBy: "Neha Kapoor", sentAt: "2026-03-01 09:00" },
    ],
    notes: [
      { id: "RN-001", quotationId: "Q-006", note: "Spoke with accounts team. Payment expected next week.", createdBy: "Neha Kapoor", createdAt: "2026-04-01 11:00" },
    ],
  },
  {
    id: "R-002", clientId: "C-005", clientName: "Speedway Motors",
    invoiceNo: "CM-B-2026-009", invoiceDate: "2026-03-01",
    amountDue: 220000, amountPaid: 0, dueDate: "2026-03-15",
    daysOverdue: 37, contact: "+91 91234 56789", whatsapp: "9123456789",
    email: "marketing@speedwaymotors.in", status: "Overdue",
    lastReminderSent: "2026-04-18",
    reminderHistory: [
      { id: "RL-004", quotationId: "Q-007", type: "whatsapp", templateUsed: "Firm", sentBy: "Neha Kapoor", sentAt: "2026-04-18 09:30" },
      { id: "RL-005", quotationId: "Q-007", type: "whatsapp", templateUsed: "Friendly", sentBy: "Neha Kapoor", sentAt: "2026-04-10 11:00" },
    ],
    notes: [
      { id: "RN-002", quotationId: "Q-007", note: "Vikrant promised partial payment by next Friday.", createdBy: "Neha Kapoor", createdAt: "2026-04-18 10:00" },
    ],
  },
  {
    id: "R-003", clientId: "C-006", clientName: "Urban Threads",
    invoiceNo: "CM-B-2026-014", invoiceDate: "2026-04-01",
    amountDue: 60000, amountPaid: 0, dueDate: "2026-04-15",
    daysOverdue: 6, contact: "+91 89001 77777", whatsapp: "8900177777",
    email: "team@urbanthreads.in", status: "Due Soon",
    lastReminderSent: "2026-04-18",
    reminderHistory: [
      { id: "RL-006", quotationId: "Q-008", type: "whatsapp", templateUsed: "Friendly", sentBy: "Neha Kapoor", sentAt: "2026-04-18 14:00" },
    ],
    notes: [],
  },
  {
    id: "R-004", clientId: "C-002", clientName: "Adv. Rajesh Kumar",
    invoiceNo: "CM-B-2026-012", invoiceDate: "2026-03-01",
    amountDue: 175000, amountPaid: 0, dueDate: "2026-03-15",
    daysOverdue: 37, contact: "+91 97654 32100", whatsapp: "9765432100",
    email: "rajesh.kumar.adv@email.com", status: "Overdue",
    lastReminderSent: "2026-04-15",
    reminderHistory: [
      { id: "RL-007", quotationId: "Q-009", type: "whatsapp", templateUsed: "Firm", sentBy: "Neha Kapoor", sentAt: "2026-04-15 16:00" },
    ],
    notes: [
      { id: "RN-003", quotationId: "Q-009", note: "Will pay after election rally ends. Says funds are committed.", createdBy: "Neha Kapoor", createdAt: "2026-04-15 16:30" },
    ],
  },
  {
    id: "R-005", clientId: "C-007", clientName: "Bansal Wheels",
    invoiceNo: "CM-B-2026-017", invoiceDate: "2026-04-01",
    amountDue: 45000, amountPaid: 0, dueDate: "2026-04-15",
    daysOverdue: 6, contact: "+91 92345 67890", whatsapp: "9234567890",
    email: "rajiv@bansalwheels.com", status: "Due Soon",
    reminderHistory: [],
    notes: [],
  },
  {
    id: "R-006", clientId: "C-003", clientName: "Vastra Couture",
    invoiceNo: "CM-B-2026-016", invoiceDate: "2026-04-01",
    amountDue: 45000, amountPaid: 45000, dueDate: "2026-04-15",
    daysOverdue: 0, contact: "+91 88001 23456", whatsapp: "8800123456",
    email: "hello@vastracouture.com", status: "Paid",
    reminderHistory: [],
    notes: [],
  },
];

export const WA_TEMPLATES: WATemplates = {
  friendly: (client, invoiceNo, amount, dueDate) =>
    `Dear ${client}, Hope all is well! This is a gentle reminder that Invoice #${invoiceNo} for ₹${amount} from CreativeMark is due on ${dueDate}. Please process at your earliest convenience. Thank you! — CreativeMark Team`,
  firm: (client, invoiceNo, amount, date) =>
    `Dear ${client}, We wish to bring to your attention that Invoice #${invoiceNo} for ₹${amount} issued on ${date} is now overdue. Kindly clear the payment immediately to avoid service disruption. — CreativeMark`,
  finalNotice: (client, invoiceNo, amount, date) =>
    `Dear ${client}, Despite previous reminders, Invoice #${invoiceNo} for ₹${amount} remains unpaid since ${date}. This is our final notice before we proceed with legal/recovery action. Please contact us immediately. — CreativeMark Advertising`,
  shootShare: (client, date, startTime, endTime, shootType, teamNames) =>
    `Dear ${client}, Our team will be at your service on ${date} from ${startTime} to ${endTime} for ${shootType}. Team: ${teamNames}. — CreativeMark`,
  workShare: (client, employee, role, date, startTime, endTime, workType, phone) =>
    `Dear ${client}, This is to confirm that our team member ${employee} (${role}) will be at your service on ${date} from ${startTime} to ${endTime} for ${workType}. For queries: ${phone}. — CreativeMark Team`,
  quotationShare: (client, quoteNumber, total, validDate) =>
    `Dear ${client}, Please find your quotation ${quoteNumber} for ₹${total} from CreativeMark. Valid till ${validDate}. — CreativeMark Team`,
  partnerAgreement: (partner) =>
    `Dear ${partner}, Please find your Partnership Agreement with CreativeMark Advertising. Kindly review, sign, and return a copy. Thank you for partnering with us! — CreativeMark Team`,
};
