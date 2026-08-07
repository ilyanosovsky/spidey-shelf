import { describe, expect, it } from "vitest";

import {
  BOX_ART_COPY,
  BOX_ART_ERRORS,
  BOX_ART_SIZE,
  boxArtAlt,
  boxArtCaption,
  boxArtFileName,
  boxArtProgress,
  boxArtUploadReducer,
  clampPercent,
  containRect,
  fileKeyFromUrl,
  INITIAL_BOX_ART_STATE,
  isBoxArtBusy,
  isRemoteImagePath,
  isSameOrigin,
  parseBoxArtInput,
  progressBlocks,
  rejectPickedFile,
  replacedFileKey,
  type BoxArtUploadState,
} from "./box-art";

describe("rejectPickedFile", () => {
  it("accepts a normal photo", () => {
    expect(rejectPickedFile({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(rejectPickedFile({ type: "image/png", size: 10 })).toBeNull();
    expect(rejectPickedFile({ type: "image/heic", size: 10 })).toBeNull();
  });

  it("refuses anything that is not an image", () => {
    expect(rejectPickedFile({ type: "application/pdf", size: 10 })).toBe("not_an_image");
    expect(rejectPickedFile({ type: "", size: 10 })).toBe("not_an_image");
  });

  it("refuses SVG — it is a document with script in it, not a photo", () => {
    expect(rejectPickedFile({ type: "image/svg+xml", size: 10 })).toBe("not_an_image");
  });

  it("refuses a file over the router's own ceiling", () => {
    expect(rejectPickedFile({ type: "image/jpeg", size: 4 * 1024 * 1024 + 1 })).toBe("too_big");
    expect(rejectPickedFile({ type: "image/jpeg", size: 4 * 1024 * 1024 })).toBeNull();
  });
});

describe("containRect", () => {
  it("leaves a square alone", () => {
    expect(containRect(1000, 1000)).toEqual({ x: 0, y: 0, width: 800, height: 800 });
  });

  it("pads a tall box left and right", () => {
    // A Funko box is portrait: 600×900 → 533×800, centred horizontally.
    const rect = containRect(600, 900);
    expect(rect.height).toBe(800);
    expect(rect.width).toBe(533);
    expect(rect.y).toBe(0);
    expect(rect.x).toBe(Math.round((800 - 533) / 2));
  });

  it("pads a wide photo top and bottom", () => {
    const rect = containRect(1600, 900);
    expect(rect.width).toBe(800);
    expect(rect.height).toBe(450);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(175);
  });

  it("scales a small image up rather than leaving it tiny in the corner", () => {
    const rect = containRect(100, 200);
    expect(rect.height).toBe(800);
    expect(rect.width).toBe(400);
  });

  it("never overflows the square in either direction", () => {
    for (const [w, h] of [
      [3, 4000],
      [4000, 3],
      [1, 1],
      [4032, 3024],
    ]) {
      const rect = containRect(w, h);
      expect(rect.width).toBeLessThanOrEqual(BOX_ART_SIZE);
      expect(rect.height).toBeLessThanOrEqual(BOX_ART_SIZE);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("fills the square rather than dividing by zero on a broken decode", () => {
    expect(containRect(0, 0)).toEqual({ x: 0, y: 0, width: 800, height: 800 });
    expect(containRect(Number.NaN, 10)).toEqual({ x: 0, y: 0, width: 800, height: 800 });
  });

  it("honours a custom size", () => {
    expect(containRect(100, 50, 200)).toEqual({ x: 0, y: 50, width: 200, height: 100 });
  });
});

describe("boxArtFileName", () => {
  it("names the file after the figure", () => {
    expect(boxArtFileName("pop-marvel-spider-man-last-stand-1450")).toBe(
      "pop-marvel-spider-man-last-stand-1450-800.webp",
    );
  });

  it("survives a slug with junk in it", () => {
    expect(boxArtFileName("Pop! Marvel/3")).toBe("pop-marvel-3-800.webp");
    expect(boxArtFileName("")).toBe("box-art-800.webp");
  });
});

describe("fileKeyFromUrl", () => {
  it("reads the key out of a v7 CDN url", () => {
    expect(fileKeyFromUrl("https://abc123.ufs.sh/f/KEY-123_image.webp")).toBe("KEY-123_image.webp");
  });

  it("still reads the legacy utfs.io url", () => {
    expect(fileKeyFromUrl("https://utfs.io/f/oldkey")).toBe("oldkey");
  });

  it("decodes a percent-escaped key", () => {
    expect(fileKeyFromUrl("https://abc.ufs.sh/f/a%20b")).toBe("a b");
  });

  it("refuses to invent a key for anything that is not ours", () => {
    expect(fileKeyFromUrl(null)).toBeNull();
    expect(fileKeyFromUrl("")).toBeNull();
    expect(fileKeyFromUrl("catalog/1450.webp")).toBeNull();
    expect(fileKeyFromUrl("https://evil.example.com/f/key")).toBeNull();
    // Look-alike host: `ufs.sh.evil.com` must not pass the suffix test.
    expect(fileKeyFromUrl("https://abc.ufs.sh.evil.com/f/key")).toBeNull();
    expect(fileKeyFromUrl("http://abc.ufs.sh/f/key")).toBeNull();
    expect(fileKeyFromUrl("https://abc.ufs.sh/key")).toBeNull();
    expect(fileKeyFromUrl("https://abc.ufs.sh/f/")).toBeNull();
    expect(fileKeyFromUrl("https://abc.ufs.sh/f/a/b")).toBeNull();
    expect(fileKeyFromUrl("not a url")).toBeNull();
  });
});

describe("replacedFileKey", () => {
  it("names the old file so a replacement does not orphan it", () => {
    expect(replacedFileKey("https://abc.ufs.sh/f/old-key", "new-key")).toBe("old-key");
  });

  it("deletes nothing when there was nothing there", () => {
    expect(replacedFileKey(null, "new-key")).toBeNull();
    expect(replacedFileKey("", "new-key")).toBeNull();
  });

  it("deletes nothing when the stored path is not ours to delete", () => {
    expect(replacedFileKey("catalog/1450.webp", "new-key")).toBeNull();
    expect(replacedFileKey("https://images.example.com/f/x", "new-key")).toBeNull();
  });

  it("never deletes the file it just saved — UploadThing dedupes identical bytes to one key", () => {
    expect(replacedFileKey("https://abc.ufs.sh/f/same-key", "same-key")).toBeNull();
  });
});

describe("isRemoteImagePath", () => {
  it("tells an absolute UploadThing url from a future bucket path", () => {
    expect(isRemoteImagePath("https://abc.ufs.sh/f/key")).toBe(true);
    expect(isRemoteImagePath("catalog/1450.webp")).toBe(false);
    expect(isRemoteImagePath(null)).toBe(false);
    expect(isRemoteImagePath("")).toBe(false);
  });
});

describe("parseBoxArtInput", () => {
  const id = "11111111-1111-4111-8111-111111111111";

  it("takes a uuid and normalizes it", () => {
    expect(parseBoxArtInput({ referenceFigureId: id.toUpperCase() })).toEqual({
      referenceFigureId: id,
    });
    expect(parseBoxArtInput({ referenceFigureId: ` ${id} ` })).toEqual({ referenceFigureId: id });
  });

  it("throws on anything else, so a bad id never reaches Postgres", () => {
    expect(() => parseBoxArtInput(null)).toThrow();
    expect(() => parseBoxArtInput("nope")).toThrow();
    expect(() => parseBoxArtInput({})).toThrow();
    expect(() => parseBoxArtInput({ referenceFigureId: 7 })).toThrow();
    expect(() => parseBoxArtInput({ referenceFigureId: "1; drop table" })).toThrow();
  });

  it("ignores extra fields rather than passing them on", () => {
    expect(parseBoxArtInput({ referenceFigureId: id, imagePath: "https://evil/x" })).toEqual({
      referenceFigureId: id,
    });
  });
});

describe("isSameOrigin", () => {
  it("accepts our own page", () => {
    expect(isSameOrigin("https://spidey.example.com", "spidey.example.com")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
    expect(isSameOrigin("https://Spidey.Example.com", "spidey.example.com")).toBe(true);
  });

  it("fails closed on a foreign or missing origin", () => {
    expect(isSameOrigin("https://evil.example.com", "spidey.example.com")).toBe(false);
    expect(isSameOrigin(null, "spidey.example.com")).toBe(false);
    expect(isSameOrigin("https://spidey.example.com", null)).toBe(false);
    expect(isSameOrigin("null", "spidey.example.com")).toBe(false);
    // A different port is a different origin.
    expect(isSameOrigin("http://localhost:3001", "localhost:3000")).toBe(false);
  });
});

describe("boxArtUploadReducer", () => {
  it("walks pick → normalize → upload → done", () => {
    let state = INITIAL_BOX_ART_STATE;
    state = boxArtUploadReducer(state, { type: "picked" });
    expect(state).toEqual({ phase: "normalizing" });

    state = boxArtUploadReducer(state, { type: "normalized" });
    expect(state).toEqual({ phase: "uploading", percent: 0 });

    state = boxArtUploadReducer(state, { type: "progress", percent: 42 });
    expect(state).toEqual({ phase: "uploading", percent: 42 });

    state = boxArtUploadReducer(state, { type: "uploaded" });
    expect(state).toEqual({ phase: "done" });
  });

  it("clamps and rounds a progress event", () => {
    const uploading: BoxArtUploadState = { phase: "uploading", percent: 0 };
    expect(boxArtUploadReducer(uploading, { type: "progress", percent: 103.7 })).toEqual({
      phase: "uploading",
      percent: 100,
    });
    expect(boxArtUploadReducer(uploading, { type: "progress", percent: -5 })).toEqual({
      phase: "uploading",
      percent: 0,
    });
    expect(boxArtUploadReducer(uploading, { type: "progress", percent: 33.4 })).toEqual({
      phase: "uploading",
      percent: 33,
    });
  });

  it("ignores progress that arrives outside an upload", () => {
    for (const state of [
      INITIAL_BOX_ART_STATE,
      { phase: "done" } as const,
      { phase: "failed", code: "upload_failed" } as const,
    ]) {
      expect(boxArtUploadReducer(state, { type: "progress", percent: 50 })).toBe(state);
    }
  });

  it("fails from any phase, and a new pick restarts the panel", () => {
    const failed = boxArtUploadReducer(
      { phase: "uploading", percent: 80 },
      { type: "failed", code: "upload_failed" },
    );
    expect(failed).toEqual({ phase: "failed", code: "upload_failed" });
    expect(boxArtUploadReducer(failed, { type: "picked" })).toEqual({ phase: "normalizing" });
    expect(boxArtUploadReducer(failed, { type: "reset" })).toEqual(INITIAL_BOX_ART_STATE);
  });
});

describe("isBoxArtBusy", () => {
  it("is true exactly while something is happening", () => {
    expect(isBoxArtBusy({ phase: "idle" })).toBe(false);
    expect(isBoxArtBusy({ phase: "normalizing" })).toBe(true);
    expect(isBoxArtBusy({ phase: "uploading", percent: 3 })).toBe(true);
    expect(isBoxArtBusy({ phase: "done" })).toBe(false);
    expect(isBoxArtBusy({ phase: "failed", code: "too_big" })).toBe(false);
  });
});

describe("boxArtProgress", () => {
  it("gives normalizing the first tenth of the bar and never goes backwards", () => {
    expect(boxArtProgress({ phase: "idle" })).toBe(0);
    expect(boxArtProgress({ phase: "normalizing" })).toBe(10);
    expect(boxArtProgress({ phase: "uploading", percent: 0 })).toBe(10);
    expect(boxArtProgress({ phase: "uploading", percent: 50 })).toBe(55);
    expect(boxArtProgress({ phase: "uploading", percent: 100 })).toBe(100);
    expect(boxArtProgress({ phase: "done" })).toBe(100);
    expect(boxArtProgress({ phase: "failed", code: "upload_failed" })).toBe(0);
  });
});

describe("progressBlocks", () => {
  it("draws the bar in whole blocks", () => {
    expect(progressBlocks(0)).toBe("░░░░░░░░░░");
    expect(progressBlocks(50)).toBe("▓▓▓▓▓░░░░░");
    expect(progressBlocks(100)).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(progressBlocks(100)).toHaveLength(10);
    expect(progressBlocks(37)).toHaveLength(10);
  });

  it("clamps rather than overflowing the bar", () => {
    expect(progressBlocks(-10)).toBe("░░░░░░░░░░");
    expect(progressBlocks(400)).toBe("▓▓▓▓▓▓▓▓▓▓");
    expect(progressBlocks(Number.NaN)).toBe("░░░░░░░░░░");
  });

  it("honours a custom cell count", () => {
    expect(progressBlocks(50, 4)).toBe("▓▓░░");
  });
});

describe("clampPercent", () => {
  it("keeps a percentage a percentage", () => {
    expect(clampPercent(12.4)).toBe(12);
    expect(clampPercent(-1)).toBe(0);
    expect(clampPercent(101)).toBe(100);
    expect(clampPercent(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("boxArtCaption", () => {
  it("says what is happening, in the house voice", () => {
    expect(boxArtCaption({ phase: "idle" })).toBeNull();
    expect(boxArtCaption({ phase: "normalizing" })).toBe("NORMALIZING…");
    expect(boxArtCaption({ phase: "uploading", percent: 42 })).toBe("UPLOADING… 42%");
    expect(boxArtCaption({ phase: "done" })).toBe(BOX_ART_COPY.done);
    expect(boxArtCaption({ phase: "failed", code: "upload_failed" })).toBe(
      BOX_ART_ERRORS.upload_failed,
    );
  });

  it("has a message for every error code", () => {
    for (const code of ["not_an_image", "too_big", "decode_failed", "upload_failed"] as const) {
      expect(BOX_ART_ERRORS[code]).toMatch(/\S/);
    }
  });
});

describe("boxArtAlt", () => {
  it("describes the picture, not the element", () => {
    expect(boxArtAlt("Spider-Man (Last Stand)")).toBe("Spider-Man (Last Stand) box art");
  });
});
