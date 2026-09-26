import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const verificationPath = (productId: string) => `/p/${productId}`;

/** Real, scannable QR for the product's verification page (rendered client-side). */
export function AuthenticityQr({
  productId,
  size,
  label,
  className,
}: {
  productId: string;
  size: number;
  label: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toString(`${window.location.origin}${verificationPath(productId)}`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#27336b", light: "#ffffff" },
    }).then((markup) => {
      if (active) setSvg(markup);
    });
    return () => {
      active = false;
    };
  }, [productId]);

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("block [&>svg]:size-full", !svg && "rounded bg-secondary", className)}
      style={{ width: size, height: size }}
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : {})}
    />
  );
}
