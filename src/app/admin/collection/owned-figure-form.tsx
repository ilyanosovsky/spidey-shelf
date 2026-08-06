"use client";

import { useActionState } from "react";

import { OWNED_STATUSES } from "@/lib/collection";
import type { ReferenceSearchResult } from "@/lib/collection-queries";

import { fieldClass, labelClass, pixelButton } from "../ui";
import { emptyOwnedFigureFormState, type OwnedFigureFormState } from "./actions";

/**
 * The add/edit form. Client-side only because `useActionState` needs it — every rule it
 * appears to enforce is re-checked in the server action.
 */

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
  submitLabel,
  onChangeFigure,
}: {
  action: (state: OwnedFigureFormState, formData: FormData) => Promise<OwnedFigureFormState>;
  reference: Pick<ReferenceSearchResult, "id" | "popNumber" | "name" | "productLine">;
  values: OwnedFigureFormValues;
  submitLabel: string;
  /** Shown on the add screen so a mis-picked figure does not mean starting over. */
  onChangeFigure?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, emptyOwnedFigureFormState);

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
        {onChangeFigure ? (
          <button
            type="button"
            onClick={onChangeFigure}
            className="font-pixel mt-3 text-[8px] tracking-wider text-blue-frame underline"
          >
            PICK ANOTHER FIGURE
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="acquiredAt" className={labelClass}>
          DATE
        </label>
        <input
          id="acquiredAt"
          name="acquiredAt"
          type="date"
          required
          defaultValue={values.acquiredAt}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="acquiredCity" className={labelClass}>
          CITY
        </label>
        <input
          id="acquiredCity"
          name="acquiredCity"
          type="text"
          autoComplete="off"
          defaultValue={values.acquiredCity}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="acquiredCountry" className={labelClass}>
          COUNTRY (2 LETTERS)
        </label>
        <input
          id="acquiredCountry"
          name="acquiredCountry"
          type="text"
          maxLength={2}
          autoComplete="off"
          autoCapitalize="characters"
          defaultValue={values.acquiredCountry}
          className={`${fieldClass} uppercase`}
        />
      </div>

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
