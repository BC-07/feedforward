export function getPlaceholderRowCount(
  currentPage: number,
  pageSize: number,
  preferredFirstPageRows: number,
  visibleRowCount: number,
): number {
  const normalizedPageSize = Number.isFinite(pageSize)
    ? Math.max(0, Math.trunc(pageSize))
    : 0;
  const normalizedPreferred = Number.isFinite(preferredFirstPageRows)
    ? Math.max(0, Math.trunc(preferredFirstPageRows))
    : normalizedPageSize;
  const normalizedVisible = Number.isFinite(visibleRowCount)
    ? Math.max(0, Math.trunc(visibleRowCount))
    : 0;

  const baselineRows = currentPage <= 1
    ? Math.min(normalizedPageSize, normalizedPreferred)
    : normalizedPageSize;

  return Math.max(0, baselineRows - normalizedVisible);
}
