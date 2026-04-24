/**
 * Centralized WhatsApp Message Templates for Leads, Recoveries, and General Communication
 */

export const WHATSAPP_TEMPLATES = {
  // Lead Related
  LEAD_GENERAL: (name: string) => 
    `*Hi ${name}*,\n\nGreetings from *CreativeMark*! 🎨\n\nThank you for reaching out to us. We'd love to help you with your branding and creative needs. How can we assist you today?\n\nBest regards,\nTeam CreativeMark`,
  
  LEAD_FOLLOWUP: (name: string, requirement: string) => 
    `*Hi ${name}*,\n\nFollowing up on our discussion regarding *${requirement}*. \n\nDo you have any updates for us? We're excited to get started on this project! 🚀\n\nBest regards,\nTeam CreativeMark`,
  
  LEAD_QUOTE_SENT: (name: string, amount: string) => 
    `*Hi ${name}*,\n\nWe have shared the formal quotation for your requirement (Estimated: *${amount}*). \n\nPlease review the attached document and let us know if you'd like to proceed or if any adjustments are needed. 📄\n\nBest regards,\nTeam CreativeMark`,

  // Billing & Quotations
  BILL_SENT: (name: string, invoice: string, amount: string) =>
    `*Hi ${name}*,\n\nYour invoice *${invoice}* for *${amount}* has been generated. \n\nYou can view and download it using the link below:\n[Link]\n\nPlease let us know once the payment is processed. Thank you! 🙏\n\nBest regards,\nTeam CreativeMark`,

  PAYMENT_RECEIVED: (name: string, invoice: string, amount: string) =>
    `*Hi ${name}*!\n\nWe have successfully received your payment of *${amount}* for invoice *${invoice}*. 🧾\n\nThank you for choosing CreativeMark. We value our partnership! \n\nBest regards,\nTeam CreativeMark`,

  PARTIAL_PAYMENT_RECEIVED: (name: string, invoice: string, amountReceived: string, totalBilled: string, totalPaid: string, balanceDue: string) =>
    `*Hi ${name}*,\n\nThank you! We have received your partial payment of *${amountReceived}* for invoice *${invoice}*. ✅\n\n📋 *Payment Summary:*\n• Total Invoice Amount: *${totalBilled}*\n• Total Paid: *${totalPaid}*\n• *Outstanding Balance: ${balanceDue}*\n\nKindly arrange for the remaining payment at your earliest convenience. We appreciate your prompt attention! 🙏\n\nBest regards,\nTeam CreativeMark`,

  OUTSTANDING_REMINDER: (name: string, invoice: string, totalBilled: string, totalPaid: string, balanceDue: string) =>
    `*Hi ${name}*,\n\nThis is a friendly reminder regarding your outstanding balance:\n\n📋 *Invoice:* ${invoice}\n• Total Amount: *${totalBilled}*\n• Paid: *${totalPaid}*\n• *Balance Due: ${balanceDue}*\n\nPlease arrange the remaining payment at your earliest convenience. Feel free to reach out if you have any questions. 😊\n\nBest regards,\nTeam CreativeMark`,

  // Recovery / Payment Related
  RECOVERY_SOFT: (client: string, amount: string, invoice: string) => 
    `*Hi ${client}*,\n\nThis is a gentle reminder regarding the outstanding payment of *${amount}* for invoice *${invoice}*. \n\nPlease let us know if you have any questions or need any assistance with the payment process. 😊\n\nBest regards,\nTeam CreativeMark`,
  
  RECOVERY_FIRM: (client: string, amount: string, invoice: string) => 
    `*Dear ${client}*,\n\nour records show that the payment of *${amount}* for invoice *${invoice}* is now *overdue*. \n\nWe would appreciate it if you could process this at your earliest convenience to ensure uninterrupted service. ⏳\n\nBest regards,\nTeam CreativeMark`,
  
  RECOVERY_FINAL: (client: string, amount: string, invoice: string) => 
    `*URGENT: Dear ${client}*,\n\nThis is a final notice regarding the significantly overdue payment of *${amount}* for invoice *${invoice}*. \n\nPlease settle this *immediately* to avoid any service disruptions or legal complications. ⚠️\n\nBest regards,\nTeam CreativeMark`,

  // Client Related
  CLIENT_GREETING: (name: string) => 
    `*Hi ${name}*,\n\nHope you're having a great day! This is from *CreativeMark*. \n\nJust checking in to see if there's anything else we can help you with today. 😊`,

  // Partners & Collaborations
  PARTNER_GREETING: (name: string) => 
    `*Hi ${name}*,\n\nThis is from *CreativeMark*. We're looking forward to our upcoming collaboration! Please reach out if you have any updates. 🤝`,

  // Custom Message Prefix
  CUSTOM: (name: string, message: string) => 
    `*Hi ${name}*,\n\n${message}\n\nBest regards,\nTeam CreativeMark`
};


export type TemplateType = keyof typeof WHATSAPP_TEMPLATES;
