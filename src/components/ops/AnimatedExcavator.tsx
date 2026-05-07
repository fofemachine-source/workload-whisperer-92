interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

export function AnimatedExcavator({ className, animate = true, color = "hsl(var(--mining-yellow))" }: Props) {
  return (
    <svg
      viewBox="0 0 200 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Escavadeira operando"
      className={`object-contain ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
    >
      {/* Esteiras */}
      <rect x="20" y="92" width="120" height="18" rx="9" fill="#1a1a1a" stroke="#333" strokeWidth="1.5" />
      <circle cx="34" cy="101" r="6" fill="#444" />
      <circle cx="60" cy="101" r="6" fill="#444" />
      <circle cx="86" cy="101" r="6" fill="#444" />
      <circle cx="112" cy="101" r="6" fill="#444" />
      <circle cx="132" cy="101" r="6" fill="#444" />

      {/* Cabine / corpo */}
      <rect x="42" y="58" width="70" height="34" rx="4" fill={color} stroke="#000" strokeWidth="1.5" />
      <rect x="50" y="46" width="38" height="18" rx="3" fill={color} stroke="#000" strokeWidth="1.5" />
      <rect x="54" y="50" width="30" height="12" fill="#7ec8e3" opacity="0.7" />

      {/* Lança fixa (braço principal) */}
      <g>
        <rect x="100" y="46" width="55" height="8" rx="2" fill={color} stroke="#000" strokeWidth="1.2" transform="rotate(-25 100 50)" />
      </g>

      {/* Antebraço fixo */}
      <g transform="translate(150 18)">
        <rect x="-4" y="0" width="8" height="42" rx="2" fill={color} stroke="#000" strokeWidth="1.2" transform="rotate(35)" />
      </g>

      {/* Concha animada — pivota no ponto da articulação */}
      <g
        style={{
          transformOrigin: "175px 60px",
          transformBox: "fill-box",
        }}
        className={animate ? "animate-bucket-dig" : ""}
      >
        <path
          d="M 168 56 L 188 56 L 192 70 Q 178 82 164 72 Z"
          fill={color}
          stroke="#000"
          strokeWidth="1.5"
        />
        {/* Dentes da concha */}
        <path d="M 166 72 l -2 5 M 172 75 l -1 5 M 178 76 l 0 5 M 184 75 l 1 5 M 190 72 l 2 5" stroke="#000" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>

      <style>{`
        @keyframes bucket-dig {
          0%   { transform: rotate(-15deg); }
          40%  { transform: rotate(35deg); }
          70%  { transform: rotate(20deg); }
          100% { transform: rotate(-15deg); }
        }
        .animate-bucket-dig { animation: bucket-dig 2.2s ease-in-out infinite; transform-origin: 175px 60px; transform-box: fill-box; }
      `}</style>
    </svg>
  );
}
