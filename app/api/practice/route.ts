import { CACHE, guard, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** GET /api/practice -> { numbers }: the unlimited-mode puzzle numbers. No answers. */
export function GET() {
  return guard(async () => json({ numbers: await getStore().getPracticeNumbers() }, { cache: CACHE.authors }));
}
