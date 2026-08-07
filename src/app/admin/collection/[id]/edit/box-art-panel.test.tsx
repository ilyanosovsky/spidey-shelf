import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseUploadthingProps } from "@uploadthing/react";
import type { AnyFileRoute } from "uploadthing/types";

import { BOX_ART_COPY, BOX_ART_ERRORS } from "@/lib/box-art";

/**
 * The panel with the SDK, the canvas and the router all replaced.
 *
 * What is worth testing here is the screen's behaviour, not UploadThing's: which caption is
 * on the LCD, how many blocks the bar has, whether the button is disabled mid-run, and — the
 * two that are actually easy to get wrong — that a non-image is refused **before** anything
 * is uploaded, and that a stale run's callbacks cannot paint over a newer one.
 */

/** The last options `useUploadThing` was called with — the test's handle on the callbacks. */
let hookOptions: UseUploadthingProps<AnyFileRoute> | undefined;
/** Typed like the real `startUpload`, so the test can assert on the input it is handed. */
const startUpload =
  vi.fn<(files: File[], input: { referenceFigureId: string }) => Promise<undefined>>();
const refresh = vi.fn();

vi.mock("@/lib/uploadthing", () => ({
  useUploadThing: (_endpoint: string, options: UseUploadthingProps<AnyFileRoute>) => {
    hookOptions = options;
    return { startUpload, isUploading: false, routeConfig: undefined };
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const normalizeBoxArt = vi.fn(
  async (file: File) => new File([file], "normalized-800.webp", { type: "image/webp" }),
);

vi.mock("@/lib/box-art-canvas", () => ({
  normalizeBoxArt: (...args: Parameters<typeof normalizeBoxArt>) => normalizeBoxArt(...args),
}));

const { BoxArtPanel } = await import("./box-art-panel");

const FIGURE = {
  referenceFigureId: "11111111-1111-4111-8111-111111111111",
  slug: "pop-marvel-spider-man-3",
  name: "Spider-Man",
  category: "peter" as const,
  popNumber: 3,
};

const ART = "https://si4zn51deh.ufs.sh/f/key_spider-man-800.webp";

function picker(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input rendered");
  return input;
}

/** Drive the hidden picker the way a file dialog does. */
async function pick(file: File) {
  const input = picker();
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

const jpeg = (size = 1000) => new File([new Uint8Array(size)], "box.jpg", { type: "image/jpeg" });

beforeEach(() => {
  hookOptions = undefined;
  startUpload.mockClear();
  refresh.mockClear();
  normalizeBoxArt.mockClear();
  normalizeBoxArt.mockImplementation(
    async (file: File) => new File([file], "normalized-800.webp", { type: "image/webp" }),
  );
});

describe("BoxArtPanel", () => {
  it("offers UPLOAD when there is no art and REPLACE when there is", () => {
    const { unmount } = render(<BoxArtPanel {...FIGURE} imagePath={null} />);
    expect(screen.getByRole("button", { name: BOX_ART_COPY.upload })).toBeInTheDocument();
    expect(screen.getByText(BOX_ART_COPY.placeholderNote)).toBeInTheDocument();
    unmount();

    render(<BoxArtPanel {...FIGURE} imagePath={ART} />);
    expect(screen.getByRole("button", { name: BOX_ART_COPY.replace })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Spider-Man box art" })).toBeInTheDocument();
  });

  it("walks NORMALIZING → UPLOADING n% → BOX ART SECURED!", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={null} />);

    // Normalization is held open so the intermediate caption can be observed.
    let release: (file: File) => void = () => {};
    normalizeBoxArt.mockImplementation(() => new Promise<File>((resolve) => (release = resolve)));

    await pick(jpeg());
    expect(screen.getByText(BOX_ART_COPY.normalizing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: BOX_ART_COPY.upload })).toBeDisabled();

    await act(async () => {
      release(new File([new Uint8Array(10)], "n.webp", { type: "image/webp" }));
    });

    await waitFor(() => expect(startUpload).toHaveBeenCalledTimes(1));
    expect(startUpload.mock.calls[0][1]).toEqual({
      referenceFigureId: FIGURE.referenceFigureId,
    });
    expect(screen.getByText("UPLOADING… 0%")).toBeInTheDocument();

    await act(async () => hookOptions?.onUploadProgress?.(40));
    expect(screen.getByText("UPLOADING… 40%")).toBeInTheDocument();
    // 10% for the normalize + 90% × 40% = 46 → 5 of 10 blocks.
    expect(screen.getByText("▓▓▓▓▓░░░░░")).toBeInTheDocument();

    await act(async () => {
      await hookOptions?.onClientUploadComplete?.([
        { serverData: { imagePath: ART, slug: FIGURE.slug } },
      ] as never);
    });

    expect(screen.getByText(BOX_ART_COPY.done)).toBeInTheDocument();
    // The new art is on screen before the server component comes back with it…
    expect(screen.getByRole("img", { name: "Spider-Man box art" })).toBeInTheDocument();
    // …and the refresh that brings it back is requested.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: BOX_ART_COPY.replace })).toBeEnabled();
  });

  it("refuses a non-image before anything leaves the browser", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={null} />);

    await pick(new File([new Uint8Array(10)], "notes.pdf", { type: "application/pdf" }));

    expect(screen.getByText(BOX_ART_ERRORS.not_an_image)).toBeInTheDocument();
    expect(normalizeBoxArt).not.toHaveBeenCalled();
    expect(startUpload).not.toHaveBeenCalled();
    // Still usable: the button comes straight back rather than staying disabled.
    expect(screen.getByRole("button", { name: BOX_ART_COPY.upload })).toBeEnabled();
  });

  it("refuses a file over the 4MB ceiling without decoding it", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={null} />);

    await pick(jpeg(4 * 1024 * 1024 + 1));

    expect(screen.getByText(BOX_ART_ERRORS.too_big)).toBeInTheDocument();
    expect(normalizeBoxArt).not.toHaveBeenCalled();
  });

  it("says so when the image cannot be decoded", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={null} />);
    normalizeBoxArt.mockRejectedValue(new Error("broken"));

    await pick(jpeg());

    await waitFor(() => expect(screen.getByText(BOX_ART_ERRORS.decode_failed)).toBeInTheDocument());
    expect(startUpload).not.toHaveBeenCalled();
  });

  it("says UPLOAD FAILED — TRY AGAIN and keeps the old art on screen", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={ART} />);

    await pick(jpeg());
    await waitFor(() => expect(startUpload).toHaveBeenCalled());

    await act(async () => {
      await hookOptions?.onUploadError?.(new Error("nope") as never);
    });

    expect(screen.getByText(BOX_ART_ERRORS.upload_failed)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Spider-Man box art" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("ignores a stale run's progress after the owner picks a second file", async () => {
    render(<BoxArtPanel {...FIGURE} imagePath={null} />);

    // First pick: hold the normalize open so this run is still "in flight".
    let releaseFirst: (file: File) => void = () => {};
    normalizeBoxArt.mockImplementationOnce(
      () => new Promise<File>((resolve) => (releaseFirst = resolve)),
    );
    await pick(jpeg());
    expect(screen.getByText(BOX_ART_COPY.normalizing)).toBeInTheDocument();

    // Second pick supersedes it and completes normally.
    await pick(jpeg());
    await waitFor(() => expect(startUpload).toHaveBeenCalledTimes(1));
    await act(async () => hookOptions?.onUploadProgress?.(70));
    expect(screen.getByText("UPLOADING… 70%")).toBeInTheDocument();

    // The abandoned run finishing must not drag the panel back to "uploading 0%".
    await act(async () => {
      releaseFirst(new File([new Uint8Array(10)], "n.webp", { type: "image/webp" }));
    });

    expect(screen.getByText("UPLOADING… 70%")).toBeInTheDocument();
    expect(startUpload).toHaveBeenCalledTimes(1);
  });
});
