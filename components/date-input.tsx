"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MONTH_NAMES_ES,
  WEEKDAY_SHORT_ES,
  calendarFromIso,
  formatChosenDate,
  isoFromParts,
  monthGrid,
  shiftMonth,
} from "@/lib/domain/dates";

function monthTitle(year: number, month: number): string {
  const name = MONTH_NAMES_ES[month - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`;
}

function todayParts() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function DateInput({
  name,
  value,
  defaultValue,
  required = false,
  disabled = false,
  className = "input-control",
  onChange,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (iso: string) => void;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const iso = isControlled ? value : internal;
  const selected = calendarFromIso(iso);
  const display = formatChosenDate(iso);
  const today = todayParts();
  const initialView = selected ?? today;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ year: initialView.year, month: initialView.month });
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const calendarId = useId();

  function commit(next: string) {
    if (!isControlled) {
      setInternal(next);
    }
    onChange?.(next);
  }

  function openCalendar() {
    if (disabled) {
      return;
    }
    const current = calendarFromIso(iso) ?? todayParts();
    setView({ year: current.year, month: current.month });
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }

    function place() {
      const trigger = triggerRef.current;
      const menu = menuRef.current;
      if (!trigger) {
        return;
      }
      const rect = trigger.getBoundingClientRect();
      const menuHeight = menu?.offsetHeight ?? 320;
      const gap = 6;
      const fitsBelow = rect.bottom + gap + menuHeight <= window.innerHeight - 8;
      const top = fitsBelow
        ? rect.bottom + gap
        : Math.max(8, rect.top - gap - menuHeight);
      const width = Math.max(rect.width, 288);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setMenuPos({ top, left: Math.max(8, left), width });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, view]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const cells = monthGrid(view.year, view.month);
  const calendar =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            id={calendarId}
            role="dialog"
            aria-label="Calendario"
            lang="es"
            className="date-calendar"
            style={
              menuPos
                ? { top: menuPos.top, left: menuPos.left, width: menuPos.width }
                : { top: 0, left: 0, visibility: "hidden" }
            }
          >
            <div className="date-calendar-nav">
              <button
                type="button"
                className="date-calendar-shift"
                aria-label="Año anterior"
                onClick={() => setView((current) => ({ ...current, year: current.year - 1 }))}
              >
                «
              </button>
              <button
                type="button"
                className="date-calendar-shift"
                aria-label="Mes anterior"
                onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
              >
                ‹
              </button>
              <p className="date-calendar-month">{monthTitle(view.year, view.month)}</p>
              <button
                type="button"
                className="date-calendar-shift"
                aria-label="Mes siguiente"
                onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
              >
                ›
              </button>
              <button
                type="button"
                className="date-calendar-shift"
                aria-label="Año siguiente"
                onClick={() => setView((current) => ({ ...current, year: current.year + 1 }))}
              >
                »
              </button>
            </div>
            <div className="date-calendar-weekdays">
              {WEEKDAY_SHORT_ES.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="date-calendar-grid">
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`empty-${index}`} />;
                }
                const isoDay = isoFromParts(view.year, view.month, day);
                const isSelected = selected
                  ? selected.year === view.year &&
                    selected.month === view.month &&
                    selected.day === day
                  : false;
                const isToday =
                  today.year === view.year && today.month === view.month && today.day === day;
                return (
                  <button
                    key={isoDay}
                    type="button"
                    className={`date-calendar-day${isSelected ? " is-selected" : ""}${
                      isToday ? " is-today" : ""
                    }`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      commit(isoDay);
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="date-input" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${className} date-input-trigger${display ? "" : " is-empty"}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? calendarId : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openCalendar();
        }}
      >
        {display ?? "Elige el día"}
      </button>
      <input
        className="date-input-value"
        name={name}
        value={iso}
        required={required}
        tabIndex={-1}
        readOnly
        aria-hidden
        onInvalid={(event) => {
          event.preventDefault();
          openCalendar();
          triggerRef.current?.focus();
        }}
      />
      {calendar}
    </div>
  );
}
