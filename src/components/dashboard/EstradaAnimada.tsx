import truckImg from "@/assets/truck.png";

export const EstradaAnimada = () => {
  return (
    <div className="w-full h-20 relative overflow-hidden rounded-xl border border-[hsl(var(--mining-green)/0.25)] bg-[hsl(222_45%_6%/0.8)] backdrop-blur-md my-3">
      {/* Road surface texture */}
      <div className="absolute inset-0 opacity-20 ops-grid-bg" />

      {/* Top lane edge */}
      <div className="absolute top-1 left-0 right-0 h-px bg-[hsl(var(--mining-green)/0.35)]" />
      {/* Bottom lane edge */}
      <div className="absolute bottom-1 left-0 right-0 h-px bg-[hsl(var(--mining-green)/0.35)]" />

      {/* Center dashed line */}
      <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0 flex items-center gap-3 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="inline-block h-0.5 w-8 rounded-full bg-[hsl(var(--mining-green)/0.55)] shadow-[0_0_6px_hsl(var(--mining-green)/0.6)]"
          />
        ))}
      </div>

      {/* Truck 1 - slow lane, 18s */}
      <div className="absolute top-2 left-0 animate-drive-slow">
        <div className="animate-truck-bounce-slow flex items-center justify-center">
          <img
            src={truckImg}
            alt="Caminhão"
            className="h-[60px] w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 6px rgba(234,179,8,0.75)) drop-shadow(0 0 14px rgba(234,179,8,0.45))",
            }}
          />
        </div>
      </div>

      {/* Truck 2 - fast lane, 12s with 5s delay */}
      <div className="absolute bottom-2 left-0 animate-drive-fast">
        <div className="animate-truck-bounce-fast flex items-center justify-center">
          <img
            src={truckImg}
            alt="Caminhão"
            className="h-[60px] w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 6px rgba(234,179,8,0.75)) drop-shadow(0 0 14px rgba(234,179,8,0.45))",
            }}
          />
        </div>
      </div>

      {/* Truck 3 - medium lane, 15s with 9s delay */}
      <div className="absolute top-4 left-0 animate-drive-medium">
        <div className="animate-truck-bounce-medium flex items-center justify-center">
          <img
            src={truckImg}
            alt="Caminhão"
            className="h-[60px] w-auto object-contain"
            style={{
              filter: "drop-shadow(0 0 6px rgba(234,179,8,0.75)) drop-shadow(0 0 14px rgba(234,179,8,0.45))",
            }}
          />
        </div>
      </div>
    </div>
  );
};
