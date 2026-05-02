// ═══════════════════════════════════════════════════════════════════
// Broadcast Hub helpers
// - Parse contacts from CSV / Excel / Phone (Capacitor)
// - Send via WhatsApp (sequential) and Email (BCC batches)
// All sending paths are FREE (use the user's own WhatsApp + email client).
// ═══════════════════════════════════════════════════════════════════
import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import { waLink } from "@/lib/format";
import { personalize } from "@/data/broadcastTemplates";

// ── Types ─────────────────────────────────────────────────────────
export interface BroadcastContact {
  id?: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  source?: "csv" | "phone" | "manual" | "crm-client" | "crm-lead" | "crm-partner";
  tags?: string[];
  notes?: string;
}

// ── Phone normalization ──────────────────────────────────────────
/**
 * Strip spaces/dashes/parens, leave a leading + only if present.
 * For Indian numbers without country code, prepend +91.
 */
export function normalizePhone(raw?: string): string {
  if (!raw) return "";
  const cleaned = String(raw).replace(/[\s\-()]/g, "").trim();
  if (!cleaned) return "";
  // Already has country code
  if (cleaned.startsWith("+")) return cleaned;
  // Pure digits — assume Indian if 10 digits and starts 6-9
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  // 91 prefix without +
  if (/^91[6-9]\d{9}$/.test(cleaned)) return `+${cleaned}`;
  // Anything else — return as-is
  return cleaned;
}

export function isValidPhone(raw?: string): boolean {
  const p = normalizePhone(raw);
  return /^\+?\d{10,15}$/.test(p);
}

export function isValidEmail(raw?: string): boolean {
  if (!raw) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

// ── Header detection for CSV/Excel ───────────────────────────────
const NAME_HINTS = ["name", "full name", "fullname", "contact", "contact name", "person", "client name", "first name"];
const PHONE_HINTS = ["phone", "mobile", "number", "contact number", "phone number", "mobile number", "cell"];
const WA_HINTS = ["whatsapp", "whats app", "wa", "wa number", "whatsapp number"];
const EMAIL_HINTS = ["email", "e-mail", "mail", "email address", "email id"];
const NOTES_HINTS = ["notes", "note", "remarks", "comment", "comments"];
const TAGS_HINTS = ["tags", "tag", "category", "label", "labels"];

function matchHeader(header: string, hints: string[]): boolean {
  const h = header.toLowerCase().trim();
  return hints.some(hint => h === hint || h.includes(hint));
}

interface HeaderMap {
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  notes?: string;
  tags?: string;
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const map: HeaderMap = {};
  for (const h of headers) {
    if (!map.name && matchHeader(h, NAME_HINTS)) map.name = h;
    else if (!map.whatsapp && matchHeader(h, WA_HINTS)) map.whatsapp = h;
    else if (!map.phone && matchHeader(h, PHONE_HINTS)) map.phone = h;
    else if (!map.email && matchHeader(h, EMAIL_HINTS)) map.email = h;
    else if (!map.notes && matchHeader(h, NOTES_HINTS)) map.notes = h;
    else if (!map.tags && matchHeader(h, TAGS_HINTS)) map.tags = h;
  }
  return map;
}

function rowToContact(row: Record<string, any>, hmap: HeaderMap): BroadcastContact | null {
  const name = (hmap.name ? row[hmap.name] : "")?.toString().trim();
  const phone = (hmap.phone ? row[hmap.phone] : "")?.toString().trim();
  const whatsapp = (hmap.whatsapp ? row[hmap.whatsapp] : "")?.toString().trim();
  const email = (hmap.email ? row[hmap.email] : "")?.toString().trim();
  const notes = (hmap.notes ? row[hmap.notes] : "")?.toString().trim();
  const tagsRaw = (hmap.tags ? row[hmap.tags] : "")?.toString().trim();

  if (!name && !phone && !whatsapp && !email) return null;

  const tags = tagsRaw
    ? tagsRaw.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean)
    : [];

  return {
    name: name || phone || email || "Unknown",
    phone: phone ? normalizePhone(phone) : undefined,
    whatsapp: whatsapp ? normalizePhone(whatsapp) : (phone ? normalizePhone(phone) : undefined),
    email: email || undefined,
    notes: notes || undefined,
    tags,
    source: "csv",
  };
}

// ── CSV parsing ──────────────────────────────────────────────────
export function parseCSV(file: File): Promise<BroadcastContact[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (result) => {
        try {
          const headers = result.meta.fields || [];
          const hmap = buildHeaderMap(headers);
          if (!hmap.name && !hmap.phone && !hmap.email && !hmap.whatsapp) {
            reject(new Error("Could not find Name / Phone / Email / WhatsApp columns. Make sure the first row has headers like 'Name', 'Phone', 'Email'."));
            return;
          }
          const contacts: BroadcastContact[] = [];
          for (const row of result.data) {
            const c = rowToContact(row, hmap);
            if (c) contacts.push(c);
          }
          resolve(contacts);
        } catch (e: any) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

// ── Excel parsing (.xlsx) ────────────────────────────────────────
export async function parseExcel(file: File): Promise<BroadcastContact[]> {
  const rows = await readXlsxFile(file);
  if (!rows || rows.length === 0) return [];

  const headers = (rows[0] || []).map((h) => String(h || "").trim());
  const hmap = buildHeaderMap(headers);
  if (!hmap.name && !hmap.phone && !hmap.email && !hmap.whatsapp) {
    throw new Error("Could not find Name / Phone / Email / WhatsApp columns. First row must contain headers.");
  }

  const headerToIdx: Record<string, number> = {};
  headers.forEach((h, i) => { headerToIdx[h] = i; });

  const contacts: BroadcastContact[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    const c = rowToContact(obj, hmap);
    if (c) contacts.push(c);
  }
  return contacts;
}

// ── Phone Contacts (Capacitor native, APK only) ──────────────────
export async function isPhoneContactsAvailable(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function importPhoneContacts(): Promise<BroadcastContact[]> {
  // Lazy import — plugin only exists in the native APK after `cap sync` + rebuild
  const mod: any = await import("@capacitor-community/contacts");
  const Contacts = mod.Contacts;
  if (!Contacts) throw new Error("Contacts plugin not available. Rebuild the APK after npm install.");

  // Permission flow
  const perm = await Contacts.requestPermissions();
  // The plugin returns either { contacts: 'granted' } or a similar shape
  const granted =
    perm?.contacts === "granted" ||
    perm?.contacts === "authorized" ||
    perm?.granted === true;
  if (!granted) {
    throw new Error("Permission to read contacts was denied.");
  }

  const result = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
      emails: true,
    },
  });

  const raw = result?.contacts || [];
  const contacts: BroadcastContact[] = [];
  for (const c of raw) {
    const display =
      c?.name?.display ||
      [c?.name?.given, c?.name?.middle, c?.name?.family].filter(Boolean).join(" ") ||
      "";
    const phone = c?.phones?.[0]?.number || "";
    const email = c?.emails?.[0]?.address || "";

    if (!display && !phone && !email) continue;

    contacts.push({
      name: display || phone || email,
      phone: phone ? normalizePhone(phone) : undefined,
      whatsapp: phone ? normalizePhone(phone) : undefined,
      email: email || undefined,
      source: "phone",
      tags: [],
    });
  }
  return contacts;
}

// ── Dedup helper ─────────────────────────────────────────────────
export function dedupeContacts(contacts: BroadcastContact[]): BroadcastContact[] {
  const seen = new Set<string>();
  const out: BroadcastContact[] = [];
  for (const c of contacts) {
    const key = (c.phone || c.whatsapp || c.email || c.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

// ── Senders ──────────────────────────────────────────────────────
export interface WhatsAppQueueItem {
  contact: BroadcastContact;
  message: string;
  url: string;
}

/**
 * Build a queue of pre-filled WhatsApp links for the given contacts + message.
 * Each link can be opened one-by-one — each open lands in WhatsApp with the
 * pre-filled chat; the user only needs to tap the Send button.
 */
export function buildWhatsAppQueue(
  contacts: BroadcastContact[],
  template: string
): WhatsAppQueueItem[] {
  const queue: WhatsAppQueueItem[] = [];
  for (const c of contacts) {
    const number = c.whatsapp || c.phone;
    if (!number || !isValidPhone(number)) continue;
    const msg = personalize(template, c.name);
    queue.push({
      contact: c,
      message: msg,
      url: waLink(number, msg),
    });
  }
  return queue;
}

/**
 * Open one WhatsApp chat in the OS WhatsApp app or web tab.
 * On Capacitor native, `_blank` is captured by the plugin and opens an external app.
 */
export function openWhatsAppLink(url: string) {
  const win = window.open(url, "_blank");
  if (!win) {
    // popup blocked — fallback to navigation
    window.location.href = url;
  }
}

/** Build mailto: URL strings for BCC sending in batches of `batchSize` (default 50). */
export function buildEmailBatches(
  contacts: BroadcastContact[],
  subject: string,
  body: string,
  batchSize = 50
): string[] {
  const validEmails = contacts
    .map(c => (c.email || "").trim())
    .filter(e => isValidEmail(e));

  // Dedupe
  const seen = new Set<string>();
  const unique = validEmails.filter(e => {
    const k = e.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const batches: string[] = [];
  for (let i = 0; i < unique.length; i += batchSize) {
    const slice = unique.slice(i, i + batchSize);
    const bcc = slice.join(",");
    const url = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    batches.push(url);
  }
  return batches;
}

export function openEmailBatch(url: string) {
  const win = window.open(url, "_blank");
  if (!win) {
    window.location.href = url;
  }
}
