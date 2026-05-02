// Background service worker
// Uses Chrome's native badge overlay to display the primary timezone time on the icon.
// The badge is rendered by the browser itself — larger and sharper than canvas-drawn text.

function getPrimaryTime() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['timezones', 'primaryIndex', 'timeFormat'], result => {
      const timezones = result.timezones || [];
      const idx = result.primaryIndex || 0;
      const tz = timezones[idx];
      const use12 = result.timeFormat === '12h';
      if (!tz) return resolve(null);
      try {
        const now = new Date();
        let timeStr = now.toLocaleTimeString('en-US', {
          timeZone: tz.zone,
          hour: use12 ? 'numeric' : '2-digit',
          minute: '2-digit',
          hour12: use12
        });
        let ampm = '';
        if (use12) {
          const match = timeStr.match(/\s*(AM|PM)$/i);
          if (match) {
            ampm = match[1];
            timeStr = timeStr.replace(/\s*(AM|PM)$/i, '');
          }
        }
        resolve({ zone: tz.zone, label: tz.label || tz.zone, timeStr, ampm });
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function updateIcon() {
  const info = await getPrimaryTime();
  if (!info) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Global Time Zone' });
    return;
  }

  // Badge overlay — rendered natively by Chrome, much larger than canvas text
  chrome.action.setBadgeText({ text: info.timeStr });           // e.g. "14:30" or "3:30"
  chrome.action.setBadgeBackgroundColor({ color: '#1e1e2e' });  // dark background
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#89b4fa' });      // blue text
  }
  const titleText = info.ampm ? `${info.label} ${info.timeStr} ${info.ampm}` : `${info.label} ${info.timeStr}`;
  chrome.action.setTitle({ title: titleText });
}

// Schedule update aligned to the top of every minute
function scheduleNextMinute() {
  const now = new Date();
  const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
  chrome.alarms.create('tick', { delayInMinutes: msToNextMinute / 60000, periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tick') updateIcon();
});

chrome.runtime.onInstalled.addListener(() => { updateIcon(); scheduleNextMinute(); });
chrome.runtime.onStartup.addListener(() => { updateIcon(); scheduleNextMinute(); });

chrome.storage.onChanged.addListener(updateIcon);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_BADGE') updateIcon();
});

// Initial call on service worker startup
updateIcon();
scheduleNextMinute();

