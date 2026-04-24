import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation, Partner } from "@/types";

// ── Brand Colors ──────────────────────────────────────────────
const BRAND_RED = { r: 200, g: 16, b: 32 };
const BRAND_BLACK = { r: 26, g: 26, b: 26 };
const BRAND_GRAY = { r: 120, g: 120, b: 120 };

// ── Company Info ──────────────────────────────────────────────
const COMPANY = {
  name: "CreativeMark Advertising",
  tagline: "Advertising | Digital Marketing | Branding | Multimedia",
  phone1: "+91 7447332829",
  phone2: "+91 9890976952",
  email: "creativemarkadvertising@gmail.com",
  website: "https://creativemarkadvertising.com/",
  address: "Pune, Maharashtra, India",
  bankName: "HDFC Bank",
  accountName: "CreativeMark Advertising",
  accountNo: "50100234567890",
  ifsc: "HDFC0000123",
  branch: "Pune Main Branch",
};

// ── Default Partner Agreement Terms ───────────────────────────
export const DEFAULT_PARTNER_TERMS = [
  "1. NATURE OF RELATIONSHIP: This agreement establishes a non-exclusive Referral Partnership. The Partner acts as an independent consultant and not as an employee, legal partner, or representative of CreativeMark Advertising.",
  "2. COMMISSION ELIGIBILITY: Commission is calculated on the 'Net Project Value' (excluding GST, third-party media spends, hardware costs, and outsourced software licenses). Commission is only earned once the client makes the full payment.",
  "3. LEAD VALIDITY: All leads must be registered via the CreativeMark CRM. A lead is valid for 90 days from registration. If no conversion occurs within this window, the lead becomes open for other partners or internal sales.",
  "4. PAYMENT TERMS: Commissions are disbursed within 10-15 working days after CreativeMark Advertising receives the full and final payment from the client. TDS will be deducted as per government norms where applicable.",
  "5. CONFIDENTIALITY: The Partner agrees to maintain absolute confidentiality regarding CreativeMark's internal pricing structures, strategic processes, and proprietary client data.",
  "6. BRAND GUIDELINES: The Partner may represent themselves as an 'Authorized Referral Partner'. Use of the company logo on any external marketing material requires prior written approval from the management.",
  "7. NON-SOLICITATION: During the term of this agreement and for one year thereafter, the Partner shall not directly or indirectly solicit or attempt to hire any employees of CreativeMark Advertising.",
  "8. TERMINATION: Either party may terminate this agreement with a 15-day written notice. Any unethical practices or misrepresentation will lead to immediate termination and forfeiture of all pending commissions.",
  "9. LEGAL JURISDICTION: This agreement is governed by the laws of India. Any disputes arising shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra."
];

// ── Default Professional Terms ────────────────────────────────
export const PROFESSIONAL_TERMS_QUOTATION = [
  "1. VALIDITY: This quotation is valid for 15 days from the date of issue. Prices are subject to change after the validity period or if the project scope is modified.",
  "2. PAYMENT MILESTONES: 50% Advance is required to initiate the project. 30% on completion of major milestones/drafts. 20% Balance before final delivery or deployment.",
  "3. TAXATION: All prices are exclusive of GST (18%) unless specifically mentioned as 'Inclusive'. GST will be added to the final invoice as per statutory requirements.",
  "4. REVISIONS: Two rounds of minor modifications are included in the quoted price. Any major design changes or additions to the scope will be billed separately as per hourly rates.",
  "5. CONTENT PROVISION: The client is responsible for providing all necessary text, images, logos, and specific data required for the project. Delays in content provision will impact the delivery timeline.",
  "6. APPROVALS: Approval of drafts must be provided in writing (Email/WhatsApp). CreativeMark Advertising is not liable for errors missed by the client during the approval process.",
  "7. INTELLECTUAL PROPERTY: Final creative rights and source files are transferred to the client ONLY after the full and final payment is cleared in our bank account.",
];

export const PROFESSIONAL_TERMS_BILL = [
  "1. PAYMENT DUE: This invoice is payable immediately upon receipt. Late payments beyond 7 days may attract a 2% monthly interest on the outstanding balance.",
  "2. DISCREPANCIES: Any discrepancies in this invoice must be reported within 24 hours of receipt. After this period, the invoice will be considered final and accepted.",
  "3. BANK TRANSFERS: Please mention the Invoice Number in the payment remarks. Kindly share the transaction UTR number or screenshot on WhatsApp for faster reconciliation.",
  "4. TDS COMPLIANCE: If TDS is applicable, please ensure it is deducted as per current income tax slabs and provided with the TDS certificate in a timely manner.",
  "5. CANCELLATION: In case of project cancellation after initiation, the advance payment remains non-refundable to cover resource time and initial work completed.",
];

// ── Helpers ───────────────────────────────────────────────────
function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtINR(amount: number | string): string {
  const val = typeof amount === "string" ? parseFloat(amount.replace(/[^\d.]/g, "")) : amount;
  if (isNaN(val)) return "₹ 0.00";
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return "₹ " + formatter.format(val);
}

// ── Load logo as base64 for PDF embedding ─────────────────────
let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  const logoPaths = ["/logo.jpeg", "logo.jpeg", "/logo-full.png", "logo-full.png"];
  
  for (const path of logoPaths) {
    try {
      const resp = await fetch(path);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          cachedLogo = reader.result as string;
          resolve(cachedLogo);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn(`Could not load logo from ${path}`);
    }
  }
  return null;
}

// ── Letterhead ────────────────────────────────────────────────
function addLetterhead(doc: jsPDF, logoBase64: string | null) {
  const pageW = doc.internal.pageSize.getWidth();

  // Decorative Top Accent
  doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.rect(0, 0, pageW, 1.5, "F");

  // Logo
  if (logoBase64) {
    try {
      const props = doc.getImageProperties(logoBase64);
      const imgW = props.width;
      const imgH = props.height;
      const ratio = imgW / imgH;
      
      let finalW = 45;
      let finalH = finalW / ratio;
      
      if (finalH > 18) {
        finalH = 18;
        finalW = finalH * ratio;
      }
      
      const yPos = 6 + (18 - finalH) / 2;
      doc.addImage(logoBase64, props.fileType || "JPEG", 15, yPos, finalW, finalH, undefined, 'FAST');
    } catch (e) {
      doc.addImage(logoBase64, "JPEG", 15, 8, 35, 12, undefined, 'FAST');
    }
  } else {
    doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CreativeMark", 15, 20);
  }

  // Right side: Company details
  const rX = pageW - 15;
  doc.setFontSize(11);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, rX, 12, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text(COMPANY.tagline, rX, 16.5, { align: "right" });
  
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFontSize(8);
  doc.text(`${COMPANY.phone1}  |  ${COMPANY.email}`, rX, 21, { align: "right" });
  
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const displayUrl = COMPANY.website.replace("https://", "").replace(/\/$/, "");
  doc.text(displayUrl, rX, 26, { align: "right" });
  doc.link(rX - doc.getTextWidth(displayUrl), 23, doc.getTextWidth(displayUrl), 5, { url: COMPANY.website });

  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(12, 30, pageW - 12, 30);
}

// ── Footer ────────────────────────────────────────────────────
function addFooter(doc: jsPDF, pageNum: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 28;
  
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(15, footerY, pageW - 15, footerY);

  const centerX = pageW / 2;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("CREATIVEMARK ADVERTISING", centerX, footerY + 7, { align: "center" });

  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setFontSize(9);
  const footerUrl = COMPANY.website.replace("https://", "").replace(/\/$/, "");
  doc.text(footerUrl, centerX, footerY + 12.5, { align: "center" });
  doc.link(centerX - (doc.getTextWidth(footerUrl) / 2), footerY + 9, doc.getTextWidth(footerUrl), 5, { url: COMPANY.website });

  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.setFontSize(7.5);
  doc.text(`${COMPANY.address}  •  ${COMPANY.phone1}  •  ${COMPANY.email}`, centerX, footerY + 17.5, { align: "center" });

  doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.rect(centerX - 20, pageH - 5, 40, 0.5, "F");

  doc.setFontSize(8);
  doc.text(`Page ${pageNum}`, pageW - 15, footerY + 12.5, { align: "right" });
}

// ── Quotation / Bill PDF ──────────────────────────────────────
export async function generateQuotationPDF(q: any) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadLogo();
  addLetterhead(doc, logoBase64);

  const isBill = q.type === "Bill";
  let y = 38;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(isBill ? "TAX INVOICE" : "QUOTATION", 15, y);

  const docNum = q.quoteNumber || q.quote_number || q.number || "";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text(docNum, pageW - 15, y, { align: "right" });
  y += 10;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(12, y - 2, 85, 26, 2, 2, "F");

  doc.setFontSize(7);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("BILL TO", 16, y + 3);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(q.clientName || q.client_name || "Client", 16, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (q.clientPhone || q.client_phone) doc.text(`Phone: ${q.clientPhone || q.client_phone}`, 16, y + 14);
  if (q.clientEmail || q.client_email) doc.text(`Email: ${q.clientEmail || q.client_email}`, 16, y + 19);

  const metaX = 120;
  doc.setFontSize(8);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Date:", metaX, y + 4);
  doc.text(isBill ? "Due Date:" : "Valid Until:", metaX, y + 10);
  doc.text("Status:", metaX, y + 16);

  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(q.date || new Date()), metaX + 25, y + 4);
  doc.text(formatDate(q.dueDate || q.due_date || q.validUntil || q.valid_until || q.date || new Date()), metaX + 25, y + 10);
  doc.text(q.status || "Draft", metaX + 25, y + 16);

  y += 32;

  const items = q.items || q.quotation_items || [];
  autoTable(doc, {
    startY: y,
    head: [["#", "Service & Description", "Qty", "Rate (Rs.)", "Amount (Rs.)"]],
    body: items.map((item: any, i: number) => [
      String(i + 1),
      item.serviceName || item.service_name || item.description || "",
      String(item.quantity || 1),
      fmtINR(item.rate || 0),
      fmtINR(item.amount || 0),
    ]),
    headStyles: { fillColor: [BRAND_RED.r, BRAND_RED.g, BRAND_RED.b], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5, cellPadding: 4 },
    bodyStyles: { fontSize: 8.5, cellPadding: 4, textColor: [BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b] },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 1: { cellWidth: "auto" }, 2: { cellWidth: 16, halign: "center" }, 3: { cellWidth: 32, halign: "right" }, 4: { cellWidth: 32, halign: "right", fontStyle: "bold" } },
    margin: { left: 12, right: 12 },
    tableLineColor: [230, 230, 230],
    tableLineWidth: 0.1,
  });

  y = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = 125;

  doc.setFontSize(9);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Subtotal:", totalsX, y);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(fmtINR(q.subtotal || 0), pageW - 15, y, { align: "right" });
  y += 6;

  if ((q.discountAmount || q.discount_amount || 0) > 0) {
    doc.setTextColor(34, 150, 80);
    doc.text(`Discount (${q.discountPercent || q.discount_percent || 0}%):`, totalsX, y);
    doc.text(`- ${fmtINR(q.discountAmount || q.discount_amount || 0)}`, pageW - 15, y, { align: "right" });
    y += 6;
  }

  if (q.gstApplicable || q.gst_applicable) {
    doc.setFontSize(8);
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text("CGST (9%):", totalsX, y);
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    doc.text(fmtINR(q.cgstAmount || q.cgst || 0), pageW - 15, y, { align: "right" });
    y += 5;
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text("SGST (9%):", totalsX, y);
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    doc.text(fmtINR(q.sgstAmount || q.sgst || 0), pageW - 15, y, { align: "right" });
    y += 6;
  }

  doc.setDrawColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setLineWidth(0.5);
  doc.line(totalsX - 2, y - 2, pageW - 12, y - 2);

  doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.roundedRect(totalsX - 2, y, pageW - totalsX + 2 - 12, 10, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Total Amount:", totalsX + 2, y + 6.5);
  doc.text(fmtINR(q.grandTotal || q.grand_total || q.total || 0), pageW - 15, y + 6.5, { align: "right" });
  y += 18;

  const totalVal = q.grandTotal || q.grand_total || q.total || 0;
  if (totalVal > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text(`Amount in words: ${numberToWords(totalVal)} Rupees Only`, 15, y);
    y += 8;
  }

  if (isBill) {
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(12, y, pageW - 24, 22, 2, 2, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
    doc.text("BANK DETAILS FOR PAYMENT", 16, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    doc.text(`Account Name: ${COMPANY.accountName}`, 16, y + 12);
    doc.text(`Bank: ${COMPANY.bankName}  |  A/C: ${COMPANY.accountNo}  |  IFSC: ${COMPANY.ifsc}`, 16, y + 17);
    y += 28;
  }

  const termsToUse = q.terms ? q.terms.split("\n") : isBill ? PROFESSIONAL_TERMS_BILL : PROFESSIONAL_TERMS_QUOTATION;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text("Terms & Conditions", 15, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  termsToUse.forEach((term: string) => {
    const lines = doc.splitTextToSize(term.trim(), 170);
    doc.text(lines, 15, y);
    y += lines.length * 3.5 + 1;
  });

  y = Math.max(y + 8, 250);
  doc.setFontSize(9);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "bold");
  doc.text(`For ${COMPANY.name}`, pageW - 60, y);
  y += 14;
  doc.setDrawColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.line(pageW - 70, y, pageW - 15, y);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", pageW - 42, y + 4, { align: "center" });

  addFooter(doc, 1);
  doc.save(`${q.quoteNumber || q.quote_number || q.number || "document"}.pdf`);
}

export async function generatePartnerAgreementPDF(partner: Partner) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadLogo();
  addLetterhead(doc, logoBase64);

  let y = 38;

  // ── Title ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("REFERRAL PARTNERSHIP AGREEMENT", pageW / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setLineWidth(0.5);
  doc.line(55, y, pageW - 55, y);
  y += 10;

  // ── Preamble ──
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  const preamble = `This Referral Partnership Agreement ("Agreement") is entered into on ${formatDate(partner.agreementDate || new Date())} between ${COMPANY.name}, having its office at ${COMPANY.address} (hereinafter referred to as "The Company") and ${partner.name}${partner.businessName ? ` (${partner.businessName})` : ''} (hereinafter referred to as "The Partner").`;
  const pLines = doc.splitTextToSize(preamble, 180);
  doc.text(pLines, 15, y);
  y += pLines.length * 4.5 + 8;

  // ── Two-column: Partner Info + Commission ──
  const mid = pageW / 2;

  // Left column - Partner Info
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(12, y - 2, mid - 16, 48, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("PARTNER DETAILS", 16, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  let ly = y + 11;
  doc.text(`Name: ${partner.name}`, 16, ly); ly += 5;
  if (partner.businessName) { doc.text(`Business: ${partner.businessName}`, 16, ly); ly += 5; }
  doc.text(`Category: ${partner.category || "Consultant"}`, 16, ly); ly += 5;
  doc.text(`Phone: ${partner.phone}`, 16, ly); ly += 5;
  doc.text(`Email: ${partner.email || "—"}`, 16, ly); ly += 5;
  if (partner.pan) { doc.text(`PAN: ${partner.pan}`, 16, ly); ly += 5; }

  // Right column - Commission + Banking
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(mid + 2, y - 2, mid - 16, 48, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("COMMISSION STRUCTURE", mid + 6, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  let ry = y + 11;
  const commText = partner.commissionType === "Percentage" ? `${partner.commissionRate}% of Net Project Value` : `${fmtINR(partner.commissionRate || 0)} Flat per Referral`;
  doc.text(`Type: ${partner.commissionType || "Percentage"}`, mid + 6, ry); ry += 5;
  doc.text(`Rate: ${commText}`, mid + 6, ry); ry += 8;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("BANKING DETAILS", mid + 6, ry);
  ry += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  if (partner.bankAccount) {
    doc.text(`A/C Holder: ${partner.accountHolder || partner.name}`, mid + 6, ry); ry += 5;
    doc.text(`Bank: ${partner.bankName || "—"}  |  IFSC: ${partner.ifsc || "—"}`, mid + 6, ry); ry += 5;
    doc.text(`A/C No: ${partner.bankAccount}`, mid + 6, ry);
  } else if (partner.upi) {
    doc.text(`UPI ID: ${partner.upi}`, mid + 6, ry);
  } else {
    doc.text("Not Provided", mid + 6, ry);
  }

  y += 56;

  // ── Terms & Conditions ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("TERMS & CONDITIONS", 15, y);
  y += 2;
  doc.setDrawColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setLineWidth(0.3);
  doc.line(15, y, 65, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);

  const partnerTerms = partner.agreementTerms ? partner.agreementTerms.split('\n').filter((t: string) => t.trim() !== '') : DEFAULT_PARTNER_TERMS;
  let pageNum = 1;
  partnerTerms.forEach((term: string) => {
    const lines = doc.splitTextToSize(term, 178);
    if (y + (lines.length * 3.8) > 260) {
      addFooter(doc, pageNum);
      pageNum++;
      doc.addPage();
      addLetterhead(doc, logoBase64);
      y = 38;
    }
    doc.text(lines, 16, y);
    y += lines.length * 3.8 + 2.5;
  });

  // ── Signature Block ──
  y = Math.max(y + 12, 240);
  if (y > 260) {
    addFooter(doc, pageNum);
    pageNum++;
    doc.addPage();
    addLetterhead(doc, logoBase64);
    y = 50;
  }

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(15, y - 4, pageW - 15, y - 4);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(`For ${COMPANY.name}`, 15, y + 2);
  doc.text(`Partner: ${partner.name}`, 120, y + 2);
  y += 18;
  doc.setDrawColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.line(15, y, 80, y);
  doc.line(120, y, pageW - 15, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", 15, y);
  doc.text("Partner Signature / Acceptance", 120, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text(`Date: ${formatDate(new Date())}`, 15, y);
  doc.text(`Date: _______________`, 120, y);

  addFooter(doc, pageNum);
  doc.save(`PartnerAgreement_${partner.name.replace(/\s+/g, "_")}.pdf`);
}

function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " and " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }
  return convert(Math.round(num));
}

// ── Receipt PDF ──────────────────────────────────────────────
export async function generateReceiptPDF(receipt: {
  clientName: string;
  invoiceNo: string;
  date: string;
  amount: number;
  paymentMode: string;
  chequeNo?: string;
  transactionId?: string;
  notes?: string;
  totalBilled?: number;
  totalPaid?: number;
  balanceDue?: number;
}) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadLogo();
  addLetterhead(doc, logoBase64);

  let y = 38;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text("PAYMENT RECEIPT", pageW / 2, y, { align: "center" });
  y += 4;
  doc.setDrawColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setLineWidth(0.5);
  doc.line(65, y, pageW - 65, y);
  y += 12;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  const details: [string, string][] = [
    ["Receipt Date", formatDate(receipt.date)],
    ["Invoice Reference", receipt.invoiceNo || "\u2014"],
    ["Client Name", receipt.clientName],
    ["Payment Mode", receipt.paymentMode || "Cash"],
  ];
  if (receipt.chequeNo) details.push(["Cheque No.", receipt.chequeNo]);
  if (receipt.transactionId) details.push(["Transaction ID", receipt.transactionId]);

  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text(`${label}:`, 20, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    doc.text(value, 70, y);
    y += 6;
  });
  y += 8;

  doc.setFillColor(248, 248, 248);
  doc.roundedRect(15, y - 2, pageW - 30, 30, 3, 3, "F");
  doc.setDrawColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setLineWidth(0.3);
  doc.roundedRect(15, y - 2, pageW - 30, 30, 3, 3, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Amount Received:", 22, y + 8);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text(fmtINR(receipt.amount), 22, y + 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text(`(${numberToWords(receipt.amount)} Rupees Only)`, 22, y + 26);
  y += 38;

  if (receipt.totalBilled && receipt.totalBilled > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    doc.text("Account Summary", 20, y); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Total Billed: ${fmtINR(receipt.totalBilled)}`, 20, y); y += 5;
    doc.text(`Total Paid: ${fmtINR(receipt.totalPaid || 0)}`, 20, y); y += 5;
    const bal = receipt.balanceDue ?? (receipt.totalBilled - (receipt.totalPaid || 0));
    doc.setFont("helvetica", "bold");
    doc.setTextColor(bal > 0 ? BRAND_RED.r : 0, bal > 0 ? BRAND_RED.g : 128, bal > 0 ? BRAND_RED.b : 0);
    doc.text(`Balance Due: ${fmtINR(bal)}`, 20, y); y += 10;
  }

  if (receipt.notes) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text(`Notes: ${receipt.notes}`, 20, y); y += 8;
  }

  y = Math.max(y + 15, 220);
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, pageW - 15, y); y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(`For ${COMPANY.name}`, 15, y); y += 18;
  doc.setDrawColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.line(15, y, 80, y); y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Authorized Signatory", 15, y); y += 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Thank you for your payment. We value your business!", pageW / 2, y, { align: "center" });
  addFooter(doc, 1);
  doc.save(`Receipt_${receipt.clientName.replace(/\s+/g, "_")}_${receipt.invoiceNo || "payment"}.pdf`);
}
