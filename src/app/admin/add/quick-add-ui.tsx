import Link from "next/link";
import { type ReactNode } from "react";

import { PixelSpiderArt } from "@/components/pixel-spider-art";
import { figureCategoryLabel } from "@/lib/categories";
import { formatPopNumber } from "@/lib/format";
import {
  QUICK_ADD_COPY,
  quickAddErrorMessages,
  variantChips,
  type AdminCatalogFigure,
  type QuickAddErrorCode,
  type QuickAddStep,
} from "@/lib/quick-add";

import { Panel } from "../ui";

/**
 * The furniture every Quick Add step sits in: the step rail, the figure summary, the chips
 * and the error list.
 *
 * All of it is server-rendered and none of it takes a callback: "interactive" here means a
 * link or a submit button and nothing else. The flow's one client component is the SCAN
 * button on step 1, and it deliberately lives outside this file.
 */

/** The three frames the owner actually walks. `new` and `done` are detours off the rail. */
const RAIL: readonly { step: QuickAddStep; label: string }[] = [
  { step: "identify", label: "1 FIND" },
  { step: "confirm", label: "2 CONFIRM" },
  { step: "details", label: "3 DETAILS" },
];

/**
 * Which rail entry lights up for a step — `new` belongs to step 1, `done` to step 3.
 * `scan-result` belongs to step 1 too: a scan IS the find, done with a camera.
 */
const RAIL_POSITION: Record<QuickAddStep, QuickAddStep> = {
  identify: "identify",
  "scan-result": "identify",
  new: "identify",
  confirm: "confirm",
  details: "details",
  done: "details",
};

export function QuickAddRail({ step }: { step: QuickAddStep }) {
  const active = RAIL_POSITION[step];

  return (
    <ol aria-label="Quick add progress" className="grid grid-cols-3 gap-2">
      {RAIL.map((entry) => {
        const isActive = entry.step === active;
        return (
          <li
            key={entry.step}
            aria-current={isActive ? "step" : undefined}
            className={`font-pixel rounded border-2 px-2 py-2 text-center text-[10px] leading-relaxed tracking-wider ${
              isActive ? "border-amber bg-amber text-ink-px" : "border-blue-frame text-cream/60"
            }`}
          >
            {entry.label}
          </li>
        );
      })}
    </ol>
  );
}

/** The screen body: one column, 375px-first, primary buttons within thumb reach at the end. */
export function QuickAddScreen({ children }: { children: ReactNode }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 p-4 sm:p-6"
    >
      {children}
    </main>
  );
}

const CHIP_TONES = {
  category: "border-cream/40 text-cream/80",
  variant: "border-amber text-amber",
  review: "border-coral text-coral",
  owned: "border-pop-green text-pop-green",
} as const;

export function Chip({
  children,
  tone = "category",
}: {
  children: ReactNode;
  tone?: keyof typeof CHIP_TONES;
}) {
  return (
    <span
      className={`font-pixel inline-block rounded border-2 px-2 py-1 text-[10px] leading-relaxed tracking-wider uppercase ${CHIP_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * The chips under a figure's name, in one place so the search result, the confirm hero and
 * the success screen can never describe the same figure differently.
 *
 * `NEEDS REVIEW` is admin-only by construction — the type that carries it
 * (`AdminCatalogFigure`) never reaches a public component (CLAUDE.md, "Security rules").
 */
export function FigureChips({ figure }: { figure: AdminCatalogFigure }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Chip>{figureCategoryLabel(figure.category)}</Chip>
      {variantChips(figure).map((chip) => (
        <Chip key={chip} tone="variant">
          {chip}
        </Chip>
      ))}
      {figure.ownedCount > 0 ? <Chip tone="owned">{QUICK_ADD_COPY.ownedChip}</Chip> : null}
      {figure.needsReview ? <Chip tone="review">{QUICK_ADD_COPY.needsReviewChip}</Chip> : null}
    </div>
  );
}

/** The chosen figure, large: the one thing the confirm step is asking about. */
export function FigureHero({ figure }: { figure: AdminCatalogFigure }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="w-40 shrink-0 sm:w-44">
        <PixelSpiderArt
          slug={figure.slug}
          category={figure.category}
          popNumber={figure.popNumber}
          size="hero"
        />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="font-pixel text-xs leading-relaxed tracking-wider text-amber">
          {formatPopNumber(figure.popNumber)}
        </p>
        <h2 className="mt-2 text-lg leading-snug text-cream">{figure.name}</h2>
        {figure.productLine ? (
          <p className="mt-1 text-sm text-cream/70">{figure.productLine}</p>
        ) : null}
        <FigureChips figure={figure} />
      </div>
    </div>
  );
}

/** The same figure, small — the header of the details and success steps. */
export function FigureSummary({ figure }: { figure: AdminCatalogFigure }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-20 shrink-0">
        <PixelSpiderArt
          slug={figure.slug}
          category={figure.category}
          popNumber={figure.popNumber}
          size="card"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-pixel text-[10px] tracking-wider text-amber">
          {formatPopNumber(figure.popNumber)}
        </p>
        <p className="mt-2 text-sm leading-snug text-cream">{figure.name}</p>
        {figure.productLine ? (
          <p className="mt-1 text-xs text-cream/60">{figure.productLine}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One tappable catalog row — a whole card is the target, so the tap area is far past 44px.
 * Used for the search results and for the variant siblings.
 */
export function FigureCardLink({
  figure,
  href,
  compact = false,
}: {
  figure: AdminCatalogFigure;
  href: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 w-full items-start gap-3 rounded border-2 border-ink-px bg-navy-panel px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber active:translate-x-[2px] active:translate-y-[2px]"
    >
      {compact ? null : (
        <span className="block w-16 shrink-0">
          <PixelSpiderArt
            slug={figure.slug}
            category={figure.category}
            popNumber={figure.popNumber}
            size="card"
          />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-pixel block text-[10px] tracking-wider text-amber">
          {formatPopNumber(figure.popNumber)}
        </span>
        <span className="mt-2 block text-sm leading-snug text-cream">{figure.name}</span>
        {figure.productLine || figure.releaseYear ? (
          <span className="mt-1 block text-xs text-cream/60">
            {[figure.productLine, figure.releaseYear].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        <FigureChips figure={figure} />
      </span>
    </Link>
  );
}

/** Whatever the last submit refused, spelled out. Empty codes render nothing at all. */
export function QuickAddErrors({ codes }: { codes: readonly QuickAddErrorCode[] }) {
  if (codes.length === 0) return null;

  return (
    <Panel className="border-coral">
      <ul role="alert" className="flex flex-col gap-2">
        {quickAddErrorMessages(codes).map((message) => (
          <li key={message} className="font-pixel text-[10px] leading-relaxed text-coral">
            {message}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
