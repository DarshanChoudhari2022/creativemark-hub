// ═══════════════════════════════════════════════════════════
// CreativeMark CRM — Comprehensive Type Definitions
// Matches full database schema from spec
// ═══════════════════════════════════════════════════════════

// ── Enums / Unions ──────────────────────────────────────────

export type ClientCategory = "Politician" | "Clothing" | "Motors" | "Other";
export type PaymentStatus = "Paid" | "Partial" | "Overdue";
export type ClientStatus = "Active" | "Inactive";
export type PostType = "Reel" | "Graphic" | "Story" | "Video";
export type Platform = "Instagram" | "Facebook" | "YouTube" | "Twitter/X" | "LinkedIn";
export type PostStatus = "Planned" | "Designed" | "Approved" | "Posted";
export type ShootType = "Reel" | "Photo" | "Video";
export type ShootStatus = "Scheduled" | "Completed" | "Cancelled";
export type EmployeeRole =
  | "Reel Shooter"
  | "Graphic Designer"
  | "Photographer"
  | "Videographer"
  | "Video Editor"
  | "Banner Designer"
  | "Social Media Manager"
  | "Content Writer"
  | "Sales Executive"
  | "Campaign Strategist"
  | "Project Manager";
export type EmployeeStatus = "Active" | "On Leave" | "Inactive";
export type ContractType = "Per Assignment" | "Monthly";
export type WorkType =
  | "Reel Shoot"
  | "Video Shoot"
  | "Photography"
  | "Banner Work"
  | "Graphic Design"
  | "Event Coverage"
  | "Office Work"
  | "Other";
export type WorkLogStatus = "Completed" | "Scheduled" | "Cancelled";
export type LeadStage = "New" | "Contacted" | "Quotation Sent" | "Negotiation" | "Converted" | "Lost";
export type LeadHeat = "Hot" | "Warm" | "Cold";
export type LeadSource = "WhatsApp" | "Referral" | "Cold Call" | "Instagram" | "Facebook" | "Walk-in" | "Website" | "Partner" | "Other";
export type ContactMethod = "Call" | "WhatsApp" | "Meeting" | "Email";
export type TaskStatus = "Pending" | "Done";
export type QuotationType = "Quotation" | "Bill";
export type QuotationStatus = "Draft" | "Sent" | "Approved" | "Converted to Bill" | "Paid" | "Overdue" | "Rejected";
export type PaymentMethod = "Cash" | "UPI" | "Bank Transfer" | "Cheque";
export type ReminderType = "whatsapp" | "email";
export type ReminderTemplate = "Friendly" | "Firm" | "Final Notice";
export type PartnerStatus = "Active" | "Inactive";
export type CommissionStatus = "Pending" | "Paid";
export type RecoveryStatus = "Not Due Yet" | "Due Soon" | "Overdue" | "Reminder Sent" | "Partially Paid" | "Paid";

// Calendar event types
export type CalendarEventType = "Shoot" | "Meeting" | "Deadline" | "Holiday" | "Internal";

// ── Client ──────────────────────────────────────────────────

export interface ClientService {
  id: string;
  serviceName: string;
  monthlyRate: number;
  active: boolean;
}

export interface SocialPost {
  id: string;
  clientId: string;
  date: string;
  postType: PostType;
  platform: Platform;
  caption: string;
  designedBy?: string; // employee id
  designedByName?: string;
  clientApproved: boolean;
  posted: boolean;
  status: PostStatus;
  notes?: string;
}

export interface ShootSchedule {
  id: string;
  clientId: string;
  date: string;
  shootType: ShootType;
  location: string;
  reportingTime: string;
  endTime: string;
  assignedEmployees: string[]; // employee ids
  assignedEmployeeNames: string[];
  notes?: string;
  status: ShootStatus;
}

export interface PaymentEntry {
  id: string;
  invoiceNo: string;
  date: string;
  amount: number;
  status: "Paid" | "Pending" | "Overdue";
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export interface Client {
  id: string;
  name: string;
  category: ClientCategory;
  area?: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  address?: string;
  gst?: string;
  pan?: string;
  contractStart: string;
  contractEnd?: string;
  monthlyRetainer: number;
  notes?: string;
  partnerId?: string; // referrer
  partnerName?: string;
  status: ClientStatus;
  services: ClientService[];
  serviceLabels: string[]; // quick display
  totalBilled: number;
  outstanding: number;
  paymentStatus: PaymentStatus;
  assignedEmployees: string[];
  assignedEmployeeNames: string[];
  posts: SocialPost[];
  shoots: ShootSchedule[];
  paymentHistory: PaymentEntry[];
}

// ── Employee ────────────────────────────────────────────────

export interface WorkLog {
  id: string;
  employeeId: string;
  clientId: string;
  clientName: string;
  date: string;
  workType: WorkType;
  reportingTime: string;
  endTime: string;
  location: string;
  agreedAmount: number;
  notes?: string;
  status: WorkLogStatus;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  monthLabel: string;
  totalAssignments: number;
  totalEarned: number;
  amountPaid: number;
  amountPending: number;
  paymentDate?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  phone: string;
  whatsapp: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  aadhar?: string;
  bankAccount?: string;
  ifsc?: string;
  accountHolder?: string;
  bankName?: string;
  upi?: string;
  contractType: ContractType;
  baseRate: number;
  dateJoined: string;
  notes?: string;
  status: EmployeeStatus;
  onFieldToday: boolean;
  assignedClients: string[];
  assignedClientNames: string[];
  workLogs: WorkLog[];
  salaryPayments: SalaryPayment[];
}

// ── Leads ───────────────────────────────────────────────────

export interface CommLog {
  id: string;
  leadId: string;
  datetime: string;
  contactPerson: string; // employee name
  contactPersonId: string;
  method: ContactMethod;
  summary: string;
  actionItems?: string;
  pendingItems?: string;
  nextFollowupDate?: string;
  nextFollowupAssigned?: string;
  nextFollowupAssignedId?: string;
}

export interface LeadTask {
  id: string;
  leadId: string;
  description: string;
  assignedTo: string;
  assignedToId: string;
  dueDate: string;
  status: TaskStatus;
}

export interface LeadReassignment {
  id: string;
  leadId: string;
  fromEmployee: string;
  toEmployee: string;
  reason: string;
  date: string;
}

export interface Lead {
  id: string;
  name: string;
  organization: string;
  category: ClientCategory | "Unknown";
  phone: string;
  whatsapp: string;
  email: string;
  address?: string;
  constituency?: string;
  source: LeadSource;
  referrerName?: string;
  referrerPhone?: string;
  partnerId?: string;
  assignedTo: string; // employee id
  assignedToName: string;
  stage: LeadStage;
  heat: LeadHeat;
  estimatedValue: number;
  servicesInterested: string[];
  dateReceived: string;
  expectedClose?: string;
  lastContactDate: string;
  nextFollowupDate?: string;
  notes?: string;
  commLog: CommLog[];
  tasks: LeadTask[];
  reassignments: LeadReassignment[];
}

// ── Quotations & Bills ──────────────────────────────────────

export interface QuotationItem {
  id: string;
  serviceName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quoteNumber: string;
  type: QuotationType;
  clientId?: string;
  leadId?: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientGst?: string;
  date: string;
  validUntil?: string;
  dueDate?: string;
  items: QuotationItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  discountType: "percent" | "flat";
  gstApplicable: boolean;
  gstRate: number;
  cgst: number;
  sgst: number;
  gstAmount: number;
  grandTotal: number;
  status: QuotationStatus;
  notes?: string;
  terms: string;
  sentVia?: "WhatsApp" | "Email";
  createdAt: string;
}

// ── Recovery ────────────────────────────────────────────────

export interface ReminderLog {
  id: string;
  quotationId: string;
  type: ReminderType;
  templateUsed: ReminderTemplate;
  sentBy?: string;
  sentAt: string;
}

export interface RecoveryNote {
  id: string;
  quotationId: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface Recovery {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNo: string;
  invoiceDate: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string;
  daysOverdue: number;
  contact: string;
  whatsapp: string;
  email: string;
  status: RecoveryStatus;
  lastReminderSent?: string;
  reminderHistory: ReminderLog[];
  notes: RecoveryNote[];
}

// ── Partners ────────────────────────────────────────────────

export interface PartnerCommissionRate {
  id: string;
  serviceName: string;
  defaultPercent: number;
  partnerPercent: number;
  notes?: string;
}

export interface CommissionLedgerEntry {
  id: string;
  partnerId: string;
  date: string;
  clientName: string;
  invoiceNumber: string;
  serviceName: string;
  invoiceAmount: number;
  commissionPercent: number;
  commissionAmount: number;
  status: CommissionStatus;
  paymentDate?: string;
  reference?: string;
  notes?: string;
}

export interface LeadReferred {
  id: string;
  leadName: string;
  dateReferred: string;
  currentStage: LeadStage;
  converted: boolean;
  dealValue: number;
  commission: number;
  status: CommissionStatus;
}

export interface Partner {
  id: string;
  name: string;
  businessName?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address?: string;
  pan?: string;
  bankAccount?: string;
  ifsc?: string;
  accountHolder?: string;
  bankName?: string;
  upi?: string;
  partnerSince: string;
  status: PartnerStatus;
  notes?: string;
  commissionRates: PartnerCommissionRate[];
  totalLeadsReferred: number;
  totalCommissionEarned: number;
  pendingCommission: number;
  leadsReferred: LeadReferred[];
  ledger: CommissionLedgerEntry[];
}

// ── Calendar ────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  start: string; // ISO datetime
  end: string;
  clientId?: string;
  clientName?: string;
  assignedEmployees?: string[];
  assignedEmployeeNames?: string[];
  location?: string;
  notes?: string;
  status: "Scheduled" | "Completed" | "Cancelled";
}

// ── Dashboard KPIs ──────────────────────────────────────────

export interface MonthlyRevenue {
  month: string;
  received: number;
  pending: number;
}

export interface LeadStageStat {
  name: LeadStage;
  value: number;
  color: string;
}

export interface ScheduleItem {
  time: string;
  employee: string;
  client: string;
  workType: string;
  type: CalendarEventType;
}

export interface OverdueItem {
  client: string;
  amount: number;
  daysOverdue: number;
  invoiceNo: string;
}

export interface FollowupItem {
  lead: string;
  company: string;
  date: string;
  assignedTo: string;
}

export interface TopPartnerItem {
  rank: number;
  name: string;
  leadsReferred: number;
  commissionEarned: number;
}

export interface Notification {
  id: number;
  title: string;
  time: string;
  urgent: boolean;
}

// ── Settings ────────────────────────────────────────────────

export interface CompanyProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gst: string;
}

export interface AccessRole {
  role: string;
  description: string;
  permissions: string[];
}

// ── WhatsApp Templates ──────────────────────────────────────

export interface WATemplates {
  friendly: (client: string, invoiceNo: string, amount: string, dueDate: string) => string;
  firm: (client: string, invoiceNo: string, amount: string, date: string) => string;
  finalNotice: (client: string, invoiceNo: string, amount: string, date: string) => string;
  shootShare: (client: string, date: string, startTime: string, endTime: string, shootType: string, teamNames: string) => string;
  workShare: (client: string, employee: string, role: string, date: string, startTime: string, endTime: string, workType: string, phone: string) => string;
  quotationShare: (client: string, quoteNumber: string, total: string, validDate: string) => string;
  partnerAgreement: (partner: string) => string;
}
