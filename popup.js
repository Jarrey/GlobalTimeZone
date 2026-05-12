
// Map OWM icon code prefix to emoji
const WEATHER_EMOJI = {
  '01': '☀️',
  '02': '⛅',
  '03': '☁️',
  '04': '☁️',
  '09': '🌧️',
  '10': '🌦️',
  '11': '⛈️',
  '13': '❄️',
  '50': '🌫️',
};

function weatherEmoji(iconCode) {
  const prefix = iconCode ? iconCode.slice(0, 2) : '';
  return WEATHER_EMOJI[prefix] || '🌡️';
}

let timezones = [];
let primaryIndex = 0;
let timer = null;
let timeFormat = '24h';
let weatherCache = {};


const dstCache = new Map();

let cachedItems = null;

function getDSTInfo(tz, now) {
  const dateKey = now.toLocaleDateString('en-US', { timeZone: tz });
  const cached = dstCache.get(tz);
  if (cached && cached.date === dateKey) return cached.isDST;
  const janOffset = getOffset(tz, new Date(now.getFullYear(), 0, 1));
  const julOffset = getOffset(tz, new Date(now.getFullYear(), 6, 1));
  const isDST = janOffset !== julOffset && getOffset(tz, now) === Math.min(janOffset, julOffset);
  dstCache.set(tz, { isDST, date: dateKey });
  return isDST;
}

function formatTime(tz, now) {
  const n = now || new Date();
  try {
    const use12 = timeFormat === '12h';
    const timeStr = n.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: use12
    });
    const dateStr = n.toLocaleDateString('zh-CN', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
    const isDST = getDSTInfo(tz, n);
    return { timeStr, dateStr, isDST };
  } catch (e) {
    return { timeStr: '--:--:--', dateStr: '', isDST: false };
  }
}

function getOffset(tz, date) {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const local = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return utc - local;
}

function tzUrl(tz) {
  if (tz.tad) return `https://www.timeanddate.com/worldclock/${tz.tad}`;
  // Fallback: search page for zones without a tad value
  const city = tz.zone.split('/').pop().replace(/_/g, ' ');
  return `https://www.timeanddate.com/worldclock/results.html?query=${encodeURIComponent(city)}`;
}

function getTimeOfDay(tz) {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const hour = parseInt(timeStr.split(':')[0], 10);
    if (hour >= 6 && hour < 18) return 'day';
    return 'night';
  } catch (e) {
    return 'night';
  }
}

// Derive city display name from stored entry.
// Priority: selectedCity → match by tad in TIMEZONE_LIST → match by zone → zone string
// Return the city-only part (no UTC prefix) for use as the big display name.
function getCityDisplayName(tz) {
  let entry = null;
  if (tz.tad) entry = TZ_BY_TAD.get(tz.tad);
  if (!entry) entry = TZ_BY_VALUE.get(tz.zone);
  if (!entry) return tz.zone;
  return entry.label.replace(/^\([^)]+\)\s*/, '');
}

function getFullLabel(tz) {
  if (tz.tad) {
    const entry = TZ_BY_TAD.get(tz.tad);
    if (entry) return entry.label;
  }
  const entry = TZ_BY_VALUE.get(tz.zone);
  return entry ? entry.label : tz.zone;
}

function renderList() {
  const container = document.getElementById('timezoneList');
  container.innerHTML = '';

  if (timezones.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>
        <p>还没有添加时区</p>
        <small>点击设置按钮添加时区</small>
      </div>`;
    return;
  }

  timezones.forEach((tz, i) => {
    const { timeStr, dateStr, isDST } = formatTime(tz.zone);
    const url = tzUrl(tz);
    const dayState = getTimeOfDay(tz.zone);

    const w = weatherCache[tz.tad || tz.zone];
    const owmUrl = w ? `https://openweathermap.org/city/${w.cityId}` : '';
    const weatherHtml = w
      ? `<span class="tz-weather" title="${escapeHtml(w.desc)}" data-owm-url="${escapeHtml(owmUrl)}">
           <span>${weatherEmoji(w.icon)}</span>
           <span class="tz-weather-temp">${w.temp}°</span>
         </span>`
      : '';

    const isPrimary = i === primaryIndex;
    const item = document.createElement('div');
    item.className = `tz-item ${dayState}${isPrimary ? ' primary' : ''}`;
    item.title = 'Open timeanddate.com for this timezone';
    item.dataset.url = url;
    item.innerHTML = `
      <div class="tz-info">
        <div class="tz-city">${escapeHtml(tz.label || getCityDisplayName(tz))}</div>
        <div class="tz-label">${escapeHtml(getFullLabel(tz))}${isDST ? ' <span class="tz-dst-badge">DST</span>' : ''}</div>
      </div>
      ${weatherHtml}
      <div class="tz-time-block">
        <div class="tz-time">${timeStr}</div>
        <div class="tz-date">${dateStr}</div>
      </div>`;

    item.addEventListener('click', (e) => {
      const weatherEl = e.target.closest('[data-owm-url]');
      if (weatherEl) {
        chrome.tabs.create({ url: weatherEl.dataset.owmUrl });
        return;
      }
      chrome.tabs.create({ url });
    });

    container.appendChild(item);
    if (i < timezones.length - 1) {
      const div = document.createElement('div');
      div.className = 'divider';
      container.appendChild(div);
    }
  });
  cachedItems = container.querySelectorAll('.tz-item');
}

function tick() {
  if (!cachedItems) cachedItems = document.querySelectorAll('.tz-item');
  const now = new Date();
  timezones.forEach((tz, i) => {
    if (!cachedItems[i]) return;
    const { timeStr, dateStr, isDST } = formatTime(tz.zone, now);
    const dayState = getTimeOfDay(tz.zone);
    const item = cachedItems[i];
    item.classList.remove('day', 'dawn', 'dusk', 'night');
    item.classList.add(dayState);

    const timeEl = item.querySelector('.tz-time');
    const dateEl = item.querySelector('.tz-date');
    const labelEl = item.querySelector('.tz-label');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
    if (labelEl) labelEl.innerHTML = escapeHtml(getFullLabel(tz)) + (isDST ? ' <span class="tz-dst-badge">DST</span>' : '');
  });
}

function isWeatherCacheEntryValid(entry, now = Date.now()) {
  if (!entry || typeof entry.fetchedAt !== 'number') return false;
  return (now - entry.fetchedAt) < WEATHER_CACHE_TTL;
}

function shouldRequestWeatherRefresh() {
  if (timezones.length === 0) return false;
  const now = Date.now();
  return timezones.some((tz) => {
    const key = tz.tad || tz.zone;
    return !isWeatherCacheEntryValid(weatherCache[key], now);
  });
}

function updateWeather() {
  if (timezones.length === 0) return;
  const items = document.querySelectorAll('.tz-item');
  timezones.forEach((tz, i) => {
    if (!items[i]) return;
    const item = items[i];
    const w = weatherCache[tz.tad || tz.zone];
    const weatherEl = item.querySelector('.tz-weather');
    if (w) {
      const owmUrl = `https://openweathermap.org/city/${w.cityId}`;
      const html = `<span>${weatherEmoji(w.icon)}</span><span class="tz-weather-temp">${w.temp}°</span>`;
      if (weatherEl) {
        weatherEl.title = w.desc;
        weatherEl.dataset.owmUrl = owmUrl;
        weatherEl.innerHTML = html;
      } else {
        const span = document.createElement('span');
        span.className = 'tz-weather';
        span.title = w.desc;
        span.dataset.owmUrl = owmUrl;
        span.innerHTML = html;
        const timeBlock = item.querySelector('.tz-time-block');
        if (timeBlock) timeBlock.before(span);
      }
    } else if (weatherEl) {
      weatherEl.remove();
    }
  });
}

chrome.storage.sync.get(['timezones', 'timeFormat', 'primaryIndex'], (result) => {
  timezones = result.timezones || [];
  timeFormat = result.timeFormat || '24h';
  primaryIndex = result.primaryIndex ?? 0;
  chrome.storage.local.get('weatherCache', (local) => {
    weatherCache = local.weatherCache || {};
    renderList();
    timer = setInterval(tick, 1000);
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' }).catch(err => console.warn('UPDATE_BADGE:', err));
    if (shouldRequestWeatherRefresh()) {
      chrome.runtime.sendMessage({ type: 'REFRESH_WEATHER' }).catch(err => console.warn('REFRESH_WEATHER:', err));
    }
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.timezones || changes.timeFormat || changes.primaryIndex) {
      if (changes.timezones) timezones = changes.timezones.newValue || [];
      if (changes.timeFormat) timeFormat = changes.timeFormat.newValue || '24h';
      if (changes.primaryIndex) primaryIndex = changes.primaryIndex.newValue ?? 0;
      renderList();
    }
  }
  if (area === 'local' && changes.weatherCache) {
    weatherCache = changes.weatherCache.newValue || {};
    if (timezones.length > 0) updateWeather();
  }
});
