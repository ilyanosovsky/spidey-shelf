"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pixelButtonClass } from "@/components/pixel-button";
import { DECODE_INTERVAL_MS, type FrameDecoder } from "@/lib/barcode/decode";
import { SCAN_COPY } from "@/lib/barcode/scan-flow";
import { normalizeScannedCode } from "@/lib/barcode/upc";

/**
 * The camera screen: a viewfinder, a scanline, and a way out of it at every moment.
 *
 * Everything here is one component because a camera is one resource. Splitting the stream,
 * the decode loop and the teardown across hooks is how a `MediaStreamTrack` survives a
 * close and leaves the phone's camera light on — so the stream, the loop and the timer all
 * live in the same refs and all die in the same cleanup.
 *
 * **The escape hatch is not an error state.** `TYPE INSTEAD` is on screen in every state,
 * including while scanning: the barcode may be scuffed, the box may be shrink-wrapped in a
 * glare, and the keyboard behind this overlay has always been the fast path for a figure
 * whose number the owner already knows.
 *
 * **The failures are the design.** iOS Safari refuses `getUserMedia` outside a secure
 * context, a home-screen PWA forgets the permission between launches (hence
 * `IF THE CAMERA STAYS DARK, RELOAD`), and a denied permission cannot be re-asked from
 * JavaScript. Each of those gets a sentence and the same way out rather than a spinner.
 */

type ScanState =
  | { kind: "starting" }
  | { kind: "scanning"; engine: string }
  | { kind: "hit"; code: string }
  | { kind: "denied" }
  | { kind: "unsupported" }
  | { kind: "insecure" }
  | { kind: "failed" };

/** How much of the frame is handed to the decoder — the band inside the viewfinder. */
const CROP = { width: 0.86, height: 0.42 };

/** Enough resolution for a 1D code, small enough to decode inside one frame budget. */
const MAX_FRAME_WIDTH = 960;

/**
 * What the browser can do, decided before the first render.
 *
 * Synchronous on purpose: jsdom and any browser without `mediaDevices` must paint the
 * fallback immediately rather than flash a viewfinder that will never fill. A secure
 * context is checked separately because the message is different and actionable.
 */
function initialState(): ScanState {
  if (typeof navigator === "undefined") return { kind: "unsupported" };
  if (typeof window !== "undefined" && window.isSecureContext === false) {
    return { kind: "insecure" };
  }
  if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
    return { kind: "unsupported" };
  }
  return { kind: "starting" };
}

export function ScannerOverlay({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<ScanState>(initialState);

  /**
   * Whether this overlay ever gets to open a camera, frozen at mount.
   *
   * A ref rather than a dependency because the start effect must run EXACTLY once: keyed
   * on `state.kind` it would re-run the moment the state moved `starting → scanning`, and
   * its cleanup would stop the stream it had just opened.
   */
  const canStartRef = useRef(state.kind === "starting");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef = useRef(true);

  /**
   * The one teardown. Called from the effect cleanup, from CLOSE, from a successful read
   * and from `pagehide` — stopping a stopped track is free, leaving one running is not.
   */
  const teardown = useCallback(() => {
    liveRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const close = useCallback(() => {
    teardown();
    onClose();
  }, [onClose, teardown]);

  useEffect(() => {
    if (!canStartRef.current) return;

    liveRef.current = true;
    let decoder: FrameDecoder | null = null;

    /** One frame: video → the cropped centre band of a canvas → the decoder. */
    function grab(): ImageData | null {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return null;

      const cropWidth = Math.round(video.videoWidth * CROP.width);
      const cropHeight = Math.round(video.videoHeight * CROP.height);
      const scale = Math.min(1, MAX_FRAME_WIDTH / cropWidth);

      canvas.width = Math.round(cropWidth * scale);
      canvas.height = Math.round(cropHeight * scale);

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return null;

      context.drawImage(
        video,
        Math.round((video.videoWidth - cropWidth) / 2),
        Math.round((video.videoHeight - cropHeight) / 2),
        cropWidth,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );

      return context.getImageData(0, 0, canvas.width, canvas.height);
    }

    async function tick() {
      if (!liveRef.current || !decoder) return;

      try {
        const frame = grab();
        const raw = frame ? await decoder.decode(frame) : null;
        // The decoder already checked ITS checksum; this one is ours, and it is what stops
        // a half-read code from spending a lookup on a number nobody printed.
        const code = normalizeScannedCode(raw);

        if (code && liveRef.current) {
          teardown();
          setState({ kind: "hit", code: code.ean13 });
          return;
        }
      } catch {
        // A single unreadable frame is not a failure — the next one is 180ms away.
      }

      if (liveRef.current) timerRef.current = setTimeout(tick, DECODE_INTERVAL_MS);
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : "";
        setState({ kind: name === "NotAllowedError" ? "denied" : "failed" });
        return;
      }

      if (!liveRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // iOS refuses to play an inline video it was not asked twice about; a rejected
        // play() is not fatal, the frames still arrive once the element is ready.
        video.play().catch(() => {});
      }

      try {
        // Dynamic: this is where the megabyte of WebAssembly enters the page, and it does
        // so only after a camera actually opened.
        const { createFrameDecoder } = await import("@/lib/barcode/decode");
        decoder = await createFrameDecoder();
      } catch {
        teardown();
        setState({ kind: "failed" });
        return;
      }

      if (!liveRef.current) return;
      setState({ kind: "scanning", engine: decoder.engine });
      void tick();
    }

    void start();
    window.addEventListener("pagehide", teardown);

    return () => {
      window.removeEventListener("pagehide", teardown);
      teardown();
    };
  }, [teardown]);

  /**
   * A hit leaves the client entirely: the hidden GET form submits into
   * `/admin/add?step=scan-result&upc=…`, which is a server render like every other frame
   * of Quick Add. No decoded state survives the navigation, and the camera is already off
   * before the request leaves.
   */
  useEffect(() => {
    if (state.kind !== "hit") return;
    const flash = setTimeout(() => formRef.current?.requestSubmit(), 420);
    return () => clearTimeout(flash);
  }, [state.kind]);

  const scanning = state.kind === "starting" || state.kind === "scanning" || state.kind === "hit";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={SCAN_COPY.overlayTitle}
      className="fixed inset-0 z-50 flex flex-col bg-ink-px"
    >
      <div className="flex items-center justify-between gap-3 border-b-2 border-blue-frame px-4 py-3">
        <p className="font-pixel text-[10px] tracking-wider text-amber">{SCAN_COPY.overlayTitle}</p>
        <button type="button" onClick={close} className={pixelButtonClass("quiet")}>
          {SCAN_COPY.close}
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {scanning ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}

        {scanning ? <Viewfinder locked={state.kind === "hit"} /> : null}

        {state.kind === "starting" ? (
          <p className="font-pixel relative z-10 text-[10px] tracking-wider text-lcd-glow">
            {SCAN_COPY.starting}
          </p>
        ) : null}

        {state.kind === "hit" ? (
          <p
            role="status"
            className="font-pixel relative z-10 rounded border-2 border-ink-px bg-pop-green px-3 py-2 text-[10px] tracking-wider text-ink-px"
          >
            {SCAN_COPY.hit}
          </p>
        ) : null}

        {!scanning ? <FailureNote state={state} /> : null}
      </div>

      <div className="flex flex-col gap-3 border-t-2 border-blue-frame px-4 py-4">
        {scanning ? (
          <p className="font-pixel text-center text-[10px] leading-relaxed tracking-wider text-cream">
            {SCAN_COPY.aim}
          </p>
        ) : null}
        <p className="font-pixel text-center text-[8px] leading-relaxed tracking-wider text-cream/60">
          {SCAN_COPY.reloadHint}
        </p>
        {/* Always here, in every state — the keyboard is a first-class path (ADR-006). */}
        <button type="button" onClick={close} className={pixelButtonClass("primary", "w-full")}>
          {SCAN_COPY.typeInstead}
        </button>
      </div>

      <canvas ref={canvasRef} aria-hidden="true" className="hidden" />

      <form ref={formRef} method="get" action="/admin/add" className="hidden">
        <input type="hidden" name="step" value="scan-result" />
        <input type="hidden" name="upc" value={state.kind === "hit" ? state.code : ""} />
      </form>
    </div>
  );
}

/**
 * The web-corner viewfinder: four amber corner brackets and a scanline that sweeps the
 * band the decoder is actually reading, so "aim here" is literally true.
 *
 * The sweep is a CSS animation named in globals.css rather than an inline transition,
 * which is what lets `prefers-reduced-motion` park it in the middle instead of leaving a
 * frozen line at the bottom of the frame.
 */
function Viewfinder({ locked }: { locked: boolean }) {
  const tone = locked ? "border-pop-green" : "border-amber";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[7%] top-1/2 h-[42%] -translate-y-1/2"
    >
      <div className={`absolute -top-px -left-px h-8 w-8 border-t-4 border-l-4 ${tone}`} />
      <div className={`absolute -top-px -right-px h-8 w-8 border-t-4 border-r-4 ${tone}`} />
      <div className={`absolute -bottom-px -left-px h-8 w-8 border-b-4 border-l-4 ${tone}`} />
      <div className={`absolute -right-px -bottom-px h-8 w-8 border-r-4 border-b-4 ${tone}`} />
      {locked ? (
        <div className="absolute inset-0 bg-pop-green/30" />
      ) : (
        <div className="scanline absolute inset-x-0 top-0 h-[3px] bg-coral" />
      )}
    </div>
  );
}

/** No camera, no permission, no HTTPS — one sentence each, and never a stack trace. */
function FailureNote({ state }: { state: ScanState }) {
  const headline =
    state.kind === "denied"
      ? SCAN_COPY.denied
      : state.kind === "insecure"
        ? SCAN_COPY.insecure
        : state.kind === "unsupported"
          ? SCAN_COPY.unsupported
          : SCAN_COPY.failed;

  return (
    <div className="relative z-10 mx-4 max-w-sm rounded border-2 border-coral px-4 py-5 text-center">
      <p role="alert" className="font-pixel text-[10px] leading-relaxed tracking-wider text-coral">
        {headline}
      </p>
      <p className="font-pixel mt-4 text-[8px] leading-relaxed tracking-wider text-cream/70">
        {state.kind === "denied" ? SCAN_COPY.deniedHint : SCAN_COPY.fallbackHint}
      </p>
    </div>
  );
}
