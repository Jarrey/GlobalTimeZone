// Background service worker
// Uses Chrome's native badge overlay to display the primary timezone time on the icon.
// The badge is rendered by the browser itself — larger and sharper than canvas-drawn text.

// ── Weather ───────────────────────────────────────────────────────────────────

const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function cityFromZone(zone) {
  return zone.split('/').pop().replace(/_/g, ' ');
}

async function fetchWeatherForZone(zone, apiKey) {
  const city = cityFromZone(zone);
  const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(apiKey)}&units=metric`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    return {
      icon: data.weather[0].icon,
      desc: data.weather[0].description,
      temp: Math.round(data.main.temp),
      cityId: data.id,
      cityName: data.name,
      fetchedAt: Date.now()
    };
  } catch (e) {
    return null;
  }
}

async function refreshWeather() {
  const result = await chrome.storage.sync.get(['timezones', 'weatherApiKey']);
  const apiKey = result.weatherApiKey || '';
  const timezones = result.timezones || [];
  if (!apiKey || timezones.length === 0) return;

  const existing = await chrome.storage.local.get('weatherCache');
  const cache = existing.weatherCache || {};
  const now = Date.now();
  const updated = { ...cache };

  for (const tz of timezones) {
    const cached = cache[tz.zone];
    if (cached && (now - cached.fetchedAt) < WEATHER_CACHE_TTL) continue;
    const data = await fetchWeatherForZone(tz.zone, apiKey);
    if (data) updated[tz.zone] = data;
  }

  await chrome.storage.local.set({ weatherCache: updated });
}

// ─────────────────────────────────────────────────────────────────────────────

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

// Weather refresh every 30 minutes
function scheduleWeather() {
  chrome.alarms.create('weatherRefresh', { periodInMinutes: 30 });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'tick') updateIcon();
  if (alarm.name === 'weatherRefresh') refreshWeather();
});

chrome.runtime.onInstalled.addListener(() => { updateIcon(); scheduleNextMinute(); scheduleWeather(); refreshWeather(); });
chrome.runtime.onStartup.addListener(() => { updateIcon(); scheduleNextMinute(); scheduleWeather(); refreshWeather(); });

chrome.storage.onChanged.addListener((changes) => {
  updateIcon();
  // If timezones or API key changed, refresh weather
  if (changes.timezones || changes.weatherApiKey) refreshWeather();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_BADGE') updateIcon();
  if (msg.type === 'REFRESH_WEATHER') refreshWeather();
});

// Initial call on service worker startup
updateIcon();
scheduleNextMinute();
scheduleWeather();
refreshWeather();

