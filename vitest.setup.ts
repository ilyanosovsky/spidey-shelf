import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only auto-registers its `afterEach(cleanup)` when Vitest runs with
 * `globals: true`, and this project does not — so without this every `render()` in a file
 * would pile up in the same document and the second one would find two of everything.
 */
afterEach(cleanup);
