
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

function formatTime(tz) {
  try {
    const now = new Date();
    const use12 = timeFormat === '12h';
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: use12
    });
    const dateStr = now.toLocaleDateString('zh-CN', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      weekday: 'short'
    });
    // Detect DST by checking offset difference between Jan and Jul
    const janOffset = getOffset(tz, new Date(now.getFullYear(), 0, 1));
    const julOffset = getOffset(tz, new Date(now.getFullYear(), 6, 1));
    const isDST = janOffset !== julOffset && getOffset(tz, now) === Math.min(janOffset, julOffset);
    return { timeStr, dateStr, isDST };
  } catch (e) {
    return { timeStr: '--:--:--', dateStr: '', isDST: false };
  }
}

function getOffset(tz, date) {
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate  = new Date(date.toLocaleString('en-US', { timeZone: tz }));
  return utcDate - tzDate;
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
  let label = null;
  if (tz.tad) {
    const entry = TIMEZONE_LIST.find(t => t.tad === tz.tad);
    if (entry) label = entry.label;
  }
  if (!label) {
    const entry = TIMEZONE_LIST.find(t => t.value === tz.zone);
    if (entry) label = entry.label;
  }
  if (!label) return tz.zone;
  // Strip UTC prefix: "(UTC+08:00) Beijing / 北京" → "Beijing / 北京"
  return label.replace(/^\([^)]+\)\s*/, '');
}

// Return the full TIMEZONE_LIST label (with UTC offset) for the secondary line.
function getFullLabel(tz) {
  if (tz.tad) {
    const entry = TIMEZONE_LIST.find(t => t.tad === tz.tad);
    if (entry) return entry.label;
  }
  const entry = TIMEZONE_LIST.find(t => t.value === tz.zone);
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

    const stateIcon = {
      day: '☀️',
      night: '🌙'
    }[dayState] || '☀️';

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
      <div class="tz-state-icon">${stateIcon}</div>
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

    if (i < timezones.length - 1) {
      container.appendChild(item);
      const div = document.createElement('div');
      div.className = 'divider';
      container.appendChild(div);
    } else {
      container.appendChild(item);
    }
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tick() {
  // Only re-render time values and time-of-day state, not the whole list
  const items = document.querySelectorAll('.tz-item');
  timezones.forEach((tz, i) => {
    if (!items[i]) return;
    const { timeStr, dateStr, isDST } = formatTime(tz.zone);
    const dayState = getTimeOfDay(tz.zone);
    items[i].classList.remove('day', 'dawn', 'dusk', 'night');
    items[i].classList.add(dayState);

    const timeEl = items[i].querySelector('.tz-time');
    const dateEl = items[i].querySelector('.tz-date');
    const labelEl = items[i].querySelector('.tz-label');
    if (timeEl) timeEl.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
    if (labelEl) labelEl.innerHTML = escapeHtml(getFullLabel(tz)) + (isDST ? ' <span class="tz-dst-badge">DST</span>' : '');
  });
}

document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(['timezones', 'timeFormat', 'primaryIndex'], (result) => {
  timezones = result.timezones || [];
  timeFormat = result.timeFormat || '24h';
  primaryIndex = result.primaryIndex ?? 0;
  // Load cached weather data before first render
  chrome.storage.local.get('weatherCache', (local) => {
    weatherCache = local.weatherCache || {};
    renderList();
    timer = setInterval(tick, 1000);
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' }).catch(() => {});
    // Trigger weather refresh; background uses TTL cache so no excessive calls
    chrome.runtime.sendMessage({ type: 'REFRESH_WEATHER' }).catch(() => {});
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  let shouldRender = false;
  if (area === 'sync') {
    if (changes.timezones) {
      timezones = changes.timezones.newValue || [];
      shouldRender = true;
    }
    if (changes.timeFormat) {
      timeFormat = changes.timeFormat.newValue || '24h';
      shouldRender = true;
    }
    if (changes.primaryIndex) {
      primaryIndex = changes.primaryIndex.newValue ?? 0;
      shouldRender = true;
    }
  }
  if (area === 'local' && changes.weatherCache) {
    weatherCache = changes.weatherCache.newValue || {};
    shouldRender = true;
  }
  if (shouldRender) renderList();
});
