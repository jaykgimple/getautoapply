// JobBoxOS Chrome Extension — Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('[JobBoxOS] ApplyAssist extension installed')
})

// Context menu for quick job capture
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'captureJob',
    title: 'Capture Job to JobBoxOS',
    contexts: ['page', 'link'],
    documentUrlPatterns: [
      'https://*.linkedin.com/jobs/*',
      'https://*.indeed.com/viewjob*',
      'https://*.greenhouse.io/*',
      'https://*.lever.co/*',
    ],
  })
})

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'captureJob' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'capture' })
  }
})
