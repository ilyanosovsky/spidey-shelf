import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShareButton } from "./share-button";

/** jsdom ships neither API; each test installs exactly the ones it is about. */
function stubNavigator(values: Record<string, unknown>) {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
  }
}

afterEach(() => {
  stubNavigator({ share: undefined, clipboard: undefined });
  vi.restoreAllMocks();
});

describe("ShareButton", () => {
  it("uses the native share sheet where there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } });

    render(<ShareButton href="/search?q=334" title="Spider-Man (White Spider)" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0][0]).toEqual({
      title: "Spider-Man (White Spider)",
      url: `${window.location.origin}/search?q=334`,
    });
    // The sheet took it — nothing lands on the clipboard and the label does not flash.
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button")).toHaveTextContent("SHARE");
  });

  it("copies the link and says so when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } });

    render(<ShareButton href="/search?q=334" title="Spider-Man (White Spider)" />);
    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("LINK COPIED");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/search?q=334`);
  });

  it("does not copy behind the user's back when the share sheet is dismissed", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const share = vi.fn().mockRejectedValue(abort);
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } });

    render(<ShareButton href="/search?q=334" title="Spider-Man" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the clipboard when the share sheet fails for a real reason", async () => {
    const share = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText } });

    render(<ShareButton href="/search?q=3" title="Spider-Man" />);
    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("LINK COPIED");
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it("stays silent when neither API is available", async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });

    render(<ShareButton href="/search?q=3" title="Spider-Man" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("SHARE"));
  });

  it("names the figure for screen readers", () => {
    render(<ShareButton href="/search?q=334" title="Spider-Man (White Spider)" />);

    expect(
      screen.getByRole("button", { name: "Share Spider-Man (White Spider)" }),
    ).toBeInTheDocument();
  });
});
