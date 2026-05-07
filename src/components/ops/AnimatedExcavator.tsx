interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

export function AnimatedExcavator({ className, animate = true, color = "#FACC15" }: Props) {
  return (
    <svg viewBox="0 0 80 50" className={className} aria-hidden>
      {/* esteira */}
      <rect x="6" y="36" width="60" height="8" rx="3" fill="#111" stroke="#333" strokeWidth="0.6" />
      <circle cx="12" cy="40" r="3" fill="#222" stroke="#444" strokeWidth="0.4" />
      <circle cx="36" cy="40" r="3" fill="#222" stroke="#444" strokeWidth="0.4" />
      <circle cx="60" cy="40" r="3" fill="#222" stroke="#444" strokeWidth="0.4" />
      {/* corpo */}
      <path d="M14 36 L14 24 L52 24 L52 36 Z" fill={color} stroke="#000" strokeWidth="0.6" />
      <rect x="34" y="18" width="14" height="8" fill={color} stroke="#000" strokeWidth="0.6" />
      <rect x="36" y="20" width="10" height="4" fill="#0EA5E9" opacity="0.85" />
      {/* braço articulado */}
      <g className={animate ? "animate-excavator-arm" : ""}>
        <rect x="16" y="20" width="22" height="3" rx="1" fill="#111" stroke="#444" strokeWidth="0.4" />
        <rect x="35" y="22" width="18" height="2.4" rx="1" fill="#111" stroke="#444" strokeWidth="0.4" transform="rotate(35 35 22)" />
        <path d="M58 36 L66 36 L64 42 L60 42 Z" fill={color} stroke="#000" strokeWidth="0.5" />
      </g>
      {/* luz piscando */}
      <circle cx="48" cy="20" r="0.8" fill="#22c55e" className="animate-blink" />
    </svg>
  );
}