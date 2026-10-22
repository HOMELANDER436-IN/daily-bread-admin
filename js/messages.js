/**
 * Daily Bread — Admin App — Messages Controller
 */

import { initAdminApp, showToast, showConfirmDialog, openSlidePanel, closeSlidePanel, formatDate, formatDateTime, escapeHtml } from './app.js';
import { getMessages, createMessage, updateMessage, deleteMessage, deleteAllMessages, togglePublish } from './api.js';
import { t, getLang } from './i18n.js';

let allMessages = [];
let editingId = null;

async function init() {
  initAdminApp({ loadUnreadBadge: true });
  setupPanel();
  setupButtons();
  await loadMessages();
}

function setupButtons() {
  // Mobile action bar — "Create Message" button
  document.getElementById('create-msg-btn')?.addEventListener('click', openCreatePanel);

  // Desktop header — "Create Message" button
  document.getElementById('create-msg-btn-desktop')?.addEventListener('click', openCreatePanel);

  // FAB (floating action button, mobile only)
  document.getElementById('fab-create-btn')?.addEventListener('click', openCreatePanel);

  // Mobile action bar — "Delete All" button
  document.getElementById('delete-all-btn')?.addEventListener('click', handleDeleteAllMessages);

  // Desktop header — "Delete All" button
  document.getElementById('delete-all-btn-desktop')?.addEventListener('click', handleDeleteAllMessages);
}

function handleDeleteAllMessages() {
  if (!allMessages.length) return;
  showConfirmDialog({
    title: t('deleteAllMessages'),
    message: t('confirmDeleteAllMessages'),
    confirmText: t('deleteAll'),
    dangerous: true,
    onConfirm: async () => {
      try {
        await deleteAllMessages();
        allMessages = [];
        renderMessages(allMessages);
        showToast(t('deleteAllMessages'), 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
  });
}

async function loadMessages() {
  const list = document.getElementById('messages-list');
  list.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-muted)">Loading...</div>`;

  try {
    allMessages = await getMessages();
    renderMessages(allMessages);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p style="color:var(--error)">${err.message}</p></div>`;
  }
}

function setDeleteAllVisible(visible) {
  // Update both mobile action bar and desktop header delete buttons
  const mobile = document.getElementById('delete-all-btn');
  const desktop = document.getElementById('delete-all-btn-desktop');
  const show = visible ? 'inline-flex' : 'none';
  if (mobile)  mobile.style.display  = show;
  if (desktop) desktop.style.display = show;
}

function renderMessages(messages) {
  const list = document.getElementById('messages-list');
  const lang = getLang();
  setDeleteAllVisible(messages.length > 0);

  if (!messages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>${t('noMessages')}</p>
        <p style="margin-top:6px;font-size:0.8rem">${t('createFirst')}</p>
      </div>`;
    return;
  }

  list.innerHTML = messages.map(msg => {
    const publishLabel = msg.is_published ? '🔒 Unpublish' : '🌐 Publish';
    const publishClass = msg.is_published ? 'unpublish' : 'publish';
    return `
    <div class="msg-card" id="msg-${msg.id}">
      <div class="msg-card-body">
        <div class="msg-card-title">${escapeHtml(msg.title || msg.content?.substring(0, 60) + '...')}</div>
        <div class="msg-card-preview">${escapeHtml(msg.content?.substring(0, 120))}...</div>
        <div class="msg-card-meta">
          <span class="badge ${msg.is_published ? 'badge-published' : 'badge-draft'}">
            ${msg.is_published ? '✓ ' + t('published') : t('draft')}
          </span>
          <span class="badge ${msg.language === 'ml' ? 'badge-ml' : 'badge-en'}">
            ${msg.language === 'ml' ? 'ML' : 'EN'}
          </span>
          <span class="msg-card-date">${formatDateTime(msg.created_at, lang)}</span>
        </div>
      </div>
      <div class="msg-card-actions">
        <button class="msg-card-action-btn" onclick="window.editMessage('${msg.id}')" title="Edit">
          ✏️ Edit
        </button>
        <button class="msg-card-action-btn ${publishClass}" onclick="window.handleTogglePublish('${msg.id}', ${!msg.is_published})" title="${msg.is_published ? t('unpublish') : t('publish')}">
          ${publishLabel}
        </button>
        <button class="msg-card-action-btn delete" onclick="window.handleDeleteMessage('${msg.id}')" title="${t('deleteMessage')}">
          🗑️ Delete
        </button>
      </div>
    </div>
  `;
  }).join('');
}

function setupPanel() {
  const backdropEl = document.getElementById('msg-panel-backdrop');
  backdropEl?.addEventListener('click', (e) => {
    if (e.target === backdropEl) closePanel();
  });
  document.getElementById('panel-close')?.addEventListener('click', closePanel);
  document.getElementById('msg-form')?.addEventListener('submit', handleSave);
}

function openCreatePanel() {
  editingId = null;
  document.getElementById('panel-title').textContent = t('createMessage');
  document.getElementById('msg-form')?.reset();
  document.getElementById('publish-toggle').checked = false;
  // Reset radio buttons to English
  document.querySelectorAll('input[name="language"]').forEach(r => {
    r.checked = r.value === 'en';
  });
  document.getElementById('msg-language').value = 'en';
  openSlidePanel('msg-panel');
}

window.editMessage = async function (id) {
  const msg = allMessages.find(m => m.id === id);
  if (!msg) return;

  editingId = id;
  document.getElementById('panel-title').textContent = t('editMessage');

  document.getElementById('msg-title').value = msg.title || '';
  document.getElementById('msg-content').value = msg.content || '';
  document.getElementById('msg-reference').value = msg.reference || '';
  document.getElementById('msg-language').value = msg.language || 'en';
  document.getElementById('publish-toggle').checked = msg.is_published;

  // Sync visible radio buttons
  const lang = msg.language || 'en';
  document.querySelectorAll('input[name="language"]').forEach(radio => {
    radio.checked = radio.value === lang;
  });

  openSlidePanel('msg-panel');
};

window.handleTogglePublish = async function (id, publish) {
  try {
    const updated = await togglePublish(id, publish);
    const idx = allMessages.findIndex(m => m.id === id);
    if (idx !== -1) allMessages[idx] = updated;
    renderMessages(allMessages);
    showToast(publish ? t('published') : t('unpublish'), 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.handleDeleteMessage = function (id) {
  showConfirmDialog({
    title: t('confirmDelete'),
    message: t('confirmDeleteMsg'),
    confirmText: t('delete'),
    dangerous: true,
    onConfirm: async () => {
      try {
        await deleteMessage(id);
        allMessages = allMessages.filter(m => m.id !== id);
        renderMessages(allMessages);
        showToast(t('deleteMessage'), 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    },
  });
};

async function handleSave(e) {
  e.preventDefault();

  const content = document.getElementById('msg-content')?.value.trim();
  if (!content) {
    showToast(t('content') + ' is required', 'error');
    return;
  }

  const saveBtn = document.getElementById('panel-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span> ${t('saving')}`;

  const payload = {
    title:        document.getElementById('msg-title')?.value.trim() || null,
    content,
    reference:    document.getElementById('msg-reference')?.value.trim() || null,
    language:     document.getElementById('msg-language')?.value || 'en',
    is_published: document.getElementById('publish-toggle')?.checked || false,
  };

  try {
    let result;
    if (editingId) {
      result = await updateMessage(editingId, payload);
      const idx = allMessages.findIndex(m => m.id === editingId);
      if (idx !== -1) allMessages[idx] = result;
    } else {
      result = await createMessage(payload);
      allMessages.unshift(result);
    }
    renderMessages(allMessages);
    closePanel();
    showToast(editingId ? t('editMessage') + ' saved' : t('createMessage') + ' saved', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = t('save');
  }
}

function closePanel() {
  closeSlidePanel('msg-panel');
  editingId = null;
  document.getElementById('msg-form')?.reset();
}
window.closePanel = closePanel;

document.addEventListener('DOMContentLoaded', init);
