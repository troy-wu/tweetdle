import { CACHE, guard, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** GET /api/authors -> Author[] sorted by name. */
export function GET() {
  return guard(async () => {
    const authors = await getStore().getAuthors();
    const sorted = [...authors].sort((a, b) => a.name.localeCompare(b.name, "en"));
    return json(sorted, { cache: CACHE.authors });
  });
}
