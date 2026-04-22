"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlidersHorizontal, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type HoverFilterOption = {
  label: string;
  value: string;
};

export type HoverFilterItem<Key extends string = string> = {
  key: Key;
  label: string;
  options: HoverFilterOption[];
  isSelected: (value: string) => boolean;
  onSelect: (value: string) => void;
};

interface HoverFilterPopoverProps<Key extends string = string> {
  items: HoverFilterItem<Key>[];
  activeCount: number;
  onReset: () => void;
  buttonLabel?: string;
}

export function HoverFilterPopover<Key extends string = string>({
  items,
  activeCount,
  onReset,
  buttonLabel = "Filters",
}: HoverFilterPopoverProps<Key>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeHoverFilter, setActiveHoverFilter] = useState<Key | null>(null);
  const [activeHoverTop, setActiveHoverTop] = useState(0);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleHoverClose = useCallback(() => {
    cancelHoverClose();
    closeTimerRef.current = setTimeout(() => {
      setActiveHoverFilter(null);
    }, 180);
  }, [cancelHoverClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const activeItem =
    items.find((item) => item.key === activeHoverFilter) ?? null;

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          cancelHoverClose();
          setActiveHoverFilter(null);
          setActiveHoverTop(0);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 transition-all duration-150 hover:-translate-y-px"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {buttonLabel}
          {activeCount > 0 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted-foreground">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[160px] p-1.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
      >
        <div
          className="relative"
          onMouseEnter={cancelHoverClose}
          onMouseLeave={scheduleHoverClose}
        >
          <div className="space-y-0.5">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onMouseEnter={(event) => {
                  cancelHoverClose();
                  setActiveHoverFilter(item.key);
                  setActiveHoverTop(event.currentTarget.offsetTop);
                }}
                onFocus={(event) => {
                  cancelHoverClose();
                  setActiveHoverFilter(item.key);
                  setActiveHoverTop(event.currentTarget.offsetTop);
                }}
                onClick={(event) => {
                  cancelHoverClose();
                  setActiveHoverFilter(item.key);
                  setActiveHoverTop(event.currentTarget.offsetTop);
                }}
                className={`flex h-10 w-full items-center justify-between rounded-md px-2.5 text-left text-[13px] transition-colors ${
                  activeHoverFilter === item.key
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent hover:text-accent-foreground text-foreground"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            ))}
          </div>
          {activeItem ? (
            <div
              className="absolute left-full z-20"
              style={{ top: activeHoverTop }}
              onMouseEnter={cancelHoverClose}
              onMouseLeave={scheduleHoverClose}
            >
              <div className="w-[168px] pl-2">
                <div className="w-[160px] rounded-md border border-border/70 bg-popover p-1 shadow-md">
                  <div className="space-y-0.5">
                    {activeItem.options.map((option) => {
                      const isSelected = activeItem.isSelected(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onMouseEnter={() => {
                            cancelHoverClose();
                            setActiveHoverFilter(activeItem.key);
                          }}
                          onClick={() => {
                            activeItem.onSelect(option.value);
                          }}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                            isSelected
                              ? "text-foreground font-medium hover:bg-accent hover:text-accent-foreground"
                              : "text-foreground hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <span className="truncate">{option.label}</span>
                          {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-1 flex justify-end border-t border-border/60 pt-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}