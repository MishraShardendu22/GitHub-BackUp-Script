"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  className?: string;
}

export function Dropdown({
  options,
  value,
  onChange,
  label,
  placeholder = "Select an option",
  disabled = false,
  searchable = false,
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const labelId = useId();

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  const activeOption = options.find((option) => option.value === value);
  const displayLabel =
    activeOption?.label ?? activeOption?.value ?? placeholder;

  const query = search.trim().toLowerCase();
  const filteredOptions =
    searchable && query
      ? options.filter(
          (option) =>
            option.label.toLowerCase().includes(query) ||
            option.value.toLowerCase().includes(query) ||
            option.sublabel?.toLowerCase().includes(query),
        )
      : options;

  return (
    <div
      className={cn("m-field", className)}
      ref={containerRef}
      style={{ position: "relative" }}
    >
      {label && (
        <span className="m-label" id={labelId}>
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        className="m-select"
        onClick={() => !disabled && setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-labelledby={label ? labelId : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-3)",
          textAlign: "left",
          backgroundImage: "none",
          paddingRight: "var(--space-4)",
        }}
      >
        <span className="m-truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="m-navitem__chevron"
          style={{ transform: isOpen ? "rotate(180deg)" : undefined }}
        />
      </button>

      {isOpen && (
        <div
          className="m-menu"
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-2))",
            left: 0,
            right: 0,
            maxHeight: "18rem",
            overflowY: "auto",
          }}
        >
          {searchable && options.length > 5 && (
            <div
              className="m-search"
              style={{ marginBottom: "var(--space-1)" }}
            >
              <span className="m-search__icon">
                <Search size={13} aria-hidden="true" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                className="m-input m-search__input"
                placeholder="Filter options"
                aria-label="Filter options"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className="m-icon-btn m-icon-btn--bare m-search__clear"
                  onClick={() => setSearch("")}
                  aria-label="Clear filter"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <div id={listId} role="listbox" aria-labelledby={labelId}>
            {filteredOptions.length === 0 ? (
              <p className="m-menu__label">No options found</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="m-menu__item"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch("");
                      triggerRef.current?.focus();
                    }}
                  >
                    <span
                      className="m-stack m-stack--tight"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <span className="m-truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="m-caption m-truncate">
                          {option.sublabel}
                        </span>
                      )}
                    </span>
                    {option.badge && (
                      <span className="m-tag">{option.badge}</span>
                    )}
                    {isSelected && <Check size={14} aria-hidden="true" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
