let timezones = [];
let primaryIndex = 0;
let timeFormat = '24h';
let weatherApiKey = '';

const tzList = document.getElementById('tzList');
const addTzBtn = document.getElementById('addTzBtn');
const saveBtn = document.getElementById('saveBtn');
const saveMsg = document.getElementById('saveMsg');
const timeFormatInputs = document.querySelectorAll('input[name="timeFormat"]');
const weatherApiKeyInput = document.getElementById('weatherApiKey');
const weatherStatusEl = document.getElementById('weatherStatus');

const DEFAULT_TZ = [
  { zone: 'Asia/Shanghai',       label: '北京' },
  { zone: 'America/New_York',    label: '纽约' },
  { zone: 'Europe/London',       label: '伦敦' },
  { zone: 'Asia/Tokyo',          label: '东京' },
];

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getLabelForZone(zone) {
  const entry = TIMEZONE_LIST.find(t => t.value === zone);
  return entry ? entry.label : zone;
}

function stripUtcPrefix(label) {
  return String(label).replace(/^\([^)]+\)\s*/, '').trim();
}

function getLabelForTimezoneEntry(tz) {
  if (tz && tz.tad) {
    const byTad = TIMEZONE_LIST.find(t => t.tad === tz.tad);
    if (byTad) return byTad.label;
  }

  if (tz && tz.selectedCity) {
    const selectedCity = tz.selectedCity.trim().toLowerCase();
    const byCity = TIMEZONE_LIST.find(t =>
      t.value === tz.zone && stripUtcPrefix(t.label).toLowerCase() === selectedCity
    );
    if (byCity) return byCity.label;
  }

  return getLabelForZone(tz?.zone);
}

function fuzzyFilter(query) {
  if (!query.trim()) return TIMEZONE_LIST;
  const tokens = query.trim().toLowerCase().split(/\s+/);
  return TIMEZONE_LIST.filter(item => {
    const text = item.label.toLowerCase() + ' ' + item.value.toLowerCase();
    return tokens.every(token => text.includes(token));
  });
}

function renderRows() {
  tzList.innerHTML = '';
  timezones.forEach((tz, i) => {
    const selectedLabel = getLabelForTimezoneEntry(tz);
    const row = document.createElement('div');
    row.className = 'tz-row';
    row.dataset.index = i;
    row.innerHTML = `
      <div class="drag-handle" title="拖动排序">
        <svg viewBox="0 0 24 24"><path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>
      </div>
      <div class="tz-row-content">
        <input class="tz-label-input" type="text" placeholder="显示名称" value="${escHtml(tz.label || '')}" data-i="${i}" />
        <div class="tz-zone-picker">
          <input class="tz-zone-search" type="text" placeholder="搜索时区城市…"
            value="${escHtml(selectedLabel)}" autocomplete="off" data-i="${i}"
            data-selected-label="${escHtml(selectedLabel)}" />
          <div class="tz-zone-dropdown hidden"></div>
        </div>
      </div>
      <button class="tz-badge-primary${i === primaryIndex ? ' active' : ''}" data-i="${i}" title="设为图标栏主显示时区">
        ${i === primaryIndex ? '★ 主显示' : '设为主显示'}
      </button>
      <button class="del-btn" data-i="${i}" title="删除">
        <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>`;
    tzList.appendChild(row);
  });

  // Bind events
  tzList.querySelectorAll('.tz-label-input').forEach(el => {
    el.addEventListener('input', e => {
      timezones[+e.target.dataset.i].label = e.target.value;
    });
  });
  tzList.querySelectorAll('.tz-zone-search').forEach(input => {
    const idx = +input.dataset.i;
    const dropdown = input.closest('.tz-zone-picker').querySelector('.tz-zone-dropdown');

    function populateDropdown(query) {
      const results = fuzzyFilter(query);
      if (results.length === 0) {
        dropdown.innerHTML = '<div class="tz-zone-no-results">无匹配结果</div>';
        return;
      }
      const selectedLabel = input.dataset.selectedLabel || '';
      dropdown.innerHTML = results.map(t =>
        `<div class="tz-zone-option${t.value === timezones[idx].zone && t.label === selectedLabel ? ' active' : ''}" data-value="${escHtml(t.value)}" data-label="${escHtml(t.label)}" data-tad="${escHtml(t.tad || '')}">${escHtml(t.label)}</div>`
      ).join('');
      dropdown.querySelectorAll('.tz-zone-option').forEach(opt => {
        opt.addEventListener('mousedown', e => {
          e.preventDefault();
          timezones[idx].zone         = opt.dataset.value;
          timezones[idx].tad          = opt.dataset.tad;
          timezones[idx].selectedCity = opt.dataset.label.replace(/^\([^)]+\)\s*/, '');
          input.value = opt.dataset.label;
          input.dataset.selectedLabel = opt.dataset.label;
          dropdown.classList.add('hidden');
        });
      });
    }

    input.addEventListener('focus', () => {
      populateDropdown('');
      dropdown.classList.remove('hidden');
      input.select();
    });

    input.addEventListener('input', () => {
      populateDropdown(input.value);
      dropdown.classList.remove('hidden');
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        dropdown.classList.add('hidden');
        input.value = input.dataset.selectedLabel || getLabelForZone(timezones[idx].zone);
      }, 150);
    });

    input.addEventListener('keydown', e => {
      const opts = Array.from(dropdown.querySelectorAll('.tz-zone-option'));
      const activeIdx = opts.findIndex(o => o.classList.contains('active'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = activeIdx < opts.length - 1 ? activeIdx + 1 : 0;
        opts.forEach(o => o.classList.remove('active'));
        opts[next]?.classList.add('active');
        opts[next]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = activeIdx > 0 ? activeIdx - 1 : opts.length - 1;
        opts.forEach(o => o.classList.remove('active'));
        opts[prev]?.classList.add('active');
        opts[prev]?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = dropdown.querySelector('.tz-zone-option.active');
        if (active) {
          timezones[idx].zone         = active.dataset.value;
          timezones[idx].tad          = active.dataset.tad;
          timezones[idx].selectedCity = active.dataset.label.replace(/^\([^)]+\)\s*/, '');
          input.value = active.dataset.label;
          input.dataset.selectedLabel = active.dataset.label;
          dropdown.classList.add('hidden');
        }
      } else if (e.key === 'Escape') {
        dropdown.classList.add('hidden');
        input.value = input.dataset.selectedLabel || getLabelForZone(timezones[idx].zone);
      }
    });
  });
  tzList.querySelectorAll('.tz-badge-primary').forEach(el => {
    el.addEventListener('click', e => {
      primaryIndex = +e.currentTarget.dataset.i;
      renderRows();
    });
  });
  tzList.querySelectorAll('.del-btn').forEach(el => {
    el.addEventListener('click', e => {
      const idx = +e.currentTarget.dataset.i;
      timezones.splice(idx, 1);
      if (primaryIndex >= timezones.length) primaryIndex = Math.max(0, timezones.length - 1);
      renderRows();
    });
  });

  // Drag-and-drop reorder
  initDrag();
}

// Simple drag-and-drop (no external lib)
let dragSrc = null;

function initDrag() {
  const rows = tzList.querySelectorAll('.tz-row');
  rows.forEach(row => {
    row.setAttribute('draggable', 'true');
    row.addEventListener('dragstart', e => {
      dragSrc = row;
      row.classList.add('sortable-chosen');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      rows.forEach(r => r.classList.remove('sortable-ghost', 'sortable-chosen'));
      dragSrc = null;
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      if (row !== dragSrc) row.classList.add('sortable-ghost');
    });
    row.addEventListener('dragleave', () => row.classList.remove('sortable-ghost'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      if (row === dragSrc) return;
      const srcIdx = +dragSrc.dataset.index;
      const dstIdx = +row.dataset.index;
      const [moved] = timezones.splice(srcIdx, 1);
      timezones.splice(dstIdx, 0, moved);
      if (primaryIndex === srcIdx) primaryIndex = dstIdx;
      else if (srcIdx < primaryIndex && dstIdx >= primaryIndex) primaryIndex--;
      else if (srcIdx > primaryIndex && dstIdx <= primaryIndex) primaryIndex++;
      renderRows();
    });
  });
}

addTzBtn.addEventListener('click', () => {
  timezones.push({ zone: 'Asia/Shanghai', label: '' });
  renderRows();
  // scroll to bottom
  tzList.lastElementChild && tzList.lastElementChild.scrollIntoView({ behavior: 'smooth' });
});

timeFormatInputs.forEach(input => {
  input.addEventListener('change', e => {
    timeFormat = e.target.value;
  });
});

saveBtn.addEventListener('click', () => {
  weatherApiKey = weatherApiKeyInput.value.trim();
  chrome.storage.sync.set({ timezones, primaryIndex, timeFormat, weatherApiKey }, () => {
    saveMsg.classList.add('show');
    setTimeout(() => saveMsg.classList.remove('show'), 2000);
    // Notify background to update badge and weather
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' }).catch(() => {});
    chrome.runtime.sendMessage({ type: 'REFRESH_WEATHER' }).catch(() => {});
  });
});

// Load saved data
chrome.storage.sync.get(['timezones', 'primaryIndex', 'timeFormat', 'weatherApiKey'], result => {
  timezones = result.timezones || DEFAULT_TZ;
  primaryIndex = result.primaryIndex || 0;
  timeFormat = result.timeFormat || '24h';
  weatherApiKey = result.weatherApiKey || '';
  const activeInput = document.querySelector(`input[name="timeFormat"][value="${timeFormat}"]`);
  if (activeInput) activeInput.checked = true;
  if (weatherApiKeyInput) weatherApiKeyInput.value = weatherApiKey;
  if (weatherApiKey && weatherStatusEl) {
    weatherStatusEl.textContent = 'API key set — weather data will refresh automatically.';
  }
  renderRows();
});
