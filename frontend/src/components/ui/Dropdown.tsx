"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  placeholder = "Select option...",
  disabled = false,
  searchable = false,
  className = "",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-focus search
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const activeOption = options.find((o) => o.value === value);
  const displayLabel =
    activeOption?.label || activeOption?.value || placeholder;

  const filteredOptions =
    searchable && search.trim()
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(search.toLowerCase()) ||
            o.value.toLowerCase().includes(search.toLowerCase()) ||
            o.sublabel?.toLowerCase().includes(search.toLowerCase()),
        )
      : options;

  return (
    <div
      className={`custom-model-selector-wrap ${className}`}
      ref={containerRef}
    >
      <button
        type="button"
        className={`custom-model-trigger ${isOpen ? "open" : ""} ${disabled ? "disabled" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {label && <span className="custom-model-label">{label}</span>}
        <span className="custom-model-value">{displayLabel}</span>
        <span className={`custom-model-arrow ${isOpen ? "rotated" : ""}`}>
          <ChevronDown size={14} />
        </span>
      </button>

      {isOpen && (
        <div className="custom-model-popover animate-in">
          {searchable && options.length > 5 && (
            <div className="custom-model-popover-header">
              <div className="custom-model-search-box">
                <Search size={13} className="custom-model-search-icon" />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="custom-model-search-input"
                  placeholder="Filter options..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="custom-model-search-clear"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="custom-model-list" role="listbox">
            {filteredOptions.length === 0 ? (
              <div className="custom-model-empty">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`custom-model-option ${isSelected ? "selected" : ""}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                  >
                    <div className="custom-model-option-main">
                      <span className="custom-model-option-name">
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="custom-model-option-id">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="custom-model-option-meta">
                      {opt.badge && (
                        <span className="custom-model-provider-badge">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="custom-model-check-icon">
                          <Check size={14} />
                        </span>
                      )}
                    </div>
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
