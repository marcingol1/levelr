import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Link2, Printer, Redo2, Undo2, FilePlus2 } from 'lucide-react';
import { useT, type Lang } from '../i18n';
import type { Unit } from '../state/project';
import { Segmented } from './ui';

interface Props {
  name: string;
  onName: (n: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onShare: () => void;
  onNew: (kind: 'blank' | 'example') => void;
  unit: Unit;
  setUnit: (u: Unit) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

export function Header(props: Props) {
  const { t } = useT();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [menu]);

  return (
    <header className="topbar">
      <div className="brand">
        <Logo />
        <div className="brand-text">
          <span className="brand-name">Levelr</span>
          <span className="brand-tag">{t('tagline')}</span>
        </div>
      </div>

      <div className="project-name">
        <input
          value={props.name}
          placeholder={t('untitled')}
          aria-label={t('projectName')}
          maxLength={80}
          onChange={(e) => props.onName(e.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="btn-group">
          <button type="button" className="icon-btn" disabled={!props.canUndo} onClick={props.onUndo} title={`${t('undo')} (⌘Z)`} aria-label={t('undo')}>
            <Undo2 size={16} />
          </button>
          <button type="button" className="icon-btn" disabled={!props.canRedo} onClick={props.onRedo} title={`${t('redo')} (⇧⌘Z)`} aria-label={t('redo')}>
            <Redo2 size={16} />
          </button>
        </div>
        <Segmented<Unit> ariaLabel={t('unit')} size="sm" value={props.unit} onChange={props.setUnit} options={[{ value: 'cm', label: 'cm' }, { value: 'mm', label: 'mm' }]} />
        <Segmented<Lang> ariaLabel="Language" size="sm" value={props.lang} onChange={props.setLang} options={[{ value: 'en', label: 'EN' }, { value: 'pl', label: 'PL' }]} />
        <div className="menu" ref={menuRef}>
          <button type="button" className="btn btn--ghost" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
            <FilePlus2 size={15} /> <span className="hide-sm">{t('new')}</span> <ChevronDown size={14} />
          </button>
          {menu && (
            <div className="menu-pop" role="menu">
              <button type="button" role="menuitem" onClick={() => (props.onNew('blank'), setMenu(false))}>
                {t('newBlank')}
              </button>
              <button type="button" role="menuitem" onClick={() => (props.onNew('example'), setMenu(false))}>
                {t('newExample')}
              </button>
            </div>
          )}
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
          <Printer size={15} /> <span className="hide-sm">{t('print')}</span>
        </button>
        <button type="button" className="btn btn--primary" onClick={props.onShare}>
          <Link2 size={15} /> <span className="hide-sm">{t('share')}</span>
        </button>
      </div>
    </header>
  );
}

function Logo() {
  // A tile resting on legs of two different heights — the whole idea in one mark.
  return (
    <svg className="logo" width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <rect x="3" y="7" width="26" height="4" rx="1" fill="currentColor" />
      <rect x="6" y="11" width="3" height="15" rx="0.6" fill="var(--accent)" />
      <rect x="23" y="11" width="3" height="8" rx="0.6" fill="var(--accent)" />
      <path d="M3 27.5 L14 27.5 L18 20.5 L29 20.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}
