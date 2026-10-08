import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { sanitize, type Project } from '../state/project';

const STORAGE_KEY = 'levelr:project:v1';
const PREFS_KEY = 'levelr:prefs:v1';

export function encodeProject(p: Project): string {
  return compressToEncodedURIComponent(JSON.stringify(p));
}

export function decodeProject(s: string): Project | null {
  try {
    const json = decompressFromEncodedURIComponent(s);
    return json ? sanitize(JSON.parse(json)) : null;
  } catch {
    return null;
  }
}

export function shareUrl(p: Project): string {
  const url = new URL(window.location.href);
  url.hash = `p=${encodeProject(p)}`;
  return url.toString();
}

export function readHashProject(): Project | null {
  const m = window.location.hash.match(/^#p=(.+)$/);
  return m ? decodeProject(m[1]) : null;
}

export function loadStored(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function store(p: Project) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — the share link still works */
  }
}

export function loadPrefs<T extends object>(fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function storePrefs(p: object) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
