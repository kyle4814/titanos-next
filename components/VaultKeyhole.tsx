/**
 * VaultKeyhole — W4 Pillar 5 signature device #2.
 *
 * 18×26 gold SVG vault-door keyhole. Pulses imperceptibly every 6
 * seconds. Used as a section H2 marker so every chamber of the site
 * carries the same craft signal.
 */

export default function VaultKeyhole({
  size = 18,
  color = "var(--gold)",
  pulse = true,
}: {
  size?: number;
  color?: string;
  pulse?: boolean;
}) {
  const h = Math.round(size * 1.4);
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: size,
        height: h,
        verticalAlign: "middle",
        marginRight: 14,
        animation: pulse ? "vault-keyhole-pulse 6s ease-in-out infinite" : "none",
      }}
    >
      <svg width={size} height={h} viewBox="0 0 18 26" fill="none">
        {/* Outer disc */}
        <circle cx="9" cy="9" r="6.5" stroke={color} strokeWidth="1.2" />
        {/* Inner socket */}
        <circle cx="9" cy="9" r="2.6" fill={color} />
        {/* Drop slot */}
        <path
          d="M 6.4 14 L 6.4 23 Q 6.4 25 9 25 Q 11.6 25 11.6 23 L 11.6 14 Z"
          stroke={color}
          strokeWidth="1.2"
          fill="none"
        />
      </svg>
      <style>{`
        @keyframes vault-keyhole-pulse {
          0%, 88%, 100% {
            filter: drop-shadow(0 0 0 rgb(var(--gold-rgb) / 0));
            opacity: 0.85;
          }
          94% {
            filter: drop-shadow(0 0 8px rgb(var(--gold-rgb) / 0.7));
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-vault-keyhole] { animation: none !important; }
        }
      `}</style>
    </span>
  );
}
