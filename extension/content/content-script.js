// GetAutoApply Auto-Fill Content Script
// Detects job application forms and auto-fills them with user data

(function() {
  'use strict';

  // Prevent double-injection
  if (window.__getautoapply_injected) return;
  window.__getautoapply_injected = true;

  // ─── Field Detection Patterns ───
  const FIELD_PATTERNS = {
    firstName: [
      /first[_\s-]?name/i, /fname/i, /given[_\s-]?name/i, /forename/i,
      /name.*first/i, /first.*name/i
    ],
    lastName: [
      /last[_\s-]?name/i, /lname/i, /surname/i, /family[_\s-]?name/i,
      /name.*last/i, /last.*name/i
    ],
    fullName: [
      /full[_\s-]?name/i, /your[_\s-]?name/i, /name$/i, /^name$/i,
      /complete[_\s-]?name/i
    ],
    email: [
      /e[_\s-]?mail/i, /email[_\s-]?address/i, /contact[_\s-]?email/i
    ],
    phone: [
      /phone/i, /mobile/i, /cell/i, /telephone/i, /contact[_\s-]?number/i
    ],
    city: [
      /city/i, /town/i, /location.*city/i
    ],
    state: [
      /state/i, /province/i, /region/i
    ],
    zipCode: [
      /zip/i, /postal/i, /postcode/i, /zipcode/i
    ],
    country: [
      /country/i, /nation/i
    ],
    linkedin: [
      /linkedin/i, /linked[_\s-]?in/i
    ],
    website: [
      /website/i, /portfolio/i, /personal[_\s-]?site/i, /github/i
    ],
    coverLetter: [
      /cover[_\s-]?letter/i, /why.*(you|this)/i, /tell.*us.*about/i,
      /additional[_\s-]?info/i, /comments/i
    ],
    resume: [
      /resume/i, /cv/i, /curriculum/i, /upload[_\s-]?resume/i,
      /attach[_\s-]?resume/i, /cv[_\s-]?upload/i
    ],
    experience: [
      /experience/i, /work[_\s-]?history/i, /employment/i
    ],
    education: [
      /education/i, /school/i, /university/i, /college/i, /degree/i
    ],
    salary: [
      /salary/i, /compensation/i, /pay/i, /expected[_\s-]?salary/i,
      /desired[_\s-]?salary/i, /ctc/i
    ],
    startDate: [
      /start[_\s-]?date/i, /available[_\s-]?date/i, /notice[_\s-]?period/i,
      /when.*start/i
    ],
    authorization: [
      /authorized/i, /work[_\s-]?authorization/i, /legally/i,
      /sponsorship/i, /visa/i
    ]
  };

  // ─── Detect Site ───
  function detectSite() {
    const host = window.location.hostname;
    if (host.includes('linkedin.com')) return 'linkedin';
    if (host.includes('indeed.com')) return 'indeed';
    if (host.includes('greenhouse.io')) return 'greenhouse';
    if (host.includes('lever.co')) return 'lever';
    if (host.includes('workday') || host.includes('myworkdayjobs')) return 'workday';
    if (host.includes('smartrecruiters')) return 'smartrecruiters';
    if (host.includes('icims.com')) return 'icims';
    if (host.includes('taleo.net')) return 'taleo';
    if (host.includes('ashbyhq.com')) return 'ashby';
    if (host.includes('applytojob.com')) return 'applytojob';
    return 'generic';
  }

  // ─── Score a Field ───
  function scoreField(input, patterns) {
    const texts = [
      input.name || '',
      input.id || '',
      input.placeholder || '',
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-field') || '',
      input.className || '',
      input.getAttribute('autocomplete') || '',
    ];

    // Check associated label
    const labels = getLabels(input);
    texts.push(...labels);

    let score = 0;
    for (const pattern of patterns) {
      for (const text of texts) {
        if (pattern.test(text)) {
          score += text === input.name ? 3 : text === input.id ? 3 : 1;
        }
      }
    }
    return score;
  }

  function getLabels(input) {
    const labels = [];
    // by id
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) labels.push(label.textContent || '');
    }
    // by wrapping label
    const parentLabel = input.closest('label');
    if (parentLabel) labels.push(parentLabel.textContent || '');
    // by aria-labelledby
    if (input.getAttribute('aria-labelledby')) {
      const ref = document.getElementById(input.getAttribute('aria-labelledby'));
      if (ref) labels.push(ref.textContent || '');
    }
    return labels;
  }

  // ─── Find All Fillable Fields ───
  function findFillableFields() {
    const inputs = document.querySelectorAll(
      'input[type="text"], input[type="email"], input[type="tel"], input[type="url"],' +
      'input:not([type]), textarea, select'
    );
    const fields = [];

    for (const input of inputs) {
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'checkbox' || input.type === 'radio') continue;
      if (input.offsetParent === null && input.type !== 'file') continue; // skip hidden

      let bestMatch = null;
      let bestScore = 0;

      for (const [fieldName, patterns] of Object.entries(FIELD_PATTERNS)) {
        const score = scoreField(input, patterns);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = fieldName;
        }
      }

      if (bestMatch && bestScore >= 2) {
        fields.push({ input, fieldName: bestMatch, score: bestScore, site: detectSite() });
      }
    }

    return fields;
  }

  // ─── Fill Fields ───
  function fillFields(userData) {
    const fields = findFillableFields();
    const results = { filled: [], skipped: [] };

    for (const { input, fieldName, score } of fields) {
      let value = getFieldValue(fieldName, userData);
      if (!value) {
        results.skipped.push({ field: fieldName, reason: 'no data' });
        continue;
      }

      // Don't overwrite if field already has user-entered data (check value length)
      if (input.value && input.value.length > 2 && input.dataset.gaFilled !== 'true') {
        // But DO overwrite if it's a common default
        const defaults = ['n/a', 'na', 'none', 'no', '0'];
        if (!defaults.includes(input.value.toLowerCase().trim())) {
          results.skipped.push({ field: fieldName, reason: 'already filled' });
          continue;
        }
      }

      fillInput(input, value);
      input.dataset.gaFilled = 'true';
      results.filled.push({ field: fieldName, selector: input.name || input.id || input.placeholder });
    }

    return results;
  }

  function getFieldValue(fieldName, userData) {
    const nameParts = (userData.fullName || '').split(' ');
    const mapping = {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      fullName: userData.fullName || '',
      email: userData.email || '',
      phone: userData.phone || '',
      city: userData.city || '',
      state: userData.state || '',
      zipCode: userData.zipCode || '',
      country: userData.country || 'United States',
      linkedin: userData.linkedin || '',
      website: userData.website || userData.github || '',
      salary: userData.salary || '',
      startDate: userData.startDate || 'Immediately',
      authorization: userData.workAuthorization ? 'Yes' : '',
      coverLetter: userData.coverLetter || '',
    };
    return mapping[fieldName] || '';
  }

  function fillInput(input, value) {
    if (input.tagName === 'SELECT') {
      // Try to find matching option
      const options = Array.from(input.options);
      const match = options.find(o =>
        o.value.toLowerCase().includes(value.toLowerCase()) ||
        o.text.toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        input.value = match.value;
      }
    } else {
      input.value = value;
    }

    // Dispatch events to trigger framework React/Vue/Angular detection
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    // React-specific: trigger the internal setter
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ─── Create Floating Action Button ───
  function createFAB() {
    if (document.getElementById('ga-autofill-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'ga-autofill-fab';
    fab.innerHTML = `
      <div class="ga-fab-button" title="Auto-fill application (GetAutoApply)">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="ga-fab-menu" id="ga-fab-menu">
        <div class="ga-fab-menu-item" data-action="fill">✦ Auto-Fill Form</div>
        <div class="ga-fab-menu-item" data-action="save">💾 Save This Job</div>
        <div class="ga-fab-menu-item" data-action="open">🔗 Open Dashboard</div>
      </div>
    `;

    document.body.appendChild(fab);

    const button = fab.querySelector('.ga-fab-button');
    const menu = fab.querySelector('.ga-fab-menu');

    button.addEventListener('click', () => {
      menu.classList.toggle('ga-menu-visible');
    });

    menu.querySelectorAll('.ga-fab-menu-item').forEach(item => {
      item.addEventListener('click', async () => {
        const action = item.dataset.action;
        if (action === 'fill') {
          const userData = await getUserData();
          if (!userData) {
            showToast('⚠ Sign in to GetAutoApply first');
            return;
          }
          const results = fillFields(userData);
          showToast(`✦ Filled ${results.filled.length} fields${results.skipped.length ? `, ${results.skipped.length} skipped` : ''}`);
        } else if (action === 'save') {
          saveCurrentJob();
        } else if (action === 'open') {
          chrome.runtime.sendMessage({ action: 'openDashboard' });
        }
        menu.classList.remove('ga-menu-visible');
      });
    });
  }

  // ─── User Data ───
  function getUserData() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getUserData' }, (response) => {
        resolve(response?.userData || null);
      });
    });
  }

  // ─── Save Current Job ───
  function saveCurrentJob() {
    const jobData = extractJobData();
    chrome.runtime.sendMessage({ action: 'saveJob', jobData }, (response) => {
      if (response?.success) {
        showToast('✓ Job saved to GetAutoApply');
      } else if (response?.error) {
        showToast(`⚠ ${response.error}`);
      } else {
        showToast('⚠ Sign in to save jobs');
      }
    });
  }

  function extractJobData() {
    const title =
      document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('[class*="title"]')?.textContent?.trim() ||
      document.querySelector('[class*="headline"]')?.textContent?.trim() ||
      '';

    const company =
      document.querySelector('[class*="company"]')?.textContent?.trim() ||
      document.querySelector('[class*="employer"]')?.textContent?.trim() ||
      '';

    const location =
      document.querySelector('[class*="location"]')?.textContent?.trim() ||
      '';

    const description =
      document.querySelector('[class*="description"]')?.textContent?.trim() ||
      document.querySelector('[class*="details"]')?.textContent?.trim() ||
      '';

    const url = window.location.href;

    return { title, company, location, description, url, source: detectSite() };
  }

  // ─── Toast Notifications ───
  function showToast(message) {
    const existing = document.getElementById('ga-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ga-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ─── Initialize ───
  function init() {
    // Only show FAB on job/application pages
    const isJobPage = /jobs?\/|apply|career|opportunity|position/i.test(window.location.pathname);
    if (isJobPage) {
      createFAB();
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'autofill') {
        getUserData().then(userData => {
          if (!userData) {
            sendResponse({ error: 'Not signed in' });
            return;
          }
          const results = fillFields(userData);
          sendResponse(results);
        });
        return true; // async
      }
      if (message.action === 'detectFields') {
        const fields = findFillableFields();
        sendResponse({ fields: fields.map(f => ({ field: f.fieldName, score: f.score, site: f.site })) });
        return true;
      }
    });
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
