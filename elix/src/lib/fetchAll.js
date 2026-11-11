// Supabase returns at most 1000 rows per request. This reads a table page by page so a menu that grows past 1000 items
// is never cut short. `makeQuery` must return a fresh query each time and should end with a stable order (for example
// .order('sort_order').order('id')) so pages never overlap.
export async function fetchAllRows(makeQuery, pageSize = 1000) {
  const all = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) return { data: all, error: null };
  }
}
