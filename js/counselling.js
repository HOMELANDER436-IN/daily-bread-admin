/**
 * Daily Bread — Admin App — Counselling Controller
 */

import { initAdminApp, showToast, formatDate, escapeHtml } from './app.js';
import { getCounselling, getCounsellingItem, markCounsellingViewed } from './api.js';
import { t, getLang } from './i18n.js';

let currentFilter = 'all';
let currentPage = 1;
let selectedItemId = null;

async function init() {
  initAdminApp({ loadUnreadBadge: true });
  setupFilters();
  await loadCounselling();
}

function setupFilters() {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      currentFilter = tab.dataset.filter;
      currentPage = 1;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      await loadCounselling();
    });
  });
}

async function loadCounselling() {
  const list = document.getElementById('counselling-list');
  list.innerHTML = `<li style="padding:20px;text-align:center;color:var(--text-muted)">Loading...</li>`;

  try {
    const data = await getCounselling(currentFilter, currentPage);
    renderList(data.requests || []);
    renderPagination(data.total, data.page, data.limit);
  } catch (err) {
    list.innerHTML = `<li style="padding:20px;color:var(--error)">${err.message}</li>`;
  }
}

function renderList(items) {
  const list = document.getElementById('counselling-list');
  const lang = getLang();

  if (!items.length) {
    list.innerHTML = `
      <li class="empty-state">
        <div class="empty-icon">🕊️</div>
        <p>${t('noCounselling')}</p>
      </li>`;
    return;
  }

  list.innerHTML = items.map(item => `
    <li class="counselling-item ${!item.is_viewed ? 'unread' : ''}"
        onclick="window.openCounsellingDetail('${item.id}')"
        data-id="${item.id}">
      <div style="padding-top:4px">
        <span class="status-dot ${item.is_viewed ? 'viewed' : 'unread'}"
              onclick="event.stopPropagation();window.toggleViewed('${item.id}', ${!item.is_viewed})"
              title="${item.is_viewed ? 'Mark unread' : 'Mark viewed'}"
              role="button"
              aria-label="${item.is_viewed ? 'Viewed' : 'Unread'}"></span>
      </div>
      <div class="counselling-item-body">
        <div class="counselling-item-name">${escapeHtml(item.full_name)}</div>
        <div class="counselling-item-phone">📞 ${escapeHtml(item.contact_number)}</div>
        ${item.comment ? `<div class="counselling-item-preview">${escapeHtml(item.comment)}</div>` : ''}
        <div class="counselling-item-date">${formatDate(item.created_at, lang)}</div>
      </div>
    </li>
  `).join('');
}

function renderPagination(total, page, limit) {
  const container = document.getElementById('pagination');
  if (!container) return;
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <button class="page-btn" ${page <= 1 ? 'disabled' : ''} onclick="window.goToPage(${page - 1})">←</button>
    <span style="font-size:0.85rem;color:var(--text-muted)">${page} / ${totalPages}</span>
    <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="window.goToPage(${page + 1})">→</button>
  `;
}

window.goToPage = async function (page) {
  currentPage = page;
  await loadCounselling();
};

window.openCounsellingDetail = async function (id) {
  selectedItemId = id;
  const panel = document.getElementById('detail-panel');
  const backdrop = document.getElementById('detail-backdrop');
  panel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted)">Loading...</div>`;
  backdrop?.classList.add('open');
  panel?.classList.add('open');
  document.body.style.overflow = 'hidden';

  try {
    const item = await getCounsellingItem(id);
    renderDetail(item);
    if (!item.is_viewed) {
      await markCounsellingViewed(id);
      loadCounselling();
    }
  } catch (err) {
    panel.innerHTML = `<div style="padding:24px;color:var(--error)">${err.message}</div>`;
  }
};

function renderDetail(item) {
  const lang = getLang();
  const panel = document.getElementById('detail-panel');

  panel.innerHTML = `
    <div class="slide-panel-header">
      <span class="slide-panel-title">Counselling Request</span>
      <button class="slide-panel-close" onclick="window.closeDetail()">✕</button>
    </div>
    <div class="slide-panel-body">
      <div class="detail-field">
        <div class="detail-label">${t('name')}</div>
        <div class="detail-value">${escapeHtml(item.full_name)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">${t('contact')}</div>
        <div class="detail-value">
          <a href="tel:${escapeHtml(item.contact_number)}" class="detail-phone-link">
            📞 ${escapeHtml(item.contact_number)}
          </a>
          <div style="font-size:0.75rem;color:var(--text-light);margin-top:3px">${t('tapToCall')}</div>
        </div>
      </div>
      ${item.comment ? `
      <div class="detail-field">
        <div class="detail-label">${t('message')}</div>
        <div class="detail-value" style="white-space:pre-wrap">${escapeHtml(item.comment)}</div>
      </div>` : ''}
      <div class="detail-field">
        <div class="detail-label">${t('submitted')}</div>
        <div class="detail-value">${formatDate(item.created_at, lang)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">${t('status')}</div>
        <div class="detail-value">
          <span class="status-dot ${item.is_viewed ? 'viewed' : 'unread'}" style="vertical-align:middle;margin-right:8px"></span>
          ${item.is_viewed ? t('viewed') : t('unread')}
          ${item.viewed_at ? `<span style="font-size:0.75rem;color:var(--text-light);margin-left:8px">${formatDate(item.viewed_at, lang)}</span>` : ''}
        </div>
      </div>
      ${!item.is_viewed ? `
      <button class="btn btn-primary" onclick="window.markViewed('${item.id}')" style="margin-top:8px">
        ✓ ${t('markViewed')}
      </button>` : ''}
    </div>
  `;
}

window.closeDetail = function () {
  document.getElementById('detail-backdrop')?.classList.remove('open');
  document.getElementById('detail-panel')?.classList.remove('open');
  document.body.style.overflow = '';
  selectedItemId = null;
};

window.markViewed = async function (id) {
  try {
    await markCounsellingViewed(id);
    showToast(t('markViewed'), 'success');
    await loadCounselling();
    window.closeDetail();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.toggleViewed = async function (id, markAsViewed) {
  if (!markAsViewed) return; // Only mark as viewed, not unmark
  try {
    await markCounsellingViewed(id);
    await loadCounselling();
    showToast(t('markViewed'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.addEventListener('DOMContentLoaded', init);
