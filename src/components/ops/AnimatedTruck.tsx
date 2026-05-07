interface Props {
  className?: string;
  driving?: boolean;
  color?: string;
}

/**
 * Caminhão fora-de-estrada estilo Komatsu HD785/HD730 (mineração).
 * Caçamba alta inclinada, cabine na frente embaixo, duas rodas gigantes traseiras
 * e uma dianteira menor — silhueta industrial igual ao painel de referência.
 */
export function AnimatedTruck({ className, driving = true, color = "#FACC15" }: Props) {
  const dark = "#1f2937";
  const stroke = "#0a0a0a";
  return (
    <svg viewBox="0 0 120 70" className={className} aria-hidden>
      {/* sombra no chão */}
      <ellipse cx="60" cy="64" rx="50" ry="2.2" fill="#000" opacity="0.45" />

      {/* CAÇAMBA — grande, inclinada para trás, com reforço superior */}
      <path
        d="M6 14 L98 18 L104 38 L18 38 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {/* borda superior reforçada (canopy) */}
      <path d="M6 14 L98 18 L98 22 L6 18 Z" fill="#000" opacity="0.35" />
      {/* sombra interna lateral da caçamba */}
      <path d="M18 38 L24 22 L94 25 L98 38 Z" fill="#000" opacity="0.18" />
      {/* nervuras verticais */}
      <line x1="40" y1="20" x2="42" y2="36" stroke="#000" strokeWidth="0.6" opacity="0.4" />
      <line x1="60" y1="21" x2="62" y2="37" stroke="#000" strokeWidth="0.6" opacity="0.4" />
      <line x1="80" y1="22" x2="82" y2="37" stroke="#000" strokeWidth="0.6" opacity="0.4" />

      {/* CHASSI / longarina */}
      <rect x="14" y="38" width="92" height="6" fill={dark} stroke={stroke} strokeWidth="0.6" />
      <rect x="14" y="42" width="92" height="2" fill="#000" opacity="0.5" />

      {/* CABINE (frente, à direita, embaixo da caçamba dianteira) */}
      <path
        d="M86 44 L86 30 L100 30 L106 38 L106 44 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="1"
      />
      {/* janela */}
      <path d="M89 33 L99 33 L103 38 L89 38 Z" fill="#0EA5E9" opacity="0.85" />
      <path d="M89 33 L99 33 L103 38 L89 38 Z" fill="none" stroke="#000" strokeWidth="0.4" />
      {/* faróis */}
      <circle cx="104" cy="42" r="1.1" fill="#fff" className="animate-blink" />
      <circle cx="100" cy="42" r="0.8" fill="#fde68a" />

      {/* escada lateral da cabine */}
      <line x1="86" y1="46" x2="88" y2="58" stroke={dark} strokeWidth="0.8" />
      <line x1="84" y1="48" x2="84" y2="58" stroke={dark} strokeWidth="0.8" />
      <line x1="84" y1="50" x2="88" y2="50" stroke={dark} strokeWidth="0.6" />
      <line x1="84" y1="54" x2="88" y2="54" stroke={dark} strokeWidth="0.6" />

      {/* RODAS — duas traseiras gigantes geminadas + uma dianteira */}
      {/* traseira (dupla) */}
      <g className={driving ? "animate-wheel-spin" : ""} style={{ transformOrigin: "26px 52px", transformBox: "fill-box" } as React.CSSProperties}>
        <circle cx="26" cy="52" r="11" fill="#0a0a0a" stroke="#444" strokeWidth="1" />
        <circle cx="26" cy="52" r="4.5" fill="#2a2a2a" stroke="#666" strokeWidth="0.6" />
        <line x1="26" y1="42" x2="26" y2="62" stroke="#555" strokeWidth="0.7" />
        <line x1="16" y1="52" x2="36" y2="52" stroke="#555" strokeWidth="0.7" />
        <line x1="19" y1="45" x2="33" y2="59" stroke="#555" strokeWidth="0.5" />
        <line x1="19" y1="59" x2="33" y2="45" stroke="#555" strokeWidth="0.5" />
      </g>
      <g className={driving ? "animate-wheel-spin" : ""} style={{ transformOrigin: "48px 52px", transformBox: "fill-box" } as React.CSSProperties}>
        <circle cx="48" cy="52" r="11" fill="#0a0a0a" stroke="#444" strokeWidth="1" />
        <circle cx="48" cy="52" r="4.5" fill="#2a2a2a" stroke="#666" strokeWidth="0.6" />
        <line x1="48" y1="42" x2="48" y2="62" stroke="#555" strokeWidth="0.7" />
        <line x1="38" y1="52" x2="58" y2="52" stroke="#555" strokeWidth="0.7" />
      </g>
      {/* dianteira */}
      <g className={driving ? "animate-wheel-spin" : ""} style={{ transformOrigin: "94px 52px", transformBox: "fill-box" } as React.CSSProperties}>
        <circle cx="94" cy="52" r="10" fill="#0a0a0a" stroke="#444" strokeWidth="1" />
        <circle cx="94" cy="52" r="4" fill="#2a2a2a" stroke="#666" strokeWidth="0.6" />
        <line x1="94" y1="43" x2="94" y2="61" stroke="#555" strokeWidth="0.7" />
        <line x1="85" y1="52" x2="103" y2="52" stroke="#555" strokeWidth="0.7" />
      </g>

      {/* luz de status no topo */}
      <circle cx="92" cy="29" r="1" fill="#22c55e" className="animate-blink" />
    </svg>
  );
}