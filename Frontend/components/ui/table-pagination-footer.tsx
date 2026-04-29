import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

type TablePaginationFooterProps = {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  pageSize: number;
  pageSizeOptions: readonly number[];
  onPageSizeChange: (value: number) => void;
};

type SimplePaginationFooterProps = {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function SimplePaginationFooter({
  page,
  totalPages,
  onPrevious,
  onNext,
}: SimplePaginationFooterProps) {
  return (
    <div className="flex items-center justify-end gap-2 text-xs text-black">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={onPrevious}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-black">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={onNext}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function TablePaginationFooter({
  page,
  totalPages,
  onPrevious,
  onNext,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: TablePaginationFooterProps) {
  return (
    <div className="flex flex-col gap-3 text-xs text-black sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="h-8 w-[82px] text-black">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-0 w-[105px]">
            {pageSizeOptions.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onPrevious}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-black">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={onNext}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
