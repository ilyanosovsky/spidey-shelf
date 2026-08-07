import { isScannableFormat, NATIVE_SCANNABLE_FORMATS } from "./upc";

/**
 * One `decode(frame)` over two very different engines.
 *
 * **Why two.** The platform has a barcode API — `BarcodeDetector` — and on Android Chrome
 * it is excellent: hardware-backed, zero bytes to download. On iOS Safari it is
 * flag-disabled and, where it is exposed at all, regressed (ADR-006). Since the owner's
 * phone is an iPhone, zxing-wasm is the engine that actually has to work and the native
 * one is the bonus.
 *
 * **Feature detection is not a `typeof` check.** A constructor that exists proves nothing
 * — the WebKit bug is that `detect()` resolves empty forever. So {@link createFrameDecoder}
 * asks `getSupportedFormats()` for our two symbologies AND runs one real `detect()` against
 * a scratch frame; anything that throws, hangs or answers wrong falls through to wasm.
 *
 * **This module is never in a bundle the public site loads.** It is dynamically imported by
 * the overlay, which is itself dynamically imported when the SCAN button is pressed — so
 * the megabyte of WebAssembly is fetched by an admin who is about to point a camera at a
 * box, and by nobody else.
 */

export type DecodeEngine = "native" | "wasm";

export interface FrameDecoder {
  /** Which engine answered — surfaced only for the overlay's debug line. */
  readonly engine: DecodeEngine;
  /** The decoded digits of a UPC-A/EAN-13, or `null` when the frame held nothing. */
  decode(frame: ImageData): Promise<string | null>;
}

/**
 * Where the `.wasm` is served from: our own `public/`, never a CDN.
 *
 * zxing-wasm defaults to a jsDelivr URL baked in at ITS build time. That default is a
 * third-party request on every scan — an availability dependency, a privacy leak, and a
 * thing that breaks the moment the phone is on a network that blocks the CDN. The file is
 * copied out of `node_modules` by `scripts/copy-zxing-wasm.mjs` (postinstall + prebuild)
 * and pinned here.
 */
export const WASM_ASSET_PATH = "/barcode/zxing_reader.wasm";

/** How many frames a second the loop asks for. */
export const DECODE_INTERVAL_MS = 180;

/* ------------------------------------------------------------------ the native engine */

interface NativeDetection {
  rawValue?: unknown;
  format?: unknown;
}

interface NativeDetector {
  detect(source: ImageData): Promise<NativeDetection[]>;
}

interface NativeDetectorConstructor {
  new (options?: { formats?: readonly string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

function nativeConstructor(): NativeDetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector;
  return typeof candidate === "function" ? (candidate as NativeDetectorConstructor) : null;
}

/**
 * Does this browser's `BarcodeDetector` actually read our two symbologies?
 *
 * Three gates, and the third is the one that matters: a one-pixel frame is pushed through
 * `detect()`. A working implementation resolves with an empty array; the broken ones
 * throw, or reject with `NotSupportedError` because the format list they advertised is not
 * the format list they implement.
 */
async function createNativeDecoder(): Promise<FrameDecoder | null> {
  const Detector = nativeConstructor();
  if (!Detector || typeof Detector.getSupportedFormats !== "function") return null;

  try {
    const supported = await Detector.getSupportedFormats();
    if (!NATIVE_SCANNABLE_FORMATS.every((format) => supported.includes(format))) return null;

    const detector = new Detector({ formats: [...NATIVE_SCANNABLE_FORMATS] });
    await detector.detect(new ImageData(1, 1));

    return {
      engine: "native",
      async decode(frame) {
        const results = await detector.detect(frame);
        for (const result of results) {
          const value = typeof result.rawValue === "string" ? result.rawValue : "";
          const format = typeof result.format === "string" ? result.format : "";
          if (value.length > 0 && isScannableFormat(format)) return value;
        }
        return null;
      },
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ the wasm engine */

async function createWasmDecoder(): Promise<FrameDecoder> {
  const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");

  await prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? WASM_ASSET_PATH : prefix + path,
    },
    // Fetch and instantiate now, while the camera is still warming up, rather than on the
    // first frame — otherwise the first second of scanning is spent compiling.
    fireImmediately: true,
  });

  return {
    engine: "wasm",
    async decode(frame) {
      const results = await readBarcodes(frame, {
        formats: ["EAN13", "UPCA"],
        tryHarder: true,
        tryRotate: true,
        tryInvert: false,
        maxNumberOfSymbols: 1,
      });

      for (const result of results) {
        if (result.isValid && result.text.length > 0 && isScannableFormat(result.format)) {
          return result.text;
        }
      }
      return null;
    },
  };
}

/**
 * The engine this browser gets. Native when it is provably real, wasm otherwise.
 *
 * Never rejects for a missing native API — only a failed wasm instantiation (no network,
 * a 404 on the asset) propagates, and the overlay turns that into a message with the
 * keyboard next to it.
 */
export async function createFrameDecoder(): Promise<FrameDecoder> {
  return (await createNativeDecoder()) ?? (await createWasmDecoder());
}
