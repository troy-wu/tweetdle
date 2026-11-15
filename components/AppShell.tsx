"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AccountSheet } from "./AccountSheet";
import { Header } from "./Header";
import { HowToPlay } from "./HowToPlay";
import { StatsModal } from "./StatsModal";

export type ModalName = "help" | "stats" | "account";

const ModalContext = createContext<{ open: (name: ModalName) => void }>({ open: () => {} });

/** Lets any page open the shared modals, e.g. the home page's "How to play" button. */
export const useModals = () => useContext(ModalContext);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalName | null>(null);
  const close = useCallback(() => setModal(null), []);
  const value = useMemo(() => ({ open: (name: ModalName) => setModal(name) }), []);

  return (
    <ModalContext.Provider value={value}>
      <Header />
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 pt-6">
        {children}
      </main>
      {modal === "help" && <HowToPlay onClose={close} />}
      {modal === "stats" && <StatsModal onClose={close} />}
      {modal === "account" && <AccountSheet onClose={close} />}
    </ModalContext.Provider>
  );
}
