import { AlertTriangle, ClipboardCopy, Download } from 'lucide-react';
import { slopeColor, slopeRange } from '../lib/colors';
import { withSpare, type Summary } from '../lib/summary';
import { fmtLen } from '../lib/units';
import { useT, type T } from '../i18n';
import type { Project, Unit } from '../state/project';

interface Props {
  project: Project;
  summary: Summary;
  unit: Unit;
  notify: (msg: string) => void;
}

export function OrderPanel({ project: p, summary: s, unit, notify }: Props) {
  const { t } = useT();
  const slope = slopeRange(s.byHeight.filter((r) => !r.level).map((r) => r.height));
  const tilesTotal = s.tiles.full + s.tiles.cut;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(orderText(p, s, t));
      notify(t('copied'));
    } catch {
      notify(t('linkFailed'));
    }
  };

  const download = () => {
    const blob = new Blob([orderCsv(p, s)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.name || 'terrace').replace(/[^\w\-]+/g, '_')}-renopad.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <section className="section section--order">
      <header className="section-head">
        <span className="section-index">B</span>
        <h2>{t('order')}</h2>
        <div className="section-aside">
          <button type="button" className="icon-btn" title={t('copyList')} aria-label={t('copyList')} onClick={copy}>
            <ClipboardCopy size={15} />
          </button>
          <button type="button" className="icon-btn" title={t('downloadCsv')} aria-label={t('downloadCsv')} onClick={download}>
            <Download size={15} />
          </button>
        </div>
      </header>

      <dl className="kpis">
        <div>
          <dt>{t('totalLegs')}</dt>
          <dd>{s.legs}</dd>
        </div>
        <div>
          <dt>{t('area')}</dt>
          <dd>
            {s.tiles.area.toFixed(2)}
            <small> m²</small>
          </dd>
        </div>
        <div>
          <dt>{t('tilesCount')}</dt>
          <dd>{tilesTotal}</dd>
          <span className="kpi-sub">{t('fullCut', { full: s.tiles.full, cut: s.tiles.cut })}</span>
        </div>
      </dl>

      {(s.issues.tooLow > 0 || s.issues.tooHigh > 0 || s.issues.atLimit > 0 || s.issues.narrowCuts.length > 0) && (
        <ul className="issues" role="status">
          {s.issues.tooLow > 0 && <Issue severe>{t('issuesLow', { n: s.issues.tooLow })}</Issue>}
          {s.issues.tooHigh > 0 && <Issue severe>{t('issuesHigh', { n: s.issues.tooHigh })}</Issue>}
          {s.issues.atLimit > 0 && <Issue>{t('issuesLimit', { n: s.issues.atLimit })}</Issue>}
          {s.issues.narrowCuts.map((c, i) => (
            <Issue key={i}>{t('issuesCut', { x: fmtLen(c, unit) })}</Issue>
          ))}
        </ul>
      )}

      <table className="bom">
        <caption className="sr-only">{t('order')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('pedestals')}</th>
            <th scope="col" className="num">{t('needed')}</th>
            <th scope="col" className="num">{t('toOrder')}</th>
          </tr>
        </thead>
        <tbody>
          {s.byModel.map((r) => (
            <tr key={r.pedestal.id}>
              <th scope="row">
                <span className="bom-name">RENOPAD PRO</span> <span className="bom-range">{r.pedestal.min}–{r.pedestal.max} mm</span>
              </th>
              <td className="num muted">{r.count}</td>
              <td className="num strong">{r.order}</td>
            </tr>
          ))}
          {s.expanders.length > 0 && (
            <tr className="bom-group">
              <th colSpan={3}>{t('expanders')}</th>
            </tr>
          )}
          {s.expanders.map((r) => (
            <tr key={r.id}>
              <th scope="row">{r.name}</th>
              <td className="num muted">{r.count}</td>
              <td className="num strong">{r.order}</td>
            </tr>
          ))}
          {s.accessories.length > 0 && (
            <tr className="bom-group">
              <th colSpan={3}>{t('accessories')}</th>
            </tr>
          )}
          {s.accessories.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                {r.name}
                {r.packs !== undefined && <span className="bom-sub">{t('packs', { n: r.packs, size: r.pack ?? 10 })}</span>}
              </th>
              <td className="num muted">{r.count}</td>
              <td className="num strong">{r.order}</td>
            </tr>
          ))}
          <tr className="bom-group">
            <th colSpan={3}>{t('tilesCount')}</th>
          </tr>
          <tr>
            <th scope="row">
              {p.tileW / 10} × {p.tileL / 10} cm
              <span className="bom-sub">{t('fullCut', { full: s.tiles.full, cut: s.tiles.cut })}</span>
            </th>
            <td className="num muted">{tilesTotal}</td>
            <td className="num strong">{withSpare(tilesTotal, p.spare)}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">{t('orderHint', { spare: p.spare })}</p>

      <h3 className="subhead">{t('byHeight')}</h3>
      <table className="by-height">
        <thead>
          <tr>
            <th scope="col">{t('height')}</th>
            <th scope="col">{t('setTo')}</th>
            <th scope="col">{t('model')}</th>
            <th scope="col" className="num">{t('count')}</th>
          </tr>
        </thead>
        <tbody>
          {s.byHeight.map((r) => (
            <tr key={`${r.level?.id ?? '~'}${r.height}`} className={r.result.ok ? '' : 'is-bad'}>
              <th scope="row">
                <i className="dot" style={{ background: r.level ? r.level.color : slopeColor(r.height, slope[0], slope[1]) }} />
                <span className="h-val">{fmtLen(r.height, unit)}</span>
                <span className="h-name">{r.level?.name ?? t('gradientLegs')}</span>
              </th>
              <td className="mono">{r.pedestalHeight} mm</td>
              <td className="mono">
                {r.result.ok
                  ? `${r.result.spec.pedestal.min}–${r.result.spec.pedestal.max}${r.result.spec.expanders.length ? ` +${r.result.spec.expanders.join('+')}` : ''}`
                  : '—'}
              </td>
              <td className="num strong">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Issue({ children, severe }: { children: React.ReactNode; severe?: boolean }) {
  return (
    <li className={`issue ${severe ? 'issue--severe' : ''}`}>
      <AlertTriangle size={14} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export function orderText(p: Project, s: Summary, t: T): string {
  const lines = [`${p.name} — ${t('order')}`, ''];
  for (const r of s.byModel) lines.push(`${r.order} × ${r.pedestal.name}`);
  for (const r of s.expanders) lines.push(`${r.order} × ${r.name}`);
  for (const r of s.accessories) lines.push(`${r.order} × ${r.name}${r.packs ? ` (${t('packs', { n: r.packs, size: r.pack ?? 10 })})` : ''}`);
  lines.push('', t('byHeight'));
  for (const r of s.byHeight) {
    const m = r.result.ok ? r.result.spec.pedestal.name : '—';
    lines.push(`${r.count} × ${r.height} mm (${r.level?.name ?? t('gradientLegs')}) → ${m}`);
  }
  lines.push('', t('orderHint', { spare: p.spare }));
  return lines.join('\n');
}

export function orderCsv(p: Project, s: Summary): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows: (string | number)[][] = [['Section', 'Item', 'Height mm', 'Needed', 'Order']];
  for (const r of s.byModel) rows.push(['Pedestal', r.pedestal.name, `${r.pedestal.min}-${r.pedestal.max}`, r.count, r.order]);
  for (const r of s.expanders) rows.push(['Expander', r.name, '', r.count, r.order]);
  for (const r of s.accessories) rows.push(['Accessory', r.name, '', r.count, r.order]);
  for (const r of s.byHeight)
    rows.push(['Leg height', r.level?.name ?? 'Slope', r.height, r.count, r.result.ok ? r.result.spec.pedestal.name : 'out of range']);
  rows.push(['Tiles', `${p.tileW}x${p.tileL} mm`, '', s.tiles.full + s.tiles.cut, withSpare(s.tiles.full + s.tiles.cut, p.spare)]);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}
