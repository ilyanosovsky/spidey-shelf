"use client";

import { useActionState } from "react";

import { OWNED_STATUSES } from "@/lib/collection";
import type { ReferenceSearchResult } from "@/lib/collection-queries";

import { SightingFields } from "../sighting-fields";
import { fieldClass, labelClass, pixelButton } from "../ui";
import { type OwnedFigureFormState } from "./actions";

/**
 * The add/edit form. Client-side only because `useActionState` needs it — every rule it
 * appears to enforce is re-checked in the server action.
 */

/**
 * The initial `useActionState` value, defined **here** and not in `./actions`.
 *
 * A `"use server"` module may only export async functions. This constant lived there, and
 * Next replaced it with `undefined` across the boundary rather than complaining — so the
 * first render read `state.errors.length` off nothing and every edit screen answered 500.
 * The type still comes from the action module, because that is where the shape belongs.
 */
const EMPTY_FORM_STATE: OwnedFigureFormState = { errors: [] };

export interface OwnedFigureFormValues {
  status: string;
  acquiredAt: string;
  acquiredCity: string;
  acquiredCountry: string;
  story: string;
  isPublic: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  mine: "MINE",
  not_mine_anymore: "NOT MINE ANYMORE",
};

export function OwnedFigureForm({
  action,
  reference,
  values,
  citiesByCountry,
  submitLabel,
}: {
  action: (state: OwnedFigureFormState, formData: FormData) => Promise<OwnedFigureFormState>;
  reference: Pick<ReferenceSearchResult, "id" | "popNumber" | "name" | "productLine">;
  values: OwnedFigureFormValues;
  /** CITY suggestions per country code, built on the server (`citySuggestionIndex()`). */
  citiesByCountry: Readonly<Record<string, readonly string[]>>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="referenceFigureId" value={reference.id} />

      <div className="rounded border-2 border-ink-px bg-navy-panel px-3 py-3">
        <p className="font-pixel text-[10px] tracking-wider text-amber">
          #{reference.popNumber ?? "—"}
        </p>
        <p className="mt-2 text-sm text-cream">{reference.name}</p>
        {reference.productLine ? (
          <p className="mt-1 text-xs text-cream/60">{reference.productLine}</p>
        ) : null}
      </div>

      {/*
       * DATE · COUNTRY · CITY, the same three fields Quick Add's details step renders — one
       * component since Phase 12, because two hand-written copies had already drifted and
       * the country box was a two-letter memory test in both of them.
       */}
      <SightingFields
        date={values.acquiredAt}
        city={values.acquiredCity}
        country={values.acquiredCountry}
        citiesByCountry={citiesByCountry}
        disabled={pending}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor="status" className={labelClass}>
          STATUS
        </label>
        <select id="status" name="status" defaultValue={values.status} className={fieldClass}>
          {OWNED_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="story" className={labelClass}>
          STORY (OPTIONAL)
        </label>
        <textarea
          id="story"
          name="story"
          rows={4}
          defaultValue={values.story}
          className={`${fieldClass} leading-relaxed`}
        />
      </div>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          name="isPublic"
          defaultChecked={values.isPublic}
          className="h-5 w-5 accent-[var(--color-pop-green)]"
        />
        <span className={labelClass}>SHOW ON THE PUBLIC SHELF</span>
      </label>

      <button type="submit" disabled={pending} className={pixelButton.primary}>
        {pending ? "SAVING…" : submitLabel}
      </button>

      {state.errors.length > 0 ? (
        <ul role="alert" className="flex flex-col gap-2">
          {state.errors.map((error) => (
            <li key={error} className="font-pixel text-[10px] leading-relaxed text-coral">
              {error}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
