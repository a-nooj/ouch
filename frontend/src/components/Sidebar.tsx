/**
 * Sidebar — organic control panel floating over the left side of the scene.
 *
 * Design language: warm paper, Fraunces + Nunito typography, moss-tinted
 * shadows, pill buttons, grain texture overlay. All dynamic colours (badge
 * states, slider fill, result fraction) are applied via inline `style` so the
 * organic palette still governs everything.
 */

import { useState } from "react";
import { useStore } from "../store/useStore";
import type { BasePose } from "../types";

// ── Palette constants (mirrors tailwind.config tokens) ────────────────────
const C = {
  primary: "#5D7052",
  secondary: "#C18C5D",
  destructive: "#A85448",
  border: "#DED8CF",
  muted: "#F0EBE5",
  mutedFg: "#78786C",
  foreground: "#2C2C24",
  accent: "#E6DCCD",
} as const;

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-sans font-bold uppercase tracking-[0.11em] text-muted-foreground mb-2.5">
      {children}
    </h2>
  );
}

function Divider() {
  return (
    <div
      className="w-full h-px"
      style={{ background: `${C.border}70` }}
    />
  );
}

function BasePoseDisplay({ base }: { base: BasePose }) {
  const rows = [
    { label: "x",   value: `${base.x.toFixed(3)} m` },
    { label: "y",   value: `${base.y.toFixed(3)} m` },
    { label: "yaw", value: `${((base.yaw * 180) / Math.PI).toFixed(1)}°` },
  ];
  return (
    <div className="space-y-[5px]">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            {label}
          </span>
          <span className="font-mono text-[11px] font-semibold tabular-nums"
            style={{ color: C.foreground }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  const targets               = useStore((s) => s.targets);
  const reachabilityMap       = useStore((s) => s.reachabilityMap);
  const basePose              = useStore((s) => s.basePose);
  const optimizationResult    = useStore((s) => s.optimizationResult);
  const isOptimizing          = useStore((s) => s.isOptimizing);
  const isCheckingReachability= useStore((s) => s.isCheckingReachability);
  const backendError          = useStore((s) => s.backendError);
  const optimize              = useStore((s) => s.optimize);
  const clearTargets          = useStore((s) => s.clearTargets);
  const robotInfo             = useStore((s) => s.robotInfo);

  const [gridRes, setGridRes] = useState(10);

  const reachableCount = Object.values(reachabilityMap).filter(Boolean).length;
  const totalKnown = targets.filter((t) => reachabilityMap[t.id] !== undefined).length;
  const reachFrac  = totalKnown > 0 ? reachableCount / totalKnown : 0;

  // Live-fill gradient for the range slider
  const sliderPct = ((gridRes - 5) / 15) * 100;
  const sliderBg = `linear-gradient(to right, ${C.primary} 0%, ${C.primary} ${sliderPct}%, ${C.border} ${sliderPct}%, ${C.border} 100%)`;

  // Result colour: moss → clay → sienna
  const resultColor =
    !optimizationResult       ? C.primary
    : optimizationResult.reachable_fraction > 0.6 ? C.primary
    : optimizationResult.reachable_fraction > 0.3 ? C.secondary
    : C.destructive;

  return (
    <div
      className="absolute top-4 left-4 bottom-4 w-[308px] flex flex-col z-10 grain rounded-4xl"
      style={{
        // Inline positioning is the source of truth — Tailwind classes are additive.
        position: "absolute",
        top: 16,
        left: 16,
        bottom: 16,
        width: 308,
        display: "flex",
        flexDirection: "column",
        zIndex: 10,
        borderRadius: "1.75rem",
        background: "rgba(253, 252, 248, 0.93)",
        backdropFilter: "blur(20px) saturate(1.5)",
        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
        border: `1px solid ${C.border}88`,
        boxShadow:
          "0 24px 64px -12px rgba(44,44,36,0.26), 0 4px 20px -4px rgba(93,112,82,0.14)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 px-6 pt-6 pb-5 overflow-hidden">
        {/* Ambient blob decorations — purely visual */}
        <div
          className="absolute -top-6 -right-6 w-32 h-32 pointer-events-none"
          style={{
            background: `${C.primary}14`,
            filter: "blur(24px)",
            borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%",
          }}
        />
        <div
          className="absolute top-4 right-10 w-14 h-14 pointer-events-none"
          style={{
            background: `${C.secondary}18`,
            filter: "blur(16px)",
            borderRadius: "40% 60% 70% 30% / 50% 40% 60% 50%",
          }}
        />

        {/* Robot status dot */}
        <div className="absolute top-6 right-6">
          <div
            className="w-2 h-2 rounded-full transition-all duration-500"
            style={{
              background: robotInfo ? C.primary : `${C.mutedFg}60`,
              boxShadow: robotInfo
                ? `0 0 0 3px ${C.primary}28`
                : "none",
            }}
          />
        </div>

        <h1 className="font-display text-[2.15rem] font-[700] leading-none tracking-[-0.01em] text-foreground">
          ouch
        </h1>
        <p className="font-sans text-[11px] leading-tight mt-1.5 text-muted-foreground">
          Base Placement Optimizer
          {robotInfo && (
            <>
              {" · "}
              <span className="font-semibold" style={{ color: `${C.primary}bb` }}>
                {robotInfo.name}
              </span>
            </>
          )}
        </p>
      </div>

      <Divider />

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain organic-scroll"
        style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}
      >

        {/* Instructions */}
        <div className="px-5 py-4">
          <SectionHeading>How to use</SectionHeading>
          <ul className="space-y-2">
            {[
              ["Left-click the floor",    "place a target pose"],
              ["Right-click a target",    "remove it"],
              ["Hit Optimise",            "find the best base placement"],
              ["Green · Red · Grey",      "reachable · not · unknown"],
            ].map(([action, effect]) => (
              <li key={action} className="flex items-start gap-2">
                <span
                  className="mt-[3px] flex-shrink-0 w-[5px] h-[5px] rounded-full"
                  style={{ background: `${C.primary}70` }}
                />
                <span className="font-sans text-[11px] leading-snug text-muted-foreground">
                  <span className="font-semibold" style={{ color: C.foreground }}>
                    {action}
                  </span>
                  {" — "}
                  {effect}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <Divider />

        {/* Error banner */}
        {backendError && (
          <>
            <div className="px-5 py-3">
              <div
                className="rounded-2xl px-3 py-2.5 font-sans text-[11px] leading-snug"
                style={{
                  background: `${C.destructive}0f`,
                  border: `1px solid ${C.destructive}35`,
                  color: C.destructive,
                }}
              >
                <span className="font-bold">Error · </span>
                {backendError}
              </div>
            </div>
            <Divider />
          </>
        )}

        {/* Robot base pose */}
        <div className="px-5 py-4">
          <SectionHeading>Robot Base Pose</SectionHeading>
          <BasePoseDisplay base={basePose} />
        </div>

        <Divider />

        {/* Targets */}
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeading>
              <span>Targets</span>
              <span
                className="ml-1.5 font-mono font-normal normal-case tracking-normal text-[10px]"
                style={{ color: `${C.mutedFg}` }}
              >
                ({targets.length})
              </span>
            </SectionHeading>

            {isCheckingReachability && (
              <span
                className="flex items-center gap-1.5 font-sans text-[10px] font-semibold"
                style={{ color: `${C.primary}99` }}
              >
                <span
                  className="w-[6px] h-[6px] rounded-full animate-pulse-soft"
                  style={{ background: C.primary }}
                />
                checking
              </span>
            )}
          </div>

          {targets.length === 0 ? (
            <p className="font-sans italic text-[11px] text-muted-foreground/60">
              Click the floor to place targets
            </p>
          ) : (
            <div className="space-y-[3px]">
              {targets.map((t, i) => {
                const r = reachabilityMap[t.id];
                const badgeBg =
                  r === undefined ? C.border
                  : r             ? C.primary
                  :                 C.destructive;
                const badgeFg =
                  r === undefined ? C.mutedFg : "#fff";
                const badgeLabel =
                  r === undefined ? "?" : r ? "✓" : "✗";

                return (
                  <div
                    key={t.id}
                    className="group flex items-center gap-2 px-2 py-[5px] rounded-xl transition-colors duration-200"
                    style={{ ["--hover-bg" as string]: `${C.muted}99` }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = `${C.muted}99`)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <span
                      className="flex-shrink-0 w-5 text-right font-mono text-[9px] font-bold"
                      style={{ color: `${C.mutedFg}80` }}
                    >
                      #{i + 1}
                    </span>
                    <span
                      className="flex-1 font-mono text-[10px] tabular-nums truncate"
                      style={{ color: `${C.foreground}99` }}
                    >
                      (
                      {t.pose.translation[0].toFixed(2)},{" "}
                      {t.pose.translation[1].toFixed(2)},{" "}
                      {t.pose.translation[2].toFixed(2)}
                      )
                    </span>
                    <span
                      className="flex-shrink-0 w-[18px] h-[18px] flex items-center justify-center rounded-full text-[8px] font-bold transition-all duration-300"
                      style={{ background: badgeBg, color: badgeFg }}
                    >
                      {badgeLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reachability bar */}
          {totalKnown > 0 && (
            <div
              className="mt-3 rounded-2xl px-3 py-2.5"
              style={{
                background: `${C.muted}cc`,
                border: `1px solid ${C.border}80`,
              }}
            >
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="font-sans text-[10px] text-muted-foreground">
                  Reachable at current base
                </span>
                <span className="font-sans text-xs font-bold tabular-nums" style={{ color: C.primary }}>
                  {reachableCount}
                  <span className="font-normal text-muted-foreground">
                    /{totalKnown}
                  </span>
                  <span className="font-normal text-[10px] text-muted-foreground ml-1">
                    ({Math.round(reachFrac * 100)}%)
                  </span>
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: `${C.border}cc` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${reachFrac * 100}%`,
                    background: `linear-gradient(to right, ${C.primary}, ${C.primary}cc)`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* ── Footer: controls + result ────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-5 py-4 space-y-3"
        style={{ flexShrink: 0, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
      >

        {/* Grid resolution control */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-sans text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
              Grid Resolution
            </label>
            <span
              className="font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: C.primary }}
            >
              {gridRes}³ ={" "}
              <span className="font-normal text-muted-foreground text-[10px]">
                {gridRes ** 3} pts
              </span>
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={20}
            value={gridRes}
            onChange={(e) => setGridRes(Number(e.target.value))}
            className="organic-slider"
            style={{ background: sliderBg }}
          />
        </div>

        {/* Optimise button — moss green pill */}
        <button
          disabled={isOptimizing || targets.length === 0}
          onClick={() => optimize(gridRes)}
          className="w-full h-11 rounded-full font-sans font-bold text-sm transition-all duration-300
                     hover:scale-[1.02] active:scale-[0.97]
                     disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: C.primary,
            color: "#F3F4F1",
            boxShadow: "0 4px 20px -2px rgba(93,112,82,0.25)",
          }}
          onMouseEnter={(e) => {
            if (!(e.currentTarget as HTMLButtonElement).disabled)
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 6px 28px -4px rgba(93,112,82,0.45)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 20px -2px rgba(93,112,82,0.25)";
          }}
        >
          {isOptimizing ? "Optimising…" : "Optimise Base Pose"}
        </button>

        {/* Clear button — terracotta outline pill */}
        <button
          disabled={targets.length === 0}
          onClick={clearTargets}
          className="w-full h-10 rounded-full font-sans font-semibold text-sm bg-transparent
                     transition-all duration-300 active:scale-[0.97]
                     disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            border: `1.5px solid ${C.destructive}55`,
            color: C.destructive,
          }}
          onMouseEnter={(e) => {
            if (!(e.currentTarget as HTMLButtonElement).disabled)
              (e.currentTarget.style.background = `${C.destructive}0e`);
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          Clear All Targets
        </button>

        {/* Optimisation result card */}
        {optimizationResult && (
          <div
            className="rounded-2xl px-3 py-3 space-y-2"
            style={{
              background: `${C.primary}0d`,
              border: `1px solid ${C.primary}28`,
            }}
          >
            <SectionHeading>
              <span style={{ color: `${C.primary}cc` }}>Optimisation Result</span>
            </SectionHeading>

            <div className="flex justify-between items-center">
              <span className="font-sans text-[11px] text-muted-foreground">Reachable</span>
              <span
                className="font-sans text-sm font-bold tabular-nums"
                style={{ color: resultColor }}
              >
                {optimizationResult.reachable_count}/{optimizationResult.total_targets}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">
                  ({Math.round(optimizationResult.reachable_fraction * 100)}%)
                </span>
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="font-sans text-[11px] text-muted-foreground">Method</span>
              <span
                className="font-mono text-[10px]"
                style={{ color: `${C.foreground}99` }}
              >
                {optimizationResult.method}
              </span>
            </div>

            <div
              className="pt-2"
              style={{ borderTop: `1px solid ${C.primary}20` }}
            >
              <BasePoseDisplay base={optimizationResult.base} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
