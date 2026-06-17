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
      className={`object-contain ${animate ? "animate-excavator-work" : ""} ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.5)) brightness(1.35) contrast(1.1)" }}
    />
  );
}
