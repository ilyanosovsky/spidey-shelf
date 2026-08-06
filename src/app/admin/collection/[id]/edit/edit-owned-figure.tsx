"use client";

import type { ReferenceSearchResult } from "@/lib/collection-queries";

import { updateOwnedFigureAction } from "../../actions";
import { OwnedFigureForm, type OwnedFigureFormValues } from "../../owned-figure-form";

/**
 * Binds the row id to the update action.
 *
 * `.bind()` puts the id in the action's closure on the server instead of in a hidden input,
 * so a submitted form cannot point the update at somebody else's row — there is only one
 * user here, but the id is still not the client's to choose.
 */
export function EditOwnedFigure({
  id,
  reference,
  values,
}: {
  id: string;
  reference: Pick<ReferenceSearchResult, "id" | "popNumber" | "name" | "productLine">;
  values: OwnedFigureFormValues;
}) {
  return (
    <OwnedFigureForm
      action={updateOwnedFigureAction.bind(null, id)}
      reference={reference}
      values={values}
      submitLabel="SAVE CHANGES"
    />
  );
}
