"use client";
/**
 * Client-only data hooks. Everything here returns a "not ready" value during
 * server render and hydration, then the real value, so markup never mismatches.
 */
import { useMemo, useSyncExternalStore } from "react";
import { computeStats, getGame, getHistory, puzzleNumberForDate } from "@/lib/game";
import type { GameState, HistoryEntry, PlayerStats } from "@/lib/types";

/* ---- clock ---- */

let nowValue = 0;
let todayValue: number | null = null;

function tick() {
  nowValue = Date.now();
  todayValue = puzzleNumberForDate(new Date(nowValue));
}

function subscribeClock(onChange: () => void) {
  tick();
  const id = window.setInterval(() => {
    tick();
    onChange();
  }, 1000);
  return () => window.clearInterval(id);
}

/** Epoch ms, updated every second. 0 until mounted. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => nowValue,
    () => 0,
  );
}

/** Today's puzzle number in the player's local date. null until mounted. */
export function useToday(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => todayValue,
    () => null,
  );
}

/* ---- localStorage ---- */

let storageVersion = 0;
const storageListeners = new Set<() => void>();

/** Call after writing to game storage so every hook re-reads it. */
export function bumpStorage() {
  storageVersion += 1;
  storageListeners.forEach((l) => l());
}

function subscribeStorage(onChange: () => void) {
  storageListeners.add(onChange);
  window.addEventListener("storage", bumpStorage);
  return () => {
    storageListeners.delete(onChange);
    window.removeEventListener("storage", bumpStorage);
  };
}

/** -1 on the server and during hydration, >= 0 on the client. */
function useStorageVersion(): number {
  return useSyncExternalStore(
    subscribeStorage,
    () => storageVersion,
    () => -1,
  );
}

export function useMounted(): boolean {
  return useStorageVersion() >= 0;
}

export function useHistory(): HistoryEntry[] {
  const v = useStorageVersion();
  return useMemo(() => (v < 0 ? [] : getHistory()), [v]);
}

/** null until mounted. */
export function usePlayerStats(): PlayerStats | null {
  const today = useToday();
  const history = useHistory();
  return useMemo(
    () => (today === null ? null : computeStats(history, today)),
    [history, today],
  );
}

/** Saved state of today's game, if any. */
export function useTodayGame(): GameState | null {
  const today = useToday();
  const v = useStorageVersion();
  return useMemo(() => (today === null || v < 0 ? null : getGame(today)), [today, v]);
}
