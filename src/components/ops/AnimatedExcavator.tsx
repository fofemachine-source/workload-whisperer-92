import excavatorAsset from "@/assets/excavator_hq.png.asset.json";

interface Props {
  className?: string;
  animate?: boolean;
  color?: string;
}

export function AnimatedExcavator({ className, animate = true }: Props) {
  return (
    <img
      src={excavatorAsset.url}
      alt="Escavadeira"
      className={`object-contain ${animate ? "animate-excavator-work" : ""} ${className ?? ""}`}
      style={{ filter: "drop-shadow(0 0 6px rgba(34,197,94,0.5))", transform: "scaleX(-1)" }}
    />
  );
}
