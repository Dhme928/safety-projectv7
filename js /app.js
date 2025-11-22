// ===============================
// My Observations App - Core JS
// ===============================

// Simple helper: safe log (comment console line if you don't want logs)
function logDebug(...args) {
  // console.log(...args);
}

// ===============================
// CSV parsing helpers
// ===============================

function parseCSV(text) {
  const lines = [];
  let current = [];
  let value = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (insideQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          value += '"';
          i++;
        } else {
          insideQuotes = false;
        }
      } else {
        value += c;
      }
    } else {
      if (c === '"') {
        insideQuotes = true;
      } else if (c === ',') {
        current.push(value);
        value = '';
      } else if (c === '\n') {
        current.push(value);
        if (current.some(v => v !== '')) {
          lines.push(current);
        }
        current = [];
        value = '';
      } else if (c === '\r') {
      } else {
        value += c;
      }
    }
  }

  if (value !== '' || current.length) {
    current.push(value);
    if (current.some(v => v !== '')) {
      lines.push(current);
    }
  }

  if (!lines.length) {
    return { headers: [], rows: [] };
  }

  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).map(fields => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (fields[idx] || '').trim();
    });
    return obj;
  });

  return { headers, rows };
}

function normalize(str) {
  return (str || '').toString().trim().toLowerCase();
}

// ===============================
// Date helpers
// ===============================

function parseSheetDate(str) {
  if (!str) return null;

  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate());
  }

  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10) - 1;
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSameMonth(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth()
  );
}

function isWithinLastDays(dateObj, days) {
  if (!dateObj) return false;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return dateObj >= start && dateObj < end;
}

// ===============================
// Global state
// ===============================

let observations = [];
let observationsLoaded = false;
let currentObsRange = 'today';

let leaderboardRows = [];

// ===============================
// Init
// ===============================

document.addEventListener('DOMContentLoaded', function () {
  setupTabs();
  setupDarkModeFromStorage();
  setupAccordions();
  setupTools();
  setupLibrary();
  setupNews();
  setupEomAndColor();
  setupTasksForm();
  setupAddObservationButton();
  setupObservationFilters();
  loadObservations(); // also fills Home KPIs
});

// ===============================
// Tabs & navigation
// ===============================

function openTab(event, tabId) {
  const sections = document.querySelectorAll('.tab-content');
  sections.forEach(sec => sec.classList.remove('active'));

  const target = document.getElementById(tabId);
  if (target) target.classList.add('active');

  const buttons = document.querySelectorAll('.nav-button');
  buttons.forEach(btn => btn.classList.remove('active'));

  if (event && event.currentTarget && event.currentTarget.classList) {
    event.currentTarget.classList.add('active');
  }
}

function setupTabs() {
  const homeSection = document.getElementById('HomeTab');
  if (homeSection) homeSection.classList.add('active');

  const homeButton = document.querySelector('.nav-button[data-color]');
  if (homeButton) homeButton.classList.add('active');
}

// ===============================
// Dark mode
// ===============================

function toggleDarkMode() {
  const body = document.body;
  const isDark = body.classList.toggle('dark-mode');

  try {
    localStorage.setItem('safetyAppDarkMode', isDark ? '1' : '0');
  } catch (e) {}

  const icon = document.getElementById('modeIcon');
  if (icon) {
    icon.classList.remove('fa-moon', 'fa-sun');
    icon.classList.add(isDark ? 'fa-sun' : 'fa-moon');
  }
}

function setupDarkModeFromStorage() {
  let stored = null;
  try {
    stored = localStorage.getItem('safetyAppDarkMode');
  } catch (e) {}

  const body = document.body;
  if (stored === '1') {
    body.classList.add('dark-mode');
  }

  const icon = document.getElementById('modeIcon');
  if (icon) {
    const isDark = body.classList.contains('dark-mode');
    icon.classList.remove('fa-moon', 'fa-sun');
    icon.classList.add(isDark ? 'fa-sun' : 'fa-moon');
  }
}

// ===============================
// Accordions
// ===============================

function setupAccordions() {
  const accordions = document.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    acc.addEventListener('click', function () {
      this.classList.toggle('activeAcc');
      const panel = this.nextElementSibling;
      if (!panel) return;
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });
  });
}

// ===============================
// Observations data
// ===============================

function loadObservations() {
  const url = window.OBSERVATIONS_SHEET_CSV_URL;
  if (!url) {
    logDebug('OBSERVATIONS_SHEET_CSV_URL not configured');
    showObservationsEmpty(
      'No observations data loaded. Configure OBSERVATIONS_SHEET_CSV_URL in js/data.js.'
    );
    return;
  }

  fetch(url)
    .then(resp => {
      if (!resp.ok) throw new Error('Network response was not ok');
      return resp.text();
    })
    .then(text => {
      const parsed = parseCSV(text);
      observations = parsed.rows.map(row => {
        const dateObj = parseSheetDate(row['Date']);
        return Object.assign({}, row, { _parsedDate: dateObj });
      });
      observationsLoaded = true;
      updateObservationCounters();
      updateHomeFromObservations();
      applyObservationFilters();
    })
    .catch(err => {
      console.error('Error loading observations sheet:', err);
      showObservationsEmpty(
        'Unable to load observations data. Please check OBSERVATIONS_SHEET_CSV_URL.'
      );
    });
}

function showObservationsEmpty(message) {
  const empty = document.getElementById('observationsEmptyState');
  const list = document.getElementById('observationsList');
  if (list) list.innerHTML = '';
  if (empty) {
    empty.style.display = 'block';
    const p = empty.querySelector('p');
    if (p) p.textContent = message;
  }
}

// Observations tab summary
function updateObservationCounters() {
  const monthSpan = document.getElementById('obsCountMonth');
  const openSpan = document.getElementById('obsCountOpen');
  const closedSpan = document.getElementById('obsCountClosed');

  if (!observations.length) {
    if (monthSpan) monthSpan.textContent = '--';
    if (openSpan) openSpan.textContent = '--';
    if (closedSpan) closedSpan.textContent = '--';
    return;
  }

  const now = new Date();
  let monthCount = 0;
  let openCount = 0;
  let closedCount = 0;

  observations.forEach(row => {
    const dateObj = row._parsedDate;
    if (isSameMonth(dateObj, now)) {
      monthCount++;
    }

    const status = normalize(row['Report Status']);
    if (status === 'open') openCount++;
    else if (status === 'closed') closedCount++;
  });

  if (monthSpan) monthSpan.textContent = monthCount;
  if (openSpan) openSpan.textContent = openCount;
  if (closedSpan) closedSpan.textContent = closedCount;
}

// Home dashboard KPIs
function updateHomeFromObservations() {
  const observersEl = document.getElementById('homeObserversToday');
  const obsTodayEl = document.getElementById('homeObservationsToday');
  const highRiskEl = document.getElementById('homeHighRiskOpen');

  if (!observations.length) {
    if (observersEl) observersEl.textContent = '--';
    if (obsTodayEl) obsTodayEl.textContent = '--';
    if (highRiskEl) highRiskEl.textContent = '--';
    return;
  }

  const today = new Date();
  const observersSet = new Set();
  let obsToday = 0;
  let highRiskOpen = 0;

  observations.forEach(row => {
    const dateObj = row._parsedDate;
    if (isSameDay(dateObj, today)) {
      obsToday++;
      const id = (row['ID'] || '').trim();
      const name = (row['Name'] || '').trim();
      const key = id || name;
      if (key) observersSet.add(key);
    }

    const status = normalize(row['Report Status']);
    const raLevel = normalize(row['RA Level']);
    if (status === 'open' && (raLevel === 'high' || raLevel === 'high risk')) {
      highRiskOpen++;
    }
  });

  if (observersEl) observersEl.textContent = observersSet.size;
  if (obsTodayEl) obsTodayEl.textContent = obsToday;
  if (highRiskEl) highRiskEl.textContent = highRiskOpen;
}

// Filters & list rendering
function setupObservationFilters() {
  const rangeButtons = document.querySelectorAll('.obs-filter-chip');
  rangeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      rangeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentObsRange = btn.getAttribute('data-range') || 'all';
      applyObservationFilters();
    });
  });

  const riskSelect = document.getElementById('obsFilterRisk');
  const statusSelect = document.getElementById('obsFilterStatus');
  const searchInput = document.getElementById('obsSearch');

  if (riskSelect) riskSelect.addEventListener('change', applyObservationFilters);
  if (statusSelect) statusSelect.addEventListener('change', applyObservationFilters);
  if (searchInput) searchInput.addEventListener('input', applyObservationFilters);

  const openSheetButton = document.getElementById('openSheetButton');
  if (openSheetButton) {
    openSheetButton.addEventListener('click', function () {
      if (window.OBSERVATIONS_FULL_SHEET_URL) {
        window.open(window.OBSERVATIONS_FULL_SHEET_URL, '_blank');
      } else {
        alert('OBSERVATIONS_FULL_SHEET_URL not configured in js/data.js');
      }
    });
  }
}

function applyObservationFilters() {
  const list = document.getElementById('observationsList');
  const empty = document.getElementById('observationsEmptyState');
  if (!list || !empty) return;

  if (!observationsLoaded || !observations.length) {
    showObservationsEmpty('No observations data loaded yet.');
    return;
  }

  const riskSelect = document.getElementById('obsFilterRisk');
  const statusSelect = document.getElementById('obsFilterStatus');
  const searchInput = document.getElementById('obsSearch');

  const riskFilter = riskSelect ? riskSelect.value : '';
  const statusFilter = statusSelect ? statusSelect.value : '';
  const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

  const now = new Date();
  let filtered = observations.filter(row => {
    const dateObj = row._parsedDate;

    if (currentObsRange === 'today') {
      if (!isSameDay(dateObj, now)) return false;
    } else if (currentObsRange === 'week') {
      if (!isWithinLastDays(dateObj, 7)) return false;
    } else if (currentObsRange === 'month') {
      if (!isSameMonth(dateObj, now)) return false;
    }

    if (riskFilter) {
      const level = normalize(row['RA Level']);
      if (level !== riskFilter.toLowerCase()) return false;
    }

    if (statusFilter) {
      const status = normalize(row['Report Status']);
      if (status !== statusFilter.toLowerCase()) return false;
    }

    if (searchTerm) {
      const haystack = [
        row['Area'],
        row['Activity Type'],
        row['Observation Types'],
        row['Observation Class'],
        row['Description'],
        row['Name'],
        row['ID']
      ]
        .map(x => (x || '').toString().toLowerCase())
        .join(' ');
      if (!haystack.includes(searchTerm)) return false;
    }

    return true;
  });

  if (!filtered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = filtered
    .map(row => {
      const date = row['Date'] || '';
      const area = row['Area'] || 'Area N/A';
      const type =
        row['Observation Types'] ||
        row['Observation Class'] ||
        row['Activity Type'] ||
        'Observation';

      const risk = normalize(row['RA Level']);
      let riskClass = '';
      let riskLabel = row['RA Level'] || '';
      if (risk.includes('high')) riskClass = 'high';
      else if (risk.includes('medium')) riskClass = 'medium';
      else if (risk.includes('low')) riskClass = 'low';

      const status = normalize(row['Report Status']);
      let statusClass = '';
      let statusLabel = row['Report Status'] || '';
      if (status === 'open') statusClass = 'status-open';
      else if (status === 'closed') statusClass = 'status-closed';
      else if (status === 'in progress' || status === 'in-progress')
        statusClass = 'status-in-progress';

      const desc = row['Description'] || '';
      const reporterName = row['Name'] || '';
      const reporterId = row['ID'] || '';

      return `
        <div class="obs-card">
          <div class="obs-card-top">
            <span>${escapeHtml(date)}</span>
            <span>${escapeHtml(area)}</span>
          </div>
          <div class="obs-card-meta">
            <span>${escapeHtml(type)}</span>
            ${riskLabel ? `<span class="obs-badge ${riskClass}">${escapeHtml(riskLabel)}</span>` : ''}
            ${statusLabel ? `<span class="obs-badge ${statusClass}">${escapeHtml(statusLabel)}</span>` : ''}
          </div>
          ${desc ? `<div class="obs-card-meta" style="margin-top:4px;">${escapeHtml(desc)}</div>` : ''}
          ${
            reporterName || reporterId
              ? `<div class="obs-card-meta" style="margin-top:4px;">Reporter: ${escapeHtml(
                  reporterName || reporterId
                )}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');
}

// ===============================
// TBT of the day + library
// ===============================

function setupLibrary() {
  // TBT of the day & full details on Home
  try {
    const tbtArray = window.tbtData || [];
    const homeTbtContent = document.getElementById('homeTbtContent');
    const tbtPanel = document.getElementById('tbtPanel');

    if (tbtArray.length && homeTbtContent) {
      const todayIndex = new Date().getDate() % tbtArray.length;
      const item = tbtArray[todayIndex];
      const safeTitle = (item.title || '').replace(/^TBT of The Day/i, '').trim() || item.title;

      homeTbtContent.innerHTML = `
        <div style="margin-bottom:4px; font-weight:600;">${escapeHtml(safeTitle)}</div>
        <a href="${item.link}" target="_blank" rel="noopener" style="color:#16a34a; font-weight:600;">
          Open TBT document
        </a>
      `;

      if (tbtPanel) {
        tbtPanel.innerHTML = `
          <p>Today’s TBT:</p>
          <p><strong>${escapeHtml(item.title)}</strong></p>
          <p><a href="${item.link}" target="_blank" rel="noopener">Open document in Google Drive</a></p>
        `;
      }
    } else if (homeTbtContent) {
      homeTbtContent.textContent = 'No TBT data configured. Add items in js/data.js.';
    }
  } catch (e) {
    console.error('Error while setting TBT of the day:', e);
  }

  // TBT library list
  try {
    const tbtArray = window.tbtData || [];
    const tbtLib = document.getElementById('tbtLibraryList');
    if (tbtLib) {
      if (!tbtArray.length) {
        tbtLib.textContent = 'No TBT items found.';
      } else {
        tbtLib.innerHTML = tbtArray
          .map(
            item => `
          <div class="tbt-item">
            <i class="fas fa-book-open"></i>
            <a href="${item.link}" target="_blank" rel="noopener">${escapeHtml(item.title)}</a>
          </div>
        `
          )
          .join('');
      }
    }
  } catch (e) {
    console.error('Error while rendering TBT library:', e);
  }

  // JSA library
  try {
    const jsaArray = window.jsaData || [];
    const searchInput = document.getElementById('jsaSearch');
    const listContainer = document.getElementById('jsaListContainer');

    function renderJsa(items) {
      if (!listContainer) return;
      if (!items.length) {
        listContainer.textContent = 'No JSA found for this search.';
        return;
      }
      listContainer.innerHTML = items
        .map(
          item => `
        <a class="jsa-item" href="${item.link}" target="_blank" rel="noopener">
          <i class="fas fa-file-alt"></i>
          <span>${escapeHtml(item.title)}</span>
        </a>
      `
        )
        .join('');
    }

    if (listContainer) {
      renderJsa(jsaArray);

      if (searchInput) {
        searchInput.addEventListener('input', function () {
          const term = this.value.trim().toLowerCase();
          if (!term) {
            renderJsa(jsaArray);
          } else {
            const filtered = jsaArray.filter(item =>
              (item.title || '').toLowerCase().includes(term)
            );
            renderJsa(filtered);
          }
        });
      }
    }
  } catch (e) {
    console.error('Error while rendering JSA library:', e);
  }
}

// ===============================
// KPI / heat / wind tools
// ===============================

function setupTools() {
  renderKpiList();
  switchTool('kpi');
}

function switchTool(tool) {
  const btns = document.querySelectorAll('.tool-toggle-btn');
  btns.forEach(btn => {
    const t = btn.getAttribute('data-tool');
    btn.classList.toggle('active-tool', t === tool);
  });

  const kpiSection = document.getElementById('kpiSection');
  const heatSection = document.getElementById('heatStressSection');
  const windSection = document.getElementById('windSpeedSection');

  if (kpiSection) kpiSection.style.display = tool === 'kpi' ? 'block' : 'none';
  if (heatSection) heatSection.style.display = tool === 'heat' ? 'block' : 'none';
  if (windSection) windSection.style.display = tool === 'wind' ? 'block' : 'none';
}

const kpiDefinitions = [
  {
    title: 'Total Observations',
    code: 'TO',
    type: 'leading',
    formula: 'Number of safety observations recorded in the selected period.',
    note: 'Higher is better when observations are quality and actions are closed.'
  },
  {
    title: 'Positive Observations',
    code: 'PO',
    type: 'leading',
    formula: 'Number of observations flagged as positive / best practice.',
    note: 'Use to recognise and reward safe behaviour.'
  },
  {
    title: 'Open Actions',
    code: 'OA',
    type: 'lagging',
    formula: 'Number of observations with status OPEN.',
    note: 'Track until all actions are closed.'
  },
  {
    title: 'High-Risk Open',
    code: 'HRO',
    type: 'lagging',
    formula: 'Observations with RA Level = High and status = Open.',
    note: 'These must be addressed immediately.'
  }
];

function renderKpiList() {
  const container = document.getElementById('kpiListContainer');
  if (!container) return;

  container.innerHTML = kpiDefinitions
    .map(kpi => {
      const typeClass = kpi.type === 'leading' ? 'leading' : 'lagging';
      const typeLabel = kpi.type === 'leading' ? 'LEADING' : 'LAGGING';
      return `
        <div class="kpi-card">
          <div class="kpi-title-row">
            <span>${escapeHtml(kpi.code)} – ${escapeHtml(kpi.title)}</span>
            <span class="kpi-badge ${typeClass}">${typeLabel}</span>
          </div>
          <div class="kpi-body">
            <div style="font-size:12px; margin-top:4px;"><strong>Formula:</strong> ${escapeHtml(
              kpi.formula
            )}</div>
            <div style="font-size:12px; margin-top:4px; color:var(--text-soft);"><strong>Note:</strong> ${escapeHtml(
              kpi.note
            )}</div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Heat index
function calculateHeatIndex() {
  const tInput = document.getElementById('inputTemp');
  const hInput = document.getElementById('inputHumidity');
  const valueEl = document.getElementById('heatIndexValue');
  const levelEl = document.getElementById('heatRiskLevel');
  const listEl = document.getElementById('heatRecommendationsList');

  if (!tInput || !hInput || !valueEl || !levelEl || !listEl) return;

  const tC = parseFloat(tInput.value);
  const rh = parseFloat(hInput.value);

  if (isNaN(tC) || isNaN(rh)) {
    valueEl.textContent = '--';
    levelEl.textContent = '--';
    listEl.innerHTML = '<li>Enter temperature and humidity to see results.</li>';
    return;
  }

  const tF = (tC * 9) / 5 + 32;

  const hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * rh -
    0.22475541 * tF * rh -
    0.00683783 * tF * tF -
    0.05481717 * rh * rh +
    0.00122874 * tF * tF * rh +
    0.00085282 * tF * rh * rh -
    0.00000199 * tF * tF * rh * rh;

  const hiC = Math.round(((hiF - 32) * 5) / 9);

  valueEl.textContent = `${hiC}°C HI`;

  let level = '';
  let advice = [];

  if (hiC < 27) {
    level = 'Safe';
    advice = [
      'Normal outdoor work with standard hydration.',
      'Monitor heat throughout the day.'
    ];
  } else if (hiC < 32) {
    level = 'Caution';
    advice = [
      'Encourage frequent water breaks.',
      'Educate workers on early signs of heat stress.'
    ];
  } else if (hiC < 41) {
    level = 'Extreme Caution';
    advice = [
      'Implement work/rest cycles.',
      'Provide shaded rest areas.',
      'Closely monitor new or unacclimatized workers.'
    ];
  } else if (hiC < 54) {
    level = 'Danger';
    advice = [
      'Shorten work periods with longer rest in shade.',
      'Ensure buddy system for monitoring.',
      'Stop non-essential high-exertion tasks.'
    ];
  } else {
    level = 'Extreme Danger';
    advice = [
      'Stop outdoor work except for emergency activities.',
      'Move workers to cooled shelters.',
      'Follow company and Saudi Aramco heat-stress procedures strictly.'
    ];
  }

  levelEl.textContent = level;
  listEl.innerHTML = advice.map(a => `<li>${escapeHtml(a)}</li>`).join('');
}

// Wind safety
function calculateWindSafety() {
  const input = document.getElementById('inputWind');
  const valueEl = document.getElementById('windValue');
  const levelEl = document.getElementById('windRiskLevel');
  const listEl = document.getElementById('windRecommendationsList');

  if (!input || !valueEl || !levelEl || !listEl) return;

  const speed = parseFloat(input.value);
  if (isNaN(speed)) {
    valueEl.textContent = '--';
    levelEl.textContent = '--';
    listEl.innerHTML = '<li>Enter wind speed to see limits.</li>';
    return;
  }

  valueEl.textContent = `${speed} km/h`;

  let level = '';
  let advice = [];

  if (speed < 32) {
    level = 'Safe';
    advice = [
      'Normal crane and man-basket operations allowed.',
      'Continue routine monitoring of wind conditions.'
    ];
  } else if (speed < 38) {
    level = 'Caution';
    advice = [
      'Review lifting plans before each lift.',
      'Avoid large-sail-area loads if possible.',
      'Increase communication between rigger and operator.'
    ];
  } else if (speed < 45) {
    level = 'Restrict';
    advice = [
      'Suspend man-basket operations.',
      'Limit crane work to essential lifts with additional controls.',
      'Follow CSM limits for specific equipment.'
    ];
  } else {
    level = 'Stop Work';
    advice = [
      'Stop all crane and man-basket operations.',
      'Secure loads, scaffolding, and loose materials.',
      'Apply Stop Work Authority until wind speeds reduce.'
    ];
  }

  levelEl.textContent = level;
  listEl.innerHTML = advice.map(a => `<li>${escapeHtml(a)}</li>`).join('');
}

// ===============================
// News from sheet
// ===============================

function setupNews() {
  const url = window.NEWS_SHEET_CSV_URL;
  const container = document.getElementById('AnnouncementsContainer');
  const loading = document.getElementById('newsLoading');

  if (!container) return;

  if (!url) {
    if (loading) loading.innerHTML = 'Configure NEWS_SHEET_CSV_URL in js/data.js to load news.';
    return;
  }

  fetch(url)
    .then(resp => {
      if (!resp.ok) throw new Error('Network response not ok');
      return resp.text();
    })
    .then(text => {
      if (loading) loading.style.display = 'none';

      const parsed = parseCSV(text);
      const rows = parsed.rows;

      if (!rows.length) {
        container.innerHTML = '<p style="text-align:center;font-size:13px;">No news items found.</p>';
        return;
      }

      container.innerHTML = rows
        .map(row => {
          const date = row['Date'] || row['DATE'] || '';
          const title = row['Title'] || row['TITLE'] || row['Announcement'] || '';
          const description =
            row['Details'] || row['DETAILS'] || row['Description'] || row['DESCRIPTION'] || '';

          return `
            <div class="news-card">
              <div class="news-header">
                <div class="news-title">
                  <div class="news-title-main">${escapeHtml(title)}</div>
                  <div class="news-title-date">${escapeHtml(date)}</div>
                </div>
                <div><i class="fas fa-chevron-down"></i></div>
              </div>
              <div class="news-body" style="display:none;">
                ${escapeHtml(description)}
              </div>
            </div>
          `;
        })
        .join('');

      const cards = container.querySelectorAll('.news-card');
      cards.forEach(card => {
        const header = card.querySelector('.news-header');
        const body = card.querySelector('.news-body');
        if (!header || !body) return;
        header.addEventListener('click', () => {
          const isOpen = body.style.display === 'block';
          body.style.display = isOpen ? 'none' : 'block';
        });
      });
    })
    .catch(err => {
      console.error('Error loading news:', err);
      if (loading) {
        loading.innerHTML =
          'Unable to load news. Please check NEWS_SHEET_CSV_URL in js/data.js or your connection.';
      }
    });
}

// ===============================
// Employee of Month & leaderboard
// ===============================

function setupEomAndColor() {
  const url = window.EOM_SHEET_URL;
  const colorSpan = document.getElementById('colorName');
  const eomContent = document.getElementById('employeeOfMonth');
  const miniContainer = document.getElementById('homeLeaderboardMini');
  const modalContainer = document.getElementById('leaderboardContainer');

  if (!url) {
    if (colorSpan) colorSpan.textContent = 'Configure EOM_SHEET_URL in js/data.js';
    if (eomContent) eomContent.textContent = 'No data – configure EOM_SHEET_URL in js/data.js.';
    if (miniContainer) miniContainer.textContent = 'No leaderboard data.';
    return;
  }

  if (eomContent) eomContent.textContent = 'Loading...';
  if (miniContainer) miniContainer.textContent = 'Loading leaderboard...';

  fetch(url)
    .then(resp => {
      if (!resp.ok) throw new Error('Network error');
      return resp.text();
    })
    .then(text => {
      const parsed = parseCSV(text);
      const rows = parsed.rows;
      if (!rows.length) {
        if (eomContent) eomContent.textContent = 'No Employee of the Month data.';
        if (miniContainer) miniContainer.textContent = 'No leaderboard data.';
        return;
      }

      const first = rows[0];

      const color =
        first['Color'] ||
        first['Color Code'] ||
        first['COLOR'] ||
        first['COLOR CODE'] ||
        first['Month Color'] ||
        '';
      if (colorSpan) {
        colorSpan.textContent = color || 'Not set';
      }

      const empName =
        first['Employee'] ||
        first['Employee Name'] ||
        first['EMPLOYEE'] ||
        first['EMPLOYEE NAME'] ||
        '';
      const empId = first['ID'] || first['Badge'] || first['BADGE'] || '';
      if (eomContent) {
        if (empName) {
          eomContent.textContent = (empId ? `[${empId}] – ` : '') + empName;
        } else {
          eomContent.textContent = 'No Employee of the Month defined.';
        }
      }

      leaderboardRows = rows.slice(1).filter(r => (r['Name'] || r['Employee'] || '').trim());

      if (!leaderboardRows.length) {
        if (miniContainer) miniContainer.textContent = 'No leaderboard data.';
        return;
      }

      leaderboardRows.sort((a, b) => {
        const aPts =
          parseFloat(a['Points'] || a['Score'] || a['POINTS'] || a['SCORE'] || '0') || 0;
        const bPts =
          parseFloat(b['Points'] || b['Score'] || b['POINTS'] || b['SCORE'] || '0') || 0;
        return bPts - aPts;
      });

      const top3 = leaderboardRows.slice(0, 3);
      if (miniContainer) {
        miniContainer.innerHTML = top3
          .map((row, index) => {
            const name = row['Name'] || row['Employee'] || '—';
            const pts =
              row['Points'] || row['Score'] || row['POINTS'] || row['SCORE'] || '0';
            return `<div style="font-size:13px; margin-bottom:2px;">
              ${index + 1}. ${escapeHtml(name)} – <strong>${escapeHtml(pts)}</strong>
            </div>`;
          })
          .join('');
      }

      if (modalContainer) {
        modalContainer.innerHTML = buildLeaderboardTableHtml(leaderboardRows);
      }
    })
    .catch(err => {
      console.error('Error loading EOM sheet:', err);
      if (colorSpan) colorSpan.textContent = 'Error loading data';
      if (eomContent) eomContent.textContent = 'Unable to load Employee of the Month data.';
      if (miniContainer) miniContainer.textContent = 'Unable to load leaderboard.';
    });
}

function buildLeaderboardTableHtml(rows) {
  if (!rows.length) {
    return '<p>No leaderboard data.</p>';
  }

  const headerHtml = `
    <table class="obs-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Name</th>
          <th>ID</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
  `;

  const bodyHtml = rows
    .map((row, idx) => {
      const name = row['Name'] || row['Employee'] || '—';
      const id = row['ID'] || row['Badge'] || '';
      const pts =
        row['Points'] || row['Score'] || row['POINTS'] || row['SCORE'] || '0';
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(id)}</td>
          <td>${escapeHtml(pts)}</td>
        </tr>
      `;
    })
    .join('');

  return headerHtml + bodyHtml + '</tbody></table>';
}

// Modals
function showLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.style.display = 'block';
}

function hideLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.style.display = 'none';
}

function showEmergencyContactsModal() {
  const modal = document.getElementById('emergencyContactsModal');
  if (modal) modal.style.display = 'block';
}

function hideEmergencyContactsModal() {
  const modal = document.getElementById('emergencyContactsModal');
  if (modal) modal.style.display = 'none';
}

// GPS for emergency reporting
function getGPSLocation() {
  const resultEl = document.getElementById('locationResult');
  if (!navigator.geolocation) {
    if (resultEl) resultEl.textContent = 'Geolocation is not supported on this device.';
    return;
  }

  if (resultEl) resultEl.textContent = 'Getting your GPS location...';

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords;
      const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      if (resultEl) {
        resultEl.innerHTML = `
          Your location:<br>
          Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}<br>
          <a href="${mapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>
        `;
      }
    },
    () => {
      if (resultEl) {
        resultEl.textContent =
          'Unable to get GPS location. Please check permissions or try again.';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ===============================
// Tasks form & Add Observation
// ===============================

function setupTasksForm() {
  const iframe = document.getElementById('tasksIframe');
  if (!iframe) return;
  const url = window.TASKS_FORM_EMBED_URL;
  if (url) iframe.src = url;
}

function setupAddObservationButton() {
  const btn = document.getElementById('addObservationButton');
  const url = window.ADD_OBSERVATION_FORM_URL;
  if (btn && url) btn.href = url;
}

// ===============================
// Small utilities
// ===============================

function escapeHtml(str) {
  return (str || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;/g, '&gt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
