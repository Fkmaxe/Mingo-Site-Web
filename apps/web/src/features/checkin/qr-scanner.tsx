"use client";

import jsQR from "jsqr";
import { Camera, CameraOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

// Not in TypeScript's DOM lib yet. Available on Android Chrome, missing on iOS Safari.
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

const SCAN_INTERVAL_MS = 200;
/** The same code is ignored for this long, so one ticket held in front of the camera scans once. */
const SAME_CODE_COOLDOWN_MS = 4000;

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError")
    return "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur.";
  if (name === "NotFoundError") return "Aucune caméra trouvée sur cet appareil.";
  return "Impossible d'ouvrir la caméra. Utilise la recherche par nom.";
}

/**
 * Camera QR scanner: BarcodeDetector when the browser has it, jsQR on a canvas otherwise.
 * Calls `onScan` with each newly read code. `paused` stops reporting (not the camera).
 */
export function QrScanner({ onScan, paused }: { onScan: (code: string) => void; paused: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastRef = useRef<{ code: string; at: number } | null>(null);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  pausedRef.current = paused;
  onScanRef.current = onScan;

  const stop = useCallback(() => {
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    setRunning(false);
  }, []);

  // Camera lifecycle (a browser resource, not data loading): stop it when leaving the page.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!running) return;
    const video = videoRef.current;
    if (!video) return;
    const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const read = async (): Promise<string | null> => {
      if (video.readyState < video.HAVE_ENOUGH_DATA) return null;
      if (detector) return (await detector.detect(video))[0]?.rawValue ?? null;
      canvasRef.current ??= document.createElement("canvas");
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return (
        jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ??
        null
      );
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const code = await read();
        const now = Date.now();
        const last = lastRef.current;
        const repeated = last && last.code === code && now - last.at < SAME_CODE_COOLDOWN_MS;
        if (code && !pausedRef.current && !repeated) {
          lastRef.current = { code, at: now };
          onScanRef.current(code);
        }
      } catch {
        // A frame that cannot be read is skipped.
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [running]);

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setRunning(true);
    } catch (e) {
      stop();
      setError(cameraErrorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
        <video
          ref={videoRef}
          muted
          playsInline
          className={running ? "size-full object-cover" : "hidden"}
        />
        {running ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[15%] rounded-xl border-4 border-primary/80"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground text-sm">
            <Camera aria-hidden className="size-10" />
            La caméra est coupée.
          </div>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {running ? (
        <Button variant="outline" size="lg" onClick={stop}>
          <CameraOff aria-hidden />
          Couper la caméra
        </Button>
      ) : (
        <Button size="lg" onClick={start}>
          <Camera aria-hidden />
          Démarrer le scan
        </Button>
      )}
    </div>
  );
}
