// Background service worker
// Uses Chrome's native badge overlay to display the primary timezone time on the icon.
// The badge is rendered by the browser itself — larger and sharper than canvas-drawn text.

// ── Weather ───────────────────────────────────────────────────────────────────

const WEATHER_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Derive a city name for OpenWeather queries.
// Accepts either a zone string like 'Asia/Shanghai' or a timezone entry object
// with a `label` like '(UTC+08:00) Beijing / 北京'. Prefer the English city
// from the label when available, falling back to the zone last segment.
function cityFromZone(zoneOrEntry) {
  if (typeof zoneOrEntry === 'object') {
    // tad is like 'china/beijing' — city segment is the most accurate OWM query
    if (zoneOrEntry.tad) {
      return zoneOrEntry.tad.split('/').pop().replace(/-/g, ' ');
    }
    // Fallback: extract English city from TIMEZONE_LIST label stored in selectedCity
    if (zoneOrEntry.selectedCity) return zoneOrEntry.selectedCity.split(' / ')[0].trim();
    // Last resort: user custom label may contain a city name
    if (zoneOrEntry.label) {
      const m = zoneOrEntry.label.match(/\)\s*([^\/\(]+)/);
      if (m && m[1]) return m[1].trim();
    }
  }
  const zone = typeof zoneOrEntry === 'string' ? zoneOrEntry : zoneOrEntry.zone;
  return zone.split('/').pop().replace(/_/g, ' ');
}

async function fetchWeatherForZone(zoneOrEntry, apiKey) {
  const city = cityFromZone(zoneOrEntry);
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

async function refreshWeather(force = false) {
  const [{ timezones }, { weatherApiKey, weatherCache: existingCache }] =
    await Promise.all([
      chrome.storage.sync.get('timezones'),
      chrome.storage.local.get(['weatherApiKey', 'weatherCache'])
    ]);
  const apiKey = weatherApiKey || '';
  const allTimezones = timezones || [];
  const cache = existingCache || {};
  const now = Date.now();
  const updated = {};

  if (allTimezones.length === 0) {
    await chrome.storage.local.set({ weatherCache: updated });
    return;
  }

  if (!apiKey) {
    for (const tz of allTimezones) {
      const key = tz.tad || tz.zone;
      if (cache[key]) updated[key] = cache[key];
    }
    await chrome.storage.local.set({ weatherCache: updated });
    return;
  }

  const tasks = allTimezones.map(async (tz) => {
    const key = tz.tad || tz.zone;
    const cached = cache[key];
    if (!force && cached && (now - cached.fetchedAt) < WEATHER_CACHE_TTL) {
      updated[key] = cached;
      return;
    }
    const data = await fetchWeatherForZone(tz, apiKey);
    if (data) {
      updated[key] = data;
    } else if (cached) {
      updated[key] = cached;
    }
  });
  await Promise.allSettled(tasks);

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
  if (alarm.name === 'weatherRefresh') refreshWeather(true);
});

chrome.runtime.onInstalled.addListener(() => { updateIcon(); scheduleNextMinute(); scheduleWeather(); refreshWeather(); });
chrome.runtime.onStartup.addListener(() => { updateIcon(); scheduleNextMinute(); scheduleWeather(); refreshWeather(); });

chrome.storage.onChanged.addListener((changes, area) => {
  if (changes.timezones || changes.timeFormat || changes.primaryIndex) {
    updateIcon();
  }
  if (changes.timezones || changes.weatherApiKey) {
    refreshWeather(true);
  }
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'UPDATE_BADGE') updateIcon();
  if (msg.type === 'REFRESH_WEATHER') {
    refreshWeather(Boolean(msg.force)).catch(err => console.warn('REFRESH_WEATHER:', err));
  }
});



