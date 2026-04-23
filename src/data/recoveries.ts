import type { Recovery } from "@/types";
import { WHATSAPP_TEMPLATES } from "./whatsappTemplates";

export const recoveries: Recovery[] = [];

export const WA_TEMPLATES: Record<string, (client: string, amount: string, invoice: string) => string> = {
  soft: WHATSAPP_TEMPLATES.RECOVERY_SOFT,
  firm: WHATSAPP_TEMPLATES.RECOVERY_FIRM,
  final: WHATSAPP_TEMPLATES.RECOVERY_FINAL,
  medium: WHATSAPP_TEMPLATES.RECOVERY_FIRM,
  strong: WHATSAPP_TEMPLATES.RECOVERY_FINAL,
};
