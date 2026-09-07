"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface DaySelectorProps {
  currentDays: number;
  options: readonly number[];
}

export function DaySelector({ currentDays, options }: DaySelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleDayChange = (days: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("days", String(days));
    router.push(`?${params.toString()}`);
  };

  return (
    <nav
      className="segmented"
      aria-label="Day range"
      style={{ alignSelf: "flex-start" }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => handleDayChange(opt)}
          className={`segmented-btn${currentDays === opt ? " segmented-btn--active" : ""}`}
          aria-pressed={currentDays === opt}
        >
          {opt}d
        </button>
      ))}
    </nav>
  );
}
