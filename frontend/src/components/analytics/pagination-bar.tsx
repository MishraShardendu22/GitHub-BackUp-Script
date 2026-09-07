"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { Dropdown } from "@/components/ui/Dropdown";

const PAGE_SIZES = [10, 25, 50] as const;

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export function PaginationBar({
  page,
  totalPages,
  pageSize,
  totalItems,
}: PaginationBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  };

  const handlePageSize = (newSize: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    params.set("pageSize", String(newSize));
    router.push(`?${params.toString()}`);
  };
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  // Window of up to 5 page numbers centered on current page
  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const windowEnd = Math.min(windowStart + 4, totalPages);
  const pages = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i,
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        paddingTop: 14,
        borderTop: "1px solid var(--line)",
        marginTop: 2,
      }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {totalItems === 0 ? "No results" : `${from}–${to} of ${totalItems}`}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Dropdown
          options={PAGE_SIZES.map((s) => ({
            value: String(s),
            label: `${s} rows`,
          }))}
          value={String(pageSize)}
          onChange={(val) => handlePageSize(Number(val))}
        />

        <div style={{ display: "flex", gap: 3 }}>
          <PBtn
            onClick={() => handlePage(1)}
            disabled={page <= 1}
            aria-label="First m-page"
          >
            <ChevronsLeft size={14} />
          </PBtn>
          <PBtn
            onClick={() => handlePage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous m-page"
          >
            <ChevronLeft size={14} />
          </PBtn>
          {pages.map((p) => (
            <PBtn
              key={p}
              onClick={() => handlePage(p)}
              active={p === page}
              aria-label={`Page ${p}`}
            >
              {p}
            </PBtn>
          ))}
          <PBtn
            onClick={() => handlePage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next m-page"
          >
            <ChevronRight size={14} />
          </PBtn>
          <PBtn
            onClick={() => handlePage(totalPages)}
            disabled={page >= totalPages}
            aria-label="Last m-page"
          >
            <ChevronsRight size={14} />
          </PBtn>
        </div>
      </div>
    </div>
  );
}

function PBtn({
  onClick,
  disabled = false,
  active = false,
  children,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      style={{
        border: active
          ? "1px solid rgba(212,168,50,0.5)"
          : "1px solid var(--line)",
        background: active ? "rgba(212,168,50,0.15)" : "var(--surface)",
        color: disabled
          ? "var(--text-muted)"
          : active
            ? "var(--iris-500)"
            : "var(--text-secondary)",
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        minWidth: 32,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      {children}
    </button>
  );
}
