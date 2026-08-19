"use client";

import { useRouter, useSearchParams } from "next/navigation";
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
        borderTop: "1px solid var(--border)",
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
          <PBtn onClick={() => handlePage(1)} disabled={page <= 1} label="«" />
          <PBtn
            onClick={() => handlePage(page - 1)}
            disabled={page <= 1}
            label="‹"
          />
          {pages.map((p) => (
            <PBtn
              key={p}
              onClick={() => handlePage(p)}
              label={String(p)}
              active={p === page}
            />
          ))}
          <PBtn
            onClick={() => handlePage(page + 1)}
            disabled={page >= totalPages}
            label="›"
          />
          <PBtn
            onClick={() => handlePage(totalPages)}
            disabled={page >= totalPages}
            label="»"
          />
        </div>
      </div>
    </div>
  );
}

function PBtn({
  onClick,
  disabled = false,
  active = false,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      style={{
        border: active
          ? "1px solid rgba(212,168,50,0.5)"
          : "1px solid var(--border)",
        background: active ? "rgba(212,168,50,0.15)" : "var(--surface)",
        color: disabled
          ? "var(--text-muted)"
          : active
            ? "var(--accent)"
            : "var(--text-secondary)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 13,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        minWidth: 32,
        transition: "background 0.12s, border-color 0.12s",
      }}
    >
      {label}
    </button>
  );
}
