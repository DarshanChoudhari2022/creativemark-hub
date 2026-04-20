export type EmployeeRole = "Reel Shooter" | "Graphic Designer" | "Photographer" | "Videographer";

export interface WorkLog {
  date: string;
  clientId: string;
  clientName: string;
  workType: string;
  agreedAmount: number;
  reportingTime: string;
  status: "Completed" | "Scheduled" | "In Progress";
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  contact: string;
  email: string;
  duesCleared: number;
  duesPending: number;
  onFieldToday: boolean;
  workLog: WorkLog[];
}

export const employees: Employee[] = [
  {
    id: "E-001",
    name: "Arjun Mehta",
    role: "Reel Shooter",
    contact: "+91 98111 22233",
    email: "arjun.m@creativemark.in",
    duesCleared: 85000,
    duesPending: 12000,
    onFieldToday: true,
    workLog: [
      { date: "20/04/2026", clientId: "C-001", clientName: "Adv. Rajesh Kumar", workType: "Reel Shoot", agreedAmount: 8000, reportingTime: "10:00 AM", status: "Scheduled" },
      { date: "18/04/2026", clientId: "C-003", clientName: "Speedway Motors", workType: "Reel Shoot", agreedAmount: 9000, reportingTime: "11:00 AM", status: "Completed" },
    ],
  },
  {
    id: "E-002",
    name: "Sneha Iyer",
    role: "Graphic Designer",
    contact: "+91 98222 33344",
    email: "sneha.i@creativemark.in",
    duesCleared: 60000,
    duesPending: 0,
    onFieldToday: false,
    workLog: [
      { date: "19/04/2026", clientId: "C-002", clientName: "Vastra Couture", workType: "Lookbook Layout", agreedAmount: 6500, reportingTime: "Remote", status: "Completed" },
    ],
  },
  {
    id: "E-003",
    name: "Vikram Joshi",
    role: "Photographer",
    contact: "+91 98333 44455",
    email: "vikram.j@creativemark.in",
    duesCleared: 110000,
    duesPending: 22000,
    onFieldToday: true,
    workLog: [
      { date: "20/04/2026", clientId: "C-004", clientName: "MLA Priya Deshmukh", workType: "Event Photography", agreedAmount: 12000, reportingTime: "9:30 AM", status: "In Progress" },
    ],
  },
  {
    id: "E-004",
    name: "Riya Sharma",
    role: "Videographer",
    contact: "+91 98444 55566",
    email: "riya.s@creativemark.in",
    duesCleared: 92000,
    duesPending: 8000,
    onFieldToday: true,
    workLog: [
      { date: "20/04/2026", clientId: "C-001", clientName: "Adv. Rajesh Kumar", workType: "Rally Coverage", agreedAmount: 14000, reportingTime: "10:00 AM", status: "Scheduled" },
    ],
  },
  {
    id: "E-005",
    name: "Karthik Rao",
    role: "Graphic Designer",
    contact: "+91 98555 66677",
    email: "karthik.r@creativemark.in",
    duesCleared: 45000,
    duesPending: 5000,
    onFieldToday: false,
    workLog: [
      { date: "17/04/2026", clientId: "C-006", clientName: "Green Earth NGO", workType: "Brand Identity", agreedAmount: 15000, reportingTime: "Remote", status: "Completed" },
    ],
  },
];
