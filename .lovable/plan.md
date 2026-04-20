
# CreativeMark CRM — UI Build Plan

A complete, polished frontend for the CreativeMark CRM with all 8 modules, mock data, and downloadable PDFs. No backend in this phase.

## Brand & Design System
- **Colors** (HSL tokens in `index.css`): Primary red `#E8192C`, white background, near-black `#1A1A1A` text, light gray `#F2F2F2` borders, status greens/ambers for badges.
- **Typography**: Inter (Google Fonts) — bold weights for headings, regular for body.
- **Components**: Flat, no gradients. Rounded buttons (red CTA / white-with-black-border secondary). Subtle card shadows. Status badges (Paid green, Partial amber, Overdue red).
- **Logo**: Place uploaded logo in `src/assets/` and use in sidebar header + PDF letterheads.

## Layout
- **White sidebar** (collapsible, shadcn `Sidebar` with `collapsible="icon"`): Logo at top, menu items with Lucide icons, active item highlighted with red pill + red left bar.
- **Top bar**: Current user name + avatar, today's date (DD/MM/YYYY), notification bell with unread dot.
- **Responsive**: Sidebar collapses to icon strip on tablet, off-canvas drawer on mobile.

## Pages (all with realistic mock data)

1. **Dashboard** (Owner view) — 4 KPI cards (Total Clients, Active Leads, Pending Payments ₹, Employees On Field Today), monthly revenue bar chart + lead-conversion pie (Recharts), "Today's Schedule" feed on right.

2. **Clients** — Toggle table/card view. Cards show name, category chip (Politician/Clothing/Motors/Other), services, payment-status badge. "+ Add Client" red CTA opens dialog. Detail page tabs: Services, Social Media Calendar, Posts, Reel Shoot Schedule, Assigned Employees.

3. **Employees** — List of contract employees with role badges. Profile page: monthly work-calendar grid, dues cleared/pending summary, date-wise work log table (client, work type, agreed ₹, reporting time, "Share with Client" button that opens a WhatsApp-style share dialog).

4. **Leads** — Drag-and-drop Kanban with 5 columns (New → Contacted → Quotation Sent → Negotiation → Converted/Lost). Click card opens right-side drawer with communication log, action items, reassign dropdown.

5. **Quotations & Bills** — Table of quotations with status badges. "Generate Quotation" opens a builder (client, line items, totals, T&C). Preview screen renders professional letterhead (red header bar, logo, itemized table, T&C with legal payment clause) and exports a real **downloadable PDF** via jsPDF + autotable. "Convert to Bill" duplicates with bill numbering.

6. **Recovery** — Top summary card: total outstanding in large red text. Table with Days Overdue auto-highlighted red if >30. Per-row actions: Send WhatsApp (opens wa.me link), Send Email (mailto), Mark as Received (updates local state).

7. **Calendar** — Monthly + weekly views (custom grid, no heavy library). Color-coded dots: red shoots, black meetings, gray internal. Filter dropdowns by Employee and Client.

8. **Partners** — Cards: name, phone, leads referred, total commission, pending commission (red), Active/Inactive badge. "+ Add Partner" red CTA. Detail page: profile (incl. PAN/GST, bank details), editable commission-structure table per service, referred leads list, commission ledger table, "Generate Agreement" red button that produces a **downloadable legal PDF** (CreativeMark letterhead, red section headers, both-party signature blocks), "Share Agreement" (WhatsApp + Email).

## Mock Data & State
- Centralized mock data in `src/data/` (clients, employees, leads, partners, quotations, calendar events, KPIs).
- Local React state + `useState`/`useReducer` for interactions (drag leads, mark received, edit commissions). No persistence.

## PDF Generation
- `jspdf` + `jspdf-autotable` for client-side PDF download of Quotations, Bills, and Partner Agreements with branded letterhead.

## Out of Scope (this phase)
- Auth, real database, email/WhatsApp sending, file uploads, multi-user roles. Easy to add later via Lovable Cloud.
