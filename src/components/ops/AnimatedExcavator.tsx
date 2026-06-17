import excavatorImg from "@/assets/excavator.png";

interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

export function AnimatedExcavator({ className, animate = true }: Props) {
  return (
    <span className={`inline-flex items-center justify-center ${className ?? ""}`}>
      <img
        src={excavatorImg}
        alt="Escavadeira"
        className={`h-full w-full object-contain ${animate ? "animate-excavator-work" : ""}`}
        style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.5)) brightness(1.35) contrast(1.1)" }}
      />
    </span>
  );
}
