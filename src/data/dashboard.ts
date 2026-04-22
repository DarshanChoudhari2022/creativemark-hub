import { clients } from "./clients";
import { employees } from "./employees";
import { leads } from "./leads";
import { recoveries } from "./recoveries";
import { partners } from "./partners";
import { calendarEvents } from "./calendar";

export const revenueData: any[] = [];
export const kpiCards: any[] = [
  { title: "Total Revenue", value: 0, format: "currency" as const, change: "0%", up: true },
  { title: "Outstanding", value: 0, format: "currency" as const, change: "0%", up: false },
  { title: "Active Clients", value: 0, format: "number" as const },
  { title: "Active Leads", value: 0, format: "number" as const },
  { title: "Overdue Invoices", value: 0, format: "number" as const },
  { title: "Partner Leads", value: 0, format: "number" as const },
];
export const leadsByStage: any[] = [];
export const todaySchedule: any[] = [];
export const upcomingEvents: any[] = [];
export const overduePayments: any[] = [];
export const followUpsDue: any[] = [];
export const partnerPerformance: any[] = [];
export const employeesOnField: any[] = [];
export const notifications: any[] = [];
