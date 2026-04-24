/**
 * Format a number as INR currency (e.g. ₹1,25,000)
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Compact INR format — shows L (Lakhs) or K
 */
export function formatINRCompact(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}K`;
  }
  return `₹${amount}`;
}

/**
 * Format a Date (or today) as DD/MM/YYYY
 */
export function formatDateDDMMYYYY(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Format phone number for WhatsApp link (strip spaces, dashes)
 */
export function waLink(phone: string, message = ""): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return `https://wa.me/${cleaned}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

/**
 * Format phone number for tel: link
 */
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[\s\-()]/g, "")}`;
}

/**
 * Format phone number for SMS link with pre-loaded message
 */
export function smsLink(phone: string, message = ""): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return `sms:${cleaned}${message ? `?body=${encodeURIComponent(message)}` : ""}`;
}

/**
 * Validate Indian phone number format (+91 followed by 10 digits)
 */
export function isValidIndianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Format phone to standard Indian format (+91 XXXXX XXXXX)
 */
export function formatIndianPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()+]/g, "");
  const digits = cleaned.startsWith("91") ? cleaned.slice(2) : cleaned;
  if (digits.length !== 10) return phone;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/**
 * Get short relative time string
 */
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}m ago`;
}
