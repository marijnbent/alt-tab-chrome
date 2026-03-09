chrome.commands.onCommand.addListener((command) => {
  if (command === 'cycle-tabs' || command === 'cycle-tabs-back') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) return;

      chrome.tabs.sendMessage(activeTab.id, {
        type: 'CYCLE_TABS',
        reverse: command === 'cycle-tabs-back'
      }, () => {
        if (chrome.runtime.lastError) {
          // Some pages do not host our content script, such as Chrome internal pages.
          return;
        }
      });
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_TABS') {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const sorted = tabs
        .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        .map(t => ({
          id: t.id,
          title: t.title || t.url,
          favIconUrl: t.favIconUrl || '',
          url: t.url,
          active: t.active,
          audible: Boolean(t.audible)
        }));
      sendResponse(sorted);
    });
    return true; // keep channel open for async response
  }

  if (msg.type === 'SWITCH_TAB') {
    chrome.tabs.update(msg.tabId, { active: true });
  }
});
