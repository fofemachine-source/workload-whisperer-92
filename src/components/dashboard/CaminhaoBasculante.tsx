import React from 'react';
import { motion } from 'framer-motion';
import truckNeon from "@/assets/truck.png";

export const CaminhaoBasculante = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* CHASSI E CABINE FIXOS (Recorte da parte de baixo e frente) */}
      <img
        src={`${truckNeon}?v=2`}
        alt="Chassi"
        className="absolute w-full h-full object-contain"
        style={{
          clipPath: "polygon(0% 48%, 62% 48%, 62% 0%, 100% 0%, 100% 100%, 0% 100%)",
          filter: "drop-shadow(0 0 6px rgba(245,180,0,0.75))"
        }}
      />
      
      {/* CAÇAMBA ANIMADA (Recorte da parte de cima e trás) */}
      <motion.img
        src={`${truckNeon}?v=2`}
        alt="Báscula"
        className="absolute w-full h-full object-contain"
        initial={{ rotate: 0 }}
        animate={{ rotate: [0, -35, -35, 0] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          repeatDelay: 2,
          ease: "easeInOut",
          times: [0, 0.4, 0.6, 1]
        }}
        style={{
          clipPath: "polygon(0% 0%, 62% 0%, 62% 48%, 0% 48%)",
          transformOrigin: "30% 55%", // Eixo de rotação aproximado no pino traseiro do caminhão original
          filter: "drop-shadow(0 0 6px rgba(245,180,0,0.75))"
        }}
      />
    </div>
  );
};
