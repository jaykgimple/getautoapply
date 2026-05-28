// JobBoxOS Chrome Extension — Content Script
// Detects job application forms and highlights fillable fields

interface FieldMapping {
  selector: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'file' | 'date'
  label: string
  jobboxField: string
}

const FIELD_MAPPINGS: FieldMapping[] = [
  { selector: 'input[type="text"]', type: 'text', label: 'Text Input', jobboxField: 'text' },
  { selector: 'input[type="email"]', type: 'email', label: 'Email', jobboxField: 'email' },
  { selector: 'input[type="tel"]', type: 'tel', label: 'Phone', jobboxField: 'phone' },
  { selector: 'textarea', type: 'textarea', label: 'Textarea', jobboxField: 'textarea' },
  { selector: 'select', type: 'select', label: 'Dropdown', jobboxField: 'select' },
  { selector: 'input[type="file"]', type: 'file', label: 'File Upload', jobboxField: 'file' },
  { selector: 'input[type="date"]', type: 'date', label: 'Date', jobboxField: 'date' },
]

const HIGHLIGHT_COLOR = '#f97316' // orange-500
const HIGHLIGHT_BG = 'rgba(249, 115, 22, 0.08)'

let highlighted = false

function highlightFields() {
  if (highlighted) return
  highlighted = true

  FIELD_MAPPINGS.forEach(mapping => {
    const elements = document.querySelectorAll(mapping.selector) as NodeListOf<HTMLElement>
    elements.forEach(el => {
      // Skip hidden elements
      if (el.offsetParent === null && el.type !== 'hidden') return

      el.style.outline = `2px solid ${HIGHLIGHT_COLOR}`
      el.style.outlineOffset = '2px'
      el.style.backgroundColor = HIGHLIGHT_BG
      el.dataset.jobboxHighlighted = 'true'
      el.dataset.jobboxType = mapping.jobboxField

      // Add hover tooltip
      el.addEventListener('mouseenter', showTooltip)
      el.addEventListener('mouseleave', hideTooltip)
    })
  })

  console.log(`[JobBoxOS] Highlighted ${document.querySelectorAll('[data-jobbox-highlighted]').length} form fields`)
}

function showTooltip(e: Event) {
  const el = e.target as HTMLElement
  const tooltip = document.createElement('div')
  tooltip.id = 'jobbox-tooltip'
  tooltip.textContent = `JobBoxOS: ${el.dataset.jobboxType} field`
  tooltip.style.cssText = `
    position: absolute; z-index: 99999; background: #1f2937; color: white;
    padding: 4px 8px; border-radius: 4px; font-size: 11px; pointer-events: none;
    top: -28px; left: 0; white-space: nowrap;
  `
  el.style.position = el.style.position || 'relative'
  el.appendChild(tooltip)
}

function hideTooltip() {
  const tooltip = document.getElementById('jobbox-tooltip')
  if (tooltip) tooltip.remove()
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'highlight') {
    highlightFields()
    sendResponse({ count: document.querySelectorAll('[data-jobbox-highlighted]').length })
  }

  if (msg.action === 'fill' && msg.data) {
    fillFields(msg.data)
    sendResponse({ filled: true })
  }

  if (msg.action === 'detect') {
    const fields = detectFields()
    sendResponse({ fields, url: window.location.href, title: document.title })
  }
})

function detectFields(): Array<{ type: string; name: string; id: string; label: string }> {
  const fields: Array<{ type: string; name: string; id: string; label: string }> = []

  FIELD_MAPPINGS.forEach(mapping => {
    const elements = document.querySelectorAll(mapping.selector) as NodeListOf<HTMLElement>
    elements.forEach(el => {
      const label = findLabel(el)
      fields.push({
        type: mapping.jobboxField,
        name: (el as HTMLInputElement).name || '',
        id: el.id || '',
        label,
      })
    })
  })

  return fields
}

function findLabel(el: HTMLElement): string {
  // Try to find associated label
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`)
    if (label) return label.textContent?.trim() || ''
  }
  // Try parent label
  const parentLabel = el.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim() || ''
  // Try aria-label
  return el.getAttribute('aria-label') || el.getAttribute('placeholder') || ''
}

function fillFields(data: Record<string, string>) {
  const mapping: Record<string, string[]> = {
    firstName: ['first', 'fname', 'first_name', 'first-name', 'given'],
    lastName: ['last', 'lname', 'last_name', 'last-name', 'surname', 'family'],
    email: ['email', 'e-mail', 'email_address'],
    phone: ['phone', 'telephone', 'mobile', 'cell'],
    linkedin: ['linkedin', 'linked_in', 'linkedin_url'],
    website: ['website', 'portfolio', 'personal_website'],
    city: ['city', 'location', 'address'],
  }

  Object.entries(mapping).forEach(([dataKey, keywords]) => {
    if (!data[dataKey]) return

    const inputs = document.querySelectorAll('input, textarea') as NodeListOf<HTMLInputElement>
    inputs.forEach(input => {
      const fieldName = (input.name + input.id + input.placeholder + findLabel(input)).toLowerCase()
      if (keywords.some(k => fieldName.includes(k))) {
        input.value = data[dataKey]
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.style.outline = '2px solid #22c55e'
      }
    })
  })
}

// Auto-highlight on known job board pages
const JOB_BOARD_HOSTS = ['linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'workday.com', 'smartrecruiters.com']
if (JOB_BOARD_HOSTS.some(host => window.location.hostname.includes(host))) {
  setTimeout(highlightFields, 1500)
}

console.log('[JobBoxOS] ApplyAssist content script loaded')
