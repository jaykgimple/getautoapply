// GetAutoApply Extension — API helper
const API_BASE = 'https://getautoapply.vercel.app';

export async function getUserData() {
  const { gaToken } = await chrome.storage.local.get(['gaToken']);
  if (!gaToken) return null;

  try {
    const res = await fetch(`${API_BASE}/api/user/profile`, {
      headers: { 'Authorization': `Bearer ${gaToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function saveJob(jobData, token) {
  const res = await fetch(`${API_BASE}/api/jobs/search/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(jobData),
  });
  return res.ok;
}
