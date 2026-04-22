import type { Recovery } from "@/types";

export const recoveries: Recovery[] = [];

export const WA_TEMPLATES: Record<string, any> = {
  soft: (client: string, amount: string, invoice: string) => 
    `Hi ${client}, this is a gentle reminder that payment of ${amount} for invoice ${invoice} is due. Please let us know if you need any assistance processing it.`,
  medium: (client: string, amount: string, invoice: string) => 
    `Dear ${client}, according to our records, payment of ${amount} for invoice ${invoice} is now past due. Could you please provide an update on the payment status?`,
  strong: (client: string, amount: string, invoice: string) => 
    `Urgent: Dear ${client}, your payment of ${amount} for invoice ${invoice} is significantly overdue. Please process this immediately to avoid interruption in services.`,
};
