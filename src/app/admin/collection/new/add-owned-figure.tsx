"use client";

import { useEffect, useId, useState, useTransition } from "react";

import { figureCategoryLabel } from "@/lib/categories";
import { parseReferenceSearchQuery } from "@/lib/collection-form";
import type { ReferenceSearchResult } from "@/lib/collection-queries";

import { fieldClass, labelClass } from "../../ui";
import { createOwnedFigureAction, searchCatalogAction } from "../actions";
import { OwnedFigureForm } from "../owned-figure-form";

/**
 * Search-first add flow: one box, then a figure, then the details.
 *
 * The search runs through a server action rather than a route handler, so it inherits the
 * same `requireAdmin()` check as the write actions — the catalog is not secret, but the
 * admin surface should not grow a second, unguarded way in.
 */

/** Long enough that a fast typist does not fire a query per keystroke. */
const DEBOUNCE_MS = 250;

/** Results are stored with the term they answer, so a stale answer is never rendered. */
interface SearchResults {
  term: string;
  items: ReferenceSearchResult[];
}

export function AddOwnedFigure({ today }: { today: string }) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [selected, setSelected] = useState<ReferenceSearchResult | null>(null);
  const [, startTransition] = useTransition();

  const parsed = parseReferenceSearchQuery(query);
  const current = results?.term === query ? results.items : null;
  const searching = !selected && parsed.kind !== "empty" && current === null;

  useEffect(() => {
    if (selected) return;
    if (parsed.kind === "empty") return;

    const term = query;
    let cancelled = false;

    const timer = setTimeout(() => {
      startTransition(async () => {
        const items = await searchCatalogAction(term);
        // The box moved on while the query was in flight — an older answer must not win.
        if (!cancelled) setResults({ term, items });
      });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, parsed.kind, selected]);

  if (selected) {
    return (
      <OwnedFigureForm
        action={createOwnedFigureAction}
        reference={selected}
        submitLabel="ADD TO THE VAULT"
        onChangeFigure={() => setSelected(null)}
        values={{
          status: "mine",
          acquiredAt: today,
          acquiredCity: "",
          acquiredCountry: "",
          story: "",
          isPublic: true,
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className={labelClass}>
          NUMBER OR NAME
        </label>
        <input
          id={inputId}
          type="search"
          inputMode="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="1450 or spider-man"
          className={fieldClass}
        />
      </div>

      {searching ? (
        <p className="font-pixel text-[10px] tracking-wider text-lcd-glow">SCANNING…</p>
      ) : null}

      {current !== null && current.length === 0 ? (
        <p className="font-pixel text-[10px] leading-relaxed text-coral">
          NOTHING IN THE CATALOG MATCHES THAT.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {(current ?? []).map((result) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => setSelected(result)}
              className="w-full rounded border-2 border-ink-px bg-navy-panel px-3 py-3 text-left active:translate-x-[2px] active:translate-y-[2px]"
            >
              <span className="font-pixel text-[10px] tracking-wider text-amber">
                #{result.popNumber ?? "—"}
              </span>
              <span className="mt-2 block text-sm text-cream">{result.name}</span>
              <span className="mt-1 block text-xs text-cream/60">
                {[result.productLine, result.exclusivity, result.releaseYear]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span className="font-pixel mt-2 block text-[8px] tracking-wider text-blue-frame">
                {figureCategoryLabel(result.category)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
