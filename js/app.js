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

/** Format a date string */
export function formatDate(dateStr, lang = 'en') {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString(lang === 'ml' ? 'ml-IN' : 'en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return dateStr; }
}

/** Escape HTML */
export function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
