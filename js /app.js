// My Observations App – core logic
// This version is designed to work with the index.html + styles you already have.
// It does NOT touch your layout or colors – only behaviour (tabs, numbers, links).

// ====== GLOBAL STATE ======
let observations = [];
let filteredObservations = [];
let leaderboardData = [];
let monthColorFromSheet = "";

// current filters for Observations tab
const obsFilters = {
  range: "today",
  risk: "",
  status: "",
  search: ""
};

// ====== SMALL UTILITIES ======
function safeGet(id) {
  return document.getElementById(id);
}

function setText(id, value, fallback = "--") {
  const el = safeGet(id);
  if (!el) return;
  if (value === null || value === undefined || value === "") {
    el.textContent = fallback;
  } else {
    el.textContent = value;
  }
}

function parseCSV(text) {
  // Simple CSV parser good enough for Google Sheets exports
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const rows = [];
  let current = [];
  let inQuotes = false;
  let field = "";

  for (let line of lines) {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        current.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
    if (inQuotes) {
      field += "\n";
    } else {
      current.push(field);
      rows.push(current);
      current = [];
      field = "";
    }
  }
  if (current.length || field) {
    current.push(field);
    rows.push(current);
  }
  return rows;
}

function parseDate(value) {
  if (!value) return null;
  // Try native Date first (handles yyyy-mm-dd etc.)
  let d = new Date(value);
  if (!isNaN(d)) return d;
  // Try dd/mm/yyyy or mm/dd/yyyy
  const parts = value.split(/[\/\-]/);
  if (parts.length === 3) {
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const p3 = parseInt(parts[2], 10);
    // assume p3 is year
    if (!isNaN(p1) && !isNaN(p2) && !isNaN(p3)) {
      // guess format: if p1 > 12 then it's dd/mm/yyyy
      if (p1 > 12) {
        d = new Date(p3, p2 - 1, p1);
      } else {
        d = new Date(p3, p1 - 1, p2);
      }
      if (!isNaN(d)) return d;
    }
  }
  return null;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

// ====== TABS & NAVIGATION ======
function openTab(evt, tabId) {
  // tab sections
  const tabContents = document.getElementsByClassName("tab-content");
  for (let i = 0; i < tabContents.length; i++) {
    tabContents[i].classList.remove("active");
  }
  const target = safeGet(tabId);
  if (target) target.classList.add("active");

  // nav buttons
  const navButtons = document.getElementsByClassName("nav-button");
  for (let i = 0; i < navButtons.length; i++) {
    navButtons[i].classList.remove("active");
  }
  if (evt && evt.currentTarget) {
    evt.currentTarget.classList.add("active");
  } else {
    // fallback: match by onclick with tabId
    for (let i = 0; i < navButtons.length; i++) {
      const btn = navButtons[i];
      const oc = btn.getAttribute("onclick") || "";
      if (oc.includes("'" + tabId + "'")) {
        btn.classList.add("active");
        break;
      }
    }
  }
}
window.openTab = openTab;

// ====== DARK / LIGHT MODE ======
function toggleDarkMode() {
  const body = document.body;
  const icon = safeGet("modeIcon");
  body.classList.toggle("dark-mode");
  if (icon) {
    if (body.classList.contains("dark-mode")) {
      icon.classList.remove("fa-moon");
      icon.classList.add("fa-sun");
    } else {
      icon.classList.add("fa-moon");
      icon.classList.remove("fa-sun");
    }
  }
}
window.toggleDarkMode = toggleDarkMode;

// ====== MODALS ======
function showLeaderboardModal() {
  const modal = safeGet("leaderboardModal");
  if (!modal) return;
  modal.style.display = "block";
  // ensure latest data
  renderLeaderboard();
}
function hideLeaderboardModal() {
  const modal = safeGet("leaderboardModal");
  if (modal) modal.style.display = "none";
}
window.showLeaderboardModal = showLeaderboardModal;
window.hideLeaderboardModal = hideLeaderboardModal;

function showEmergencyContactsModal() {
  const modal = safeGet("emergencyContactsModal");
  if (modal) modal.style.display = "block";
}
function hideEmergencyContactsModal() {
  const modal = safeGet("emergencyContactsModal");
  if (modal) modal.style.display = "none";
}
window.showEmergencyContactsModal = showEmergencyContactsModal;
window.hideEmergencyContactsModal = hideEmergencyContactsModal;

// ====== ACCORDIONS (Info / Home accordions) ======
function initAccordions() {
  const accordions = document.getElementsByClassName("accordion");
  for (let i = 0; i < accordions.length; i++) {
    accordions[i].addEventListener("click", function () {
      this.classList.toggle("active");
      const panel = this.nextElementSibling;
      if (!panel) return;
      if (panel.style.maxHeight) {
        panel.style.maxHeight = null;
      } else {
        panel.style.maxHeight = panel.scrollHeight + "px";
      }
    });
  }
}

// ====== GPS LOCATION (Emergency section) ======
function getGPSLocation() {
  const resultEl = safeGet("locationResult");
  if (!resultEl) return;
  if (!navigator.geolocation) {
    resultEl.textContent = "Geolocation is not supported on this device.";
    return;
  }
  resultEl.textContent = "Getting your location...";
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
      resultEl.innerHTML = `
        <strong>Location captured:</strong><br>
        Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}<br>
        <a href="${mapsUrl}" target="_blank">Open in Google Maps</a>
      `;
    },
    err => {
      resultEl.textContent = "Unable to get location. Check permissions/GPS.";
      console.error(err);
    }
  );
}
window.getGPSLocation = getGPSLocation;

// ====== TBT OF THE DAY + LIBRARY ======
function loadTbtOfDay() {
  const tbtList = window.tbtData || [];
  const homeTbtContent = safeGet("homeTbtContent");
  const tbtPanel = safeGet("tbtPanel");

  if (!tbtList.length) {
    if (homeTbtContent) homeTbtContent.textContent = "No TBT data configured. Add items in js/data.js.";
    if (tbtPanel) tbtPanel.textContent = "No TBT items found.";
    return;
  }

  // pick deterministic TBT based on day of year
  const today = new Date();
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const tbtOfDay = tbtList[dayOfYear % tbtList.length];

  if (homeTbtContent) {
    homeTbtContent.innerHTML = `
      <div><strong>${tbtOfDay.title}</strong></div>
      <a href="${tbtOfDay.link}" target="_blank">Open TBT document</a>
    `;
  }

  if (tbtPanel) {
    tbtPanel.innerHTML = tbtList
      .map(
        item => `
        <button class="tbt-list-item" onclick="window.open('${item.link}', '_blank')">
          <i class="fas fa-book-open"></i>
          <span>${item.title}</span>
        </button>`
      )
      .join("");
  }

  // Also fill TBT Library tab (left column)
  const tbtLibraryList = safeGet("tbtLibraryList");
  if (tbtLibraryList) {
    tbtLibraryList.innerHTML = tbtList
      .map(
        item => `
        <div class="library-item" onclick="window.open('${item.link}','_blank')">
          <i class="fas fa-book-open"></i>
          <span>${item.title}</span>
        </div>`
      )
      .join("");
  }
}

// ====== JSA LIBRARY & SEARCH ======
function renderJSAList(data) {
  const container = safeGet("jsaListContainer");
  if (!container) return;

  if (!data || !data.length) {
    container.innerHTML = `<p class="empty-note">No matching JSA found.</p>`;
    return;
  }

  container.innerHTML = data
    .map(
      item => `
      <div class="jsa-card">
        <button class="jsa-card-header" onclick="window.open('${item.link}','_blank')">
          <div class="jsa-title">
            <i class="fas fa-file-alt"></i>
            <span>${item.title}</span>
          </div>
          <i class="fas fa-external-link-alt jsa-open-icon"></i>
        </button>
      </div>`
    )
    .join("");
}

function initJsaSearch() {
  const searchInput = safeGet("jsaSearch");
  const allJsa = window.jsaData || [];
  if (!searchInput) return;

  renderJSAList(allJsa);

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    const filtered = allJsa.filter(item =>
      item.title.toLowerCase().includes(q)
    );
    renderJSAList(filtered);
  });
}

// ====== OBSERVATIONS: LOAD & DASHBOARD ======
function loadObservations() {
  const url = window.OBSERVATIONS_SHEET_CSV_URL;
  if (!url) {
    const empty = safeGet("observationsEmptyState");
    if (empty) empty.style.display = "block";
    return;
  }

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      if (!rows.length) return;

      const headers = rows[0];
      const dateIndex = headers.findIndex(h => h.trim().toLowerCase() === "date");
      const raLevelIndex = headers.findIndex(h => h.trim().toLowerCase() === "ra level");
      const statusIndex = headers.findIndex(h => h.trim().toLowerCase() === "report status");
      const typeIndex = headers.findIndex(h => h.trim().toLowerCase().includes("observation types"));
      const descIndex = headers.findIndex(h => h.trim().toLowerCase() === "description");
      const areaIndex = headers.findIndex(h => h.trim().toLowerCase() === "area");
      const nameIndex = headers.findIndex(h => h.trim().toLowerCase() === "name");
      const idIndex = headers.findIndex(h => h.trim().toLowerCase() === "id");

      observations = rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h.trim()] = (row[i] || "").trim();
        });
        obj._date = dateIndex >= 0 ? parseDate(row[dateIndex]) : null;
        obj._raLevel = raLevelIndex >= 0 ? (row[raLevelIndex] || "").trim() : "";
        obj._status = statusIndex >= 0 ? (row[statusIndex] || "").trim() : "";
        obj._type = typeIndex >= 0 ? (row[typeIndex] || "").trim() : "";
        obj._desc = descIndex >= 0 ? (row[descIndex] || "").trim() : "";
        obj._area = areaIndex >= 0 ? (row[areaIndex] || "").trim() : "";
        obj._observer = nameIndex >= 0 ? (row[nameIndex] || "").trim() : (idIndex >= 0 ? (row[idIndex] || "").trim() : "");
        return obj;
      }).filter(o => o._date instanceof Date && !isNaN(o._date));

      updateObservationKpis();
      initObservationFilters();
      applyObservationFilters();
    })
    .catch(err => {
      console.error("Error loading observations:", err);
      const empty = safeGet("observationsEmptyState");
      if (empty) {
        empty.style.display = "block";
        empty.querySelector("p").textContent =
          "Error loading observations. Check OBSERVATIONS_SHEET_CSV_URL in js/data.js.";
      }
    });
}

function updateObservationKpis() {
  if (!observations.length) return;
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const todayObs = observations.filter(o => isSameDay(o._date, today));
  const observersToday = new Set(todayObs.map(o => o._observer).filter(Boolean)).size;
  const highOpen = observations.filter(o =>
    o._raLevel.toLowerCase().includes("high") &&
    o._status.toLowerCase() !== "closed"
  ).length;

  setText("homeObserversToday", observersToday || "--");
  setText("homeObservationsToday", todayObs.length || "--");
  setText("homeHighRiskOpen", highOpen || "--");

  const monthObs = observations.filter(o => o._date >= monthStart);
  const openCount = monthObs.filter(o => o._status.toLowerCase() !== "closed").length;
  const closedCount = monthObs.filter(o => o._status.toLowerCase() === "closed").length;

  setText("obsCountMonth", monthObs.length || "--");
  setText("obsCountOpen", openCount || "--");
  setText("obsCountClosed", closedCount || "--");
}

function initObservationFilters() {
  const chips = document.querySelectorAll(".obs-filter-chip");
  chips.forEach(chip => {
    chip.addEventListener("click", () => {
      chips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      obsFilters.range = chip.dataset.range || "today";
      applyObservationFilters();
    });
  });

  const riskSelect = safeGet("obsFilterRisk");
  if (riskSelect) {
    riskSelect.addEventListener("change", () => {
      obsFilters.risk = riskSelect.value;
      applyObservationFilters();
    });
  }
  const statusSelect = safeGet("obsFilterStatus");
  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      obsFilters.status = statusSelect.value;
      applyObservationFilters();
    });
  }
  const searchInput = safeGet("obsSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      obsFilters.search = searchInput.value.toLowerCase();
      applyObservationFilters();
    });
  }

  const openSheetBtn = safeGet("openSheetButton");
  if (openSheetBtn && window.OBSERVATIONS_FULL_SHEET_URL) {
    openSheetBtn.addEventListener("click", () => {
      window.open(window.OBSERVATIONS_FULL_SHEET_URL, "_blank");
    });
  }
}

function applyObservationFilters() {
  const listEl = safeGet("observationsList");
  const emptyEl = safeGet("observationsEmptyState");
  if (!listEl || !emptyEl) return;

  if (!observations.length) {
    emptyEl.style.display = "block";
    listEl.innerHTML = "";
    return;
  }

  const today = new Date();
  const weekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  filteredObservations = observations.filter(o => {
    const d = o._date;

    if (obsFilters.range === "today" && !isSameDay(d, today)) return false;
    if (obsFilters.range === "week" && (d < weekAgo || d > today)) return false;
    if (obsFilters.range === "month" && d < monthStart) return false;

    if (obsFilters.risk) {
      if (o._raLevel.toLowerCase() !== obsFilters.risk.toLowerCase()) return false;
    }

    if (obsFilters.status) {
      const s = o._status.toLowerCase();
      if (obsFilters.status === "Open" && s === "closed") return false;
      if (obsFilters.status === "Closed" && s !== "closed") return false;
      if (obsFilters.status === "In Progress" && !["in progress", "open"].includes(s)) return false;
    }

    if (obsFilters.search) {
      const haystack = [
        o._type,
        o._desc,
        o._area,
        o._observer
      ].join(" ").toLowerCase();
      if (!haystack.includes(obsFilters.search)) return false;
    }

    return true;
  });

  if (!filteredObservations.length) {
    emptyEl.style.display = "block";
    listEl.innerHTML = `
      <div class="obs-empty-message">
        <i class="fas fa-info-circle"></i>
        <p>No observations match the selected filters.</p>
      </div>`;
    return;
  }

  emptyEl.style.display = "none";
  listEl.innerHTML = filteredObservations
    .map(o => {
      const riskClass = o._raLevel ? o._raLevel.toLowerCase() : "unknown";
      const statusClass = o._status ? o._status.toLowerCase().replace(/\s+/g, "-") : "unknown";
      return `
        <div class="obs-card">
          <div class="obs-card-header">
            <span class="obs-card-date">${o.Date || ""}</span>
            <span class="obs-status ${"status-" + statusClass}">${o._status || "Status?"}</span>
          </div>
          <div class="obs-card-body">
            <div class="obs-type">${o._type || "Observation"}</div>
            <div class="obs-desc">${o._desc || ""}</div>
          </div>
          <div class="obs-card-footer">
            <span class="obs-chip risk-${riskClass}">${o._raLevel || "RA Level"}</span>
            <span class="obs-chip">${o._area || ""}</span>
            <span class="obs-chip">${o._observer || ""}</span>
          </div>
        </div>`;
    })
    .join("");
}

// ====== EMPLOYEE OF MONTH + LEADERBOARD ======
function fetchEOMData() {
  const url = window.EOM_SHEET_URL;
  if (!url) return;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(csvText => {
      const rows = csvText.replace(/\r/g, "").split("\n").slice(1); // skip header
      leaderboardData = [];
      let maxPoints = -1;
      let topEmployee = "";

      rows.forEach(row => {
        if (row.trim() === "") return;
        const cols = row.split(",").map(col => col.replace(/["']/g, "").trim());
        const name = cols[0] || "";
        const points = parseFloat(cols[1]);
        const color = cols[2] || "";

        if (!monthColorFromSheet && color) {
          monthColorFromSheet = color;
        }

        if (name) {
          const p = !isNaN(points) ? points : 0;
          leaderboardData.push({ name, points: p });
          if (p > maxPoints) {
            maxPoints = p;
            topEmployee = name;
          }
        }
      });

      const eomEl = safeGet("employeeOfMonth");
      if (eomEl) eomEl.textContent = topEmployee || "No data (check sheet)";

      const colorEl = safeGet("colorName");
      if (colorEl) {
        const displayColor = monthColorFromSheet || colorEl.textContent || "White";
        colorEl.textContent = displayColor;
        // try to set text color if looks like a real color
        if (/^[a-zA-Z]+$/.test(displayColor)) {
          colorEl.style.color = displayColor.toLowerCase();
        }
      }

      // update home mini leaderboard if available
      renderLeaderboardMini();
    })
    .catch(err => {
      console.error("Error fetching EOM/leaderboard:", err);
      const eomEl = safeGet("employeeOfMonth");
      if (eomEl) eomEl.textContent = "Error loading data (link check)";
      const container = safeGet("leaderboardContainer");
      if (container) {
        container.innerHTML = `<p class="empty-note">Failed to load leaderboard data.</p>`;
      }
    });
}

function renderLeaderboard() {
  const container = safeGet("leaderboardContainer");
  if (!container) return;
  if (!leaderboardData.length) {
    container.innerHTML = `<p class="empty-note">No leaderboard data yet.</p>`;
    return;
  }
  const sorted = [...leaderboardData].sort((a, b) => b.points - a.points);
  container.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr><th>#</th><th>Name</th><th>Points</th></tr>
      </thead>
      <tbody>
        ${sorted
          .map(
            (row, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${row.name}</td>
                <td>${row.points}</td>
              </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function renderLeaderboardMini() {
  const container = safeGet("homeLeaderboardMini");
  if (!container) return;
  if (!leaderboardData.length) {
    container.innerHTML = `<p class="empty-note">No leaderboard data.</p>`;
    return;
  }
  const sorted = [...leaderboardData].sort((a, b) => b.points - a.points).slice(0, 3);
  container.innerHTML = `
    <ol class="mini-leaderboard">
      ${sorted
        .map(
          (row, idx) => `
            <li>
              <span class="position">${idx + 1}</span>
              <span class="name">${row.name}</span>
              <span class="points">${row.points}</span>
            </li>`
        )
        .join("")}
    </ol>`;
}

// ====== TOOLS TAB (KPI / HEAT / WIND) ======
function switchTool(tool) {
  const kpiSection = safeGet("kpiSection");
  const heatSection = safeGet("heatStressSection");
  const windSection = safeGet("windSpeedSection");
  const buttons = document.querySelectorAll(".tool-toggle-btn");

  if (kpiSection) kpiSection.style.display = tool === "kpi" ? "block" : "none";
  if (heatSection) heatSection.style.display = tool === "heat" ? "block" : "none";
  if (windSection) windSection.style.display = tool === "wind" ? "block" : "none";

  buttons.forEach(btn => {
    if (btn.dataset.tool === tool) {
      btn.classList.add("active-tool");
    } else {
      btn.classList.remove("active-tool");
    }
  });
}
window.switchTool = switchTool;

// KPI placeholders – you can customise later
function initKpiSection() {
  const container = safeGet("kpiListContainer");
  if (!container) return;
  container.innerHTML = `
    <div class="kpi-hint">
      Configure your KPI formulas in this section later.
      For now this is a static placeholder so the layout stays nice.
    </div>`;
}

// Heat index calculation (simple formula)
function calculateHeatIndex() {
  const tInput = safeGet("inputTemp");
  const hInput = safeGet("inputHumidity");
  if (!tInput || !hInput) return;

  const t = parseFloat(tInput.value);
  const rh = parseFloat(hInput.value);
  const valueEl = safeGet("heatIndexValue");
  const levelEl = safeGet("heatRiskLevel");
  const listEl = safeGet("heatRecommendationsList");

  if (isNaN(t) || isNaN(rh)) {
    if (valueEl) valueEl.textContent = "--";
    if (levelEl) levelEl.textContent = "--";
    if (listEl) listEl.innerHTML = "<li>Enter temperature and humidity to see results.</li>";
    return;
  }

  // NOAA approximation in °F, then convert back to °C
  const T = t * 9 / 5 + 32;
  const HI_F =
    -42.379 + 2.04901523 * T + 10.14333127 * rh
    - 0.22475541 * T * rh - 6.83783e-3 * T * T
    - 5.481717e-2 * rh * rh + 1.22874e-3 * T * T * rh
    + 8.5282e-4 * T * rh * rh - 1.99e-6 * T * T * rh * rh;
  const HI_C = (HI_F - 32) * 5 / 9;

  let level = "";
  let tips = [];
  if (HI_C < 27) {
    level = "Caution";
    tips = ["Monitor workers", "Encourage hydration"];
  } else if (HI_C < 32) {
    level = "Extreme Caution";
    tips = ["Increase water breaks", "Watch for heat stress symptoms"];
  } else if (HI_C < 41) {
    level = "Danger";
    tips = ["Limit heavy work", "Schedule more frequent breaks", "Monitor vulnerable workers closely"];
  } else {
    level = "Extreme Danger";
    tips = ["Consider stopping non-essential work", "Medical support must be available"];
  }

  if (valueEl) valueEl.textContent = HI_C.toFixed(1) + "°C HI";
  if (levelEl) levelEl.textContent = level;
  if (listEl) {
    listEl.innerHTML = tips.map(tip => `<li>${tip}</li>`).join("");
  }

  // also mirror a compact summary in Home tab if exists
  const homeHeat = safeGet("homeHeatSummary");
  if (homeHeat) homeHeat.textContent = `${level} (${HI_C.toFixed(0)}°C HI)`;
}
window.calculateHeatIndex = calculateHeatIndex;

function calculateWindSafety() {
  const wInput = safeGet("inputWind");
  if (!wInput) return;
  const v = parseFloat(wInput.value);
  const valueEl = safeGet("windValue");
  const levelEl = safeGet("windRiskLevel");
  const listEl = safeGet("windRecommendationsList");

  if (isNaN(v)) {
    if (valueEl) valueEl.textContent = "--";
    if (levelEl) levelEl.textContent = "--";
    if (listEl) listEl.innerHTML = "<li>Enter wind speed to see limits.</li>";
    return;
  }

  let level = "";
  let tips = [];
  if (v < 25) {
    level = "Safe";
    tips = ["Normal lifting allowed", "Monitor for gusts"];
  } else if (v < 38) {
    level = "Caution";
    tips = ["Review crane charts", "Restrict large surfaces", "Stop manbasket if gusty"];
  } else if (v < 45) {
    level = "High Risk";
    tips = ["Stop non-essential lifting", "Engineer review required"];
  } else {
    level = "Stop Work";
    tips = ["Stop all crane & manbasket operations"];
  }

  if (valueEl) valueEl.textContent = v.toFixed(1) + " km/h";
  if (levelEl) levelEl.textContent = level;
  if (listEl) {
    listEl.innerHTML = tips.map(tip => `<li>${tip}</li>`).join("");
  }

  const homeWind = safeGet("homeWindSummary");
  if (homeWind) homeWind.textContent = `${level} (${v.toFixed(0)} km/h)`;
}
window.calculateWindSafety = calculateWindSafety;

// ====== NEWS / ANNOUNCEMENTS ======
function loadNews() {
  const url = window.NEWS_SHEET_CSV_URL;
  const container = safeGet("AnnouncementsContainer");
  const loading = safeGet("newsLoading");
  if (!url || !container) return;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(text => {
      if (loading) loading.style.display = "none";
      const rows = parseCSV(text);
      if (!rows.length) {
        container.innerHTML = `<p class="empty-note">No news configured.</p>`;
        return;
      }
      const headers = rows[0].map(h => h.trim().toLowerCase());
      const dateIdx = headers.findIndex(h => h === "date");
      const titleIdx = headers.findIndex(h => h === "title");
      const typeIdx = headers.findIndex(h => h === "type");
      const msgIdx = headers.findIndex(h => h === "message" || h === "description");
      const linkIdx = headers.findIndex(h => h === "link");

      container.innerHTML = rows.slice(1).map(row => {
        const date = dateIdx >= 0 ? (row[dateIdx] || "").trim() : "";
        const title = titleIdx >= 0 ? (row[titleIdx] || "").trim() : "Announcement";
        const type = typeIdx >= 0 ? (row[typeIdx] || "").trim() : "";
        const msg = msgIdx >= 0 ? (row[msgIdx] || "").trim() : "";
        const link = linkIdx >= 0 ? (row[linkIdx] || "").trim() : "";

        const typeIcon = type.toLowerCase().includes("alert") ? "fa-triangle-exclamation"
          : type.toLowerCase().includes("event") ? "fa-calendar-day"
          : "fa-bullhorn";

        return `
          <div class="news-card">
            <button class="news-card-header">
              <div class="news-title">
                <i class="fas ${typeIcon}"></i>
                <span>${title}</span>
              </div>
              <span class="news-date">${date}</span>
            </button>
            <div class="news-body">
              <p>${msg}</p>
              ${link ? `<a href="${link}" target="_blank">Open document</a>` : ""}
            </div>
          </div>`;
      }).join("");
    })
    .catch(err => {
      console.error("Error loading news:", err);
      if (loading) loading.style.display = "none";
      if (container) container.innerHTML = `<p class="empty-note">Failed to load news. Check NEWS_SHEET_CSV_URL in js/data.js.</p>`;
    });
}

// ====== INITIALISATION ======
function initApp() {
  try {
    initAccordions();
    initJsaSearch();
    initKpiSection();

    // Google Forms / links from data.js
    const tasksIframe = safeGet("tasksIframe");
    if (tasksIframe && window.TASKS_FORM_EMBED_URL) {
      tasksIframe.src = window.TASKS_FORM_EMBED_URL;
    }
    const addBtn = safeGet("addObservationButton");
    if (addBtn && window.ADD_OBSERVATION_FORM_URL) {
      addBtn.href = window.ADD_OBSERVATION_FORM_URL;
    }

    loadTbtOfDay();
    fetchEOMData();
    loadObservations();
    loadNews();

    // default to Home tab if it exists
    const homeTab = safeGet("HomeTab");
    if (homeTab) {
      homeTab.classList.add("active");
    }
  } catch (e) {
    console.error("Error during initApp:", e);
  }
}

document.addEventListener("DOMContentLoaded", initApp);
