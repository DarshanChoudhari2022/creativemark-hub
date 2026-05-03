// ═══════════════════════════════════════════════════════════════════
// Gemini AI helper for the Lead Hunter feature.
//
// Free model: gemini-2.5-flash (fastest current model on the free tier;
// 1M context, supports JSON-mode output).
//
// Free-tier limits at time of writing: 10 RPM, ~250 RPD, 250k TPM.
// We respect that with a soft client-side throttle (one request at a time).
//
// SECURITY: VITE_-prefixed env vars are bundled into the client JS, so the
// key in the APK can be extracted by anyone who decompiles it. For an
// internal CRM that's an accepted tradeoff. If you ever ship publicly,
// move this behind a Supabase Edge Function and never expose the key.
// ═══════════════════════════════════════════════════════════════════

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export interface GeminiLeadInput {
  name: string;
  category?: string;
  city?: string;
  website?: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface GeminiColdEmailOutput {
  subject: string;
  body: string;
  whatsapp: string;
  pain_point_guess: string;
  fit_score: number; // 0-100
}

export class GeminiError extends Error {}

/** Single in-flight guard so we don't burst past the 10 RPM free-tier limit. */
let inFlight: Promise<unknown> | null = null;

async function callGemini<T>(prompt: string, jsonSchema?: object): Promise<T> {
  if (!API_KEY) {
    throw new GeminiError(
      "Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env file and rebuild."
    );
  }

  // Serialize calls — avoids 429s on the strict free tier (10 RPM).
  while (inFlight) {
    try { await inFlight; } catch { /* don't propagate previous errors */ }
  }

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  if (jsonSchema) {
    body.generationConfig.responseMimeType = "application/json";
    body.generationConfig.responseSchema = jsonSchema;
  }

  const work = (async () => {
    const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new GeminiError(`Gemini ${res.status}: ${txt.slice(0, 300)}`);
    }
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.[0]?.text ??
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "";
    if (!text) throw new GeminiError("Empty response from Gemini.");

    if (jsonSchema) {
      try {
        return JSON.parse(text) as T;
      } catch {
        // Sometimes the model wraps JSON in ```json fences even in JSON mode.
        const stripped = text.replace(/```(?:json)?/g, "").trim();
        return JSON.parse(stripped) as T;
      }
    }
    return text as unknown as T;
  })();

  inFlight = work;
  try {
    return await work;
  } finally {
    inFlight = null;
  }
}

/**
 * Generate a personalized cold-email + WhatsApp + 1-line pain-point guess
 * for a single scraped lead. Used in the Lead Hunter results table.
 *
 * `agency` describes YOUR business — what you sell — so Gemini can tailor
 * the value prop. Default below is CreativeMark Advertising.
 */
export async function generateColdEmail(
  lead: GeminiLeadInput,
  agency = "CreativeMark Advertising — branding, packaging design, social-media management, and printing services for small/medium businesses"
): Promise<GeminiColdEmailOutput> {
  const schema = {
    type: "object",
    properties: {
      subject:        { type: "string" },
      body:           { type: "string" },
      whatsapp:       { type: "string" },
      pain_point_guess: { type: "string" },
      fit_score:      { type: "integer" },
    },
    required: ["subject", "body", "whatsapp", "pain_point_guess", "fit_score"],
  };

  const prompt = `You are an SDR writing personalized B2B outreach.

OUR BUSINESS: ${agency}

PROSPECT:
- Business name: ${lead.name}
- Category: ${lead.category || "unknown"}
- City: ${lead.city || "unknown"}
- Website: ${lead.website || "(none)"}
- Email: ${lead.email || "(unknown)"}
- Phone: ${lead.phone || "(unknown)"}
- Extra notes: ${lead.notes || "(none)"}

TASK — return JSON only:
1. "pain_point_guess": ONE specific pain point this kind of business likely has that our services solve (max 18 words).
2. "subject": short, curiosity-driven email subject line (max 60 chars). NO emojis. NO clickbait.
3. "body": 90-140 word cold email. Open with a specific observation about their business or category — no generic "I came across your business". State a concrete value prop tied to their pain point. End with ONE soft CTA (a 10-min call OR a 2-line yes/no question). Sign as "Team CreativeMark Advertising".
4. "whatsapp": short WhatsApp version (max 60 words, friendlier tone, can use 1-2 emojis).
5. "fit_score": 0-100 integer estimating how good a fit this prospect is for us. Higher means better fit (e.g. boutique retail/restaurants/clinics rate 70-90, gas stations rate 20-30, multinational chains rate 10).

Personalize using the business name and category — don't write generic content.`;

  return await callGemini<GeminiColdEmailOutput>(prompt, schema);
}

/**
 * Lightweight fit-score-only call (no full email body) — cheaper, used
 * for batch scoring of search results before the user picks favourites.
 */
export async function scoreLeadFit(
  lead: GeminiLeadInput,
  agency = "CreativeMark Advertising — branding, packaging design, social-media management, printing services"
): Promise<{ fit_score: number; reason: string }> {
  const schema = {
    type: "object",
    properties: {
      fit_score: { type: "integer" },
      reason: { type: "string" },
    },
    required: ["fit_score", "reason"],
  };
  const prompt = `Rate how good a sales prospect this is for our business.

OUR BUSINESS: ${agency}

PROSPECT: ${lead.name} (${lead.category || "unknown"}, ${lead.city || "unknown city"})

Return JSON: { fit_score: 0-100 integer, reason: <max 12 words> }`;
  return await callGemini(prompt, schema);
}

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}
