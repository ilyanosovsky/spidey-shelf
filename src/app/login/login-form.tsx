"use client";

import { useActionState } from "react";

import { pixelButtonClass } from "@/components/pixel-button";
import { fieldClass } from "@/app/admin/ui";

import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="font-pixel text-[10px] tracking-wider text-amber">
          PASSWORD
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? "login-error" : undefined}
          // The same LCD field the admin uses, focus ring included — this screen predates
          // the shared classes and was quietly carrying its own copy of them.
          className={fieldClass}
        />
      </div>

      <button type="submit" disabled={pending} className={pixelButtonClass("primary")}>
        {pending ? "CHECKING…" : "ENTER THE VAULT"}
      </button>

      {state.error ? (
        <p
          id="login-error"
          role="alert"
          className="font-pixel text-center text-[10px] leading-relaxed text-coral"
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
