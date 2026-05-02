/**
 * Centralized message templates for the Broadcast Hub.
 * Use {name} as a placeholder — it will be replaced per recipient at send time.
 */

export interface BroadcastTemplate {
  key: string;
  label: string;
  category: "festival" | "marketing" | "general";
  emoji: string;
  message: string;
}

export const BROADCAST_TEMPLATES: BroadcastTemplate[] = [
  // ── Festivals ────────────────────────────────────────────────────
  {
    key: "DIWALI",
    label: "Diwali",
    category: "festival",
    emoji: "🪔",
    message:
      "*Hi {name}*,\n\n🪔 *Wishing you and your family a very Happy Diwali!* 🪔\n\nMay this festival of lights bring prosperity, happiness, and success to your business and personal life.\n\nThank you for your continued trust in us.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216 | 🌐 creativemarkadvertising.com",
  },
  {
    key: "NEW_YEAR",
    label: "New Year",
    category: "festival",
    emoji: "🎉",
    message:
      "*Hi {name}*,\n\n🎉 *Happy New Year!* 🎉\n\nWishing you a year filled with new opportunities, exciting growth, and great achievements. Looking forward to creating something amazing together this year.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216 | 🌐 creativemarkadvertising.com",
  },
  {
    key: "HOLI",
    label: "Holi",
    category: "festival",
    emoji: "🎨",
    message:
      "*Hi {name}*,\n\n🎨 *Happy Holi!* 🎨\n\nMay this Holi paint your life with the colors of joy, success, and prosperity. Have a vibrant and safe celebration with your loved ones!\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "EID",
    label: "Eid Mubarak",
    category: "festival",
    emoji: "🌙",
    message:
      "*Hi {name}*,\n\n🌙 *Eid Mubarak!* 🌙\n\nMay this blessed occasion fill your life with peace, prosperity, and happiness. Wishing you and your family a joyous Eid.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "CHRISTMAS",
    label: "Christmas",
    category: "festival",
    emoji: "🎄",
    message:
      "*Hi {name}*,\n\n🎄 *Merry Christmas!* 🎄\n\nWishing you a season of joy, warmth, and beautiful moments with your loved ones. Thank you for being a valued part of our journey.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "GANESH_CHATURTHI",
    label: "Ganesh Chaturthi",
    category: "festival",
    emoji: "🙏",
    message:
      "*Hi {name}*,\n\n🙏 *Ganpati Bappa Morya!* 🙏\n\nMay Lord Ganesha remove all obstacles from your path and bless you with success, wisdom, and prosperity.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "INDEPENDENCE_DAY",
    label: "Independence Day",
    category: "festival",
    emoji: "🇮🇳",
    message:
      "*Hi {name}*,\n\n🇮🇳 *Happy Independence Day!* 🇮🇳\n\nLet us celebrate the spirit of freedom and the nation's progress. Jai Hind!\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "RAKSHA_BANDHAN",
    label: "Raksha Bandhan",
    category: "festival",
    emoji: "🪢",
    message:
      "*Hi {name}*,\n\n🪢 *Happy Raksha Bandhan!* 🪢\n\nWishing you and your siblings a joyful celebration filled with love, laughter, and lifelong bonds.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "GUDI_PADWA",
    label: "Gudi Padwa",
    category: "festival",
    emoji: "🌼",
    message:
      "*Hi {name}*,\n\n🌼 *Happy Gudi Padwa!* 🌼\n\nWishing you a year ahead full of prosperity, good health, and new beginnings. Naveen Varshachya Hardik Shubhechha!\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },

  // ── Marketing ────────────────────────────────────────────────────
  {
    key: "BROCHURE_SHARE",
    label: "Share Brochure",
    category: "marketing",
    emoji: "📄",
    message:
      "*Hi {name}*,\n\nGreetings from *CreativeMark Advertising*! 🎨\n\nWe'd love to share our latest brochure showcasing our complete suite of services — *Branding, Digital Marketing, Reels, Photography, Banners & more*.\n\n📎 *Brochure:* https://creativemarkadvertising.com\n\nLet us know if anything catches your eye, we'd be happy to schedule a quick call.\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },
  {
    key: "PRODUCT_LAUNCH",
    label: "New Product Launch",
    category: "marketing",
    emoji: "🚀",
    message:
      "*Hi {name}*,\n\n🚀 *Exciting News from CreativeMark!* 🚀\n\nWe're thrilled to announce the launch of our new service. Designed to help businesses like yours grow faster and smarter.\n\n✨ *What's new:*\n• Premium creative packages\n• Faster turnaround times\n• Special launch pricing for our valued clients\n\n📞 Reply to this message or call us at +91 9309393216 for an exclusive walkthrough.\n\nWarm regards,\n*Team CreativeMark Advertising*",
  },
  {
    key: "OFFER",
    label: "Special Offer",
    category: "marketing",
    emoji: "💥",
    message:
      "*Hi {name}*,\n\n💥 *Limited-time Offer from CreativeMark!* 💥\n\nGet *up to 25% off* on all our branding & social media packages this month. Perfect time to refresh your brand or kick off a new campaign.\n\n📞 Call us at +91 9309393216 or simply reply here to grab this deal before it ends.\n\nWarm regards,\n*Team CreativeMark Advertising*",
  },
  {
    key: "REENGAGE",
    label: "Re-engagement / Stay in Touch",
    category: "marketing",
    emoji: "👋",
    message:
      "*Hi {name}*,\n\n👋 Hope you're doing well! It's been a while.\n\nJust dropping in to say hi from the team at *CreativeMark Advertising*. We've recently rolled out some exciting new services and would love to catch up on how your brand has been growing.\n\nLet us know if you'd like to chat — even a quick coffee call works!\n\nWarm regards,\n*Team CreativeMark Advertising*\n📞 +91 9309393216",
  },

  // ── General ──────────────────────────────────────────────────────
  {
    key: "CUSTOM",
    label: "Custom Message",
    category: "general",
    emoji: "✏️",
    message:
      "*Hi {name}*,\n\n[Type your message here]\n\nWarm regards,\n*Team CreativeMark Advertising*",
  },
];

/** Personalize a template/message by replacing {name} with the recipient name. */
export function personalize(message: string, name: string): string {
  const safeName = (name || "there").trim() || "there";
  return message.replace(/\{name\}/gi, safeName);
}

export type BroadcastChannel = "whatsapp" | "email";
