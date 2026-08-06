"use client";

import { useActionState } from "react";

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
          className="rounded border-2 border-ink-px bg-lcd-bg px-3 py-3 text-base text-lcd-glow caret-lcd-glow outline-none focus-visible:border-blue-frame"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="font-pixel rounded border-2 border-ink-px bg-amber px-4 py-3 text-[10px] tracking-wider text-ink-px shadow-[4px_4px_0_var(--color-ink-px)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_var(--color-ink-px)] disabled:opacity-60"
      >
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
