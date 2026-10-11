import type { Box } from "@/lib/receipts/types";

/** Shows just one part of the receipt photo, e.g. the line being asked about. */
export function Crop({
  src,
  width,
  height,
  box,
  className = "",
}: {
  src: string;
  width: number;
  height: number;
  box: Box;
  className?: string;
}) {
  const pad = 10;
  const x = Math.max(0, box.x0 - pad);
  const y = Math.max(0, box.y0 - pad);
  const w = Math.min(width, box.x1 + pad) - x;
  const h = Math.min(height, box.y1 + pad) - y;
  return (
    <svg
      viewBox={`${x} ${y} ${w} ${h}`}
      className={`block w-full rounded-xl bg-ivory ring-1 ring-white/10 ${className}`}
      role="img"
      aria-label="That line on the receipt"
    >
      <image href={src} width={width} height={height} />
    </svg>
  );
}
