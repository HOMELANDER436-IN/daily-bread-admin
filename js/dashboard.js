/**
 * Daily Bread — Admin App — Dashboard Controller
 */

import { initAdminApp, showToast, formatDate, formatTime } from './app.js';
import { getDashboardData } from './api.js';
import { t } from './i18n.js';

async function init() {
  initAdminApp({ loadUnreadBadge: true });

  try {
    const { messages, counsellingCounts, prayerSettings } = await getDashboardData();

    // Latest message
    const latest = messages.find(m => m.is_published) || messages[0] || null;
    renderMessageStat(latest);

    // Counselling counts
    renderCounsellingStat(counsellingCounts);

    // Prayer
    renderPrayerStat(prayerSettings);
  } catch (err) {
    showToast('Failed to load dashboard data', 'error');
  }
}

function renderMessageStat(msg) {
  const el = document.getElementById('msg-stat');
  if (!el) return;
  if (!msg) {
    el.innerHTML = `<div class="stat-sub">${t('noMessages')}</div>`;
    return;
  }
  const title = msg.title || (msg.content?.substring(0, 40) + '...');
  const status = msg.is_published
    ? `<span class="badge badge-published">✓ ${t('published')}</span>`
    : `<span class="badge badge-draft">${t('draft')}</span>`;
  el.innerHTML = `
    <div class="stat-value" style="font-size:1rem;line-height:1.4;font-weight:600">${title}</div>
    <div style="margin-top:8px">${status}</div>
  `;
}

function renderCounsellingStat(counts) {
  const totalEl  = document.getElementById('counselling-total');
  const unreadEl = document.getElementById('counselling-unread');
  if (totalEl)  totalEl.textContent  = counts?.total ?? '—';
  if (unreadEl) {
    unreadEl.textContent = counts?.unread ?? '—';
    if (counts?.unread > 0) unreadEl.className = 'stat-value stat-warn';
  }
}

function renderPrayerStat(settings) {
  const timeEl   = document.getElementById('prayer-time-stat');
  const statusEl = document.getElementById('prayer-status-stat');
  if (timeEl)   timeEl.textContent = settings?.prayer_time ? formatTime(settings.prayer_time) : '—';
  if (statusEl) {
    statusEl.textContent = settings?.enabled ? t('enabled') : t('disabled');
    statusEl.className = `stat-sub ${settings?.enabled ? 'stat-ok' : ''}`;
  }
}

document.addEventListener('DOMContentLoaded', init);
