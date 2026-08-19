"use client";

import type { ReactNode } from "react";

export function PanelSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-ink-700 px-4 py-4">
      <div className="mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-400">
          {title}
        </h3>
        {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-ink-300">{label}</span>
        <span className="font-mono text-[11px] text-ink-400">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-ink-800 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-ink-600 text-ink-50"
              : "text-ink-400 hover:text-ink-100"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function IconButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-700 hover:text-ink-50 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
