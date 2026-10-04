"use client";
import type { ReactNode } from "react";

const paths = {
  send: "M7 17 17 7M8 7h9v9",
  receive: "M12 4v15m0 0-6-6m6 6 6-6",
  add: "M12 5v14M5 12h14",
  refresh: "M20 11a8 8 0 0 0-14.9-3.6M4 4v4h4m-4 5a8 8 0 0 0 14.9 3.6M20 20v-4h-4",
  close: "M6 6l12 12M18 6 6 18",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5 10 17 19 7",
};

export function Icon({ name, className = "size-5" }: { name: keyof typeof paths; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/20" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full bg-white/10" aria-label="Close">
            <Icon name="close" className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid size-8 place-items-center rounded-xl bg-[radial-gradient(circle_at_30%_20%,#3b6cf6,#13224f)] text-lg font-bold">r</div>
      <span className="text-xl font-bold tracking-tight">remit</span>
    </div>
  );
}

/** Deterministic gradient avatar from an address, so each account has a recognisable face. */
export function Avatar({ address, className = "size-11" }: { address: string; className?: string }) {
  const h = parseInt(address.slice(2, 8), 16) % 360;
  return (
    <div
      className={`rounded-full border border-white/15 ${className}`}
      style={{ background: `linear-gradient(135deg, hsl(${h} 80% 60%), hsl(${(h + 60) % 360} 70% 40%))` }}
    />
  );
}
