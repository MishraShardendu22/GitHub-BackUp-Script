"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface DaySelectorProps {
  currentDays: number;
}

export function DaySelector({ currentDays }: DaySelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const options = [7, 30, 90] as const;

  const handleDayChange = (days: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("days", String(days));
    router.push(`?${params.toString()}`);
  };

  return (
    <nav
      className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground"
      aria-label="Day range selector"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => handleDayChange(opt)}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            currentDays === opt
              ? "bg-background text-foreground shadow-sm"
              : "hover:bg-background/50 hover:text-foreground",
          )}
          aria-pressed={currentDays === opt}
        >
          {opt}d
        </button>
      ))}
    </nav>
  );
}
