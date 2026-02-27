// UAE Dirham icon — drop-in replacement for lucide DollarSign
// Renders "AED" as a compact SVG that accepts the same className prop as lucide icons
export function DirhamIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <text
        x="1"
        y="17"
        fontSize="9.5"
        fontWeight="800"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.3"
      >
        AED
      </text>
    </svg>
  );
}
