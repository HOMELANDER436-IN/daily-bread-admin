/**
 * Daily Bread — Admin App — Prayer Settings Controller
 */

import { initAdminApp, showToast } from './app.js';
import { getPrayerSettings, updatePrayerSettings } from './api.js';
import { t } from './i18n.js';

let settings = null;

async function init() {
  initAdminApp({ loadUnreadBadge: true });
  await loadSettings();
  setupForm();
}

async function loadSettings() {
  try {
    settings = await getPrayerSettings();
    renderSettings(settings);
  } catch (err) {
    showToast('Failed to load prayer settings: ' + err.message, 'error');
  }
}

function renderSettings(data) {
  if (!data) return;

  const timeDisplay = document.getElementById('prayer-time-display');
  const timeInput   = document.getElementById('prayer-time-input');
  const enabledToggle = document.getElementById('prayer-enabled-toggle');
  const statusMsg   = document.getElementById('prayer-status-msg');

  if (timeDisplay) timeDisplay.textContent = data.prayer_time || '21:00';
  if (timeInput)   timeInput.value = data.prayer_time || '21:00';
  if (enabledToggle) {
    enabledToggle.checked = data.enabled || false;
    updateStatusMessage(data.enabled);
  }

  enabledToggle?.addEventListener('change', () => {
    updateStatusMessage(enabledToggle.checked);
  });

  timeInput?.addEventListener('input', () => {
    if (timeDisplay) timeDisplay.textContent = timeInput.value || '—';
  });
}

function updateStatusMessage(enabled) {
  const statusMsg = document.getElementById('prayer-status-msg');
  if (statusMsg) {
    statusMsg.textContent = enabled ? t('prayerEnabledMsg') : t('prayerDisabledMsg');
    statusMsg.className = `stat-sub ${enabled ? 'stat-ok' : ''}`;
  }
}

function setupForm() {
  document.getElementById('prayer-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const timeInput     = document.getElementById('prayer-time-input');
    const enabledToggle = document.getElementById('prayer-enabled-toggle');
    const saveBtn       = document.getElementById('save-prayer-btn');

    if (!timeInput?.value.match(/^\d{2}:\d{2}$/)) {
      showToast('Invalid time format. Use HH:MM (e.g. 21:00)', 'error');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner"></span> ${t('saving')}`;

    try {
      const updated = await updatePrayerSettings({
        prayer_time: timeInput.value,
        enabled: enabledToggle?.checked || false,
        timezone: 'Asia/Kolkata',
      });
      settings = updated;
      renderSettings(updated);
      showToast(t('saveSettings') + ' — saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = t('saveSettings');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
