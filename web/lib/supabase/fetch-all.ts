// PostgREST отдаёт не больше 1000 строк за запрос (max-rows). Для подсчётов «по ученику» нужны
// все строки, поэтому читаем страницами. build(from, to) должен вернуть запрос с .range(from, to).
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1)
    if (error || !data) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
}
