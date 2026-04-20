export interface Recovery {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNo: string;
  amountDue: number;
  dueDate: string;
  daysOverdue: number;
  lastReminder: string;
  contact: string;
  email: string;
  received?: boolean;
}

export const recoveries: Recovery[] = [
  { id: "R-1", clientId: "C-001", clientName: "Adv. Rajesh Kumar", invoiceNo: "INV-2026-0210", amountDue: 175000, dueDate: "10/04/2026", daysOverdue: 10, lastReminder: "18/04/2026", contact: "+91 98765 43210", email: "rajesh.kumar@example.in" },
  { id: "R-2", clientId: "C-003", clientName: "Speedway Motors", invoiceNo: "INV-2026-0198", amountDue: 220000, dueDate: "01/03/2026", daysOverdue: 50, lastReminder: "15/04/2026", contact: "+91 91234 56789", email: "marketing@speedwaymotors.in" },
  { id: "R-3", clientId: "C-005", clientName: "Urban Threads", invoiceNo: "INV-2026-0221", amountDue: 60000, dueDate: "05/04/2026", daysOverdue: 15, lastReminder: "—", contact: "+91 98989 33445", email: "team@urbanthreads.in" },
  { id: "R-4", clientId: "C-006", clientName: "Green Earth NGO", invoiceNo: "INV-2026-0175", amountDue: 95000, dueDate: "20/02/2026", daysOverdue: 60, lastReminder: "12/04/2026", contact: "+91 97000 22113", email: "contact@greenearth.org" },
];
