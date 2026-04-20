import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Quotation, quotationTerms } from "@/data/quotations";
import { Partner } from "@/data/partners";
import { formatINR, formatDateDDMMYYYY } from "@/lib/format";

const RED: [number, number, number] = [232, 25, 44];
const BLACK: [number, number, number] = [26, 26, 26];
const GRAY: [number, number, number] = [120, 120, 120];

function letterhead(doc: jsPDF, title: string) {
  // Red header bar
  doc.setFillColor(...RED);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("CREATIVE MARK", 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Advertising  |  Digital Marketing  |  Branding  |  Multimedia", 14, 19);

  // Right side title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, doc.internal.pageSize.getWidth() - 14, 17, { align: "right" });

  // Footer line
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(14, ph - 18, doc.internal.pageSize.getWidth() - 14, ph - 18);
  doc.setTextColor(...GRAY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("CreativeMark Advertising  •  Mumbai, Maharashtra, India  •  hello@creativemarkadvertising.com  •  +91 99999 00000", 14, ph - 12);
  doc.text("www.creativemarkadvertising.com", doc.internal.pageSize.getWidth() - 14, ph - 12, { align: "right" });
}

export function downloadQuotationPDF(q: Quotation, kind: "Quotation" | "Bill" = "Quotation") {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  letterhead(doc, kind.toUpperCase());

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${kind} No: ${q.id}`, 14, 40);
  doc.text(`Date: ${q.date}`, doc.internal.pageSize.getWidth() - 14, 40, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text("BILL TO", 14, 50);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(q.clientName, 14, 56);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Client ID: ${q.clientId}   •   Validity: ${q.validity}`, 14, 61);

  const subtotal = q.items.reduce((s, i) => s + i.qty * i.rate, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  autoTable(doc, {
    startY: 70,
    head: [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]],
    body: q.items.map((it, idx) => [
      String(idx + 1),
      it.description,
      String(it.qty),
      it.rate.toLocaleString("en-IN"),
      (it.qty * it.rate).toLocaleString("en-IN"),
    ]),
    headStyles: { fillColor: RED, textColor: 255, fontStyle: "bold" },
    bodyStyles: { textColor: BLACK },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 12 },
      2: { halign: "right", cellWidth: 18 },
      3: { halign: "right", cellWidth: 30 },
      4: { halign: "right", cellWidth: 35 },
    },
    margin: { left: 14, right: 14 },
  });

  // @ts-expect-error autoTable adds lastAutoTable
  let y = doc.lastAutoTable.finalY + 8;

  const labelX = doc.internal.pageSize.getWidth() - 70;
  const valX = doc.internal.pageSize.getWidth() - 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal", labelX, y);
  doc.text(`₹ ${subtotal.toLocaleString("en-IN")}`, valX, y, { align: "right" });
  y += 6;
  doc.text("GST @ 18%", labelX, y);
  doc.text(`₹ ${gst.toLocaleString("en-IN")}`, valX, y, { align: "right" });
  y += 7;
  doc.setDrawColor(...RED);
  doc.line(labelX, y - 3, valX, y - 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...RED);
  doc.text("TOTAL", labelX, y + 3);
  doc.text(`₹ ${total.toLocaleString("en-IN")}`, valX, y + 3, { align: "right" });
  y += 14;

  // T&C
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Terms & Conditions", 14, y);
  doc.setDrawColor(...RED);
  doc.line(14, y + 1.5, 60, y + 1.5);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  quotationTerms.forEach((t, i) => {
    const lines = doc.splitTextToSize(`${i + 1}. ${t}`, doc.internal.pageSize.getWidth() - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.5;
  });

  doc.save(`${kind}-${q.id}.pdf`);
}

export function downloadPartnerAgreementPDF(p: Partner) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  letterhead(doc, "PARTNERSHIP AGREEMENT");

  const pw = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("REFERRAL PARTNERSHIP AGREEMENT", pw / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`Effective Date: ${formatDateDDMMYYYY()}   •   Agreement Ref: AG-${p.id}-${Date.now().toString().slice(-5)}`, pw / 2, y, { align: "center" });
  y += 10;

  const section = (title: string) => {
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 14, y);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.line(14, y + 1.5, 14 + doc.getTextWidth(title), y + 1.5);
    y += 6;
    doc.setTextColor(60, 60, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
  };

  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, pw - 28);
    doc.text(lines, 14, y);
    y += lines.length * 4.6 + 3;
  };

  section("1. PARTIES");
  para(`This Agreement is made between CreativeMark Advertising ("Agency"), having its registered office in Mumbai, Maharashtra, India, and ${p.name} ("Partner"), residing at the address on record, contactable at ${p.phone} / ${p.email}.`);

  section("2. SCOPE OF ENGAGEMENT");
  para("The Partner agrees to refer prospective clients to the Agency for advertising, digital marketing, branding, and multimedia services. The Agency retains sole discretion to accept or reject any referred prospect.");

  section("3. COMMISSION STRUCTURE");
  y += 1;
  autoTable(doc, {
    startY: y,
    head: [["Service", "Commission %"]],
    body: p.commissionStructure.map((c) => [c.service, `${c.percent}%`]),
    headStyles: { fillColor: RED, textColor: 255 },
    columnStyles: { 1: { halign: "right", cellWidth: 35 } },
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9 },
  });
  // @ts-expect-error finalY
  y = doc.lastAutoTable.finalY + 5;
  para("Commission is computed on the net deal value (excluding taxes) of each successfully closed engagement that originated from a Partner referral.");

  section("4. PAYMENT TERMS");
  para("Commission shall be paid to the Partner within fifteen (15) business days after the Agency has received full payment from the referred client for the relevant invoice. Payments will be made by bank transfer to the account details provided by the Partner.");

  section("5. CONFIDENTIALITY");
  para("Each party shall keep all non-public information of the other party strictly confidential and shall not disclose such information to any third party without prior written consent, both during the term of this Agreement and for two (2) years thereafter.");

  section("6. TERM & TERMINATION");
  para("This Agreement is effective from the date first written above and shall continue until terminated by either party with thirty (30) days' written notice. Commissions accrued but unpaid as on the termination date shall remain payable.");

  section("7. GOVERNING LAW");
  para("This Agreement shall be governed by the laws of India. Any dispute shall be subject to the exclusive jurisdiction of the courts of Mumbai, Maharashtra.");

  // Signatures
  if (y > 230) { doc.addPage(); letterhead(doc, "PARTNERSHIP AGREEMENT"); y = 40; }
  y += 10;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.3);
  doc.line(20, y, 90, y);
  doc.line(pw - 90, y, pw - 20, y);
  doc.setTextColor(...BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("For CreativeMark Advertising", 20, y + 5);
  doc.text("Partner", pw - 90, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text("Authorised Signatory", 20, y + 10);
  doc.text(p.name, pw - 90, y + 10);

  doc.save(`Agreement-${p.name.replace(/\s+/g, "_")}-${p.id}.pdf`);
}
