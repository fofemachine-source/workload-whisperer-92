import React from 'react';
import { motion } from 'framer-motion';

export const CaminhaoBasculante = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center bg-transparent ${className}`}>
      <svg viewBox="0 0 400 300" className="w-full h-full drop-shadow-[0_0_12px_rgba(245,180,0,0.5)]">
        {/* CHASSI E CABINE FIXOS */}
        <g id="chassi-cabine">
          {/* Cabine Amarela Komatsu */}
          <path d="M 260 180 L 320 180 L 300 120 L 250 120 Z" fill="#eab308" stroke="#18181b" strokeWidth="3" />
          {/* Grelha e Detalhes da Frente */}
          <rect x="290" y="140" width="25" height="35" fill="#27272a" />
          {/* Rodas Traseiras e Dianteiras */}
          <circle cx="110" cy="210" r="30" fill="#18181b" stroke="#71717a" strokeWidth="6" />
          <circle cx="280" cy="210" r="30" fill="#18181b" stroke="#71717a" strokeWidth="6" />
          <circle cx="110" cy="210" r="12" fill="#eab308" />
          <circle cx="280" cy="210" r="12" fill="#eab308" />
        </g>
        
        {/* CAÇAMBA ANIMADA (BASCULAMENTO) */}
        <motion.g
          id="cacamba"
          initial={{ rotate: 0 }}
          animate={{ rotate: [0, -35, -35, 0] }}
          transition={{
            duration: 6,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
            times: [0, 0.4, 0.6, 1]
          }}
          style={{ transformOrigin: "90px 170px" }} // Ponto de articulação ajustado para trás, perto do eixo traseiro
        >
          {/* Geometria da Caçamba Komatsu */}
          <path
            d="M 60 170 L 250 170 L 280 90 L 50 90 Z"
            fill="#eab308"
            stroke="#18181b"
            strokeWidth="4"
          />
          {/* Viseira Superior da Caçamba */}
          <path d="M 250 90 L 310 70 L 280 90 Z" fill="#ca8a04" />
          {/* Linhas / Frisos laterais da caçamba */}
          <line x1="90" y1="90" x2="100" y2="170" stroke="#ca8a04" strokeWidth="4" />
          <line x1="140" y1="90" x2="150" y2="170" stroke="#ca8a04" strokeWidth="4" />
          <line x1="190" y1="90" x2="200" y2="170" stroke="#ca8a04" strokeWidth="4" />
          <line x1="240" y1="90" x2="250" y2="170" stroke="#ca8a04" strokeWidth="4" />
          
          {/* Texto HD785 */}
          <rect x="120" y="115" width="65" height="25" fill="#18181b" />
          <text x="125" y="133" fill="#eab308" fontSize="16" fontWeight="bold">HD785</text>
        </motion.g>
      </svg>
    </div>
  );
};
