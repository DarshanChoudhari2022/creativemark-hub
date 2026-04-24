import React from "react";
import { usePrivacyShield } from "@/contexts/PrivacyShieldContext";

interface MaskedProps {
  children: React.ReactNode;
  /** Override mask text (default: "•••••") */
  placeholder?: string;
  /** Additional className for the mask span */
  className?: string;
}

/**
 * Wraps sensitive content (financial amounts, client names, etc.)
 * and shows a masked placeholder when the privacy shield is active.
 *
 * Usage:
 *   <Masked>{formatINR(amount)}</Masked>
 *   <Masked placeholder="••• Client">{client.name}</Masked>
 */
export const Masked = ({ children, placeholder = "•••••", className = "" }: MaskedProps) => {
  const { isShielded } = usePrivacyShield();

  if (!isShielded) return <>{children}</>;

  return (
    <span
      className={`select-none inline-block tracking-widest text-muted-foreground/60 ${className}`}
      style={{ filter: "blur(0px)" }}
      aria-hidden="true"
    >
      {placeholder}
    </span>
  );
};

/**
 * Hook to get the mask function — useful when you need to mask
 * a value inline (e.g., in chart tooltips or KPI values).
 */
export const useMask = () => {
  const { isShielded } = usePrivacyShield();

  return {
    isShielded,
    /** Mask a string value */
    mask: (value: string, placeholder = "•••••") =>
      isShielded ? placeholder : value,
    /** Mask a number formatted as string */
    maskAmount: (formattedAmount: string) =>
      isShielded ? "₹•••••" : formattedAmount,
  };
};
