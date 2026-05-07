interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

/**
 * Escavadeira de mineração estilo Hitachi EX1200/EX2500:
 * esteira larga, corpo giratório (house) com cabine na frente,
 * lança (boom) inclinada para cima, braço (stick) e caçamba (bucket) com dentes.
 */
export function AnimatedExcavator({ className, animate = true, color = "#FACC15" }: Props) {
  const dark = "#1f2937";
  const stroke = "#0a0a0a";
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden>
      {/* sombra */}
      <ellipse cx="60" cy="74" rx="45" ry="2" fill="#000" opacity="0.45" />

      {/* ESTEIRA */}
      <rect x="14" y="58" width="84" height="14" rx="6" fill="#111" stroke="#333" strokeWidth="0.8" />
      <rect x="18" y="60" width="76" height="10" rx="4" fill="#000" />
      {/* sapatas */}
      {Array.from({ length: 14 }).map((_, i) => (
        <line
          key={i}
          x1={20 + i * 5.5}
          y1="60"
          x2={20 + i * 5.5}
          y2="70"
          stroke="#333"
          strokeWidth="0.6"
        />
      ))}
      {/* roda motriz e roda guia */}
      <circle cx="22" cy="65" r="5" fill="#0a0a0a" stroke="#444" strokeWidth="0.7" />
      <circle cx="22" cy="65" r="1.6" fill="#2a2a2a" />
      <circle cx="90" cy="65" r="5" fill="#0a0a0a" stroke="#444" strokeWidth="0.7" />
      <circle cx="90" cy="65" r="1.6" fill="#2a2a2a" />
      {/* roletes */}
      <circle cx="38" cy="68" r="2" fill="#222" />
      <circle cx="54" cy="68" r="2" fill="#222" />
      <circle cx="70" cy="68" r="2" fill="#222" />

      {/* CORPO GIRATÓRIO (house) — base preta + corpo amarelo */}
      <rect x="22" y="50" width="72" height="6" fill={dark} />
      <path
        d="M26 50 L26 36 L84 36 L90 50 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {/* contrapeso traseiro */}
      <path d="M22 50 L22 42 L30 38 L30 50 Z" fill={color} stroke={stroke} strokeWidth="0.8" />
      <line x1="24" y1="44" x2="28" y2="44" stroke="#000" strokeWidth="0.5" opacity="0.5" />
      <line x1="24" y1="47" x2="28" y2="47" stroke="#000" strokeWidth="0.5" opacity="0.5" />

      {/* CABINE (frente, à direita do operador) */}
      <path
        d="M62 36 L62 22 L80 22 L84 36 Z"
        fill={color}
        stroke={stroke}
        strokeWidth="0.9"
      />
      {/* janela */}
      <path d="M64 24 L78 24 L82 34 L64 34 Z" fill="#0EA5E9" opacity="0.85" />
      <path d="M64 24 L78 24 L82 34 L64 34 Z" fill="none" stroke="#000" strokeWidth="0.4" />

      {/* luz de status */}
      <circle cx="78" cy="20" r="1" fill="#22c55e" className="animate-blink" />

      {/* LANÇA + BRAÇO + CAÇAMBA — articulados (animação balança) */}
      <g className={animate ? "animate-excavator-arm" : ""} style={{ transformOrigin: "60px 36px", transformBox: "fill-box" } as React.CSSProperties}>
        {/* lança (boom) - sobe da base do corpo até cima à esquerda */}
        <path
          d="M58 36 L20 8 L14 14 L54 42 Z"
          fill={color}
          stroke={stroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* cilindro hidráulico do boom */}
        <line x1="50" y1="34" x2="30" y2="20" stroke="#444" strokeWidth="2" />
        <line x1="50" y1="34" x2="30" y2="20" stroke="#888" strokeWidth="0.8" />
        {/* pivô */}
        <circle cx="20" cy="11" r="1.5" fill="#000" />

        {/* braço (stick) */}
        <path
          d="M16 8 L4 30 L10 34 L22 14 Z"
          fill={color}
          stroke={stroke}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* cilindro do stick */}
        <line x1="22" y1="14" x2="10" y2="28" stroke="#888" strokeWidth="0.7" />

        {/* caçamba (bucket) com dentes */}
        <path
          d="M2 28 L14 26 L18 36 L8 40 Z"
          fill={color}
          stroke={stroke}
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* dentes */}
        <path d="M3 36 L1 39 L4 39 Z" fill={dark} />
        <path d="M7 38 L5 41 L9 41 Z" fill={dark} />
        <path d="M11 39 L9 42 L13 42 Z" fill={dark} />
        <path d="M15 39 L13 42 L17 42 Z" fill={dark} />
      </g>
    </svg>
  );
}