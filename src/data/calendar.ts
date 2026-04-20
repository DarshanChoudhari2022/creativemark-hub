export type EventType = "shoot" | "meeting" | "internal";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD for sorting
  time: string;
  type: EventType;
  clientId?: string;
  employeeId?: string;
}

export const calendarEvents: CalendarEvent[] = [
  { id: "EV-1", title: "Reel shoot — Adv. Rajesh Kumar", date: "2026-04-20", time: "10:00", type: "shoot", clientId: "C-001", employeeId: "E-001" },
  { id: "EV-2", title: "MLA Priya — Event coverage", date: "2026-04-20", time: "09:30", type: "shoot", clientId: "C-004", employeeId: "E-003" },
  { id: "EV-3", title: "Client review — Vastra Couture", date: "2026-04-22", time: "14:00", type: "meeting", clientId: "C-002" },
  { id: "EV-4", title: "Team standup", date: "2026-04-21", time: "11:00", type: "internal" },
  { id: "EV-5", title: "Speedway showroom shoot", date: "2026-04-28", time: "10:30", type: "shoot", clientId: "C-003", employeeId: "E-001" },
  { id: "EV-6", title: "Strategy — Patil Industries", date: "2026-04-23", time: "15:00", type: "meeting", clientId: "C-001" },
  { id: "EV-7", title: "Internal review", date: "2026-04-24", time: "16:00", type: "internal" },
  { id: "EV-8", title: "Reel shoot — Urban Threads", date: "2026-04-25", time: "11:00", type: "shoot", clientId: "C-005", employeeId: "E-001" },
  { id: "EV-9", title: "MLA Priya — Rally", date: "2026-04-26", time: "08:00", type: "shoot", clientId: "C-004", employeeId: "E-004" },
];
