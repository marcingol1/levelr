import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { parseLen, toUnit } from '../lib/units';
import type { Unit } from '../state/project';

interface LengthFieldProps {
  label?: string;
  value: number; // mm
  unit: Unit;
  min?: number; // mm
  max?: number; // mm
  onCommit: (mm: number) => void;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
}

/** Text-based length input: accepts "72", "7,2 cm", "0.5 m"; commits on Enter/blur. */
export function LengthField({ label, value, unit, min = 0, max = 1e6, onCommit, ariaLabel, className, compact }: LengthFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState(toUnit(value, unit));
  const [invalid, setInvalid] = useState(false);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(toUnit(value, unit));
  }, [value, unit]);

  const commit = (text = draft) => {
    const mm = parseLen(text, unit);
    if (mm === null || mm < min || mm > max) {
      setInvalid(true);
      setDraft(toUnit(value, unit));
      window.setTimeout(() => setInvalid(false), 900);
      return;
    }
    setInvalid(false);
    if (mm !== value) onCommit(mm);
    setDraft(toUnit(mm, unit));
  };

  const step = (dir: 1 | -1, big: boolean) => {
    const base = unit === 'cm' ? 10 : 1;
    const next = Math.min(max, Math.max(min, Math.round((value + dir * base * (big ? 10 : 1)) * 10) / 10));
    onCommit(next);
    setDraft(toUnit(next, unit));
  };

  return (
    <div className={`field ${compact ? 'field--compact' : ''} ${className ?? ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className={`input-wrap ${invalid ? 'is-invalid' : ''}`}>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          value={draft}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit();
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(toUnit(value, unit));
              e.currentTarget.blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
            }
          }}
        />
        <span className="suffix" aria-hidden>
          {unit}
        </span>
      </div>
    </div>
  );
}

interface SegmentedProps<V extends string> {
  value: V;
  options: { value: V; label: ReactNode; title?: string }[];
  onChange: (v: V) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}

export function Segmented<V extends string>({ value, options, onChange, ariaLabel, size = 'md' }: SegmentedProps<V>) {
  return (
    <div className={`segmented segmented--${size}`} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          className={o.value === value ? 'is-active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  sub?: ReactNode;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, sub, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={`switch-row ${disabled ? 'is-disabled' : ''}`}>
      <div className="switch-text">
        <label htmlFor={id}>{label}</label>
        {sub && <span className="sub">{sub}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

export function Section({ index, title, children, aside }: { index: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <span className="section-index">{index}</span>
        <h2>{title}</h2>
        {aside && <div className="section-aside">{aside}</div>}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}
