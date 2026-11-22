// UDAAN wordmark: orange "take-off" mark + Outfit lettering.
// tone="light" for light backgrounds (ink text), tone="dark" for dark backgrounds (white text).
export default function Logo({ size = 32, tone = "light", markOnly = false }: { size?: number; tone?: "light" | "dark"; markOnly?: boolean }) {
  const ink = tone === "light" ? "#16181d" : "#ffffff";
  return (
    <span className="inline-flex select-none items-center" style={{ gap: size * 0.3 }} aria-label="UDAAN">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
        {/* rounded tile */}
        <rect width="40" height="40" rx="11" fill="#D9541E" />
        {/* rising flight path */}
        <path d="M9 29c6.5-.4 12.6-4.6 17.4-12.6" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
        {/* arrowhead */}
        <path d="M20.6 13.2 30.8 10l-1.6 10.6z" fill="#fff" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
        {/* runway dot */}
        <circle cx="9.2" cy="29" r="2.4" fill="#fff" opacity="0.55" />
      </svg>
      {!markOnly && (
        <span
          style={{
            fontFamily: "'Outfit', 'Inter', ui-sans-serif, system-ui, sans-serif",
            fontWeight: 800,
            fontSize: size * 0.78,
            letterSpacing: "-0.01em",
            lineHeight: 1,
            color: ink,
          }}
        >
          UDAAN
        </span>
      )}
    </span>
  );
}
