import type { FaceVisualization } from "@/lib/analysis-schema";
import { FACE_REGIONS, overlayPoint } from "@/lib/face-overlay";

/** One image/landmark transform, shared by FaceScan and MogBattle. No inference. */
export function FaceLandmarkPortrait({ photoUrl, data, visible = true, region = "all", monochrome = false,
  label = "Selfie original com geometria facial detectada", testId = "face-overlay" }: {
  photoUrl: string; data: FaceVisualization; visible?: boolean; region?: string; monochrome?: boolean; label?: string; testId?: string;
}) {
  const { width, height, landmarks } = data;
  const points = landmarks.map((point) => overlayPoint(point, width, height));
  const selected = FACE_REGIONS.filter(({ key }) => region === "all" || region === key);
  const highlighted = new Set(selected.flatMap(({ edges }) => edges.flatMap(([a, b]) => [a, b])));
  return (
    <svg data-testid={testId} role="img" aria-label={label} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid slice" width={width} height={height} className="portrait-svg">
      <title>{label}</title>
      <image href={photoUrl} width={width} height={height} preserveAspectRatio="none" style={{ imageOrientation: "from-image", filter: monochrome ? "grayscale(1)" : undefined }} />
      <g data-testid="landmark-layer" aria-hidden="true" className={`facial-landmarks ${visible ? "" : "facial-landmarks--hidden"}`}>
        {selected.map(({ key, edges }) => (
          <g key={key} data-region={key} fill="none" stroke="#8CCBFF" strokeWidth={region === "all" ? 0.8 : 1.2} strokeOpacity={0.8}>
            {edges.map(([a, b]) => points[a] && points[b] ? <line key={`${a}-${b}`} x1={points[a]!.x} y1={points[a]!.y} x2={points[b]!.x} y2={points[b]!.y} vectorEffect="non-scaling-stroke" /> : null)}
          </g>
        ))}
        {points.map((point, index) => point && (region === "all" || highlighted.has(index)) ? <circle key={index} data-landmark={index} cx={point.x} cy={point.y} r={Math.max(width, height) * (highlighted.has(index) ? .0025 : .0015)} fill={highlighted.has(index) ? "#EDF5FF" : "#8CCBFF"} opacity={highlighted.has(index) ? 1 : .5} /> : null)}
      </g>
    </svg>
  );
}
