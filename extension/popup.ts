// JobBoxOS Chrome Extension — Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  const statusEl = document.getElementById('status')!
  const fieldCountEl = document.getElementById('fieldCount')!
  const btnHighlight = document.getElementById('btnHighlight')!
  const btnFill = document.getElementById('btnFill')!
  const btnDashboard = document.getElementById('btnDashboard')!

  // Check connection to JobBoxOS
  try {
    const resp = await fetch('https://jobbox-os.vercel.app/api/health', { method: 'GET', signal: AbortSignal.timeout(5000) })
    if (resp.ok) {
      statusEl.className = 'status connected'
      statusEl.textContent = '● Connected to JobBoxOS'
    }
  } catch {
    statusEl.className = 'status disconnected'
    statusEl.textContent = '● JobBoxOS dashboard not reachable'
  }

  // Detect fields on current page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'detect' })
      fieldCountEl.textContent = String(response?.fields?.length || 0)
    } catch {
      fieldCountEl.textContent = '0'
    }
  }

  btnHighlight.addEventListener('click', async () => {
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'highlight' })
      fieldCountEl.textContent = String(response?.count || 0)
    }
  })

  btnFill.addEventListener('click', async () => {
    // Get user profile from storage and fill
    const { profile } = await chrome.storage.local.get('profile')
    if (profile && tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'fill', data: profile })
    } else {
      alert('Please set up your profile in the JobBoxOS dashboard first.')
    }
  })

  btnDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://jobbox-os.vercel.app/dashboard' })
  })
})
