"use client";
import { useEffect, useState } from "react";
import { ShareIcon } from "./icons";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and non-secure origins.
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      el.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareButton({ text }: { text: string }) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        // The player closed the share sheet: nothing more to do.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setToast((await copy(text)) ? "Copied!" : "Couldn't copy");
  }

  return (
    <>
      <button type="button" className="btn btn-accent btn-xl w-full" onClick={share}>
        <ShareIcon /> Share result
      </button>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center">
        {toast && (
          <span className="animate-pop bg-ink px-4 py-2 text-sm font-semibold text-on-color">
            {toast}
          </span>
        )}
      </div>
    </>
  );
}
