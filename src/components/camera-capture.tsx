"use client";

import { useEffect, useRef, useState } from "react";

export function CameraCapture({ onCapture, onClose, onSelect }: { onCapture: (file: File) => void; onClose: () => void; onSelect: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const active = useRef(true);

  function stopCamera() {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  function closeCamera() {
    // Remove modal inertness before returning keyboard focus to the page.
    dialog.current?.close();
    onClose();
  }

  useEffect(() => {
    active.current = true;
    dialog.current?.showModal();
    return () => { active.current = false; stopCamera(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function openCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } } });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
        if (!cancelled) setReady(true);
      } catch (cause) {
        if (cancelled) return;
        stopCamera();
        const denied = cause instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(cause.name);
        setError(denied ? "Permissão de câmera não concedida. Você pode selecionar uma foto." : "Câmera indisponível. Selecione uma foto da sua galeria ou arquivos.");
      }
    }
    void openCamera();
    return () => { cancelled = true; stopCamera(); };
  }, [attempt]);

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  async function capture() {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight || capturing) return;
    setCapturing(true);
    try {
      const scale = Math.min(1, 1280 / Math.max(source.videoWidth, source.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(source.videoWidth * scale); canvas.height = Math.round(source.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      // Save the unmirrored frame: preview, inference and landmarks use the same image.
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", .92));
      canvas.width = canvas.height = 0;
      if (!active.current) return;
      if (!blob) throw new Error("capture");
      stopCamera();
      setReady(false);
      const file = new File([blob], "selfie-camera.jpg", { type: "image/jpeg" });
      setShot({ file, url: URL.createObjectURL(file) });
    } catch {
      if (active.current) setError("Não foi possível capturar. Tente novamente ou selecione uma foto.");
    } finally { if (active.current) setCapturing(false); }
  }

  return (
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); closeCamera(); }} aria-labelledby="camera-title" className="camera-dialog glass-card w-[calc(100%_-_2rem)] max-w-md p-5 text-slate-100">
      <div className="flex items-center justify-between gap-3">
        <h2 id="camera-title" className="text-sm font-medium">{shot ? "Confirmar selfie" : "Sua câmera"}</h2>
        <button type="button" onClick={closeCamera} className="blue-focus rounded-lg px-3 py-2 text-xs text-blue-200">Fechar câmera</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl bg-black/30">
        {shot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="Selfie capturada para confirmação" className="max-h-[50svh] w-full object-contain" />
        ) : <video ref={video} autoPlay muted playsInline aria-label="Prévia da câmera" className="max-h-[50svh] min-h-48 w-full object-contain" />}
      </div>
      <p role="status" className="mt-3 text-xs text-slate-400">{error || (!shot && !ready ? "Aguardando permissão da câmera…" : "")}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {shot ? <>
          <button type="button" onClick={() => { dialog.current?.close(); onCapture(shot.file); onClose(); }} className="primary-button blue-focus rounded-xl px-4 py-3 text-xs font-semibold">Usar esta foto</button>
          <button type="button" onClick={() => { setShot(null); setError(""); setAttempt((n) => n + 1); }} className="blue-focus rounded-xl px-4 py-3 text-xs text-blue-200">Tirar outra foto</button>
        </> : <button type="button" disabled={!ready || capturing} onClick={capture} className="primary-button blue-focus rounded-xl px-4 py-3 text-xs font-semibold disabled:opacity-40">{capturing ? "Capturando…" : "Capturar selfie"}</button>}
        <button type="button" onClick={() => { dialog.current?.close(); onSelect(); }} className="photo-select-button blue-focus px-4 py-3 text-xs">Selecionar foto</button>
      </div>
    </dialog>
  );
}
