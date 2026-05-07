interface Props {
  className?: string;
  driving?: boolean;
  color?: string; // tailwind hex color
}

export function AnimatedTruck({ className, driving = true, color = "#FACC15" }: Props) {
  return (
    <svg viewBox="0 0 80 40" className={className} aria-hidden>
      {/* caçamba */}
      <path d="M4 22 L4 10 L42 10 L48 22 Z" fill={color} stroke="#000" strokeWidth="0.6" />
      <path d="M8 21 L8 13 L40 13 L44 21 Z" fill="#000" opacity="0.25" />
      {/* cabine */}
      <path d="M48 22 L48 14 L60 14 L66 22 Z" fill={color} stroke="#000" strokeWidth="0.6" />
      <rect x="52" y="15.5" width="8" height="4" fill="#0EA5E9" opacity="0.85" />
      {/* chassi */}
      <rect x="3" y="22" width="65" height="5" fill="#1f2937" />
      {/* rodas */}
      <g className={driving ? "animate-wheel-spin" : ""}>
        <circle cx="14" cy="29" r="5" fill="#0a0a0a" stroke="#444" strokeWidth="0.8" />
        <line x1="14" y1="25" x2="14" y2="33" stroke="#666" strokeWidth="0.6" />
        <line x1="10" y1="29" x2="18" y2="29" stroke="#666" strokeWidth="0.6" />
      </g>
      <g className={driving ? "animate-wheel-spin" : ""}>
        <circle cx="26" cy="29" r="5" fill="#0a0a0a" stroke="#444" strokeWidth="0.8" />
        <line x1="26" y1="25" x2="26" y2="33" stroke="#666" strokeWidth="0.6" />
      </g>
      <g className={driving ? "animate-wheel-spin" : ""}>
        <circle cx="56" cy="29" r="5" fill="#0a0a0a" stroke="#444" strokeWidth="0.8" />
        <line x1="56" y1="25" x2="56" y2="33" stroke="#666" strokeWidth="0.6" />
      </g>
      {/* farol piscando */}
      <circle cx="65" cy="17" r="0.9" fill="#fff" className="animate-blink" />
    </svg>
  );
}