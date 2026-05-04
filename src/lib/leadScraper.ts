// ═══════════════════════════════════════════════════════════════════
// Lead Scraper — OpenStreetMap Overpass API
//
// Free, no API key, no quota in practice (fair-use policy: ~10k queries/day).
// Returns businesses tagged in OSM by category + radius around a city.
//
// Limitations vs Google Maps:
//   • No reviews / ratings / photos.
//   • Coverage of small Indian businesses is patchy outside major cities.
//   • ~30-50% of entries have a phone, ~15-25% have a website.
// Strengths:
//   • Free, ToS-clean, no vendor lock-in.
//   • Returns GPS coordinates for every result (great for territory mapping).
// ═══════════════════════════════════════════════════════════════════

import { normalizePhone } from "@/lib/broadcast";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

const HTTP_HEADERS = { "Accept-Language": "en" };

// Optional Supabase Edge Function proxy (bypasses CORS / mobile network blocks)
function getProxyConfig(): { url: string; anonKey: string } | null {
  const env = (import.meta as any).env || {};
  const url = env.VITE_SUPABASE_URL || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || "";
  return url && anonKey ? { url: `${url}/functions/v1/overpass-proxy`, anonKey } : null;
}

async function proxyRequest(action: "geocode" | "scrape", payload: Record<string, any>): Promise<any> {
  const cfg = getProxyConfig();
  if (!cfg) throw new Error("Proxy not configured");
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": cfg.anonKey,
      "Authorization": `Bearer ${cfg.anonKey}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Proxy error: HTTP ${res.status}${errText ? ` — ${errText}` : ""}`);
  }
  return res.json();
}

async function fetchOverpass(query: string, signal?: AbortSignal): Promise<any> {
  let lastError = "";
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", ...HTTP_HEADERS },
        body: "data=" + encodeURIComponent(query),
        signal,
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      return res.json();
    } catch (e: any) {
      lastError = e.message || "network error";
    }
  }
  throw new Error(`All Overpass endpoints failed. Last: ${lastError}`);
}

// ── Types ─────────────────────────────────────────────────────────
export interface ScrapedLead {
  // Stable identifier (osm node/way/relation id)
  osm_id: string;
  osm_type: "node" | "way" | "relation";

  // Core display fields
  name: string;
  category: string;          // human label (e.g. "Restaurant", "Dentist")
  raw_tags: Record<string, string>;

  // Contact
  phone?: string;
  website?: string;
  email?: string;

  // Address
  address_full?: string;
  address_street?: string;
  address_city?: string;
  address_postcode?: string;

  // Geo
  lat: number;
  lon: number;

  // Bookkeeping
  source: "osm";
  scraped_at: string;
}

// Common business categories users search by, mapped to OSM tag filters.
// `query` is the body fragment that goes inside the Overpass `nwr` block.
export interface BusinessCategoryDef {
  key: string;            // internal key
  label: string;          // dropdown label
  icon?: string;          // emoji
  query: string;          // Overpass tag filter
}

export const BUSINESS_CATEGORIES: BusinessCategoryDef[] = [
  // Food & hospitality
  { key: "restaurant",  label: "Restaurants",       icon: "🍽️", query: '["amenity"="restaurant"]' },
  { key: "cafe",        label: "Cafes",             icon: "☕", query: '["amenity"="cafe"]' },
  { key: "bakery",      label: "Bakeries",          icon: "🥐", query: '["shop"="bakery"]' },
  { key: "fast_food",   label: "Fast Food",         icon: "🍔", query: '["amenity"="fast_food"]' },
  { key: "bar",         label: "Bars / Pubs",       icon: "🍺", query: '["amenity"~"^(bar|pub)$"]' },
  { key: "hotel",       label: "Hotels",            icon: "🏨", query: '["tourism"~"^(hotel|guest_house|hostel)$"]' },

  // Retail
  { key: "clothing",    label: "Clothing Stores",   icon: "👕", query: '["shop"="clothes"]' },
  { key: "supermarket", label: "Supermarkets",      icon: "🛒", query: '["shop"~"^(supermarket|convenience)$"]' },
  { key: "electronics", label: "Electronics",       icon: "📱", query: '["shop"~"^(electronics|mobile_phone|computer)$"]' },
  { key: "jewelry",     label: "Jewelry / Gold",    icon: "💎", query: '["shop"="jewelry"]' },
  { key: "furniture",   label: "Furniture",         icon: "🛋️", query: '["shop"="furniture"]' },
  { key: "florist",     label: "Florists",          icon: "💐", query: '["shop"="florist"]' },
  { key: "bookshop",    label: "Bookshops",         icon: "📚", query: '["shop"="books"]' },

  // Services
  { key: "salon",       label: "Salons / Beauty",   icon: "💇", query: '["shop"~"^(hairdresser|beauty)$"]' },
  { key: "gym",         label: "Gyms / Fitness",    icon: "🏋️", query: '["leisure"="fitness_centre"]' },
  { key: "carwash",     label: "Car Wash",          icon: "🚿", query: '["amenity"="car_wash"]' },
  { key: "garage",      label: "Auto Repair",       icon: "🔧", query: '["shop"="car_repair"]' },

  // Healthcare
  { key: "clinic",      label: "Clinics",           icon: "🏥", query: '["amenity"~"^(clinic|doctors)$"]' },
  { key: "dentist",     label: "Dentists",          icon: "🦷", query: '["amenity"="dentist"]' },
  { key: "pharmacy",    label: "Pharmacies",        icon: "💊", query: '["amenity"="pharmacy"]' },
  { key: "hospital",    label: "Hospitals",         icon: "🚑", query: '["amenity"="hospital"]' },

  // Professional
  { key: "office",      label: "Offices (any)",     icon: "🏢", query: '["office"]' },
  { key: "lawyer",      label: "Lawyers",           icon: "⚖️", query: '["office"="lawyer"]' },
  { key: "real_estate", label: "Real Estate",       icon: "🏘️", query: '["office"="estate_agent"]' },
  { key: "school",      label: "Schools",           icon: "🏫", query: '["amenity"~"^(school|college|university)$"]' },
];

// ── City -> bounding box / center via Nominatim ──────────────────
export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

export async function geocodeCity(query: string): Promise<GeocodeResult | null> {
  if (!query.trim()) return null;
  const q = query.trim();

  // Try proxy first (avoids CORS / mobile network blocks)
  try {
    const json = await proxyRequest("geocode", { city: q });
    if (!Array.isArray(json) || json.length === 0) return null;
    return {
      display_name: json[0].display_name,
      lat: parseFloat(json[0].lat),
      lon: parseFloat(json[0].lon),
    };
  } catch (proxyErr) {
    // Fallback to direct Nominatim with one retry
    const url = `${NOMINATIM_ENDPOINT}?q=${encodeURIComponent(q)}&format=json&limit=1`;
    let lastErr: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 800));
        const res = await fetch(url, { headers: HTTP_HEADERS });
        if (!res.ok) throw new Error(`Geocoding failed: HTTP ${res.status}`);
        const json = await res.json();
        if (!Array.isArray(json) || json.length === 0) return null;
        return {
          display_name: json[0].display_name,
          lat: parseFloat(json[0].lat),
          lon: parseFloat(json[0].lon),
        };
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }
}

// ── Scrape ───────────────────────────────────────────────────────
export interface ScrapeOptions {
  category: BusinessCategoryDef;
  lat: number;
  lon: number;
  radiusMeters: number;       // typical: 1000-25000
  limit?: number;             // soft cap on results, default 200
}

export async function scrapeLeads(opts: ScrapeOptions): Promise<ScrapedLead[]> {
  const limit = opts.limit ?? 200;
  const q = `
    [out:json][timeout:30];
    nwr${opts.category.query}(around:${opts.radiusMeters},${opts.lat},${opts.lon});
    out tags center ${limit};
  `.trim();

  // Try Supabase edge-function proxy first (bypasses CORS / mobile network blocks)
  let json: any;
  try {
    json = await proxyRequest("scrape", { query: q });
  } catch (proxyErr) {
    // Fallback to direct endpoints with retry across mirrors
    json = await fetchOverpass(q);
  }

  const elements: any[] = json?.elements || [];

  const out: ScrapedLead[] = [];
  for (const el of elements) {
    const tags: Record<string, string> = el.tags || {};
    const name = tags.name || tags["name:en"] || tags.brand;
    if (!name) continue; // skip un-named entries — useless for outreach

    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;

    // Phone — try common keys in priority order, normalize to +CC format
    const phoneRaw = tags["contact:phone"] || tags.phone || tags["contact:mobile"];
    const phone = phoneRaw ? normalizePhone(phoneRaw.split(";")[0].trim()) : undefined;

    // Website / email
    const websiteRaw = tags["contact:website"] || tags.website || tags.url;
    const website = websiteRaw ? cleanUrl(websiteRaw) : undefined;
    const emailRaw = tags["contact:email"] || tags.email;
    const email = emailRaw ? emailRaw.split(";")[0].trim() : undefined;

    // Address
    const addrParts = [
      tags["addr:housenumber"],
      tags["addr:street"],
      tags["addr:suburb"],
      tags["addr:city"],
      tags["addr:postcode"],
    ].filter(Boolean);
    const address_full = addrParts.length ? addrParts.join(", ") : undefined;

    // Friendly category label — prefer the def's label, but if the tag set
    // has a more specific cuisine/shop/office sub-tag, append it.
    const categoryLabel = enrichCategoryLabel(opts.category.label, tags);

    out.push({
      osm_id: String(el.id),
      osm_type: el.type,
      name,
      category: categoryLabel,
      raw_tags: tags,
      phone,
      website,
      email,
      address_full,
      address_street: tags["addr:street"],
      address_city: tags["addr:city"],
      address_postcode: tags["addr:postcode"],
      lat,
      lon,
      source: "osm",
      scraped_at: new Date().toISOString(),
    });
  }

  return out;
}

function cleanUrl(url: string): string {
  let u = url.trim().split(/\s+/)[0];
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  // Strip trailing punctuation that sometimes leaks from OSM imports
  u = u.replace(/[.,;]+$/, "");
  return u;
}

function enrichCategoryLabel(base: string, tags: Record<string, string>): string {
  const sub = tags.cuisine || tags["cuisine:1"] || tags.shop || tags.office;
  if (sub && !base.toLowerCase().includes(sub.toLowerCase())) {
    return `${base} · ${sub.replace(/_/g, " ")}`;
  }
  return base;
}

// ── Utilities ─────────────────────────────────────────────────────
export function googleMapsLink(lead: ScrapedLead): string {
  return `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lon}`;
}

export function osmLink(lead: ScrapedLead): string {
  return `https://www.openstreetmap.org/${lead.osm_type}/${lead.osm_id}`;
}
