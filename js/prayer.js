/**
 * Daily Bread — Admin App — Prayer Settings & Schedules Controller
 */

import { initAdminApp, showToast, formatTime, format12Hour, to24Hour } from './app.js';
import {
  getPrayerSettings,
  updatePrayerSettings,
  getPrayerSchedules,
  createPrayerSchedule,
  updatePrayerSchedule,
  deletePrayerSchedule,
  togglePrayerSchedule,
} from './api.js';
import { t } from './i18n.js';

let masterSettings = null;
let schedules = [];
let pendingDeleteId = null;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function init() {
  initAdminApp({ loadUnreadBadge: true });
  setupEventListeners();
  await Promise.all([loadMasterSettings(), loadSchedules()]);
}

// ─── Master Settings ──────────────────────────────────────────
async function loadMasterSettings() {
  try {
    masterSettings = await getPrayerSettings();
    renderMasterSettings(masterSettings);
  } catch (err) {
    showToast('Failed to load prayer settings: ' + err.message, 'error');
  }
}

function renderMasterSettings(data) {
  if (!data) return;
  const toggle = document.getElementById('prayer-enabled-toggle');
  if (toggle) {
    toggle.checked = Boolean(data.enabled);
    updateMasterStatus(toggle.checked);
  }
}

function updateMasterStatus(enabled) {
  const statusMsg = document.getElementById('prayer-status-msg');
  if (statusMsg) {
    statusMsg.textContent = enabled ? t('prayerEnabledMsg') : t('prayerDisabledMsg');
    statusMsg.className = `form-hint ${enabled ? 'stat-ok' : ''}`;
  }
}

// ─── Multiple Schedules ───────────────────────────────────────
async function loadSchedules() {
  const listEl = document.getElementById('schedules-list');
  const emptyEl = document.getElementById('schedules-empty');

  try {
    schedules = await getPrayerSchedules();
    renderSchedulesList();
  } catch (err) {
    showToast('Failed to load prayer schedules: ' + err.message, 'error');
  }
}

function renderSchedulesList() {
  const listEl = document.getElementById('schedules-list');
  const emptyEl = document.getElementById('schedules-empty');
  if (!listEl) return;

  if (!schedules || schedules.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = schedules.map(sched => {
    const time12 = format12Hour(sched.time || '21:00');
    const typeDescription = getTypeDescription(sched);
    const isChecked = sched.enabled !== false;
    const cardClass = `schedule-card ${isChecked ? '' : 'disabled'}`;

    return `
      <div class="${cardClass}" data-schedule-id="${sched.id}">
        <div class="schedule-info">
          <div class="schedule-time">${time12}</div>
          <div class="schedule-type">
            ${sched.label ? `<strong style="color:var(--text)">${escapeHtml(sched.label)}</strong> • ` : ''}
            <span>${typeDescription}</span>
          </div>
        </div>
        <div class="schedule-actions">
          <div class="toggle-wrap" style="margin:0">
            <label class="toggle">
              <input type="checkbox" class="schedule-toggle" data-id="${sched.id}" ${isChecked ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <button type="button" class="btn btn-ghost btn-sm edit-sched-btn" data-id="${sched.id}" title="${t('editSchedule')}">
            ✏️
          </button>
          <button type="button" class="btn btn-ghost btn-sm delete-sched-btn" data-id="${sched.id}" title="${t('deleteSchedule')}" style="color:var(--error)">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function getTypeDescription(sched) {
  if (sched.type === 'daily') {
    return t('everyDay');
  }
  if (sched.type === 'weekly') {
    const days = (sched.daysOfWeek || []).map(d => DAY_NAMES[d] || d);
    return `${t('selectedDays')}: ${days.join(', ')}`;
  }
  if (sched.type === 'once') {
    const completedBadge = sched.completed ? ' (Completed)' : '';
    return `${t('once')}: ${sched.date || '—'}${completedBadge}`;
  }
  return t('everyDay');
}

// ─── Event Listeners ──────────────────────────────────────────
function setupEventListeners() {
  // Master toggle
  document.getElementById('prayer-enabled-toggle')?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    updateMasterStatus(enabled);
    try {
      await updatePrayerSettings({ enabled, timezone: 'Asia/Kolkata' });
      showToast(enabled ? 'Prayer notifications enabled' : 'Prayer notifications disabled', 'success');
    } catch (err) {
      e.target.checked = !enabled;
      updateMasterStatus(!enabled);
      showToast('Failed to update prayer settings: ' + err.message, 'error');
    }
  });

  // Open Add Schedule slide panel
  document.getElementById('add-schedule-btn')?.addEventListener('click', () => {
    openSchedulePanel(null);
  });

  // Close panel triggers
  document.getElementById('schedule-panel-close')?.addEventListener('click', closeSchedulePanel);
  document.getElementById('schedule-cancel-btn')?.addEventListener('click', closeSchedulePanel);
  document.getElementById('schedule-panel-backdrop')?.addEventListener('click', closeSchedulePanel);

  // Time selects change -> update preview
  const hourEl = document.getElementById('sched-hour');
  const minEl = document.getElementById('sched-minute');
  const perEl = document.getElementById('sched-period');
  const updatePreview = () => {
    const h = hourEl?.value || '9';
    const m = minEl?.value || '00';
    const p = perEl?.value || 'PM';
    const previewEl = document.getElementById('sched-time-preview');
    if (previewEl) previewEl.textContent = `Selected: ${h}:${m} ${p}`;
  };
  hourEl?.addEventListener('change', updatePreview);
  minEl?.addEventListener('change', updatePreview);
  perEl?.addEventListener('change', updatePreview);

  // Repeat type change -> toggle day chips vs date input
  document.getElementById('sched-type')?.addEventListener('change', (e) => {
    const type = e.target.value;
    const daysWrap = document.getElementById('sched-days-wrap');
    const dateWrap = document.getElementById('sched-date-wrap');
    if (daysWrap) daysWrap.style.display = type === 'weekly' ? 'block' : 'none';
    if (dateWrap) dateWrap.style.display = type === 'once' ? 'block' : 'none';
  });

  // Day chip toggle
  document.getElementById('sched-days-chips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.day-chip');
    if (chip) {
      chip.classList.toggle('active');
    }
  });

  // Schedule list actions (toggle, edit, delete delegation)
  document.getElementById('schedules-list')?.addEventListener('click', async (e) => {
    // 1. Toggle switch
    const toggle = e.target.closest('.schedule-toggle');
    if (toggle) {
      const id = toggle.dataset.id;
      const isEnabled = toggle.checked;
      try {
        await togglePrayerSchedule(id, isEnabled);
        const card = toggle.closest('.schedule-card');
        if (card) card.classList.toggle('disabled', !isEnabled);
        showToast(isEnabled ? 'Schedule enabled' : 'Schedule disabled', 'success');
      } catch (err) {
        toggle.checked = !isEnabled;
        showToast('Failed to toggle schedule: ' + err.message, 'error');
      }
      return;
    }

    // 2. Edit button
    const editBtn = e.target.closest('.edit-sched-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      const sched = schedules.find(s => s.id === id);
      if (sched) openSchedulePanel(sched);
      return;
    }

    // 3. Delete button
    const deleteBtn = e.target.closest('.delete-sched-btn');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      openDeleteDialog(id);
      return;
    }
  });

  // Schedule Form Submit
  document.getElementById('schedule-form')?.addEventListener('submit', handleScheduleFormSubmit);

  // Delete dialog buttons
  document.getElementById('cancel-delete-btn')?.addEventListener('click', closeDeleteDialog);
  document.getElementById('confirm-delete-btn')?.addEventListener('click', handleConfirmDelete);
  document.getElementById('delete-dialog-backdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'delete-dialog-backdrop') closeDeleteDialog();
  });
}

// ─── Slide Panel Management ───────────────────────────────────
function openSchedulePanel(sched) {
  const panel = document.getElementById('schedule-panel');
  const backdrop = document.getElementById('schedule-panel-backdrop');
  const title = document.getElementById('schedule-panel-title');
  const idInput = document.getElementById('sched-id');
  const hourEl = document.getElementById('sched-hour');
  const minEl = document.getElementById('sched-minute');
  const perEl = document.getElementById('sched-period');
  const typeEl = document.getElementById('sched-type');
  const labelEl = document.getElementById('sched-label');
  const enabledEl = document.getElementById('sched-enabled');
  const daysWrap = document.getElementById('sched-days-wrap');
  const dateWrap = document.getElementById('sched-date-wrap');
  const dateEl = document.getElementById('sched-date');
  const previewEl = document.getElementById('sched-time-preview');

  if (sched) {
    // Edit mode
    title.textContent = t('editSchedule');
    idInput.value = sched.id;
    labelEl.value = sched.label || '';
    enabledEl.checked = sched.enabled !== false;
    typeEl.value = sched.type || 'daily';

    // Parse 24-hr time to 12-hr selects
    const timeParts = (sched.time || '21:00').split(':');
    let h24 = parseInt(timeParts[0], 10) || 0;
    const mStr = timeParts[1] ? String(timeParts[1]).padStart(2, '0') : '00';
    const period = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;

    hourEl.value = String(h12);
    minEl.value = mStr;
    perEl.value = period;

    // Days chips
    const activeDays = (sched.daysOfWeek || []).map(Number);
    document.querySelectorAll('#sched-days-chips .day-chip').forEach(chip => {
      const d = parseInt(chip.dataset.day, 10);
      chip.classList.toggle('active', activeDays.includes(d));
    });

    // Date
    if (dateEl) dateEl.value = sched.date || '';

    // Show/hide sections
    daysWrap.style.display = sched.type === 'weekly' ? 'block' : 'none';
    dateWrap.style.display = sched.type === 'once' ? 'block' : 'none';
  } else {
    // Create mode
    title.textContent = t('addSchedule');
    idInput.value = '';
    labelEl.value = '';
    enabledEl.checked = true;
    typeEl.value = 'daily';
    hourEl.value = '9';
    minEl.value = '00';
    perEl.value = 'PM';

    // All days active by default for weekly
    document.querySelectorAll('#sched-days-chips .day-chip').forEach(chip => {
      chip.classList.add('active');
    });

    // Default tomorrow for once date
    if (dateEl) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      dateEl.value = tomorrow.toISOString().split('T')[0];
    }

    daysWrap.style.display = 'none';
    dateWrap.style.display = 'none';
  }

  // Update time preview
  const h = hourEl?.value || '9';
  const m = minEl?.value || '00';
  const p = perEl?.value || 'PM';
  if (previewEl) previewEl.textContent = `Selected: ${h}:${m} ${p}`;

  panel?.classList.add('open');
  backdrop?.classList.add('open');
}

function closeSchedulePanel() {
  document.getElementById('schedule-panel')?.classList.remove('open');
  document.getElementById('schedule-panel-backdrop')?.classList.remove('open');
}

// ─── Form Submission ──────────────────────────────────────────
async function handleScheduleFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('sched-id')?.value;
  const hour12 = parseInt(document.getElementById('sched-hour')?.value, 10);
  const minute = document.getElementById('sched-minute')?.value;
  const period = document.getElementById('sched-period')?.value;
  const type = document.getElementById('sched-type')?.value;
  const label = document.getElementById('sched-label')?.value.trim();
  const enabled = document.getElementById('sched-enabled')?.checked;
  const saveBtn = document.getElementById('schedule-save-btn');

  // Convert 12-hr to 24-hr for backend storage
  const time24 = to24Hour(hour12, minute, period);

  const payload = {
    type,
    time: time24,
    label: label || '',
    enabled: Boolean(enabled),
    timezone: 'Asia/Kolkata',
  };

  if (type === 'weekly') {
    const selectedDays = [];
    document.querySelectorAll('#sched-days-chips .day-chip.active').forEach(chip => {
      selectedDays.push(parseInt(chip.dataset.day, 10));
    });
    if (selectedDays.length === 0) {
      showToast('Please select at least one day of the week', 'error');
      return;
    }
    payload.daysOfWeek = selectedDays;
  } else if (type === 'once') {
    const dateVal = document.getElementById('sched-date')?.value;
    if (!dateVal || !dateVal.match(/^\d{4}-\d{2}-\d{2}$/)) {
      showToast('Please select a valid date', 'error');
      return;
    }
    payload.date = dateVal;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = `<span class="spinner"></span> ${t('saving')}`;

  try {
    if (id) {
      await updatePrayerSchedule(id, payload);
      showToast(t('scheduleSaved'), 'success');
    } else {
      await createPrayerSchedule(payload);
      showToast(t('scheduleSaved'), 'success');
    }
    closeSchedulePanel();
    await loadSchedules();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = t('save');
  }
}

// ─── Delete Dialog ────────────────────────────────────────────
function openDeleteDialog(id) {
  pendingDeleteId = id;
  document.getElementById('delete-dialog-backdrop')?.classList.add('open');
}

function closeDeleteDialog() {
  pendingDeleteId = null;
  document.getElementById('delete-dialog-backdrop')?.classList.remove('open');
}

async function handleConfirmDelete() {
  if (!pendingDeleteId) return;

  const btn = document.getElementById('confirm-delete-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${t('delete')}`;

  try {
    await deletePrayerSchedule(pendingDeleteId);
    showToast(t('scheduleDeleted'), 'success');
    closeDeleteDialog();
    await loadSchedules();
  } catch (err) {
    showToast('Failed to delete schedule: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = t('delete');
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', init);
