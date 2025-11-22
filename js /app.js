// My Observations App - Core Logic
// This file assumes all URLs + libraries are defined in js/data.js

// ====== GLOBAL STATE ======
let observationsRaw = [];
let observationsParsed = [];
let observationsLoaded = false;

let observationsFilterRange = 'today';
let observationsFilterRisk = '';
let observationsFilterStatus = '';
let observationsFilterSearch = '';

let leaderboardRows = [];
let eomRow = null;

// ====== UTILITIES ======
function parseCSV(text) {
  const rows = [];
  let current = '';
  let row = [];
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      const nextChar = text[i + 1];
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (current !== '' || row.length > 0) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      }
      // \r\n is handled naturally
    } else {
      current += char;
    }
  }
  if (current !== '' || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows.filter(
    r => r.length > 1 || (r.length === 1 && r[0].trim() !== '')
  );
}

function safeNumber(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function toDateMaybe(str) {
  if (!str) return null;
  const trimmed = String(str).trim();
  if (!trimmed) return null;

  let d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d;

  // Try dd/mm/yyyy
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [_, dStr, mStr, yStr] = m;
    const day = parseInt(dStr, 10);
    const month = parseInt(mStr, 10) - 1;
    let year = parseInt(yStr, 10);
    if (year < 100) year += 2000;
    d = new Date(year, month, day);
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

function daysBetween(a, b) {
  const ms = Math.abs(a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0));
  return ms / (1000 * 60 * 60 * 24);
}

// ====== THEME ======
function initTheme() {
  const saved = localStorage.getItem('moa_theme') || 'light';
  const body = document.body;
  const icon = document.getElementById('modeIcon');
  if (saved === 'dark') {
    body.classList.add('dark-mode');
    if (icon) {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  } else {
    body.classList.remove('dark-mode');
    if (icon) {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  }
}

function toggleDarkMode() {
  const body = document.body;
  const icon = document.getElementById('modeIcon');
  body.classList.toggle('dark-mode');
  const isDark = body.classList.contains('dark-mode');
  localStorage.setItem('moa_theme', isDark ? 'dark' : 'light');
  if (icon) {
    icon.classList.toggle('fa-moon', !isDark);
    icon.classList.toggle('fa-sun', isDark);
  }
}
window.toggleDarkMode = toggleDarkMode;

// ====== NAVIGATION ======
function openTab(evt, tabName) {
  const tabcontent = document.getElementsByClassName('tab-content');
  const navbuttons = document.getElementsByClassName('nav-button');
  const currentTab = document.getElementById(tabName);

  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].classList.remove('active');
  }
  if (currentTab) currentTab.classList.add('active');

  for (let i = 0; i < navbuttons.length; i++) {
    navbuttons[i].classList.remove('active');
  }
  if (evt && evt.currentTarget) {
    evt.currentTarget.classList.add('active');
  } else {
    const btn = document.querySelector(
      `.nav-button[onclick*="'${tabName}'"]`
    );
    if (btn) btn.classList.add('active');
  }
}
window.openTab = openTab;

// ====== ACCORDIONS ======
function initAccordions() {
  const accordions = document.querySelectorAll('.accordion');
  accordions.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('activeAcc');
      const panel = btn.nextElementSibling;
      if (!panel) return;
      const isOpen = panel.style.display === 'block';
      panel.style.display = isOpen ? 'none' : 'block';
    });
  });
}

// ====== TBT & JSA LIBRARIES ======
function initTbtAndJsa() {
  const allTbt = window.tbtData || [];
  const allJsa = window.jsaData || [];

  // TBT of the day
  const tbtContentEl = document.getElementById('homeTbtContent');
  const tbtPanel = document.getElementById('tbtPanel');
  if (!allTbt.length) {
    if (tbtContentEl)
      tbtContentEl.textContent =
        'No TBT data configured. Add items in js/data.js.';
    if (tbtPanel) tbtPanel.textContent = 'No toolbox talks configured.';
  } else {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today - new Date(today.getFullYear(), 0, 0)) / 86400000
    );
    const tbt = allTbt[dayOfYear % allTbt.length];

    if (tbtContentEl) {
      tbtContentEl.innerHTML = `
        <div><strong>${tbt.title}</strong></div>
        <div style="margin-top:4px;">
          <a href="${tbt.link}" target="_blank">Open TBT document</a>
        </div>
      `;
    }

    if (tbtPanel) {
      tbtPanel.innerHTML = allTbt
        .map(
          item => `
        <div class="tbt-item">
          <i class="fas fa-book-open"></i>
          <a href="${item.link}" target="_blank">${item.title}</a>
        </div>
      `
        )
        .join('');
    }
  }

  // Library tab – TBT list
  const tbtLibList = document.getElementById('tbtLibraryList');
  if (tbtLibList) {
    if (!allTbt.length) {
      tbtLibList.textContent = 'No TBT items found.';
    } else {
      tbtLibList.innerHTML = allTbt
        .map(
          item => `
        <div class="tbt-item">
          <i class="fas fa-book-open"></i>
          <a href="${item.link}" target="_blank">${item.title}</a>
        </div>
      `
        )
        .join('');
    }
  }

  // JSA library
  const jsaContainer = document.getElementById('jsaListContainer');
  const jsaSearch = document.getElementById('jsaSearch');
  function renderJsa(filterText) {
    if (!jsaContainer) return;
    const q = (filterText || '').toLowerCase();
    const filtered = allJsa.filter(j => j.title.toLowerCase().includes(q));
    if (!filtered.length) {
      jsaContainer.textContent = 'No JSA found for this search.';
      return;
    }
    jsaContainer.innerHTML = filtered
      .map(
        j => `
      <a class="jsa-item" href="${j.link}" target="_blank">
        <i class="fas fa-file-alt"></i>
        <span>${j.title}</span>
      </a>
    `
      )
      .join('');
  }
  if (jsaContainer) renderJsa('');
  if (jsaSearch) {
    jsaSearch.addEventListener('input', () => renderJsa(jsaSearch.value));
  }
}

// ====== EOM & LEADERBOARD ======
function fetchEomAndLeaderboard() {
  const url = window.EOM_SHEET_URL;
  const eomCard = document.getElementById('employeeOfMonth');
  const colorSpan = document.getElementById('colorName');
  const miniContainer = document.getElementById('homeLeaderboardMini');

  if (!url) {
    if (eomCard) eomCard.textContent = 'Configure EOM_SHEET_URL in js/data.js';
    if (miniContainer)
      miniContainer.textContent = 'No leaderboard data (missing EOM_SHEET_URL).';
    return;
  }

  fetch(url)
    .then(r => r.text())
    .then(text => {
      const rows = parseCSV(text);
      if (!rows.length) throw new Error('Empty EOM sheet');

      const header = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows
        .slice(1)
        .filter(r => r.some(c => c.trim() !== ''));

      const colorIdx = header.findIndex(h => h.includes('color'));
      const eomNameIdx = header.findIndex(
        h =>
          h.includes('employee of the month') ||
          (h.includes('employee') && h.includes('month')) ||
          h.includes('eom name')
      );
      const eomIdIdx = header.findIndex(
        h =>
          (h.includes('id') && h.includes('employee')) || h === 'id'
      );
      const nameIdx = header.findIndex(
        h =>
          h === 'name' ||
          h.includes('officer') ||
          h.includes('safety officer')
      );
      const pointsIdx = header.findIndex(
        h => h.includes('points') || h.includes('score')
      );

      if (!dataRows.length) {
        if (eomCard) eomCard.textContent = 'No EOM data found.';
        if (miniContainer) miniContainer.textContent = 'No leaderboard data.';
        return;
      }

      // Use last row as "current"
      const last = dataRows[dataRows.length - 1];
      eomRow = last;

      if (colorSpan && colorIdx !== -1) {
        colorSpan.textContent = last[colorIdx] || 'N/A';
      }

      if (eomCard) {
        if (eomNameIdx !== -1 || eomIdIdx !== -1) {
          const name =
            eomNameIdx !== -1 ? last[eomNameIdx] || '' : '';
          const id = eomIdIdx !== -1 ? last[eomIdIdx] || '' : '';
          eomCard.textContent = `${id ? '[' + id + '] - ' : ''}${name}`;
        } else {
          eomCard.textContent =
            'Check EOM sheet columns (name / id).';
        }
      }

      // Leaderboard rows (every row that has name + points)
      leaderboardRows = dataRows
        .map(r => ({
          name: nameIdx !== -1 ? r[nameIdx] || '' : '',
          points: pointsIdx !== -1 ? safeNumber(r[pointsIdx]) : 0
        }))
        .filter(x => x.name && Number.isFinite(x.points));

      if (!leaderboardRows.length) {
        if (miniContainer)
          miniContainer.textContent = 'No leaderboard data configured.';
        return;
      }

      const top3 = [...leaderboardRows]
        .sort((a, b) => b.points - a.points)
        .slice(0, 3);
      if (miniContainer) {
        miniContainer.innerHTML = top3
          .map(
            (p, i) => `
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;">
            <span>${i + 1}. ${p.name}</span>
            <span>${p.points}</span>
          </div>
        `
          )
          .join('');
      }
    })
    .catch(err => {
      console.error('EOM/Leaderboard error', err);
      if (eomCard)
        eomCard.textContent = 'Configure EOM_SHEET_URL or check network.';
      const miniContainer2 = document.getElementById(
        'homeLeaderboardMini'
      );
      if (miniContainer2)
        miniContainer2.textContent = 'Unable to load leaderboard.';
    });
}

function showLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  const container = document.getElementById('leaderboardContainer');
  if (!modal || !container) return;

  if (!leaderboardRows.length) {
    container.innerHTML =
      '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading leaderboard...</div>';
    fetchEomAndLeaderboard();
  } else {
    const sorted = [...leaderboardRows].sort(
      (a, b) => b.points - a.points
    );
    let html =
      '<table class="obs-table"><thead><tr><th>#</th><th>Safety Officer</th><th>Points</th></tr></thead><tbody>';
    sorted.forEach((p, i) => {
      html += `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.points}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;
  }
  modal.style.display = 'block';
}
function hideLeaderboardModal() {
  const modal = document.getElementById('leaderboardModal');
  if (modal) modal.style.display = 'none';
}
window.showLeaderboardModal = showLeaderboardModal;
window.hideLeaderboardModal = hideLeaderboardModal;

// ====== EMERGENCY MODAL ======
function showEmergencyContactsModal() {
  const modal = document.getElementById('emergencyContactsModal');
  if (modal) modal.style.display = 'block';
}
function hideEmergencyContactsModal() {
  const modal = document.getElementById('emergencyContactsModal');
  if (modal) modal.style.display = 'none';
}
window.showEmergencyContactsModal = showEmergencyContactsModal;
window.hideEmergencyContactsModal = hideEmergencyContactsModal;

// Close modals when clicking outside content
window.addEventListener('click', evt => {
  const leaderboardModal = document.getElementById('leaderboardModal');
  const emergencyModal = document.getElementById('emergencyContactsModal');
  if (evt.target === leaderboardModal) hideLeaderboardModal();
  if (evt.target === emergencyModal) hideEmergencyContactsModal();
});

// ====== OBSERVATIONS ======
function parseObservations(rows) {
  if (!rows || !rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  const dataRows = rows
    .slice(1)
    .filter(r => r.some(c => c.trim() !== ''));

  const idxDate = header.findIndex(
    h => h === 'date' || h.includes('date')
  );
  const idxArea = header.findIndex(h => h.includes('area'));
  const idxRiskLevel = header.findIndex(
    h => h.includes('ra level') || h === 'risk level'
  );
  const idxStatus = header.findIndex(
    h => h.includes('report status') || h === 'status'
  );
  const idxClass = header.findIndex(h => h.includes('observation class'));
  const idxType = header.findIndex(h => h.includes('observation types'));
  const idxDesc = header.findIndex(h => h.startsWith('description'));
  const idxName = header.findIndex(
    h => h === 'name' || h.includes('observer')
  );

  return dataRows.map(r => {
    const date = idxDate !== -1 ? toDateMaybe(r[idxDate]) : null;
    const statusRaw = idxStatus !== -1 ? r[idxStatus] || '' : '';
    const status = statusRaw.trim();
    const riskLevel = idxRiskLevel !== -1 ? r[idxRiskLevel] || '' : '';
    const obsClass = idxClass !== -1 ? r[idxClass] || '' : '';
    const obsType = idxType !== -1 ? r[idxType] || '' : '';
    return {
      raw: r,
      date,
      dateText: idxDate !== -1 ? r[idxDate] || '' : '',
      area: idxArea !== -1 ? r[idxArea] || '' : '',
      riskLevel,
      status,
      class: obsClass,
      type: obsType,
      description: idxDesc !== -1 ? r[idxDesc] || '' : '',
      reporter: idxName !== -1 ? r[idxName] || '' : ''
    };
  });
}

function updateHomeFromObservations() {
  const observersEl = document.getElementById('homeObserversToday');
  const obsTodayEl = document.getElementById('homeObservationsToday');
  const highRiskEl = document.getElementById('homeHighRiskOpen');

  if (!observationsParsed.length) {
    if (observersEl) observersEl.textContent = '--';
    if (obsTodayEl) obsTodayEl.textContent = '--';
    if (highRiskEl) highRiskEl.textContent = '--';
    return;
  }

  const today = new Date();
  const todayRecords = observationsParsed.filter(
    o => o.date && isSameDay(o.date, today)
  );
  const allOpenHigh = observationsParsed.filter(
    o =>
      o.status.toLowerCase().includes('open') &&
      o.riskLevel.toLowerCase().includes('high')
  );

  const observersTodaySet = new Set(
    todayRecords.map(o => o.reporter).filter(Boolean)
  );

  if (observersEl) observersEl.textContent = observersTodaySet.size || 0;
  if (obsTodayEl) obsTodayEl.textContent = todayRecords.length || 0;
  if (highRiskEl) highRiskEl.textContent = allOpenHigh.length || 0;
}

function updateObservationSummaryBar() {
  const countMonthEl = document.getElementById('obsCountMonth');
  const openEl = document.getElementById('obsCountOpen');
  const closedEl = document.getElementById('obsCountClosed');

  if (!observationsParsed.length) {
    if (countMonthEl) countMonthEl.textContent = '--';
    if (openEl) openEl.textContent = '--';
    if (closedEl) closedEl.textContent = '--';
    return;
  }

  const now = new Date();
  const monthRecords = observationsParsed.filter(
    o => o.date && isSameMonth(o.date, now)
  );
  const openCount = monthRecords.filter(o =>
    o.status.toLowerCase().includes('open')
  ).length;
  const closedCount = monthRecords.filter(o =>
    o.status.toLowerCase().includes('closed')
  ).length;

  if (countMonthEl) countMonthEl.textContent = monthRecords.length;
  if (openEl) openEl.textContent = openCount;
  if (closedEl) closedEl.textContent = closedCount;
}

function renderObservationsList() {
  const listEl = document.getElementById('observationsList');
  const emptyStateEl = document.getElementById('observationsEmptyState');
  if (!listEl) return;

  if (!observationsLoaded) {
    listEl.innerHTML =
      '<div class="obs-empty-state"><i class="fas fa-database"></i><p>No observations data loaded. Check OBSERVATIONS_SHEET_CSV_URL in js/data.js.</p></div>';
    if (emptyStateEl) emptyStateEl.style.display = 'none';
    return;
  }

  const now = new Date();
  let filtered = [...observationsParsed];

  filtered = filtered.filter(o => {
    if (!o.date) return false;
    if (observationsFilterRange === 'today') {
      return isSameDay(o.date, now);
    }
    if (observationsFilterRange === 'week') {
      return daysBetween(new Date(o.date), new Date(now)) <= 7;
    }
    if (observationsFilterRange === 'month') {
      return isSameMonth(o.date, now);
    }
    return true;
  });

  if (observationsFilterRisk) {
    const rVal = observationsFilterRisk.toLowerCase();
    filtered = filtered.filter(o =>
      o.riskLevel.toLowerCase().includes(rVal)
    );
  }
  if (observationsFilterStatus) {
    const sVal = observationsFilterStatus.toLowerCase();
    filtered = filtered.filter(o =>
      o.status.toLowerCase().includes(sVal)
    );
  }
  if (observationsFilterSearch) {
    const q = observationsFilterSearch.toLowerCase();
    filtered = filtered.filter(
      o =>
        o.area.toLowerCase().includes(q) ||
        o.type.toLowerCase().includes(q) ||
        o.class.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q) ||
        o.reporter.toLowerCase().includes(q)
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = `
      <div class="obs-empty-state">
        <i class="fas fa-info-circle"></i>
        <p>No observations match the selected filters.</p>
      </div>`;
    if (emptyStateEl) emptyStateEl.style.display = 'none';
    return;
  }

  // Render as cards
  listEl.innerHTML = filtered
    .map(o => {
      const risk = o.riskLevel.toLowerCase();
      let riskClass = '';
      if (risk.includes('high')) riskClass = 'high';
      else if (risk.includes('medium')) riskClass = 'medium';
      else if (risk.includes('low')) riskClass = 'low';

      let statusClass = '';
      const sLower = o.status.toLowerCase();
      if (sLower.includes('open')) statusClass = 'status-open';
      else if (sLower.includes('closed')) statusClass = 'status-closed';
      else if (sLower.includes('progress'))
        statusClass = 'status-in-progress';

      return `
      <div class="obs-card">
        <div class="obs-card-top">
          <span>${o.dateText || ''}</span>
          <span>${o.area || ''}</span>
        </div>
        <div class="obs-card-meta">
          ${o.class ? `<span>${o.class}</span>` : ''}
          ${o.type ? `<span>${o.type}</span>` : ''}
          ${o.reporter ? `<span>By: ${o.reporter}</span>` : ''}
        </div>
        <div class="obs-card-meta">
          ${
            o.riskLevel
              ? `<span class="obs-badge ${riskClass}">${o.riskLevel}</span>`
              : ''
          }
          ${
            o.status
              ? `<span class="obs-badge ${statusClass}">${o.status}</span>`
              : ''
          }
        </div>
        ${
          o.description
            ? `<div style="margin-top:6px;">${o.description}</div>`
            : ''
        }
      </div>
    `;
    })
    .join('');

  if (emptyStateEl) emptyStateEl.style.display = 'none';
}

function initObservationsFilters() {
  const chips = document.querySelectorAll('.obs-filter-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      observationsFilterRange = chip.dataset.range || 'today';
      renderObservationsList();
    });
  });

  const riskSel = document.getElementById('obsFilterRisk');
  const statusSel = document.getElementById('obsFilterStatus');
  const searchInput = document.getElementById('obsSearch');

  if (riskSel) {
    riskSel.addEventListener('change', () => {
      observationsFilterRisk = riskSel.value || '';
      renderObservationsList();
    });
  }
  if (statusSel) {
    statusSel.addEventListener('change', () => {
      observationsFilterStatus = statusSel.value || '';
      renderObservationsList();
    });
  }
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      observationsFilterSearch = searchInput.value || '';
      renderObservationsList();
    });
  }

  const openSheetBtn = document.getElementById('openSheetButton');
  if (openSheetBtn) {
    openSheetBtn.addEventListener('click', () => {
      const url =
        window.OBSERVATIONS_FULL_SHEET_URL ||
        window.OBSERVATIONS_SHEET_CSV_URL;
      if (url) window.open(url, '_blank');
    });
  }
}

function loadObservations() {
  const url = window.OBSERVATIONS_SHEET_CSV_URL;
  if (!url) {
    console.warn('OBSERVATIONS_SHEET_CSV_URL not configured');
    observationsLoaded = false;
    renderObservationsList();
    return;
  }

  fetch(url)
    .then(r => r.text())
    .then(text => {
      const rows = parseCSV(text);
      observationsRaw = rows;
      observationsParsed = parseObservations(rows);
      observationsLoaded = observationsParsed.length > 0;
      updateHomeFromObservations();
      updateObservationSummaryBar();
      renderObservationsList();
    })
    .catch(err => {
      console.error('Error loading observations', err);
      observationsLoaded = false;
      renderObservationsList();
    });
}

// ====== KPI LOGIC ======
const kpiDefinitions = [
  {
    id: 'trir',
    name: 'TRIR - Total Recordable Incident Rate',
    category: 'Lagging',
    description: 'Recordable incidents per 200,000 working hours.',
    inputs: [
      { key: 'incidents', label: 'Recordable incidents' },
      { key: 'hours', label: 'Total man-hours' }
    ],
    formula: vals => {
      const incidents = safeNumber(vals.incidents);
      const hours = safeNumber(vals.hours);
      if (!hours) return null;
      return (incidents * 200000) / hours;
    },
    target: '< 0.05'
  },
  {
    id: 'ltir',
    name: 'LTIR - Lost Time Injury Rate',
    category: 'Lagging',
    description: 'LTIs per 200,000 working hours.',
    inputs: [
      { key: 'ltis', label: 'Lost time injuries' },
      { key: 'hours', label: 'Total man-hours' }
    ],
    formula: vals => {
      const ltis = safeNumber(vals.ltis);
      const hours = safeNumber(vals.hours);
      if (!hours) return null;
      return (ltis * 200000) / hours;
    },
    target: '< 0.02'
  },
  {
    id: 'obs_rate',
    name: 'Observations per 10,000 Man-hours',
    category: 'Leading',
    description: 'Positive & negative observations per 10,000 hours.',
    inputs: [
      { key: 'observations', label: 'Total observations' },
      { key: 'hours', label: 'Total man-hours' }
    ],
    formula: vals => {
      const obs = safeNumber(vals.observations);
      const hours = safeNumber(vals.hours);
      if (!hours) return null;
      return (obs * 10000) / hours;
    },
    target: '> 25'
  },
  {
    id: 'tbt_coverage',
    name: 'TBT Coverage',
    category: 'Leading',
    description: '% of workers who attended toolbox talks.',
    inputs: [
      { key: 'attendees', label: 'TBT attendees' },
      { key: 'workforce', label: 'Total workforce' }
    ],
    formula: vals => {
      const a = safeNumber(vals.attendees);
      const w = safeNumber(vals.workforce);
      if (!w) return null;
      return (a / w) * 100;
    },
    target: '≥ 95%'
  }
];

function renderKpiCards() {
  const container = document.getElementById('kpiListContainer');
  if (!container) return;
  container.innerHTML = kpiDefinitions
    .map(kpi => {
      const inputsHtml = kpi.inputs
        .map(
          inp => `
      <div class="kpi-input-group">
        <label>${inp.label}</label>
        <input type="number" data-kpi="${kpi.id}" data-field="${inp.key}" class="kpi-input-field" placeholder="0">
      </div>
    `
        )
        .join('');

      const badgeClass =
        kpi.category === 'Leading' ? 'leading' : 'lagging';

      return `
      <div class="kpi-card">
        <div class="kpi-title-row">
          <span>${kpi.name}</span>
          <span class="kpi-badge ${badgeClass}">${kpi.category}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">${kpi.description}</div>
        ${inputsHtml}
        <div style="margin-top:4px;font-size:12px;color:var(--text-muted);">
          Target: <strong>${kpi.target}</strong>
        </div>
        <div style="margin-top:4px;font-size:13px;">
          Result: <span id="kpi-result-${kpi.id}">--</span>
        </div>
      </div>
    `;
    })
    .join('');

  const inputs = container.querySelectorAll('.kpi-input-field');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      const kpiId = input.dataset.kpi;
      const kpi = kpiDefinitions.find(k => k.id === kpiId);
      if (!kpi) return;

      const values = {};
      const related = container.querySelectorAll(
        `.kpi-input-field[data-kpi="${kpiId}"]`
      );
      related.forEach(r => {
        values[r.dataset.field] = r.value;
      });

      const result = kpi.formula(values);
      const resultEl = document.getElementById(
        `kpi-result-${kpi.id}`
      );
      if (!resultEl) return;

      if (result === null) {
        resultEl.textContent = '--';
      } else {
        resultEl.textContent =
          kpi.id === 'tbt_coverage'
            ? result.toFixed(1) + '%'
            : result.toFixed(3);
      }
    });
  });
}

// ====== HEAT STRESS & WIND ======
function calculateHeatIndex() {
  const tInput = document.getElementById('inputTemp');
  const hInput = document.getElementById('inputHumidity');
  const valueEl = document.getElementById('heatIndexValue');
  const catEl = document.getElementById('heatRiskLevel');
  const listEl = document.getElementById('heatRecommendationsList');
  const homeSummary = document.getElementById('homeHeatSummary');

  if (!tInput || !hInput || !valueEl || !catEl || !listEl) return;

  const T = parseFloat(tInput.value);
  const RH = parseFloat(hInput.value);
  if (isNaN(T) || isNaN(RH)) {
    valueEl.textContent = '--';
    catEl.textContent = '--';
    listEl.innerHTML =
      '<li>Enter temperature and humidity to see results.</li>';
    if (homeSummary) homeSummary.textContent = '--';
    return;
  }

  // Convert C to F for formula
  const Tf = (T * 9) / 5 + 32;
  let HI =
    -42.379 +
    2.04901523 * Tf +
    10.14333127 * RH -
    0.22475541 * Tf * RH -
    0.00683783 * Tf * Tf -
    0.05481717 * RH * RH +
    0.00122874 * Tf * Tf * RH +
    0.00085282 * Tf * RH * RH -
    0.00000199 * Tf * Tf * RH * RH;
  // Convert back to C
  const HIc = ((HI - 32) * 5) / 9;
  const rounded = Math.round(HIc);

  let category = '';
  let rec = [];
  if (HIc < 27) {
    category = 'Normal (Comfort)';
    rec = ['Continue work as usual.', 'Provide drinking water and shade.'];
  } else if (HIc < 32) {
    category = 'Caution';
    rec = [
      'Encourage frequent water breaks.',
      'Monitor workers with risk factors.'
    ];
  } else if (HIc < 41) {
    category = 'Extreme Caution';
    rec = [
      'Implement work-rest cycles.',
      'Mandatory hydration plan.',
      'Increase supervision.'
    ];
  } else if (HIc < 54) {
    category = 'Danger';
    rec = [
      'Reduce exposure time / reschedule tasks.',
      'Use buddy system & continuous monitoring.',
      'Consider stopping non-essential work.'
    ];
  } else {
    category = 'Extreme Danger';
    rec = [
      'Stop non-essential outdoor work.',
      'Only life-saving work with strict controls.',
      'Continuous medical supervision.'
    ];
  }

  valueEl.textContent = `${rounded}°C HI`;
  catEl.textContent = category;
  listEl.innerHTML = rec.map(r => `<li>${r}</li>`).join('');
  if (homeSummary) homeSummary.textContent = `${category} (${rounded}°C HI)`;
}
window.calculateHeatIndex = calculateHeatIndex;

function calculateWindSafety() {
  const wInput = document.getElementById('inputWind');
  const valueEl = document.getElementById('windValue');
  const catEl = document.getElementById('windRiskLevel');
  const listEl = document.getElementById('windRecommendationsList');
  const homeSummary = document.getElementById('homeWindSummary');

  if (!wInput || !valueEl || !catEl || !listEl) return;

  const v = parseFloat(wInput.value);
  if (isNaN(v)) {
    valueEl.textContent = '--';
    catEl.textContent = '--';
    listEl.innerHTML =
      '<li>Enter wind speed to see limits.</li>';
    if (homeSummary) homeSummary.textContent = '--';
    return;
  }

  let category = '';
  let rec = [];
  if (v < 25) {
    category = 'Safe';
    rec = [
      'All lifting & man-basket operations allowed.',
      'Continue monitoring MET data.'
    ];
  } else if (v < 38) {
    category = 'Caution';
    rec = [
      'Review crane & scaffold activities.',
      'Stop non-essential work at height.',
      'Increase frequency of MET checks.'
    ];
  } else if (v < 50) {
    category = 'High Risk';
    rec = [
      'Suspend man-basket & light crane lifts.',
      'Secure loose materials & scaffolding.',
      'Supervisor approval for critical lifts only.'
    ];
  } else {
    category = 'Stop Work';
    rec = [
      'Stop all lifting / work at height.',
      'Secure all equipment & materials.',
      'Resume only when wind is below limits.'
    ];
  }

  valueEl.textContent = `${v.toFixed(1)} km/h`;
  catEl.textContent = category;
  listEl.innerHTML = rec.map(r => `<li>${r}</li>`).join('');
  if (homeSummary)
    homeSummary.textContent = `${category} (${v.toFixed(1)} km/h)`;
}
window.calculateWindSafety = calculateWindSafety;

// Tool tab switcher
function switchTool(toolName) {
  const kpiSection = document.getElementById('kpiSection');
  const heatSection = document.getElementById('heatStressSection');
  const windSection = document.getElementById('windSpeedSection');
  const buttons = document.querySelectorAll('.tool-toggle-btn');

  if (!kpiSection || !heatSection || !windSection) return;

  kpiSection.style.display = toolName === 'kpi' ? 'block' : 'none';
  heatSection.style.display = toolName === 'heat' ? 'block' : 'none';
  windSection.style.display = toolName === 'wind' ? 'block' : 'none';

  buttons.forEach(btn => {
    const isActive = btn.dataset.tool === toolName;
    btn.classList.toggle('active-tool', isActive);
  });
}
window.switchTool = switchTool;

// ====== GPS ======
function getGPSLocation() {
  const output = document.getElementById('locationResult');
  if (!output) return;

  if (!navigator.geolocation) {
    output.textContent = 'Geolocation is not supported by your browser.';
    return;
  }

  output.textContent = 'Fetching coordinates...';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      const link = `https://maps.google.com/?q=${latitude},${longitude}`;
      output.innerHTML = `Lat: ${latitude.toFixed(
        5
      )}, Lng: ${longitude.toFixed(
        5
      )}<br><a href="${link}" target="_blank">Open in Google Maps</a>`;
    },
    err => {
      console.error(err);
      output.textContent =
        'Unable to retrieve your location. Check permissions.';
    }
  );
}
window.getGPSLocation = getGPSLocation;

// ====== NEWS ======
function loadNews() {
  const url = window.NEWS_SHEET_CSV_URL;
  const container = document.getElementById('AnnouncementsContainer');
  const loading = document.getElementById('newsLoading');

  if (!container) return;

  if (!url) {
    if (loading) loading.remove();
    container.innerHTML =
      '<div class="announcement-card"><div class="card-title">Configure NEWS_SHEET_CSV_URL in js/data.js to load news.</div></div>';
    return;
  }

  fetch(url)
    .then(r => r.text())
    .then(text => {
      const rows = parseCSV(text);
      if (loading) loading.remove();
      if (!rows.length) {
        container.innerHTML =
          '<div class="announcement-card"><div class="card-title">No news configured.</div></div>';
        return;
      }

      const header = rows[0].map(h => h.trim().toLowerCase());
      const dataRows = rows
        .slice(1)
        .filter(r => r.some(c => c.trim() !== ''));

      const idxDate = header.findIndex(h => h.includes('date'));
      const idxTitle = header.findIndex(h => h.includes('title'));
      const idxBody = header.findIndex(
        h => h.includes('body') || h.includes('description')
      );

      container.innerHTML = dataRows
        .map(row => {
          const date = idxDate !== -1 ? row[idxDate] || '' : '';
          const title =
            idxTitle !== -1 ? row[idxTitle] || '' : 'Announcement';
          const body = idxBody !== -1 ? row[idxBody] || '' : '';
          return `
          <div class="news-card">
            <div class="news-header">
              <div class="news-title">
                <div class="news-title-main">${title}</div>
                <div class="news-title-date">${date}</div>
              </div>
              <i class="fas fa-chevron-down"></i>
            </div>
            <div class="news-body" style="display:none;">
              ${body || '<em>No details provided.</em>'}
            </div>
          </div>
        `;
        })
        .join('');

      // toggle body open/close
      container.querySelectorAll('.news-card').forEach(card => {
        const headerEl = card.querySelector('.news-header');
        const bodyEl = card.querySelector('.news-body');
        headerEl.addEventListener('click', () => {
          const visible = bodyEl.style.display === 'block';
          bodyEl.style.display = visible ? 'none' : 'block';
        });
      });
    })
    .catch(err => {
      console.error('News error', err);
      if (loading) loading.remove();
      container.innerHTML =
        '<div class="announcement-card"><div class="card-title">Failed to load news. Check NEWS_SHEET_CSV_URL.</div></div>';
    });
}

// ====== INITIALISATION ======
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initAccordions();
  initTbtAndJsa();
  initObservationsFilters();
  renderKpiCards();
  switchTool('kpi');
  loadObservations();
  fetchEomAndLeaderboard();
  loadNews();

  // Configure buttons / forms from data.js
  const addBtn = document.getElementById('addObservationButton');
  if (addBtn && window.ADD_OBSERVATION_FORM_URL) {
    addBtn.href = window.ADD_OBSERVATION_FORM_URL;
  }
  const tasksIframe = document.getElementById('tasksIframe');
  if (tasksIframe && window.TASKS_FORM_EMBED_URL) {
    tasksIframe.src = window.TASKS_FORM_EMBED_URL;
  }

  // Default active tab (Home)
  const homeTab = document.getElementById('HomeTab');
  if (homeTab) homeTab.classList.add('active');
});
