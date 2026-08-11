import buildClassName from './buildClassName';

export const GRID_COLUMNS = 3;

export function getGridCornerClassName(index: number, total: number) {
  const lastRowIndex = Math.floor((total - 1) / GRID_COLUMNS);
  const lastRowCount = total - lastRowIndex * GRID_COLUMNS;
  const isLastRowFull = lastRowCount === GRID_COLUMNS;

  const isTopStart = index === 0;
  const isTopEnd = index === Math.min(GRID_COLUMNS - 1, total - 1);
  const isBottomStart = index === lastRowIndex * GRID_COLUMNS;
  const isBottomEnd = index === total - 1
    || (!isLastRowFull && lastRowIndex > 0 && index === lastRowIndex * GRID_COLUMNS - 1);

  return buildClassName(
    isTopStart && 'roundTopStart',
    isTopEnd && 'roundTopEnd',
    isBottomStart && 'roundBottomStart',
    isBottomEnd && 'roundBottomEnd',
  );
}
