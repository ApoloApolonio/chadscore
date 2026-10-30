"use client";

import { useRef, useState } from "react";
import { CameraCapture } from "./camera-capture";
import { FaceIllustration } from "./face-illustration";
import { SELFIE_ACCEPT } from "@/lib/selfie";
import type { useBattlePhoto } from "./use-battle-photo";

export function BattleParticipant({ index, name, onName, draft, disabled }: {
  index: 0 | 1; name: string; onName: (name: string) => void; draft: ReturnType<typeof useBattlePhoto>; disabled: boolean;
}) {
  const [camera, setCamera] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const cameraButton = useRef<HTMLButtonElement>(null);
  const label = `Participante ${index + 1}`;
  const busy = disabled || draft.validating;
  return <section className="result-bubble battle-participant" aria-label={label} aria-busy={busy}>
    <h2>{label}</h2>
    <label className="battle-name-label">Nome (opcional)<input aria-label={`Nome do ${label.toLowerCase()}`} value={name} onChange={(event) => onName(event.target.value)} maxLength={40} disabled={disabled} autoComplete="off" /></label>
    <div className="battle-draft-portrait">
      {draft.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={draft.photo.url} alt={`Selfie do ${label.toLowerCase()}`} />
      ) : <FaceIllustration />}
    </div>
    <input ref={file} type="file" accept={SELFIE_ACCEPT} hidden disabled={busy} aria-label={`Foto do ${label.toLowerCase()}`} onChange={(event) => { const image = event.target.files?.[0]; event.target.value = ""; if (image) void draft.select(image); }} />
    <div className="battle-photo-actions">
      <button ref={cameraButton} type="button" disabled={busy} onClick={() => setCamera(true)} className="photo-choice blue-focus">Tirar foto</button>
      <button type="button" disabled={busy} onClick={() => file.current?.click()} className="photo-select-button blue-focus">{draft.photo ? "Trocar foto" : "Selecionar foto"}</button>
    </div>
    {draft.photo && <button type="button" disabled={disabled} className="subtle-control blue-focus" onClick={() => { draft.remove(); cameraButton.current?.focus(); }}>Remover foto</button>}
    {draft.validating && <p role="status">Validando imagem…</p>}
    {draft.error && <p role="alert" className="battle-error">{draft.error}</p>}
    {camera && <CameraCapture onCapture={(image) => { void draft.select(image); }} onClose={() => { setCamera(false); cameraButton.current?.focus(); }} onSelect={() => { setCamera(false); file.current?.click(); }} />}
  </section>;
}
