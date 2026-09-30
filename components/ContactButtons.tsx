import AnimatedButton from "@/components/AnimatedButton";
import { CONTACT } from "@/lib/config";

/**
 * ContactButtons: the one place people reach Kyle directly.
 * WhatsApp, Telegram or a phone call. No booking, no forms.
 * Numbers and links live in lib/config.ts (CONTACT).
 */
type Props = {
  /** Small line above the buttons. Pass null to hide. */
  heading?: string | null;
  align?: "center" | "start";
  /** Hide the hours line (only if the surrounding copy already says it). */
  showHours?: boolean;
};

export default function ContactButtons({ heading = null, align = "center", showHours = true }: Props) {
  const justify = align === "center" ? "center" : "flex-start";
  return (
    <div
      data-analytics="contact-buttons"
      style={{ textAlign: align === "center" ? "center" : "left" }}
    >
      {heading && (
        <p style={{ color: "var(--ice)", fontSize: "var(--fs-body)", margin: "0 0 16px" }}>
          {heading}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: justify,
          alignItems: "stretch",
        }}
      >
        <AnimatedButton
          href={CONTACT.WHATSAPP_HREF}
          external
          variant="primary"
          ariaLabel="Message Kyle on WhatsApp"
        >
          Message on WhatsApp
        </AnimatedButton>
        <AnimatedButton
          href={CONTACT.TELEGRAM_HREF}
          external
          variant="primary"
          ariaLabel="Message Kyle on Telegram"
        >
          Message on Telegram
        </AnimatedButton>
        <AnimatedButton
          href={CONTACT.TEL_HREF}
          variant="primary"
          ariaLabel={`Call Kyle on ${CONTACT.PHONE_DISPLAY}`}
        >
          Call {CONTACT.PHONE_DISPLAY}
        </AnimatedButton>
      </div>
      {showHours && (
        <p style={{ color: "var(--dim)", fontSize: "var(--fs-sm)", margin: "14px 0 0", lineHeight: 1.6 }}>
          {CONTACT.HOURS}
        </p>
      )}
    </div>
  );
}
