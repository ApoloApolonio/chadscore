import { useId } from "react";
import { formatScore } from "@/lib/score-classification";

export function ScoreRing({ value, label, testId, descriptionId }: { value: number | null; label: string; testId: string; descriptionId?: string }) {
  const gradient = useId();
  return (
    <div className="score-ring" role={value === null ? "group" : "meter"} aria-label={`${label}: ${value === null ? "não estimado" : formatScore(value)}`} aria-describedby={descriptionId} aria-valuemin={value === null ? undefined : 0} aria-valuemax={value === null ? undefined : 10} aria-valuenow={value ?? undefined}>
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <defs><linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#CDD8E7" /><stop offset=".5" stopColor="#EDF5FF" /><stop offset="1" stopColor="#8CCBFF" /></linearGradient></defs>
        <circle cx="64" cy="64" r="54" fill="none" stroke="#1c1c1c" strokeWidth="3" />
        {value !== null && <circle data-ring-value={value} className="score-ring-fill" cx="64" cy="64" r="54" fill="none" stroke={`url(#${gradient})`} strokeWidth="3" strokeLinecap={value === 0 ? "butt" : "round"} pathLength="100" strokeDasharray={`${value * 10} 100`} transform="rotate(-90 64 64)" />}
      </svg>
      <div className="score-ring-copy"><span className="score-value" data-testid={testId}>{formatScore(value)}</span><span className="score-denominator">/ 10,0</span></div>
      <p className="score-caption">{label}</p>
    </div>
  );
}
