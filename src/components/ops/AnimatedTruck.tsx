import truckImg from "@/assets/truck.png";

interface Props {
  className?: string;
  driving?: boolean;
}

export function AnimatedTruck({ className, driving = true }: Props) {
  return (
    <img
      src={truckImg}
      alt="Caminhão"
      loading="lazy"
      className={`object-contain ${driving ? "animate-truck-bounce" : ""} ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
    />
  );
}
