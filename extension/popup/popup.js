// GetAutoApply Extension — Popup Script
document.addEventListener('DOMContentLoaded', async () => {
  const els = {
    authStatus: document.getElementById('auth-status'),
    btnAutofill: document.getElementById('btn-autofill'),
    btnDetect: document.getElementById('btn-detect'),
    btnSave: document.getElementById('btn-save'),
    btnDashboard: document.getElementById('btn-dashboard'),
    results: document.getElementById('results'),
    fieldsSection: document.getElementById('fields-section'),
    fieldsList: document.getElementById('fields-list'),
  };

  // Check auth
  const { gaToken, gaUser } = await chrome.storage.local.get(['gaToken', 'gaUser']);
  if (gaUser) {
    els.authStatus.textContent = `✓ Signed in as ${gaUser}`;
    els.authStatus.classList.add('connected');
    els.btnAutofill.disabled = false;
    els.btnDetect.disabled = false;
  } else {
    els.authStatus.textContent = '⚠ Not signed in — open GetAutoApply to sign in';
  }

  function showResult(msg, type = 'success') {
    els.results.innerHTML = `<div class="result-msg ${type}">${msg}</div>`;
    setTimeout(() => { els.results.innerHTML = ''; }, 5000);
  }

  // Auto-fill
  els.btnAutofill.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    els.btnAutofill.disabled = true;
    els.btnAutofill.textContent = '✦ Filling...';

    chrome.tabs.sendMessage(tab.id, { action: 'autofill' }, (response) => {
      els.btnAutofill.disabled = false;
      els.btnAutofill.textContent = '✦ Auto-Fill Application';

      if (response?.error) {
        showResult(`⚠ ${response.error}`, 'error');
      } else if (response?.filled) {
        showResult(`✓ Filled ${response.filled.length} fields`, 'success');
      } else {
        showResult('No fillable fields detected on this page', 'error');
      }
    });
  });

  // Detect fields
  els.btnDetect.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'detectFields' }, (response) => {
      if (response?.fields?.length > 0) {
        els.fieldsSection.style.display = 'block';
        els.fieldsList.innerHTML = response.fields
          .sort((a, b) => b.score - a.score)
          .slice(0, 12)
          .map(f => `
            <div class="field-count">
              <span class="label">${f.field}</span>
              <span class="value">${f.site} · score ${f.score}</span>
            </div>
          `).join('');
      } else {
        els.fieldsSection.style.display = 'block';
        els.fieldsList.innerHTML = '<div class="field-count"><span class="label">No fields detected</span></div>';
      }
    });
  });

  // Save job
  els.btnSave.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    chrome.tabs.sendMessage(tab.id, { action: 'save' });
    showResult('Saving job...', 'success');
  });

  // Open dashboard
  els.btnDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://getautoapply.vercel.app/dashboard' });
  });
});
