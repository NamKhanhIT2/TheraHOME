"use client";

// The design system's Button (components/buttons/Button.jsx in the _ds bundle),
// ported for the landing site. Base metrics are copied exactly — height 52,
// --radius-md, the button type tokens, the 0.97 press scale.
//
// The one deliberate change is `secondary`. The DS variant is
// `background: var(--bg-card)` (white) with `color: var(--color-primary)`,
// which is right on the app's light surface and unreadable on the landing's
// near-black one. Here it becomes a glass outline, matching how every other
// secondary surface on these pages is drawn.
import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "secondary";

const base: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 52,
  borderRadius: "var(--radius-md)",
  fontFamily: "inherit",
  fontSize: "var(--text-button-size)",
  lineHeight: "var(--text-button-lh)",
  fontWeight: "var(--text-button-weight)",
  border: "none",
  padding: "0 24px",
  whiteSpace: "nowrap",
  transition: "background 150ms ease-out, transform 150ms ease-out, box-shadow 200ms ease-out",
};

const variants: Record<Variant, CSSProperties> = {
  primary: {
    background: "var(--color-primary)",
    color: "var(--text-on-primary)",
    boxShadow: "0 10px 30px rgba(0,127,217,0.35)",
  },
  secondary: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.16)",
  },
};

export function LandingButton({
  children,
  variant = "primary",
  href,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  variant?: Variant;
  /** Renders an <a>. Mutually exclusive with onClick in practice. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const merged: CSSProperties = {
    ...base,
    ...variants[variant],
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    ...style,
  };

  // Press feedback is inline rather than a CSS class because the DS component
  // does it this way and the scale has to survive the inline style merge.
  const press = {
    onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
      if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
    },
    onMouseUp: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = "scale(1)";
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = "scale(1)";
    },
  };

  if (href) {
    // An off-site link opens in its own tab, and the buy buttons are the
    // reason. They hand the customer to Shopify's checkout, which lives on
    // therahomeai.com; Shopify owns the thank-you page and sends "continue
    // shopping" back to its own store, so replacing this tab stranded the
    // customer there with no way back but typing the address. Keeping our page
    // open behind the checkout means closing that tab returns them.
    // (`return_to` on the cart permalink does not help — Shopify ignores it,
    // checked 2026-09-20.)
    const external = /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        style={merged}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : null)}
        {...press}
      >
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={merged} {...press}>
      {children}
    </button>
  );
}
