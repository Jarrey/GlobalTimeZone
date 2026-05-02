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

function buildSelectOptions(selectedZone) {
  return TIMEZONE_LIST.map(t =>
    `<option value="${t.value}"${t.value === selectedZone ? ' selected' : ''}>${escHtml(t.label)}</option>`
  ).join('');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderRows() {
  tzList.innerHTML = '';
  timezones.forEach((tz, i) => {
    const row = document.createElement('div');
    row.className = 'tz-row';
    row.dataset.index = i;
    row.innerHTML = `
      <div class="drag-handle" title="拖动排序">
        <svg viewBox="0 0 24 24"><path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>
      </div>
      <div class="tz-row-content">
        <input class="tz-label-input" type="text" placeholder="显示名称" value="${escHtml(tz.label || '')}" data-i="${i}" />
        <select class="tz-zone-select" data-i="${i}">${buildSelectOptions(tz.zone)}</select>
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
  tzList.querySelectorAll('.tz-zone-select').forEach(el => {
    el.addEventListener('change', e => {
      timezones[+e.target.dataset.i].zone = e.target.value;
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
