/** Read every row without silently stopping at the Data API's page limit. */
export async function readAllPages<T>(read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, size = 500): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const result = await read(from, from + size - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < size) return rows;
  }
}