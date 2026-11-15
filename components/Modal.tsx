"use client";
import { useEffect, useId, useRef } from "react";
import { CloseIcon } from "./icons";

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-fade sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="animate-rise max-h-[92dvh] w-full max-w-[520px] overflow-y-auto border border-b-0 border-ink bg-bg p-5 pb-8 outline-none sm:border-b sm:pb-6"
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
          <h2 id={titleId} className="font-display text-2xl font-bold">
            {title}
          </h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
