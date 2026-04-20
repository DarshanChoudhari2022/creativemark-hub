export type ClientCategory = "Politician" | "Clothing" | "Motors" | "Other";
export type PaymentStatus = "Paid" | "Partial" | "Overdue";

export interface Client {
  id: string;
  name: string;
  category: ClientCategory;
  services: string[];
  paymentStatus: PaymentStatus;
  contact: string;
  email: string;
  totalBilled: number;
  outstanding: number;
  assignedEmployees: string[];
  posts: { date: string; platform: string; caption: string; status: "Posted" | "Scheduled" }[];
  reelShoots: { date: string; location: string; status: "Done" | "Upcoming" }[];
  socialCalendar: { date: string; activity: string }[];
}

export const clients: Client[] = [
  {
    id: "C-001",
    name: "Adv. Rajesh Kumar",
    category: "Politician",
    services: ["Campaign Management", "Social Media", "Reel Production"],
    paymentStatus: "Partial",
    contact: "+91 98765 43210",
    email: "rajesh.kumar@example.in",
    totalBilled: 450000,
    outstanding: 175000,
    assignedEmployees: ["E-001", "E-003", "E-004"],
    posts: [
      { date: "18/04/2026", platform: "Instagram", caption: "Public rally highlights", status: "Posted" },
      { date: "20/04/2026", platform: "Facebook", caption: "Constituency visit recap", status: "Scheduled" },
    ],
    reelShoots: [
      { date: "15/04/2026", location: "Andheri Office", status: "Done" },
      { date: "25/04/2026", location: "Thane Rally Ground", status: "Upcoming" },
    ],
    socialCalendar: [
      { date: "21/04/2026", activity: "Carousel post — Manifesto" },
      { date: "23/04/2026", activity: "Reel — Door to door" },
    ],
  },
  {
    id: "C-002",
    name: "Vastra Couture",
    category: "Clothing",
    services: ["Branding", "Photography", "E-commerce Shoot"],
    paymentStatus: "Paid",
    contact: "+91 99876 12345",
    email: "hello@vastracouture.in",
    totalBilled: 320000,
    outstanding: 0,
    assignedEmployees: ["E-002", "E-005"],
    posts: [
      { date: "19/04/2026", platform: "Instagram", caption: "Summer collection drop", status: "Posted" },
    ],
    reelShoots: [
      { date: "12/04/2026", location: "Bandra Studio", status: "Done" },
    ],
    socialCalendar: [
      { date: "22/04/2026", activity: "Lookbook reel" },
    ],
  },
  {
    id: "C-003",
    name: "Speedway Motors",
    category: "Motors",
    services: ["Digital Marketing", "Videography"],
    paymentStatus: "Overdue",
    contact: "+91 91234 56789",
    email: "marketing@speedwaymotors.in",
    totalBilled: 280000,
    outstanding: 220000,
    assignedEmployees: ["E-001", "E-004"],
    posts: [
      { date: "10/04/2026", platform: "YouTube", caption: "New SUV launch teaser", status: "Posted" },
    ],
    reelShoots: [
      { date: "28/04/2026", location: "Showroom — Pune", status: "Upcoming" },
    ],
    socialCalendar: [
      { date: "24/04/2026", activity: "Test drive vlog" },
    ],
  },
  {
    id: "C-004",
    name: "MLA Priya Deshmukh",
    category: "Politician",
    services: ["Campaign Management", "Branding"],
    paymentStatus: "Paid",
    contact: "+91 90000 11122",
    email: "office.priya@example.in",
    totalBilled: 600000,
    outstanding: 0,
    assignedEmployees: ["E-003"],
    posts: [],
    reelShoots: [],
    socialCalendar: [],
  },
  {
    id: "C-005",
    name: "Urban Threads",
    category: "Clothing",
    services: ["Social Media", "Influencer Tie-ups"],
    paymentStatus: "Partial",
    contact: "+91 98989 33445",
    email: "team@urbanthreads.in",
    totalBilled: 180000,
    outstanding: 60000,
    assignedEmployees: ["E-002"],
    posts: [],
    reelShoots: [],
    socialCalendar: [],
  },
  {
    id: "C-006",
    name: "Green Earth NGO",
    category: "Other",
    services: ["Branding", "Digital Marketing"],
    paymentStatus: "Overdue",
    contact: "+91 97000 22113",
    email: "contact@greenearth.org",
    totalBilled: 95000,
    outstanding: 95000,
    assignedEmployees: ["E-005"],
    posts: [],
    reelShoots: [],
    socialCalendar: [],
  },
];
