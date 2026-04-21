import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation } from "@/data/quotations";
import type { Partner } from "@/data/partners";

const BRAND_RED_R = 232, BRAND_RED_G = 25, BRAND_RED_B = 44;

function addLetterhead(doc: jsPDF) {
  // Red header bar
  doc.setFillColor(BRAND_RED_R, BRAND_RED_G, BRAND_RED_B);
  doc.rect(0, 0, 210, 30, "F");

  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("CreativeMark", 15, 16);

  // Tagline
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Advertising | Digital Marketing | Branding | Multimedia", 15, 23);

  // Contact info right
  doc.setFontSize(7);
  doc.text("+91 98765 43210 | hello@creativemark.in", 195, 16, { align: "right" });
  doc.text("301, Baner Road, Pune — 411045", 195, 21, { align: "right" });

  // Reset color
  doc.setTextColor(26, 26, 26);
  doc.setFont("helvetica", "normal");
}

function addFooter(doc: jsPDF, pageNum: number) {
  const y = 280;
  doc.setDrawColor(200, 200, 200);
  doc.line(15, y, 195, y);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("CreativeMark — www.creativemark.in", 15, y + 5);
  doc.text(`Page ${pageNum}`, 195, y + 5, { align: "right" });
  doc.setTextColor(26, 26, 26);
}

export function generateQuotationPDF(q: Quotation) {
  const doc = new jsPDF();
  addLetterhead(doc);

  let y = 40;

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("QUOTATION", 15, y);
  y += 8;

  // Quotation details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Quotation #: ${q.number}`, 15, y);
  doc.text(`Date: ${formatDate(q.date)}`, 130, y);
  y += 6;
  doc.text(`To: ${q.clientName}`, 15, y);
  doc.text(`Valid Until: ${formatDate(q.validUntil)}`, 130, y);
  y += 10;

  // Line items table
  autoTable(doc, {
    startY: y,
    head: [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]],
    body: q.items.map((item, i) => [
      String(i + 1),
      item.description,
      String(item.quantity),
      item.rate.toLocaleString("en-IN"),
      item.amount.toLocaleString("en-IN"),
    ]),
    headStyles: {
      fillColor: [BRAND_RED_R, BRAND_RED_G, BRAND_RED_B],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
    margin: { left: 15, right: 15 },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Totals
  const totalsX = 130;
  doc.setFontSize(10);
  doc.text("Subtotal:", totalsX, y);
  doc.text(`₹${q.subtotal.toLocaleString("en-IN")}`, 195, y, { align: "right" });
  y += 6;

  if (q.gstRate > 0) {
    doc.text(`GST (${q.gstRate}%):`, totalsX, y);
    doc.text(`₹${q.gstAmount.toLocaleString("en-IN")}`, 195, y, { align: "right" });
    y += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(BRAND_RED_R, BRAND_RED_G, BRAND_RED_B);
  doc.text("Total:", totalsX, y);
  doc.text(`₹${q.total.toLocaleString("en-IN")}`, 195, y, { align: "right" });
  doc.setTextColor(26, 26, 26);
  y += 12;

  // Terms
  if (q.terms) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Terms & Conditions", 15, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(q.terms, 170);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 8;
  }

  // Bank details
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Bank Details", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("Account: CreativeMark Pvt Ltd | Bank: HDFC Bank, Baner | A/C: 50100123456789 | IFSC: HDFC0001234", 15, y);

  addFooter(doc, 1);
  doc.save(`${q.number}.pdf`);
}

export function generatePartnerAgreementPDF(partner: Partner) {
  const doc = new jsPDF();
  addLetterhead(doc);

  let y = 40;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PARTNERSHIP AGREEMENT", 15, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(partner.agreementDate)}`, 15, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Partner Details", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${partner.name}`, 15, y); y += 5;
  doc.text(`Category: ${partner.category}`, 15, y); y += 5;
  doc.text(`Phone: ${partner.phone}`, 15, y); y += 5;
  doc.text(`Email: ${partner.email}`, 15, y); y += 10;

  doc.setFont("helvetica", "bold");
  doc.text("Commission Structure", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  if (partner.commissionType === "Percentage") {
    doc.text(`Type: Percentage — ${partner.commissionRate}% of project value`, 15, y);
  } else {
    doc.text(`Type: Flat Amount — ₹${partner.commissionRate.toLocaleString("en-IN")} per referred lead`, 15, y);
  }
  y += 10;

  // Agreement terms
  doc.setFont("helvetica", "bold");
  doc.text("Terms", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const terms = [
    "1. Commission is payable only after the referred client's invoice is fully paid.",
    "2. Commission is calculated on the net project value (excluding GST).",
    "3. Payment will be processed within 15 working days of client payment.",
    "4. This agreement is valid for 12 months from the date above and is renewable.",
    "5. Either party may terminate with 30 days written notice.",
    "6. All referrals must be communicated in writing (email/WhatsApp) before the first client contact.",
  ];
  terms.forEach(term => {
    const lines = doc.splitTextToSize(term, 170);
    doc.text(lines, 15, y);
    y += lines.length * 4 + 2;
  });

  y += 15;
  doc.setFontSize(10);
  doc.text("For CreativeMark", 15, y);
  doc.text(`Partner: ${partner.name}`, 110, y);
  y += 12;
  doc.setDrawColor(100, 100, 100);
  doc.line(15, y, 80, y);
  doc.line(110, y, 175, y);
  y += 5;
  doc.setFontSize(8);
  doc.text("Authorized Signatory", 15, y);
  doc.text("Partner Signature", 110, y);

  addFooter(doc, 1);
  doc.save(`Agreement-${partner.name.replace(/\s+/g, "-")}.pdf`);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
