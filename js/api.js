/**
 * Daily Bread — Admin App — API Client
 * REST API client for administrative operations (no authentication tokens).
 */

import { BASE_URL } from './config.js';

const TIMEOUT_MS = 12000;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Standard fetch wrapper for admin requests.
 */
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({ success: false, message: `HTTP ${response.status}` }));

    if (!response.ok) {
      throw new ApiError(data.message || data.error || `HTTP ${response.status}`, response.status);
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') throw new ApiError('Request timed out.', 0);
    if (err instanceof ApiError) throw err;
    throw new ApiError('Unable to connect to server.', 0);
  }
}

// ─── Dashboard ────────────────────────────────────────────────
export async function getDashboardData() {
  const [messagesRes, counsellingCountsRes, prayerRes] = await Promise.allSettled([
    apiFetch('/api/admin/messages'),
    apiFetch('/api/admin/counselling/counts'),
    apiFetch('/api/admin/prayer-settings'),
  ]);

  return {
    messages: messagesRes.status === 'fulfilled' ? (messagesRes.value.data || []) : [],
    counsellingCounts: counsellingCountsRes.status === 'fulfilled' ? counsellingCountsRes.value.data : null,
    prayerSettings: prayerRes.status === 'fulfilled' ? prayerRes.value.data : null,
  };
}

// ─── Messages ─────────────────────────────────────────────────
export async function getMessages() {
  const res = await apiFetch('/api/admin/messages');
  return res.data || [];
}

export async function getMessage(id) {
  const res = await apiFetch(`/api/admin/messages/${id}`);
  return res.data;
}

export async function createMessage(data) {
  const res = await apiFetch('/api/admin/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateMessage(id, data) {
  const res = await apiFetch(`/api/admin/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteMessage(id) {
  await apiFetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
}

export async function togglePublish(id, isPublished) {
  const res = await apiFetch(`/api/admin/messages/${id}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ is_published: isPublished, isPublished }),
  });
  return res.data;
}

// ─── Counselling ──────────────────────────────────────────────
export async function getCounselling(filter = 'all', page = 1) {
  const res = await apiFetch(`/api/admin/counselling?filter=${filter}&page=${page}&limit=20`);
  return res.data;
}

export async function getCounsellingItem(id) {
  const res = await apiFetch(`/api/admin/counselling/${id}`);
  return res.data;
}

export async function markCounsellingViewed(id) {
  const res = await apiFetch(`/api/admin/counselling/${id}/viewed`, { method: 'PATCH' });
  return res.data;
}

export async function getCounsellingCounts() {
  const res = await apiFetch('/api/admin/counselling/counts');
  return res.data;
}

// ─── Prayer ───────────────────────────────────────────────────
export async function getPrayerSettings() {
  const res = await apiFetch('/api/admin/prayer-settings');
  return res.data;
}

export async function updatePrayerSettings(data) {
  const res = await apiFetch('/api/admin/prayer-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return res.data;
}

export { ApiError };
