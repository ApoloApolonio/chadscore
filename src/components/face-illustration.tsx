// Authored illustration coordinates, NOT MediaPipe data or a scoring reference.
// One half is mirrored to keep the angular wireframe exactly symmetrical.
const leftContours = [
  "200,44 166,46 138,59 118,82 108,116 106,154 102,190 108,230 108,265 126,288 151,307 174,322 200,326",
  "106,154 92,149 88,166 94,199 106,209",
  "94,163 99,172 96,184 104,195",
  "128,292 132,325 130,350 90,377 62,390",
  "151,307 153,340 176,370 200,378",
  "130,350 153,340 177,348 200,354",
  "130,350 147,370 200,378",
  "118,137 133,131 153,132 176,136 180,143 153,140 130,140 118,143",
  "128,155 143,149 164,150 179,154 165,161 144,162 128,155",
  "126,165 145,172 165,169 180,161",
  "108,182 128,178 151,184 172,196",
  "102,190 124,207 146,213 164,228",
  "124,207 116,231 126,259 146,281",
  "146,213 159,239 164,252",
  "194,148 192,177 190,196 185,211 190,220 200,225",
  "180,213 184,220 193,221 200,225",
  "200,211 193,214 190,220",
  "164,252 180,249 192,246 200,249",
  "164,252 180,262 200,265",
  "164,252 183,254 200,255",
  "180,277 188,282 200,284",
  "151,307 167,289 185,299 200,300",
  "174,322 182,312 200,314",
];

const leftMesh = [
  "200,44 176,85 200,96",
  "166,46 176,85 138,59 140,100 118,82",
  "176,85 140,100 153,132 176,136 200,126",
  "108,116 140,100 130,140 106,154 128,155",
  "140,100 118,137 108,116",
  "176,85 176,136 194,148 200,126",
  "176,136 179,154 194,148 192,177 180,161",
  "106,154 128,155 126,165 108,182 102,190",
  "126,165 151,184 145,172 165,169 172,196 192,177",
  "128,178 124,207 151,184 146,213 172,196 185,211",
  "102,190 116,231 108,230 108,265 126,259 126,288 146,281 151,307",
  "124,207 126,259 146,213 180,213 159,239 185,211",
  "126,259 164,252 146,281 167,289 180,262 180,277",
  "159,239 180,249 184,220 192,246 193,221 200,239",
  "164,252 167,289 188,282 200,265",
  "167,289 174,322 185,299 182,312",
  "108,265 146,281 128,292 132,325 151,307",
  "132,325 153,340 174,322 177,348",
];

const midpointChain = "200,44 200,70 200,96 200,126 200,148 200,177 200,196 200,211 200,225 200,239 200,249 200,255 200,265 200,284 200,300 200,314 200,326 200,354 200,378";
const halfPoints = [...leftContours, ...leftMesh, midpointChain].flatMap((chain) => chain.split(" ").map((point) => point.split(",").map(Number)));
const points = [...new Map(halfPoints.flatMap(([x, y]) => [[x, y], [400 - x, y]]).map(([x, y]) => [`${x},${y}`, [x, y] as const] as const)).values()];

/** Decorative male wireframe only. Never imported by detection or calibration. */
export function FaceIllustration() {
  return (
    <svg aria-hidden="true" data-illustration="stylized-male" viewBox="0 0 400 400" fill="none" className="face-illustration h-full w-full">
      <g className="face-float">
        {/* Restrained planar reflections; the canvas and silhouette stay transparent. */}
        <g fill="#EDF5FF" fillOpacity=".025">
          <path d="M108 182L128 178L151 184L146 213L124 207ZM292 182L272 178L249 184L254 213L276 207Z" />
          <path d="M108 265L126 259L146 281L174 322L151 307L126 288ZM292 265L274 259L254 281L226 322L249 307L274 288Z" />
          <path d="M185 299L200 300L215 299L226 322L200 326L174 322Z" />
        </g>
        {[false, true].map((mirror) => (
          <g key={String(mirror)} transform={mirror ? "translate(400 0) scale(-1 1)" : undefined}>
            <g stroke="#8CCBFF" strokeWidth=".65" strokeOpacity=".27" strokeLinejoin="round">
              {leftMesh.map((chain, i) => <polyline key={i} points={chain} />)}
            </g>
            <g stroke="#8CCBFF" strokeWidth=".95" strokeOpacity=".65" strokeLinejoin="round" strokeLinecap="round">
              {leftContours.map((chain, i) => <polyline key={i} points={chain} />)}
            </g>
            {/* Low, straight brow and narrow orbital rim, without cartoon outlines. */}
            <path d="M118 137L133 131L153 132L176 136L180 143L153 140L130 140L118 143Z" fill="#EDF5FF" fillOpacity=".06" stroke="#EDF5FF" strokeOpacity=".55" strokeWidth=".8" />
            <path d="M128 155L143 149L164 150L179 154M108 265L126 288L151 307L174 322" stroke="#EDF5FF" strokeOpacity=".6" strokeWidth="1.05" />
            <ellipse cx="154" cy="156" rx="4" ry="3.2" stroke="#EDF5FF" strokeOpacity=".35" strokeWidth=".6" />
            <circle cx="154" cy="156" r=".9" fill="#EDF5FF" opacity=".6" />
          </g>
        ))}
        <polyline points={midpointChain} stroke="#EDF5FF" strokeWidth=".55" strokeOpacity=".18" />
        <g className="illustration-points">
          {points.map(([x, y]) => <circle key={`${x},${y}`} cx={x} cy={y} fill={x === 200 || y >= 288 ? "#EDF5FF" : "#8CCBFF"} r={y >= 265 && y <= 326 ? 1.65 : 1.1} opacity={(Math.min(x, 400 - x) + y) % 3 === 0 ? .85 : .6} />)}
        </g>
      </g>
    </svg>
  );
}
