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
  setupDeleteAll();
  await loadMessages();
}

function setupDeleteAll() {
  const deleteAllBtn = document.getElementById('delete-all-btn');
  deleteAllBtn?.addEventListener('click', handleDeleteAllMessages);
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
  list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted)">Loading...</div>`;

  try {
    allMessages = await getMessages();
    renderMessages(allMessages);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><p style="color:var(--error)">${err.message}</p></div>`;
  }
}

function renderMessages(messages) {
  const list = document.getElementById('messages-list');
  const lang = getLang();
  const deleteAllBtn = document.getElementById('delete-all-btn');
  if (deleteAllBtn) {
    deleteAllBtn.style.display = messages.length ? 'inline-flex' : 'none';
  }

  if (!messages.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>${t('noMessages')}</p>
        <p style="margin-top:6px;font-size:0.8rem">${t('createFirst')}</p>
      </div>`;
    return;
  }

  list.innerHTML = messages.map(msg => `
    <li class="msg-item" id="msg-${msg.id}">
      <div class="msg-item-body">
        <div class="msg-item-title">${escapeHtml(msg.title || msg.content?.substring(0, 50) + '...')}</div>
        <div class="msg-item-preview">${escapeHtml(msg.content?.substring(0, 80))}...</div>
        <div class="msg-item-meta">
          <span class="badge ${msg.is_published ? 'badge-published' : 'badge-draft'}">
            ${msg.is_published ? '✓ ' + t('published') : t('draft')}
          </span>
          <span class="badge ${msg.language === 'ml' ? 'badge-ml' : 'badge-en'}">
            ${msg.language === 'ml' ? 'ML' : 'EN'}
          </span>
          <span style="font-size:0.75rem;color:var(--text-light)">${formatDateTime(msg.created_at, lang)}</span>
        </div>
      </div>
      <div class="msg-item-actions">
        <button class="btn btn-ghost btn-sm" onclick="window.editMessage('${msg.id}')" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="window.handleTogglePublish('${msg.id}', ${!msg.is_published})" title="${msg.is_published ? t('unpublish') : t('publish')}">
          ${msg.is_published ? '🔒' : '🌐'}
        </button>
        <button class="btn btn-ghost btn-sm" onclick="window.handleDeleteMessage('${msg.id}')" title="${t('deleteMessage')}" style="color:var(--error)">🗑️</button>
      </div>
    </li>
  `).join('');
}

function setupPanel() {
  // Create backdrop
  const panelEl = document.getElementById('msg-panel');
  const backdropEl = document.getElementById('msg-panel-backdrop');

  backdropEl?.addEventListener('click', (e) => {
    if (e.target === backdropEl) closePanel();
  });
  document.getElementById('panel-close')?.addEventListener('click', closePanel);
  document.getElementById('create-msg-btn')?.addEventListener('click', () => openCreatePanel());
  document.getElementById('msg-form')?.addEventListener('submit', handleSave);
}

function openCreatePanel() {
  editingId = null;
  document.getElementById('panel-title').textContent = t('createMessage');
  document.getElementById('msg-form')?.reset();
  document.getElementById('publish-toggle').checked = false;
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

  // Sync visible radio buttons to match the message's stored language
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
  const msg = allMessages.find(m => m.id === id);
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
    title:      document.getElementById('msg-title')?.value.trim() || null,
    content,
    reference:  document.getElementById('msg-reference')?.value.trim() || null,
    language:   document.getElementById('msg-language')?.value || 'en',
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

document.addEventListener('DOMContentLoaded', init);
