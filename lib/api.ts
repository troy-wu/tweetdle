/**
 * Browser-side API client. UI code calls these and nothing else to reach the server.
 */
import type {
  Author,
  DailyStats,
  HistoryEntry,
  LeaderboardKind,
  LeaderboardRow,
  PublicPuzzle,
  ResultPayload,
  ResultResponse,
  SyncResponse,
} from "@/lib/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const getPuzzle = (n: number) => request<PublicPuzzle>(`/api/puzzle/${n}`);
/** Every puzzle number in the bank (daily and unlimited-only). */
export const getPuzzleNumbers = () =>
  request<{ numbers: number[] }>(`/api/practice`).then((r) => r.numbers);
export const getAuthors = () => request<Author[]>(`/api/authors`);
export const submitResult = (payload: ResultPayload) =>
  request<ResultResponse>(`/api/result`, json(payload));
export const getStats = (n: number) => request<DailyStats>(`/api/stats/${n}`);
export const getLeaderboard = (kind: LeaderboardKind, puzzleNumber: number) =>
  request<LeaderboardRow[]>(`/api/leaderboard?kind=${kind}&n=${puzzleNumber}`);
export const syncHistory = (history: HistoryEntry[]) =>
  request<SyncResponse>(`/api/sync`, json({ history }));

/* Review mode (local dev only, see lib/server/review.ts). */
export type ReviewVerdict = "keep" | "maybe" | "cut";
export interface ReviewRating {
  verdict: ReviewVerdict;
  note: string;
  solved: boolean;
  guessesUsed: number;
  ratedAt: string;
}
export interface ReviewListItem {
  number: number;
  category: Author["category"];
  rating: ReviewRating | null;
}
export interface ReviewPuzzle {
  puzzle: PublicPuzzle;
  answer: Author;
  tweetUrls: string[];
  fullTexts: string[];
  rating: ReviewRating | null;
  prev: number | null;
  next: number | null;
  total: number;
}
export const getReviewList = () => request<ReviewListItem[]>(`/api/review`);
export const getReviewPuzzle = (n: number) => request<ReviewPuzzle>(`/api/review/${n}`);
export const saveReviewRating = (n: number, rating: Omit<ReviewRating, "ratedAt">) =>
  request<ReviewRating>(`/api/review`, json({ number: n, ...rating }));
