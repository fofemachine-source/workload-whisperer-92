import excavatorImg from "@/assets/excavator.png";

interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

export function AnimatedExcavator({ className, animate = true }: Props) {
  return (
    <img
      src={excavatorImg}
      alt="Escavadeira"
      loading="lazy"
      className={`object-contain ${animate ? "animate-excavator-work" : ""} ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6))" }}
    />
  );
}
