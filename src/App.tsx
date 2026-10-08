import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Header } from './components/Header';
import { SetupPanel } from './components/SetupPanel';
import { Plan, type Tool } from './components/Plan';
import { LevelsPanel } from './components/LevelsPanel';
import { OrderPanel } from './components/OrderPanel';
import { I18n, makeT, type Lang } from './i18n';
import { summarize } from './lib/summary';
import { loadPrefs, loadStored, readHashProject, shareUrl, store, storePrefs } from './lib/share';
import { blankProject, demoProject, historyReducer, layoutOf, type Action, type History, type Unit } from './state/project';
import { fmtSpan } from './lib/units';

function init(): History {
  const fromLink = readHashProject();
  if (fromLink) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return { past: [], present: fromLink ?? loadStored() ?? demoProject(), future: [] };
}

const defaultLang: Lang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en';

export default function App() {
  const [hist, send] = useReducer(historyReducer, undefined, init);
  const p = hist.present;
  const dispatch = useCallback((a: Action) => send(a), []);

  const [prefs, setPrefs] = useState(() => loadPrefs<{ unit: Unit; lang: Lang }>({ unit: 'cm', lang: defaultLang }));
  const [tool, setTool] = useState<Tool>('paint');
  const [brushId, setBrushId] = useState(p.baseLevelId);
  const [gradient, setGradient] = useState({ from: 60, to: 100 });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  const t = useMemo(() => makeT(prefs.lang), [prefs.lang]);
  const i18n = useMemo(() => ({ t, lang: prefs.lang }), [t, prefs.lang]);

  const layout = useMemo(
    () => layoutOf(p),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.width, p.depth, p.tileW, p.tileL, p.joint, p.pattern, p.disabled],
  );
  const summary = useMemo(() => summarize(p, layout), [p, layout]);
  const brush = p.levels.find((l) => l.id === brushId) ?? p.levels[0];

  // Persist (debounced) — storage is a convenience; the share link is the durable copy.
  useEffect(() => {
    const id = window.setTimeout(() => store(p), 250);
    return () => window.clearTimeout(id);
  }, [p]);
  useEffect(() => storePrefs(prefs), [prefs]);
  useEffect(() => {
    document.documentElement.lang = prefs.lang;
  }, [prefs.lang]);
  useEffect(() => {
    document.title = p.name ? `${p.name} · Levelr` : 'Levelr';
  }, [p.name]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const share = async () => {
    const url = shareUrl(p);
    try {
      await navigator.clipboard.writeText(url);
      notify(t('linkCopied'));
    } catch {
      window.history.replaceState(null, '', url);
      notify(t('linkFailed'));
    }
  };

  // Keyboard: tools, level brushes, undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        send({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        send({ type: 'redo' });
      } else if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'p') setTool('paint');
        else if (k === 's') setTool('shape');
        else if (k === 'g') setTool('gradient');
        else if (/^[1-9]$/.test(k)) {
          const l = p.levels[Number(k) - 1];
          if (l) {
            setBrushId(l.id);
            setTool('paint');
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.levels]);

  const selectBrush = (id: string) => {
    setBrushId(id);
    if (tool !== 'paint') setTool('paint');
  };

  return (
    <I18n.Provider value={i18n}>
      <div className="app">
        <Header
          name={p.name}
          onName={(name) => dispatch({ type: 'set', patch: { name } })}
          canUndo={hist.past.length > 0}
          canRedo={hist.future.length > 0}
          onUndo={() => send({ type: 'undo' })}
          onRedo={() => send({ type: 'redo' })}
          onShare={share}
          onNew={(kind) => {
            const next = kind === 'blank' ? blankProject() : demoProject();
            dispatch({ type: 'load', project: next });
            setBrushId(next.baseLevelId);
          }}
          unit={prefs.unit}
          setUnit={(unit) => setPrefs((s) => ({ ...s, unit }))}
          lang={prefs.lang}
          setLang={(lang) => setPrefs((s) => ({ ...s, lang }))}
        />

        <div className="print-head" aria-hidden>
          <strong>{p.name}</strong> · {fmtSpan(p.width)} × {fmtSpan(p.depth)} · {p.tileW / 10}×{p.tileL / 10} cm · {t('printedOn')}{' '}
          {new Date().toLocaleDateString(prefs.lang)}
        </div>

        <main className="workspace">
          <SetupPanel project={p} layout={layout} unit={prefs.unit} dispatch={dispatch} />
          <Plan
            project={p}
            layout={layout}
            summary={summary}
            tool={tool}
            setTool={setTool}
            brush={brush}
            gradient={gradient}
            setGradient={setGradient}
            unit={prefs.unit}
            dispatch={dispatch}
          />
          <aside className="panel panel--side" aria-label={t('order')}>
            <LevelsPanel project={p} summary={summary} brushId={brush.id} setBrush={selectBrush} unit={prefs.unit} dispatch={dispatch} />
            <OrderPanel project={p} summary={summary} unit={prefs.unit} notify={notify} />
          </aside>
        </main>

        <div className={`toast ${toast ? 'is-on' : ''}`} role="status" aria-live="polite">
          {toast}
        </div>
      </div>
    </I18n.Provider>
  );
}
