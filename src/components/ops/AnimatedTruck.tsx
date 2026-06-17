import truckImg from "@/assets/truck_new.png";

interface Props {
  className?: string;
  driving?: boolean;
  color?: string;
}

export function AnimatedTruck({ className, driving = true }: Props) {
  return (
    <img
      src={truckImg}
      alt="Caminhão"
      className={`object-contain ${driving ? "animate-truck-move" : ""} ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.5)) brightness(1.4) contrast(1.1)" }}
    />
  );
}
