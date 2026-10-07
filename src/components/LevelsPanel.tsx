import { useMemo, useState } from 'react';
import { Plus, Star, Trash2, PaintBucket } from 'lucide-react';
import { MAX_HEIGHT, MIN_HEIGHT, PEDESTALS, pickPedestal } from '../lib/catalog';
import { padDeduction, type Summary } from '../lib/summary';
import { slopeColor, slopeRange } from '../lib/colors';
import { fmtLen, parseLenList } from '../lib/units';
import { useT } from '../i18n';
import { uid, type Action, type Level, type Project, type Unit } from '../state/project';
import { LengthField } from './ui';

interface Props {
  project: Project;
  summary: Summary;
  brushId: string;
  setBrush: (id: string) => void;
  unit: Unit;
  dispatch: (a: Action) => void;
}

export function LevelsPanel({ project: p, summary, brushId, setBrush, unit, dispatch }: Props) {
  const { t } = useT();
  const [bulk, setBulk] = useState('');
  const deduct = padDeduction(p);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    let slopeLegs = 0;
    for (const info of summary.legInfo.values()) {
      if (info.level) c.set(info.level.id, (c.get(info.level.id) ?? 0) + 1);
      else slopeLegs++;
    }
    return { c, slopeLegs };
  }, [summary.legInfo]);

  const slope = useMemo(() => slopeRange(Object.values(p.heights).filter((v): v is number => typeof v === 'number')), [p.heights]);

  const addBulk = () => {
    const values = parseLenList(bulk, unit);
    if (!values.length) return;
    const n0 = p.levels.length;
    const levels = values.map((height, i) => ({ id: uid(), height, name: t('levelName', { n: n0 + i + 1 }) }));
    dispatch({ type: 'addLevels', levels });
    // A new level is what you want to paint with next.
    setBrush(levels[0].id);
    setBulk('');
  };

  const addOne = () => {
    const last = p.levels[p.levels.length - 1];
    const id = uid();
    dispatch({ type: 'addLevels', levels: [{ id, height: Math.min(MAX_HEIGHT, (last?.height ?? 70) + 20), name: t('levelName', { n: p.levels.length + 1 }) }] });
    setBrush(id);
  };

  return (
    <section className="section section--levels">
      <header className="section-head">
        <span className="section-index">A</span>
        <h2>{t('levels')}</h2>
        <span className="section-aside count">{p.levels.length}</span>
      </header>
      <p className="hint">{t('levelsHint')}</p>

      <ul className="levels" role="radiogroup" aria-label={t('levels')}>
        {p.levels.map((l, i) => (
          <LevelRow
            key={l.id}
            level={l}
            index={i}
            active={l.id === brushId}
            isBase={l.id === p.baseLevelId}
            count={counts.c.get(l.id) ?? 0}
            deduct={deduct}
            unit={unit}
            canRemove={p.levels.length > 1}
            onSelect={() => setBrush(l.id)}
            dispatch={dispatch}
          />
        ))}
        {counts.slopeLegs > 0 && (
          <li className="level level--slope">
            <span
              className="swatch swatch--ramp"
              style={{ background: `linear-gradient(90deg, ${slopeColor(slope[0], slope[0], slope[1])}, ${slopeColor(slope[1], slope[0], slope[1])})` }}
            />
            <span className="level-name static">{t('gradientLegs')}</span>
            <span className="level-sub">
              {fmtLen(slope[0], unit)} – {fmtLen(slope[1], unit)}
              <span className="sep">·</span>
              {counts.slopeLegs} {t(counts.slopeLegs === 1 ? 'leg' : 'legs')}
            </span>
          </li>
        )}
      </ul>

      <div className="level-actions">
        <button type="button" className="btn btn--ghost" onClick={addOne}>
          <Plus size={15} /> {t('addLevel')}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          title={t('fillAll')}
          onClick={() => dispatch({ type: 'fillAll', value: brushId })}
        >
          <PaintBucket size={15} /> {t('fillAll')}
        </button>
      </div>

      <form
        className="bulk"
        onSubmit={(e) => {
          e.preventDefault();
          addBulk();
        }}
      >
        <input value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={t('bulkPlaceholder')} aria-label={t('bulkPlaceholder')} />
        <button type="submit" className="btn btn--quiet" disabled={!parseLenList(bulk, unit).length}>
          {t('add')}
        </button>
      </form>

      <RangeStrip levels={p.levels} deduct={deduct} />
    </section>
  );
}

function LevelRow({
  level,
  index,
  active,
  isBase,
  count,
  deduct,
  unit,
  canRemove,
  onSelect,
  dispatch,
}: {
  level: Level;
  index: number;
  active: boolean;
  isBase: boolean;
  count: number;
  deduct: number;
  unit: Unit;
  canRemove: boolean;
  onSelect: () => void;
  dispatch: (a: Action) => void;
}) {
  const { t } = useT();
  const r = pickPedestal(level.height - deduct);
  const model = r.ok
    ? `${r.spec.pedestal.min}–${r.spec.pedestal.max}${r.spec.expanders.length ? ` +${r.spec.expanders.join('+')}` : ''}`
    : r.reason === 'too-low'
      ? `< ${MIN_HEIGHT}`
      : `> ${MAX_HEIGHT}`;

  return (
    <li className={`level ${active ? 'is-active' : ''}`} style={{ ['--c' as string]: level.color }} onClick={onSelect}>
      <button type="button" role="radio" aria-checked={active} className="swatch" onClick={onSelect} title={index < 9 ? `${index + 1}` : undefined}>
        <span className="sr-only">{level.name}</span>
        {index < 9 && <kbd aria-hidden>{index + 1}</kbd>}
      </button>
      <input
        className="level-name"
        value={level.name}
        maxLength={40}
        onFocus={onSelect}
        aria-label="Name"
        onChange={(e) => dispatch({ type: 'updateLevel', id: level.id, patch: { name: e.target.value } })}
      />
      <LengthField
        compact
        className="level-height"
        unit={unit}
        value={level.height}
        min={1}
        max={2000}
        ariaLabel={`${level.name} height`}
        onCommit={(v) => dispatch({ type: 'updateLevel', id: level.id, patch: { height: v } })}
      />
      <span className="level-tools">
        {isBase ? (
          <span className="base-tag" title={t('base')}>
            {t('base')}
          </span>
        ) : (
          <button type="button" className="icon-btn icon-btn--sm" title={t('makeBase')} aria-label={t('makeBase')} onClick={() => dispatch({ type: 'setBaseLevel', id: level.id })}>
            <Star size={13} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          title={t('remove')}
          aria-label={t('remove')}
          disabled={!canRemove}
          onClick={() => dispatch({ type: 'removeLevel', id: level.id })}
        >
          <Trash2 size={13} />
        </button>
      </span>
      <span className="level-sub">
        <span className={`level-model ${r.ok ? '' : 'is-bad'}`} title={r.ok ? r.spec.pedestal.name : t('outOfRange')}>
          {model}
        </span>
        <span className="sep">·</span>
        <span>
          {count} {t(count === 1 ? 'leg' : 'legs')}
        </span>
      </span>
    </li>
  );
}

/** The RENOPAD PRO adjustment ranges on one scale, with each level marked. */
function RangeStrip({ levels, deduct }: { levels: Level[]; deduct: number }) {
  // Square-root scale keeps the short low ranges (13–18, 18–23…) readable.
  const max = MAX_HEIGHT;
  const pos = (mm: number) => `${(Math.sqrt(Math.min(max, Math.max(0, mm)) / max) * 100).toFixed(2)}%`;
  const ext = PEDESTALS[PEDESTALS.length - 1].max;
  return (
    <figure className="range-strip" aria-label="RENOPAD PRO ranges">
      <div className="range-track">
        {PEDESTALS.map((m, i) => (
          <span
            key={m.id}
            className={`range-seg ${i % 2 ? 'odd' : ''}`}
            style={{ left: pos(m.min), width: `calc(${pos(m.max)} - ${pos(m.min)})` }}
            title={m.name}
          />
        ))}
        <span className="range-seg range-seg--ext" style={{ left: pos(ext), width: `calc(${pos(max)} - ${pos(ext)})` }} title="+ Ekspander 50 / 100 mm" />
        {levels.map((l) => (
          <span key={l.id} className="range-mark" style={{ left: pos(l.height - deduct), ['--c' as string]: l.color }} title={`${l.name}: ${l.height} mm`} />
        ))}
      </div>
      <div className="range-ticks" aria-hidden>
        {[13, 29, 65, 119, 173, 300, 500].map((v) => (
          <span key={v} style={{ left: pos(v) }}>
            {v}
          </span>
        ))}
      </div>
      <figcaption>RENOPAD PRO · mm</figcaption>
    </figure>
  );
}
