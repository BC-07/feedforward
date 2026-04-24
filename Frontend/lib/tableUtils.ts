export function getPlaceholderRowCount(
  currentPage: number,
  pageSize: number,
  defaultPageSize: number,
  paginatedLength: number,
): number {
  if (pageSize !== defaultPageSize || currentPage <= 1) return 0;
  return Math.max(0, defaultPageSize - paginatedLength);
}