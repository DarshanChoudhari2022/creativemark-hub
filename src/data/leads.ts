export type LeadStage = "New" | "Contacted" | "Quotation Sent" | "Negotiation" | "Converted" | "Lost";

export interface Lead {
  id: string;
  name: string;
  company: string;
  referrer: string;
  salesperson: string;
  nextCallDate: string;
  lastAction: string;
  stage: LeadStage;
  value: number;
  contact: string;
  email: string;
  communicationLog: { date: string; type: "Call" | "Email" | "Meeting" | "WhatsApp"; note: string }[];
  actionItems: { task: string; due: string; done: boolean }[];
}

export const leads: Lead[] = [
  {
    id: "L-101", name: "Suresh Patil", company: "Patil Industries", referrer: "Anil Verma",
    salesperson: "Neha Kapoor", nextCallDate: "21/04/2026", lastAction: "Intro call done",
    stage: "New", value: 150000, contact: "+91 90011 22334", email: "suresh@patil.in",
    communicationLog: [{ date: "19/04/2026", type: "Call", note: "First introduction, interested in branding" }],
    actionItems: [{ task: "Send service brochure", due: "21/04/2026", done: false }],
  },
  {
    id: "L-102", name: "Geeta Naik", company: "Naik Sarees", referrer: "Walk-in",
    salesperson: "Rohan Das", nextCallDate: "22/04/2026", lastAction: "Sent intro deck",
    stage: "Contacted", value: 85000, contact: "+91 90022 33445", email: "geeta@naiksarees.in",
    communicationLog: [
      { date: "17/04/2026", type: "WhatsApp", note: "Shared agency portfolio" },
      { date: "19/04/2026", type: "Email", note: "Sent service catalogue" },
    ],
    actionItems: [{ task: "Follow up on deck", due: "22/04/2026", done: false }],
  },
  {
    id: "L-103", name: "Mahesh Gowda", company: "Gowda Motors", referrer: "Priya Deshmukh",
    salesperson: "Neha Kapoor", nextCallDate: "23/04/2026", lastAction: "Quotation emailed",
    stage: "Quotation Sent", value: 320000, contact: "+91 90033 44556", email: "m.gowda@gowdamotors.in",
    communicationLog: [{ date: "18/04/2026", type: "Meeting", note: "Discussed annual retainer" }],
    actionItems: [{ task: "Confirm quotation receipt", due: "21/04/2026", done: true }],
  },
  {
    id: "L-104", name: "Divya Reddy", company: "Reddy Boutique", referrer: "Anil Verma",
    salesperson: "Rohan Das", nextCallDate: "24/04/2026", lastAction: "Negotiating scope",
    stage: "Negotiation", value: 210000, contact: "+91 90044 55667", email: "divya@reddyboutique.in",
    communicationLog: [{ date: "20/04/2026", type: "Call", note: "Wants 10% off, discussing scope cut" }],
    actionItems: [{ task: "Revised quotation", due: "22/04/2026", done: false }],
  },
  {
    id: "L-105", name: "Hon. Ravi Shinde", company: "Shinde Foundation", referrer: "Direct",
    salesperson: "Neha Kapoor", nextCallDate: "—", lastAction: "Onboarded",
    stage: "Converted", value: 480000, contact: "+91 90055 66778", email: "office@shindefoundation.in",
    communicationLog: [{ date: "15/04/2026", type: "Meeting", note: "Signed retainer agreement" }],
    actionItems: [],
  },
  {
    id: "L-106", name: "Ankit Bansal", company: "Bansal Wheels", referrer: "Walk-in",
    salesperson: "Rohan Das", nextCallDate: "—", lastAction: "Went with competitor",
    stage: "Lost", value: 120000, contact: "+91 90066 77889", email: "ankit@bansalwheels.in",
    communicationLog: [{ date: "16/04/2026", type: "Email", note: "Declined our proposal" }],
    actionItems: [],
  },
  {
    id: "L-107", name: "Farhan Sheikh", company: "Sheikh Garments", referrer: "Anil Verma",
    salesperson: "Neha Kapoor", nextCallDate: "21/04/2026", lastAction: "Awaiting reply",
    stage: "Quotation Sent", value: 95000, contact: "+91 90077 88990", email: "farhan@sheikhgarments.in",
    communicationLog: [{ date: "19/04/2026", type: "Email", note: "Quotation sent" }],
    actionItems: [{ task: "Reminder call", due: "21/04/2026", done: false }],
  },
];
