import { memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { Paintbrush, Scissors, TrendingDown } from 'lucide-react';
import type { Layout, Node, Tile } from '../lib/layout';
import type { Summary } from '../lib/summary';
import { slopeColor, slopeRange } from '../lib/colors';
import { fmtLen, fmtSpan, toUnit } from '../lib/units';
import { useT } from '../i18n';
import type { Action, Level, Project, Unit } from '../state/project';
import { LengthField, Segmented } from './ui';

export type Tool = 'paint' | 'shape' | 'gradient';

interface Props {
  project: Project;
  layout: Layout;
  summary: Summary;
  tool: Tool;
  setTool: (t: Tool) => void;
  brush: Level;
  gradient: { from: number; to: number };
  setGradient: (g: { from: number; to: number }) => void;
  unit: Unit;
  dispatch: (a: Action) => void;
}

interface Pt {
  x: number;
  y: number;
}

const PAD = 56; // px reserved around the terrace for dimension lines
const HIT = 14; // px pick radius for legs

export function Plan({ project, layout, summary, tool, setTool, brush, gradient, setGradient, unit, dispatch }: Props) {
  const { t } = useT();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [drag, setDrag] = useState<{ a: Pt; b: Pt } | null>(null);
  const [hover, setHover] = useState<{ node?: Node; tile?: Tile; px: Pt } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize({ w: Math.max(240, width), h: Math.max(240, height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = project.width;
  const D = project.depth;
  const scale = Math.max(1e-4, Math.min((size.w - PAD * 2) / W, (size.h - PAD * 2) / D));
  const m = PAD / scale;
  const px = useCallback((n: number) => n / scale, [scale]);

  const pitchPx = Math.min(
    ...[layout.x.lines, layout.y.lines].map((ls) => {
      let min = Infinity;
      for (let i = 1; i < ls.length; i++) min = Math.min(min, ls[i] - ls[i - 1]);
      return min === Infinity ? 600 : min;
    }),
  ) * scale;
  const dotR = Math.max(2.5, Math.min(6.5, pitchPx * 0.16));
  const showLabels = pitchPx >= 46;

  const slope = useMemo(() => slopeRange(Object.values(project.heights).filter((v): v is number => typeof v === 'number')), [project.heights]);

  const colorOf = useCallback(
    (key: string) => {
      const info = summary.legInfo.get(key);
      if (!info) return 'var(--ink-3)';
      return info.level ? info.level.color : slopeColor(info.height, slope[0], slope[1]);
    },
    [summary.legInfo, slope],
  );

  // ------------------------------------------------------------ hit testing
  const toPlan = (e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const nearestNode = (p: Pt): Node | undefined => {
    const r = px(HIT);
    let best: Node | undefined;
    let bd = r * r;
    for (const n of layout.nodes) {
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d <= bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  };

  const tileAt = (p: Pt): Tile | undefined =>
    layout.tiles.find((tl) => p.x >= tl.x && p.x <= tl.x + tl.w && p.y >= tl.y && p.y <= tl.y + tl.h);

  const rectOf = (a: Pt, b: Pt) => ({
    x0: Math.min(a.x, b.x),
    x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y),
    y1: Math.max(a.y, b.y),
  });

  // ------------------------------------------------------------ pointer
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPlan(e);
    setDrag({ a: p, b: p });
  };

  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    if (drag) {
      setDrag({ a: drag.a, b: p });
      return;
    }
    const box = wrapRef.current!.getBoundingClientRect();
    const node = nearestNode(p);
    const tile = node ? undefined : tileAt(p);
    setHover(node || tile ? { node, tile, px: { x: e.clientX - box.left, y: e.clientY - box.top } } : null);
  };

  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const a = drag.a;
    const b = toPlan(e);
    setDrag(null);
    const moved = Math.hypot(b.x - a.x, b.y - a.y) > px(5);

    if (!moved) {
      if (tool === 'paint') {
        const n = nearestNode(a);
        const tl = n ? undefined : tileAt(a);
        const keys = n ? [n.key] : tl?.enabled ? tl.nodes : [];
        if (keys.length) dispatch({ type: 'paint', keys, value: brush.id });
      } else if (tool === 'shape') {
        const tl = tileAt(a);
        if (tl) dispatch({ type: 'setTiles', keys: [tl.key], enabled: !tl.enabled });
      }
      return;
    }

    const r = rectOf(a, b);
    const slack = px(dotR);
    const inRect = layout.nodes.filter((n) => n.x >= r.x0 - slack && n.x <= r.x1 + slack && n.y >= r.y0 - slack && n.y <= r.y1 + slack);

    if (tool === 'paint') {
      if (inRect.length) dispatch({ type: 'paint', keys: inRect.map((n) => n.key), value: brush.id });
    } else if (tool === 'shape') {
      const tiles = layout.tiles.filter((tl) => tl.x < r.x1 && tl.x + tl.w > r.x0 && tl.y < r.y1 && tl.y + tl.h > r.y0);
      if (!tiles.length) return;
      const enable = tiles.every((tl) => !tl.enabled);
      dispatch({ type: 'setTiles', keys: tiles.map((tl) => tl.key), enabled: enable });
    } else if (tool === 'gradient') {
      const alongX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
      const s = alongX ? a.x : a.y;
      const span = (alongX ? b.x : b.y) - s;
      const values: Record<string, number> = {};
      for (const n of inRect) {
        const tt = Math.min(1, Math.max(0, ((alongX ? n.x : n.y) - s) / span));
        values[n.key] = Math.round(gradient.from + tt * (gradient.to - gradient.from));
      }
      if (inRect.length) dispatch({ type: 'paintMany', values });
    }
  };

  // ------------------------------------------------------------ overlays
  const marquee = drag && Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) > px(5) ? rectOf(drag.a, drag.b) : null;
  const gradAlongX = drag ? Math.abs(drag.b.x - drag.a.x) >= Math.abs(drag.b.y - drag.a.y) : true;

  const hoverInfo = hover?.node ? summary.legInfo.get(hover.node.key) : undefined;
  const lastX = layout.x.spans[layout.x.spans.length - 1];
  const lastY = layout.y.spans[layout.y.spans.length - 1];

  const toolHint =
    tool === 'paint' ? (
      <>
        {t('toolPaintHint')}{' '}
        <span className="chip" style={{ ['--c' as string]: brush.color }}>
          <i className="dot" /> {brush.name} · {fmtLen(brush.height, unit)}
        </span>
      </>
    ) : tool === 'shape' ? (
      t('toolShapeHint')
    ) : (
      <>
        {t('toolGradientHint')}
        <LengthField compact unit={unit} value={gradient.from} min={1} max={2000} ariaLabel="from" onCommit={(v) => setGradient({ ...gradient, from: v })} />
        {t('to')}
        <LengthField compact unit={unit} value={gradient.to} min={1} max={2000} ariaLabel="to" onCommit={(v) => setGradient({ ...gradient, to: v })} />
      </>
    );

  return (
    <section className="stage" aria-label="Plan">
      <div className="stage-bar">
        <Segmented<Tool>
          ariaLabel="Tool"
          value={tool}
          onChange={setTool}
          options={[
            { value: 'paint', label: <><Paintbrush size={15} /> {t('toolPaint')}</>, title: `${t('toolPaint')} (P)` },
            { value: 'shape', label: <><Scissors size={15} /> {t('toolShape')}</>, title: `${t('toolShape')} (S)` },
            { value: 'gradient', label: <><TrendingDown size={15} /> {t('toolGradient')}</>, title: `${t('toolGradient')} (G)` },
          ]}
        />
        <div className="stage-hint">{toolHint}</div>
      </div>

      <div
        className={`plan-wrap tool-${tool}`}
        ref={wrapRef}
        // On narrow screens the plan box follows the terrace's proportions (plus room for dimensions).
        style={{ ['--aspect' as string]: `${(W + 0.3 * Math.max(W, D)) / (D + 0.3 * Math.max(W, D))}` }}
        onPointerLeave={() => setHover(null)}
      >
        {layout.tiles.length === 0 ? (
          <p className="plan-empty">{t('emptyPlan')}</p>
        ) : (
          <svg
            ref={svgRef}
            className="plan"
            viewBox={`${-m} ${-m} ${W + 2 * m} ${D + 2 * m}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            role="img"
            aria-label={`${fmtSpan(W)} × ${fmtSpan(D)}, ${summary.legs} ${t('legs')}`}
          >
            <defs>
              <pattern id="hatch" width={px(7)} height={px(7)} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2={px(7)} stroke="var(--cut-hatch)" strokeWidth={px(1)} />
              </pattern>
              <clipPath id="enabled-tiles">
                {layout.tiles.filter((tl) => tl.enabled).map((tl) => (
                  <rect key={tl.key} x={tl.x} y={tl.y} width={tl.w} height={tl.h} />
                ))}
              </clipPath>
            </defs>

            <Dimensions W={W} D={D} px={px} unit={unit} lastX={lastX} lastY={lastY} cols={layout.x.spans.length} rows={layout.y.spans.length} />
            <TilesLayer tiles={layout.tiles} px={px} />
            <ZonesLayer layout={layout} colorOf={colorOf} W={W} D={D} />
            <CutsLayer tiles={layout.tiles} />
            <NodesLayer nodes={layout.nodes} colorOf={colorOf} summary={summary} r={px(dotR)} px={px} showLabels={showLabels} unit={unit} />

            {hover?.tile && (
              <rect className="hover-tile" x={hover.tile.x} y={hover.tile.y} width={hover.tile.w} height={hover.tile.h} strokeWidth={px(2)} />
            )}
            {hover?.node && <circle className="hover-node" cx={hover.node.x} cy={hover.node.y} r={px(dotR + 4)} strokeWidth={px(2)} />}

            {marquee && (
              <g className={`marquee marquee--${tool}`}>
                <rect x={marquee.x0} y={marquee.y0} width={marquee.x1 - marquee.x0} height={marquee.y1 - marquee.y0} strokeWidth={px(1.5)} strokeDasharray={`${px(5)} ${px(4)}`} />
                {tool === 'gradient' && drag && (
                  <line
                    x1={gradAlongX ? drag.a.x : (marquee.x0 + marquee.x1) / 2}
                    y1={gradAlongX ? (marquee.y0 + marquee.y1) / 2 : drag.a.y}
                    x2={gradAlongX ? drag.b.x : (marquee.x0 + marquee.x1) / 2}
                    y2={gradAlongX ? (marquee.y0 + marquee.y1) / 2 : drag.b.y}
                    strokeWidth={px(2)}
                    markerEnd="url(#arrow)"
                  />
                )}
              </g>
            )}
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
              </marker>
            </defs>
          </svg>
        )}

        {hover && !drag && (hover.node || hover.tile) && (
          <div className="plan-tip" style={{ left: hover.px.x, top: hover.px.y }}>
            {hover.node && hoverInfo ? (
              <>
                <div className="tip-head">
                  <i className="dot" style={{ background: colorOf(hover.node.key) }} />
                  <strong>{fmtLen(hoverInfo.height, unit)}</strong>
                  <span>{hoverInfo.level?.name ?? t('gradientLegs')}</span>
                </div>
                <div className="tip-line">
                  {hoverInfo.result.ok
                    ? `PRO ${hoverInfo.result.spec.pedestal.min}–${hoverInfo.result.spec.pedestal.max}${hoverInfo.result.spec.expanders.length ? ` + ${hoverInfo.result.spec.expanders.join(' + ')}` : ''}`
                    : t('outOfRange')}
                </div>
                <div className="tip-line muted">{t('hoverTiles', { n: hover.node.tiles.length })}</div>
              </>
            ) : hover.tile ? (
              <div className="tip-line">
                {toUnit(hover.tile.w, unit)} × {toUnit(hover.tile.h, unit)} {unit}
              </div>
            ) : null}
          </div>
        )}
      </div>

      <footer className="stage-foot">
        <span>
          <strong>{summary.legs}</strong> {t('legs')}
        </span>
        <span>
          <strong>{summary.tiles.full + summary.tiles.cut}</strong> {t('tiles')}
        </span>
        <span>
          <strong>{summary.tiles.area.toFixed(2)}</strong> m²
        </span>
        <span className="keys" aria-hidden>
          P · S · G · 1–9 · ⌘Z
        </span>
      </footer>
    </section>
  );
}

// ------------------------------------------------------------ layers

const TilesLayer = memo(function TilesLayer({ tiles, px }: { tiles: Tile[]; px: (n: number) => number }) {
  return (
    <g className="tiles">
      {tiles.map((tl) =>
        tl.enabled ? (
          <rect key={tl.key} className="tile" x={tl.x} y={tl.y} width={tl.w} height={tl.h} />
        ) : (
          <rect
            key={tl.key}
            className="tile tile--off"
            x={tl.x + px(2)}
            y={tl.y + px(2)}
            width={Math.max(0, tl.w - px(4))}
            height={Math.max(0, tl.h - px(4))}
            strokeWidth={px(1)}
            strokeDasharray={`${px(3)} ${px(3)}`}
          />
        ),
      )}
    </g>
  );
});

const CutsLayer = memo(function CutsLayer({ tiles }: { tiles: Tile[] }) {
  return (
    <g className="cuts" pointerEvents="none">
      {tiles
        .filter((tl) => tl.enabled && tl.cut)
        .map((tl) => (
          <rect key={tl.key} x={tl.x} y={tl.y} width={tl.w} height={tl.h} fill="url(#hatch)" />
        ))}
    </g>
  );
});

/** Soft colour field around each leg, so painted areas read at a glance. */
const ZonesLayer = memo(function ZonesLayer({ layout, colorOf, W, D }: { layout: Layout; colorOf: (k: string) => string; W: number; D: number }) {
  const cell = (lines: number[], i: number, max: number) => [
    i > 0 ? (lines[i - 1] + lines[i]) / 2 : 0,
    i < lines.length - 1 ? (lines[i] + lines[i + 1]) / 2 : max,
  ];
  const xi = new Map(layout.x.lines.map((v, i) => [v, i]));
  const yi = new Map(layout.y.lines.map((v, i) => [v, i]));
  return (
    <g className="zones" clipPath="url(#enabled-tiles)" pointerEvents="none">
      {layout.nodes.map((n) => {
        const [x0, x1] = cell(layout.x.lines, xi.get(n.x) ?? 0, W);
        const [y0, y1] = cell(layout.y.lines, yi.get(n.y) ?? 0, D);
        return <rect key={n.key} x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill={colorOf(n.key)} />;
      })}
    </g>
  );
});

const NodesLayer = memo(function NodesLayer({
  nodes,
  colorOf,
  summary,
  r,
  px,
  showLabels,
  unit,
}: {
  nodes: Node[];
  colorOf: (k: string) => string;
  summary: Summary;
  r: number;
  px: (n: number) => number;
  showLabels: boolean;
  unit: Unit;
}) {
  return (
    <g className="nodes" pointerEvents="none">
      {nodes.map((n) => {
        const info = summary.legInfo.get(n.key);
        const bad = info && !info.result.ok;
        return (
          <g key={n.key}>
            <circle className={`node ${bad ? 'node--bad' : ''}`} cx={n.x} cy={n.y} r={bad ? r * 1.25 : r} fill={colorOf(n.key)} strokeWidth={px(bad ? 2 : 1.5)} />
            {showLabels && info && (
              <text className="node-label" x={n.x + r + px(3)} y={n.y - r - px(2)} fontSize={px(10.5)}>
                {toUnit(info.height, unit)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

function Dimensions({
  W,
  D,
  px,
  unit,
  lastX,
  lastY,
  cols,
  rows,
}: {
  W: number;
  D: number;
  px: (n: number) => number;
  unit: Unit;
  lastX?: { start: number; end: number; cut: boolean };
  lastY?: { start: number; end: number; cut: boolean };
  cols: number;
  rows: number;
}) {
  const off = px(28);
  const tick = px(5);
  const fs = px(11);
  return (
    <g className="dims" pointerEvents="none">
      <rect className="outline" x={0} y={0} width={W} height={D} strokeWidth={px(1)} />
      {/* width */}
      <line x1={0} y1={-off} x2={W} y2={-off} strokeWidth={px(1)} />
      <line x1={0} y1={-off - tick} x2={0} y2={-off + tick} strokeWidth={px(1)} />
      <line x1={W} y1={-off - tick} x2={W} y2={-off + tick} strokeWidth={px(1)} />
      <text x={W / 2} y={-off - px(7)} fontSize={fs} textAnchor="middle">
        {fmtSpan(W)}
      </text>
      {/* depth */}
      <line x1={-off} y1={0} x2={-off} y2={D} strokeWidth={px(1)} />
      <line x1={-off - tick} y1={0} x2={-off + tick} y2={0} strokeWidth={px(1)} />
      <line x1={-off - tick} y1={D} x2={-off + tick} y2={D} strokeWidth={px(1)} />
      <text x={-off - px(7)} y={D / 2} fontSize={fs} textAnchor="middle" transform={`rotate(-90 ${-off - px(7)} ${D / 2})`}>
        {fmtSpan(D)}
      </text>
      {/* cut sizes */}
      {lastX?.cut && cols > 1 && (
        <text className="dim-cut" x={(lastX.start + lastX.end) / 2} y={D + px(18)} fontSize={px(10)} textAnchor="middle">
          ✂ {toUnit(lastX.end - lastX.start, unit)}
        </text>
      )}
      {lastY?.cut && rows > 1 && (
        <text className="dim-cut" x={W + px(10)} y={(lastY.start + lastY.end) / 2 + px(3)} fontSize={px(10)}>
          ✂ {toUnit(lastY.end - lastY.start, unit)}
        </text>
      )}
    </g>
  );
}
