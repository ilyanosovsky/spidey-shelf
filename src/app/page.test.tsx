import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home", () => {
  it("renders the gadget shell", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/SPIDEY/);
    expect(screen.getByText("12 / 117")).toBeInTheDocument();
  });
});
