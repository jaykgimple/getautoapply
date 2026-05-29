// GetAutoApply Extension — Service Worker
import { getUserData as fetchUserData } from './api.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getUserData') {
    chrome.storage.local.get(['gaUserData'], (result) => {
      sendResponse({ userData: result.gaUserData || null });
    });
    return true;
  }

  if (message.action === 'saveJob') {
    chrome.storage.local.get(['gaToken'], async (result) => {
      if (!result.gaToken) {
        sendResponse({ error: 'Not signed in to GetAutoApply' });
        return;
      }
      try {
        const res = await fetch('https://getautoapply.vercel.app/api/jobs/search/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.gaToken}`,
          },
          body: JSON.stringify(message.jobData),
        });
        const data = await res.json();
        sendResponse({ success: res.ok, data });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    });
    return true;
  }

  if (message.action === 'openDashboard') {
    chrome.tabs.create({ url: 'https://getautoapply.vercel.app/dashboard' });
  }
});

// Context menu: save job
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus?.create({
    id: 'ga-save-job',
    title: 'Save job to GetAutoApply',
    contexts: ['page'],
  });
});

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'ga-save-job' && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: 'save' });
  }
});
