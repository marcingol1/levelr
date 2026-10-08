import { RotateCw } from 'lucide-react';
import type { Layout, SupportPattern } from '../lib/layout';
import { toUnit } from '../lib/units';
import { useT } from '../i18n';
import type { Action, Project, Unit } from '../state/project';
import { LengthField, Section, Segmented, Switch } from './ui';

const TILE_PRESETS: [number, number][] = [
  [600, 600],
  [600, 1200],
  [450, 900],
  [400, 800],
  [800, 800],
  [900, 900],
  [1000, 1000],
  [500, 500],
];

interface Props {
  project: Project;
  layout: Layout;
  unit: Unit;
  dispatch: (a: Action) => void;
}

export function SetupPanel({ project: p, layout, unit, dispatch }: Props) {
  const { t } = useT();
  const set = (patch: Partial<Project>) => dispatch({ type: 'set', patch });

  const lastX = layout.x.spans[layout.x.spans.length - 1];
  const lastY = layout.y.spans[layout.y.spans.length - 1];
  const cuts = [
    lastX?.cut && t('cutCol', { x: `${toUnit(lastX.end - lastX.start, unit)} ${unit}` }),
    lastY?.cut && t('cutRow', { y: `${toUnit(lastY.end - lastY.start, unit)} ${unit}` }),
  ].filter(Boolean);

  const roles = layout.roles;
  const rolesText = roles.center && (roles.midX || roles.midY)
    ? t('rolesFull')
    : roles.center
      ? t('rolesCenter')
      : roles.midX || roles.midY
        ? t('rolesEdges')
        : t('rolesCorners');
  const perTile = 4 + (roles.midX ? 2 : 0) + (roles.midY ? 2 : 0) + (roles.center ? 1 : 0);
  const area = layout.tiles.filter((x) => x.enabled).reduce((s, x) => s + x.w * x.h, 0) / 1e6;
  const density = area > 0 ? layout.nodes.length / area : 0;

  const presetActive = (w: number, l: number) => (p.tileW === w && p.tileL === l) || (p.tileW === l && p.tileL === w);
  const cm = (v: number) => v / 10;

  return (
    <aside className="panel panel--setup" aria-label="Setup">
      <Section index="01" title={t('s1')}>
        <div className="grid-2">
          <LengthField label={t('width')} unit={unit} value={p.width} min={300} max={50_000} onCommit={(v) => set({ width: v })} />
          <LengthField label={t('depth')} unit={unit} value={p.depth} min={300} max={50_000} onCommit={(v) => set({ depth: v })} />
        </div>
        <p className="hint">{t('s1Hint')}</p>
      </Section>

      <Section index="02" title={t('s2')}>
        <div className="presets" role="group" aria-label={t('tileSize')}>
          {TILE_PRESETS.map(([w, l]) => (
            <button
              key={`${w}x${l}`}
              type="button"
              className={`preset ${presetActive(w, l) ? 'is-active' : ''}`}
              onClick={() => set(presetActive(w, l) ? {} : { tileW: w, tileL: l })}
            >
              {cm(w)}×{cm(l)}
            </button>
          ))}
        </div>
        <div className="tile-size">
          <LengthField label={`${t('tileSize')} · X`} unit={unit} value={p.tileW} min={100} max={3000} onCommit={(v) => set({ tileW: v })} />
          <button type="button" className="icon-btn rotate" title={t('rotate')} aria-label={t('rotate')} onClick={() => dispatch({ type: 'rotateTile' })}>
            <RotateCw size={15} />
          </button>
          <LengthField label="Y" unit={unit} value={p.tileL} min={100} max={3000} onCommit={(v) => set({ tileL: v })} />
        </div>
        <div className="grid-2">
          <LengthField label={t('joint')} unit="mm" value={p.joint} min={0} max={20} onCommit={(v) => set({ joint: v })} />
          <div className="stat">
            <span className="stat-value">{t('gridInfo', { cols: layout.x.spans.length, rows: layout.y.spans.length })}</span>
            <span className="stat-sub">{cuts.length ? cuts.join(' · ') : t('noCuts')}</span>
          </div>
        </div>
        <p className="hint">{t('jointHint')}</p>
      </Section>

      <Section index="03" title={t('s3')}>
        <Segmented<SupportPattern>
          ariaLabel={t('s3')}
          size="sm"
          value={p.pattern}
          onChange={(v) => set({ pattern: v })}
          options={[
            { value: 'auto', label: t('pAuto') },
            { value: 'corners', label: t('pCorners') },
            { value: 'center', label: t('pCenter') },
            { value: 'edges', label: t('pEdges') },
            { value: 'full', label: t('pFull') },
          ]}
        />
        <div className="pattern-preview">
          <PatternGlyph w={p.tileW} l={p.tileL} roles={roles} />
          <div>
            <p className="pattern-title">
              {perTile} / tile <span className="muted">· {t('legsPerM2', { n: density.toFixed(1) })}</span>
            </p>
            <p className="hint">{rolesText}</p>
          </div>
        </div>
      </Section>

      <Section index="04" title={t('s4')}>
        <Switch checked={p.acousticPad} onChange={(v) => set({ acousticPad: v })} label={t('acousticPad')} sub={t('acousticPadSub')} />
        <div className="nested">
          <Switch checked={p.deductPad} disabled={!p.acousticPad} onChange={(v) => set({ deductPad: v })} label={t('deductPad')} />
        </div>
        <Switch checked={p.slopeCorrector} onChange={(v) => set({ slopeCorrector: v })} label={t('slopeCorrector')} sub={t('slopeCorrectorSub')} />
        <div className="spare-row">
          <div className="switch-text">
            <label htmlFor="spare">{t('spare')}</label>
            <span className="sub">{t('spareHint')}</span>
          </div>
          <div className="input-wrap input-wrap--narrow">
            <input
              id="spare"
              type="number"
              min={0}
              max={50}
              step={1}
              value={p.spare}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0 && v <= 50) set({ spare: v });
              }}
            />
            <span className="suffix">%</span>
          </div>
        </div>
      </Section>
    </aside>
  );
}

/** Tiny tile diagram showing where the legs go for the chosen pattern. */
function PatternGlyph({ w, l, roles }: { w: number; l: number; roles: Layout['roles'] }) {
  const k = 44 / Math.max(w, l);
  const W = w * k;
  const H = l * k;
  const pts: [number, number][] = [
    [0, 0],
    [W, 0],
    [0, H],
    [W, H],
  ];
  if (roles.midX) pts.push([W / 2, 0], [W / 2, H]);
  if (roles.midY) pts.push([0, H / 2], [W, H / 2]);
  if (roles.center) pts.push([W / 2, H / 2]);
  return (
    <svg className="glyph" width="60" height="60" viewBox={`${-8 + (W - 44) / 2} ${-8 + (H - 44) / 2} 60 60`} aria-hidden>
      <rect x={0} y={0} width={W} height={H} rx={1.5} />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} />
      ))}
    </svg>
  );
}
