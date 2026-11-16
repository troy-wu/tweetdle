import { CACHE, guard, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** GET /api/practice -> { numbers }: every puzzle number in the bank, for unlimited mode. No answers. */
export function GET() {
  return guard(async () => json({ numbers: await getStore().getPuzzleNumbers() }, { cache: CACHE.authors }));
}
