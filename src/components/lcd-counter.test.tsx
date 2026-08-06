import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { LCDCounter } from "./lcd-counter";

describe("LCDCounter", () => {
  it("shows the counts and its caption", () => {
    render(<LCDCounter value="11 / 120" label="PETER PARKER COLLECTED" />);

    expect(screen.getByText("11 / 120")).toBeInTheDocument();
    expect(screen.getByText("PETER PARKER COLLECTED")).toBeInTheDocument();
  });

  it("sets the digits in tabular pixel type", () => {
    render(<LCDCounter value="0 / 120" label="COLLECTED" />);

    const digits = screen.getByText("0 / 120");
    expect(digits.className).toContain("font-pixel");
    expect(digits.className).toContain("tabular-nums");
  });

  it("carries the scanline overlay unless it is turned off", () => {
    const { container, unmount } = render(<LCDCounter value="1 / 2" label="X" />);
    expect(container.querySelector(".lcd-scanlines")).not.toBeNull();
    unmount();

    const plain = render(<LCDCounter value="1 / 2" label="X" scanlines={false} />);
    expect(plain.container.querySelector(".lcd-scanlines")).toBeNull();
  });
});
