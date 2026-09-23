/**
 * Daily Bread — Admin App — Main App Controller
 * Handles sidebar, language, shared UI behaviour across all admin pages.
 */

import { setLocale, t, getLang } from './i18n.js';

const LANG_KEY = 'db_admin_lang';

export function initAdminApp(options = {}) {
  // 1. Language
  const savedLang = localStorage.getItem(LANG_KEY) || 'en';
  setLocale(savedLang);
  updateLangButtons(savedLang);

  // 2. Sidebar / hamburger navigation
  initSidebar();

  // 3. Unread counselling badge
  if (options.loadUnreadBadge) loadUnreadBadge();
}

function initSidebar() {
  const overlay  = document.getElementById('drawer-overlay');
  const sidebar  = document.getElementById('sidebar');
  const openBtn  = document.getElementById('hamburger-btn');

  function openSidebar() {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  }

  openBtn?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Mark active nav link
  const currentPage = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(currentPage)) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
}

window.switchLanguage = function (lang) {
  setLocale(lang);
  localStorage.setItem(LANG_KEY, lang);
  updateLangButtons(lang);
};

function updateLangButtons(lang) {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

/** Fetch and display unread counselling count in the nav badge */
async function loadUnreadBadge() {
  try {
    const { getCounsellingCounts } = await import('./api.js');
    const counts = await getCounsellingCounts();
    const badge = document.getElementById('counselling-badge');
    if (badge && counts?.unread > 0) {
      badge.textContent = counts.unread;
      badge.style.display = 'flex';
    }
  } catch { /* non-critical */ }
}

/** Show a toast message */
export function showToast(message, type = '', duration = 3000) {
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = `toast ${type}`.trim();
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => toast.classList.remove('show'), duration);
}

/** Show a confirmation dialog */
export function showConfirmDialog({ title, message, confirmText, onConfirm, dangerous = false }) {
  let backdrop = document.getElementById('confirm-dialog-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'confirm-dialog-backdrop';
    backdrop.className = 'dialog-backdrop';
    backdrop.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 id="dialog-title"></h3>
        <p id="dialog-message"></p>
        <div class="dialog-actions">
          <button class="btn btn-ghost" id="dialog-cancel">${t('cancel')}</button>
          <button class="btn" id="dialog-confirm"></button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
  }

  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-message').textContent = message;
  const confirmBtn = document.getElementById('dialog-confirm');
  confirmBtn.textContent = confirmText || t('delete');
  confirmBtn.className = `btn ${dangerous ? 'btn-danger' : 'btn-primary'}`;

  const cancelBtn = document.getElementById('dialog-cancel');

  function close() { backdrop.classList.remove('open'); }
  function confirm() { close(); onConfirm?.(); }

  // Reset listeners
  confirmBtn.replaceWith(confirmBtn.cloneNode(true));
  cancelBtn.replaceWith(cancelBtn.cloneNode(true));
  document.getElementById('dialog-confirm').addEventListener('click', confirm);
  document.getElementById('dialog-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  backdrop.classList.add('open');
}

/** Open/close slide panel */
export function openSlidePanel(id) {
  document.getElementById(`${id}-backdrop`)?.classList.add('open');
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeSlidePanel(id) {
  document.getElementById(`${id}-backdrop`)?.classList.remove('open');
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Robustly parses any timestamp input (Firestore object, seconds, ISO string, Date).
 * Returns a valid Date object, or null if invalid.
 */
export function parseTimestamp(ts) {
  if (!ts) return null;
  if (ts instanceof Date) {
    return isNaN(ts.getTime()) ? null : ts;
  }
  if (typeof ts.toMillis === 'function') {
    const d = new Date(ts.toMillis());
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'object') {
    const sec = ts._seconds ?? ts.seconds;
    if (typeof sec === 'number') {
      const d = new Date(sec * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  if (typeof ts === 'number') {
    const d = new Date(ts < 1e11 ? ts * 1000 : ts);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === 'string') {
    const trimmed = ts.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a date cleanly without ever showing Invalid Date.
 */
export function formatDate(dateInput, lang = 'en', fallback = '—') {
  const date = parseTimestamp(dateInput);
  if (!date) return fallback;

  try {
    const locale = lang === 'ml' ? 'ml-IN' : 'en-IN';
    const formatted = date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (!formatted || formatted.toLowerCase().includes('invalid')) {
      return fallback;
    }
    return formatted;
  } catch {
    return fallback;
  }
}

/**
 * Format a time into strict 12-hour format with AM/PM (e.g. 9:00 PM).
 * Never exposes 24-hour time to the user.
 */
export function formatTime(timeOrTs, lang = 'en', fallback = '—') {
  if (!timeOrTs) return fallback;

  if (typeof timeOrTs === 'string' && timeOrTs.includes(':')) {
    const parts = timeOrTs.trim().split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;
      const minStr = String(m).padStart(2, '0');
      return `${h}:${minStr} ${ampm}`;
    }
  }

  const date = parseTimestamp(timeOrTs);
  if (!date) return fallback;

  try {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const minStr = String(minutes).padStart(2, '0');
    return `${hours}:${minStr} ${ampm}`;
  } catch {
    return fallback;
  }
}

/**
 * Formats date and 12-hour time together.
 */
export function formatDateTime(dateInput, lang = 'en', fallback = '—') {
  const dStr = formatDate(dateInput, lang, '');
  const tStr = formatTime(dateInput, lang, '');
  if (dStr && tStr) return `${dStr}, ${tStr}`;
  return dStr || tStr || fallback;
}

/**
 * Converts 24-hr "HH:MM" into { hour12, minute, ampm } for 12-hour inputs.
 */
export function format12Hour(hhmm = '21:00') {
  const parts = String(hhmm).split(':');
  let h = parseInt(parts[0], 10) || 0;
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour12: String(h).padStart(2, '0'), minute: m, ampm };
}

/**
 * Converts 12-hour { hour12, minute, ampm } to 24-hr "HH:MM" for backend storage.
 */
export function to24Hour(hour12, minute, ampm) {
  let h = parseInt(hour12, 10) || 12;
  const m = String(parseInt(minute, 10) || 0).padStart(2, '0');
  const isPM = String(ampm).toUpperCase() === 'PM';
  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/** Escape HTML */
export function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
