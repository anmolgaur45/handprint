"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ListboxOption {
  value: string;
  label: string;
}

export interface ListboxProps {
  options: ListboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}

export function Listbox({
  options,
  value,
  onChange,
  placeholder = "Select option",
  className,
  label,
}: ListboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxId = useId();
  const labelId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openListbox = () => {
    const selectedIndex = options.findIndex((opt) => opt.value === value);
    setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const closeListbox = () => {
    setFocusedIndex(-1);
    setIsOpen(false);
  };

  const toggleListbox = () => {
    if (isOpen) {
      closeListbox();
    } else {
      openListbox();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openListbox();
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        closeListbox();
        triggerRef.current?.focus();
        break;
      case "Tab":
        closeListbox();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          onChange(options[focusedIndex].value);
          closeListbox();
          triggerRef.current?.focus();
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case "Home":
        e.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        e.preventDefault();
        setFocusedIndex(options.length - 1);
        break;
      default:
        break;
    }
  };

  const handleOptionClick = (val: string) => {
    onChange(val);
    closeListbox();
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full space-y-1.5", className)}>
      {label && (
        <label
          id={labelId}
          className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block"
        >
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        id={`${listboxId}-trigger`}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={label ? labelId : undefined}
        aria-controls={listboxId}
        aria-activedescendant={
          isOpen && focusedIndex >= 0 ? `${listboxId}-opt-${focusedIndex}` : undefined
        }
        onClick={toggleListbox}
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 py-2.5 px-4 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-left transition"
      >
        <span className={cn(!selectedOption && "text-zinc-655")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-550 transition-transform duration-200", isOpen && "transform rotate-180")} />
      </button>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-labelledby={label ? labelId : undefined}
          className="absolute z-50 w-full mt-1.5 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-md p-1 shadow-2xl focus:outline-none max-h-60 overflow-y-auto animate-scaleUp"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;

            return (
              <li
                key={opt.value}
                id={`${listboxId}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleOptionClick(opt.value)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium cursor-pointer transition select-none",
                  isFocused
                    ? "bg-emerald-500/10 text-emerald-300"
                    : isSelected
                    ? "text-emerald-450"
                    : "text-zinc-300 hover:bg-zinc-900"
                )}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 text-emerald-400" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
