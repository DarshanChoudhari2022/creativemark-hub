import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Quotation, Partner } from "@/types";

// ── Brand Colors ──────────────────────────────────────────────
const BRAND_RED = { r: 200, g: 16, b: 32 };
const BRAND_BLACK = { r: 26, g: 26, b: 26 };
const BRAND_GRAY = { r: 120, g: 120, b: 120 };

// ── Company Info ──────────────────────────────────────────────
const COMPANY = {
  name: "CreativeMark",
  tagline: "Advertising | Digital Marketing | Branding | Multimedia",
  phone1: "+91 7447332829",
  phone2: "+91 9890976952",
  email: "creativemarkadvertising@gmail.com",
  website: "https://creativemarkadvertising.com/",
  address: "Pune, Maharashtra, India",
  bankName: "HDFC Bank",
  accountName: "CreativeMark Solutions",
  accountNo: "50100456789123",
  ifsc: "HDFC0001234",
  branch: "Baner, Pune",
};

// ── Default Professional Terms ────────────────────────────────
const PROFESSIONAL_TERMS_QUOTATION = [
  "1. Validity: This quotation is valid for a period of 15 days from the date of issue. Prices may be subject to change thereafter.",
  "2. Payment Terms: A 50% advance payment is mandatory to initiate the project. The remaining 50% balance must be cleared upon project completion or before the final handover of deliverables.",
  "3. Scope of Work: The project will be executed strictly as per the requirements mentioned in this document. Any additional requests or modifications to the original scope will be billed separately at an hourly rate or as a fixed add-on.",
  "4. Client Responsibilities: Timely delivery depends on the client providing all necessary content, approvals, and feedback. Delays in providing materials may result in a revised delivery schedule.",
  "5. Intellectual Property: All creative rights, source files, and final deliverables remain the property of CreativeMark until the final invoice is paid in full. Upon full payment, usage rights are transferred to the client.",
  "6. Revisions: This quotation includes up to two rounds of minor revisions for the specified services. Major design changes or additional rounds will incur extra charges.",
  "7. Project Cancellation: If the project is canceled by the client after commencement, the 50% advance will be non-refundable to cover the initial planning and resource allocation costs.",
  "8. Statutory Levies: GST (18%) and other government taxes are applied as per the prevailing rates and are not included in the basic service rates unless specified.",
  "9. Confidentiality: Both parties agree not to disclose any proprietary information or trade secrets shared during the project duration.",
];

const PROFESSIONAL_TERMS_BILL = [
  "1. Payment Due Date: This invoice is payable immediately upon receipt or within the pre-agreed credit period of 7 days from the invoice date.",
  "2. Late Payment Interest: Payments delayed beyond 15 days will attract a late fee/interest of 2% per month on the outstanding balance, compounded monthly.",
  "3. Disputed Invoices: Any discrepancies or disputes regarding this invoice must be reported in writing within 48 hours of receipt; otherwise, it will be considered accepted as final.",
  "4. Statutory Compliance: GST has been applied based on the service category. TDS, if applicable, should be deducted as per the Income Tax Act and a TDS certificate should be provided.",
  "5. Finality of Service: Once the deliverables are approved and the final files/services are handed over, no further modifications will be made without a new work order.",
  "6. Jurisdiction: All transactions are subject to the laws of India. Any legal disputes arising out of this transaction shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra.",
  "7. Digital Binding: This is a system-generated document based on the approved quotation and work order; it is legally binding and does not require a physical signature.",
];

// ── Helpers ───────────────────────────────────────────────────
function formatDate(date: Date | string) {
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function fmtINR(amount: number | string): string {
  const val = typeof amount === "string" ? parseFloat(amount.replace(/[^\d.]/g, "")) : amount;
  if (isNaN(val)) return "Rs. 0";
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(val).replace("₹", "Rs. ").trim();
}

// ── Load logo as base64 for PDF embedding ─────────────────────
let cachedLogo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  const logoPaths = ["/logo.jpeg", "/logo-full.png", "logo.jpeg"];
  
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
      console.error(`Failed to load logo from ${path}`, e);
    }
  }
  return null;
}

// ── Letterhead ────────────────────────────────────────────────
function addLetterhead(doc: jsPDF, logoBase64: string | null) {
  const pageW = doc.internal.pageSize.getWidth();

  // Decorative Top Accent (Slim Red Bar)
  doc.setFillColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.rect(0, 0, pageW, 2, "F");

  // Logo (if available)
  if (logoBase64) {
    try {
      // Get image properties to maintain aspect ratio
      const props = doc.getImageProperties(logoBase64);
      const ratio = props.width / props.height;
      const maxW = 60;
      const maxH = 18;
      
      let finalW = maxW;
      let finalH = maxW / ratio;
      
      if (finalH > maxH) {
        finalH = maxH;
        finalW = maxH * ratio;
      }
      
      doc.addImage(logoBase64, "JPEG", 12, 6, finalW, finalH, undefined, 'FAST');
    } catch (e) {
      // Fallback if properties fail
      doc.addImage(logoBase64, "JPEG", 12, 6, 60, 15, undefined, 'FAST');
    }
  } else {
    // Fallback text logo (Brand Red)
    doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("CreativeMark", 15, 22);
  }

  // Right side: Company details
  const rX = pageW - 15;
  doc.setFontSize(10);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, rX, 12, { align: "right" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text(COMPANY.tagline, rX, 16.5, { align: "right" });
  
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(`${COMPANY.phone1} | ${COMPANY.email}`, rX, 21, { align: "right" });
  
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.website.replace("https://", ""), rX, 25.5, { align: "right" });
  // Make it clickable
  const webW = doc.getTextWidth(COMPANY.website.replace("https://", ""));
  doc.link(rX - webW, 25.5 - 3, webW, 5, { url: COMPANY.website });

  // Divider Line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(12, 32, pageW - 12, 32);

  // Reset text color for body
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "normal");
}

// ── Footer ────────────────────────────────────────────────────
function addFooter(doc: jsPDF, pageNum: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const y = 285;
  
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(12, y, pageW - 12, y);

  doc.setFontSize(7); // Slightly smaller to prevent overlap
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  
  // Website on the left
  const footerWebText = COMPANY.website.replace("https://", "").replace(/\/$/, "");
  doc.text(footerWebText, 15, y + 6);
  const fwW = doc.getTextWidth(footerWebText);
  doc.link(15, y + 6 - 3, fwW, 5, { url: COMPANY.website });

  // Middle info: Address / Phone
  doc.text(`${COMPANY.address} | ${COMPANY.phone1}`, pageW / 2, y + 6, { align: "center" });

  // Right side: Email & Page Number
  const rightText = `${COMPANY.email}  |  Page ${pageNum}`;
  doc.text(rightText, pageW - 15, y + 6, { align: "right" });
  
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
}

// ── Quotation / Bill PDF ──────────────────────────────────────
export async function generateQuotationPDF(q: any) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const logoBase64 = await loadLogo();
  addLetterhead(doc, logoBase64);

  const isBill = q.type === "Bill";
  let y = 36;

  // ── Title ─────────────────────────────────────────────────
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(isBill ? "TAX INVOICE" : "QUOTATION", 15, y);

  // ── Document number badge ─────────────────────────────────
  const docNum = q.quoteNumber || q.quote_number || q.number || "";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(BRAND_RED.r, BRAND_RED.g, BRAND_RED.b);
  doc.text(docNum, pageW - 15, y, { align: "right" });
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  y += 10;

  // ── Bill To section ───────────────────────────────────────
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
  if (q.clientPhone || q.client_phone) {
    doc.text(`Phone: ${q.clientPhone || q.client_phone}`, 16, y + 14);
  }
  if (q.clientEmail || q.client_email) {
    doc.text(`Email: ${q.clientEmail || q.client_email}`, 16, y + 19);
  }

  // ── Document Details (right side) ─────────────────────────
  const metaX = 120;
  doc.setFontSize(8);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Date:", metaX, y + 4);
  doc.text(isBill ? "Due Date:" : "Valid Until:", metaX, y + 10);
  doc.text("Status:", metaX, y + 16);

  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.setFont("helvetica", "bold");
  doc.text(formatDate(q.date || new Date()), metaX + 25, y + 4);
  doc.text(
    formatDate(q.dueDate || q.due_date || q.validUntil || q.valid_until || q.date || new Date()),
    metaX + 25, y + 10
  );
  doc.text(q.status || "Draft", metaX + 25, y + 16);
  doc.setFont("helvetica", "normal");

  y += 32;

  // ── Items Table ───────────────────────────────────────────
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
    headStyles: {
      fillColor: [BRAND_RED.r, BRAND_RED.g, BRAND_RED.b],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 4,
      textColor: [BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b],
    },
    alternateRowStyles: { fillColor: [252, 252, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 32, halign: "right" },
      4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 12, right: 12 },
    tableLineColor: [230, 230, 230],
    tableLineWidth: 0.1,
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Totals ────────────────────────────────────────────────
  const totalsX = 125;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  // Subtotal
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  doc.text("Subtotal:", totalsX, y);
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  doc.text(fmtINR(q.subtotal || 0), pageW - 15, y, { align: "right" });
  y += 6;

  // Discount
  if ((q.discountAmount || q.discount_amount || 0) > 0) {
    const dAmt = q.discountAmount || q.discount_amount || 0;
    const dPct = q.discountPercent || q.discount_percent || 0;
    doc.setTextColor(34, 150, 80);
    doc.text(`Discount (${dPct}%):`, totalsX, y);
    doc.text(`- ${fmtINR(dAmt)}`, pageW - 15, y, { align: "right" });
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    y += 6;
  }

  // GST
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

  // Total Amount — highlighted
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
  doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
  y += 18;

  // ── Amount in Words ───────────────────────────────────────
  const totalVal = q.grandTotal || q.grand_total || q.total || 0;
  if (totalVal > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
    doc.text(`Amount in words: ${numberToWords(totalVal)} Rupees Only`, 15, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(BRAND_BLACK.r, BRAND_BLACK.g, BRAND_BLACK.b);
    y += 8;
  }

  // ── Bank Details (for Bill) ───────────────────────────────
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
    doc.text(`Bank: ${COMPANY.bankName}  |  A/C: ${COMPANY.accountNo}  |  IFSC: ${COMPANY.ifsc}  |  Branch: ${COMPANY.branch}`, 16, y + 17);
    y += 28;
  }

  // ── Terms & Conditions ────────────────────────────────────
  const termsToUse = q.terms
    ? q.terms.split("\n")
    : isBill ? PROFESSIONAL_TERMS_BILL : PROFESSIONAL_TERMS_QUOTATION;

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

  // ── Signature ─────────────────────────────────────────────
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

// ── Partner Agreement PDF ─────────────────────────────────────
export async function generatePartnerAgreementPDF(partner: Partner) {
  const doc = new jsPDF();
  const logoBase64 = await loadLogo();
  addLetterhead(doc, logoBase64);

  let y = 36;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PARTNERSHIP AGREEMENT", 15, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(partner.agreementDate || "")}`, 15, y);
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
    doc.text(`Type: Flat Amount — ${fmtINR(partner.commissionRate || 0)} per referred lead`, 15, y);
  }
  y += 10;

  // Agreement terms
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions (Mutual Agreement)", 15, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(BRAND_GRAY.r, BRAND_GRAY.g, BRAND_GRAY.b);
  
  const partnerTerms = [
    "1. Referral & Scope: The Partner agrees to refer potential clients to CreativeMark for services including Digital Marketing, Branding, and Multimedia. A referral is valid only if communicated in writing before the first client contact.",
    "2. Commission Eligibility: Commission is earned only on the 'Net Project Value' (excluding GST and third-party costs like ad-spend). Eligibility arises only after the client has cleared the full invoice amount.",
    "3. Payment Terms: Commissions are processed on a monthly basis. Payouts will be made within 15 working days of the following month, subject to receipt of payment from the referred client.",
    "4. Professional Conduct: The Partner shall represent CreativeMark with integrity. The Partner is not authorized to sign contracts, commit to timelines, or offer discounts on behalf of CreativeMark without written consent.",
    "5. Non-Circumvention: The Partner agrees not to engage or contract directly with any client referred to CreativeMark for a period of 12 months following the referral, regardless of agreement status.",
    "6. Confidentiality: Both parties shall maintain strict confidentiality regarding project pricing, client data, and proprietary business strategies shared during the course of this partnership.",
    "7. Relationship: This agreement does not create an employer-employee relationship. The Partner operates as an independent contractor and is responsible for their own tax liabilities (GST/TDS) as per Indian law.",
    "8. Termination: This agreement is valid for 12 months and renews automatically unless terminated. Either party may terminate this agreement with 30 days written notice via Email or WhatsApp.",
    "9. Jurisdiction: Any disputes arising from this agreement shall be subject to the exclusive jurisdiction of the courts in Pune, Maharashtra."
  ];

  partnerTerms.forEach(term => {
    const lines = doc.splitTextToSize(term, 175);
    if (y + (lines.length * 4) > 275) {
      doc.addPage();
      addLetterhead(doc, logoBase64);
      y = 40;
    }
    doc.text(lines, 15, y);
    y += lines.length * 4 + 2;
  });

  y += 15;
  doc.setFontSize(10);
  doc.text(`For ${COMPANY.name}`, 15, y);
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

// ── Number to Words (Indian system) ───────────────────────────
function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
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
