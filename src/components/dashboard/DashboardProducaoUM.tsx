import { useCallback, useMemo, useState, useEffect, useRef, memo } from "react";
import { motion } from "framer-motion";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  return (
    <div className={`animate-truck-idle-move flex items-center justify-center ${className}`}>
      <img
        src={truckNeon}
        alt="Caminhão"
        className="w-full h-full object-contain"
        style={{ filter: "drop-shadow(0 0 6px rgba(245,180,0,0.75)) drop-shadow(0 0 12px rgba(245,180,0,0.35))" }}
      />
    </div>
  );
}
