"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const handlePageSize = (newSize: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", "1");
    params.set("pageSize", newSize);
    router.push(`?${params.toString()}`);
  };
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm w-full">
      <div className="flex items-center text-muted-foreground whitespace-nowrap">
        {totalItems === 0
          ? "No results found"
          : `Showing ${from} to ${to} of ${totalItems} entries`}
      </div>

      <div className="flex items-center gap-4 sm:gap-6 flex-wrap justify-center">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground whitespace-nowrap">
            Rows per page
          </span>
          <Select value={String(pageSize)} onValueChange={handlePageSize}>
            <SelectTrigger className="h-8 w-[70px] bg-background">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="flex items-center justify-center text-muted-foreground mr-2">
            Page {page} of {totalPages || 1}
          </span>
          <div className="flex items-center space-x-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={() => handlePage(1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePage(page - 1)}
              disabled={page <= 1}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handlePage(page + 1)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden sm:flex"
              onClick={() => handlePage(totalPages)}
              disabled={page >= totalPages}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
