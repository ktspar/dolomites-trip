
let data = null;
const state = {
  selectedBase: 'ortisei',
  selectedDay: 'day1',
  selectedWeather: 'bluebird',
  selectedEnergy: 'medium',
  selectedVibe: 'green_meadows',
  selectedCommitment: 'any',
  hotelSelection: {
    ortisei: { presetId: null, customEnabled: false, customName: '', customMapLink: '', customMapQuery: '' },
    cortina: { presetId: null, customEnabled: false, customName: '', customMapLink: '', customMapQuery: '' }
  },
  openDays: new Set(),
};

const weatherOptions = [
  { id: 'bluebird', label: 'Bluebird' },
  { id: 'partly_cloudy', label: 'Partly cloudy' },
  { id: 'high_clouds_dry', label: 'High clouds but dry' },
  { id: 'mixed_weather', label: 'Mixed weather' },
  { id: 'bad_weather', label: 'Bad weather' },
  { id: 'storm_risk', label: 'Storm risk' }
];
const energyOptions = [
  { id: 'high', label: 'High energy' },
  { id: 'medium', label: 'Medium energy' },
  { id: 'low', label: 'Low / recovery' }
];
const vibeOptions = [
  { id: 'dramatic_white_rock', label: 'Dramatic white rock' },
  { id: 'green_meadows', label: 'Green meadows + huts' },
  { id: 'church_postcard', label: 'Church / postcard village' },
  { id: 'lake', label: 'Lake scenery' },
  { id: 'scenic_drive_only', label: 'Scenic drive only' }
];
const commitmentOptions = [
  { id: 'any', label: 'Any' },
  { id: 'must_reserve', label: 'Must reserve' },
  { id: 'reserve_if_possible', label: 'Better to reserve' },
  { id: 'day_of_ok', label: 'Easy day-of' }
];

async function init() {
  try {
    const res = await fetch('./trip-data.json');
    data = await res.json();
    initializeHotels();
    render();
    registerServiceWorker();
  } catch (e) {
    console.error(e);
    const app = document.getElementById('app');
    app.innerHTML = '<section class="section"><div class="section-header"><h2>Could not load trip data</h2><p>Please make sure <code>trip-data.json</code> is published correctly.</p></div><div class="section-body"></div></section>';
  }
}

function initializeHotels() {
  ['ortisei', 'cortina'].forEach(base => {
    const cfg = data.hotels?.[base];
    const fallback = cfg?.defaultHotelId || cfg?.presetHotels?.[0]?.id || null;
    state.hotelSelection[base].presetId = fallback;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
}

function escapeHtml(value='') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value='') {
  return escapeHtml(value);
}

function formatRichText(input='') {
  let html = escapeHtml(input);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/(^|[\s(>])((https?:\/\/[^\s<]+))/g, (m,prefix,url) => `${prefix}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
  return html;
}

function googleSearchLink(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleDirectionsLink({ originQuery, destinationQuery, waypoints = [], travelMode = 'driving' }) {
  const params = new URLSearchParams({ api: '1', origin: originQuery, destination: destinationQuery, travelmode: travelMode });
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function getSelectedHotel(base) {
  const selection = state.hotelSelection[base];
  const cfg = data.hotels[base];
  if (selection.customEnabled && selection.customName && (selection.customMapLink || selection.customMapQuery)) {
    const query = selection.customMapQuery || selection.customName;
    return { id:'custom', name: selection.customName, mapQuery: query, mapLink: selection.customMapLink || googleSearchLink(query) };
  }
  return cfg.presetHotels.find(h => h.id === selection.presetId) || cfg.presetHotels[0];
}

function resolvePlace(id) { return data.places[id] || null; }

function buildRouteLink(routeDef) {
  if (!routeDef) return null;
  let originQuery = '';
  let destinationQuery = '';
  const waypoints = [];
  const travelMode = routeDef.travelMode || 'driving';
  if (routeDef.transferBetweenBases) {
    originQuery = getSelectedHotel(routeDef.originBase).mapQuery;
    destinationQuery = getSelectedHotel(routeDef.destinationBase).mapQuery;
  } else {
    if (routeDef.originBase) originQuery = getSelectedHotel(routeDef.originBase).mapQuery;
    if (routeDef.destinationBase) destinationQuery = getSelectedHotel(routeDef.destinationBase).mapQuery;
    if (routeDef.originPlace) originQuery = resolvePlace(routeDef.originPlace)?.mapQuery || '';
    if (routeDef.destination) destinationQuery = resolvePlace(routeDef.destination)?.mapQuery || '';
  }
  (routeDef.waypoints || []).forEach(id => { const p = resolvePlace(id); if (p) waypoints.push(p.mapQuery); });
  if (!originQuery || !destinationQuery) return null;
  return googleDirectionsLink({ originQuery, destinationQuery, waypoints, travelMode });
}

function buildDriveRouteLink(drive) {
  if (!drive) return null;
  const route = drive.route || {};
  const originBase = route.base || drive.bestBase;
  const originQuery = getSelectedHotel(originBase === 'both' ? state.selectedBase : originBase).mapQuery;
  const waypoints = (route.waypoints || []).map(id => resolvePlace(id)?.mapQuery).filter(Boolean);
  let destinationQuery = originQuery;
  if (route.destinationBase) destinationQuery = getSelectedHotel(route.destinationBase).mapQuery;
  if (route.returnToOrigin) destinationQuery = originQuery;
  return googleDirectionsLink({ originQuery, destinationQuery, waypoints, travelMode:'driving' });
}

function el(tag, className='', html='') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function badge(text, cls='') { return el('span', `badge ${cls}`.trim(), escapeHtml(text)); }
function linkEl(label, href) {
  const a = document.createElement('a');
  a.href = href;
  if (!href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener'; }
  a.textContent = label;
  return a;
}

function updateTopBar() {
  document.getElementById('top-current-base').textContent = `Base: ${data.bases.find(b => b.id === state.selectedBase).label}`;
  document.getElementById('top-ortisei-hotel').textContent = `${data.hotels.ortisei.label.replace(/ \(default:.*\)$/,'')}: ${getSelectedHotel('ortisei').name}`;
  document.getElementById('top-cortina-hotel').textContent = `${data.hotels.cortina.label.replace(/ \(default:.*\)$/,'')}: ${getSelectedHotel('cortina').name}`;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  updateTopBar();
  app.appendChild(renderOverview());
  app.appendChild(renderControls());
  app.appendChild(renderDecisionTools());
  app.appendChild(renderDayPicker());
  app.appendChild(renderDailyPlan());
  app.appendChild(renderHikeLibrary());
  app.appendChild(renderScenicDrives());
  app.appendChild(renderAccessBooking());
  wireNavActive();
}

function sectionShell(id, title, subtitle) {
  const section = el('section', 'section');
  section.id = id;
  section.innerHTML = `<div class="section-header"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div><div class="section-body"></div>`;
  return section;
}

function metricCard(title, contentHtml) {
  return el('div', 'metric-card', `<h3>${escapeHtml(title)}</h3><div class="muted">${contentHtml}</div>`);
}

function regionLabelFromBase(base) {
  if (base === "ortisei") return "West";
  if (base === "cortina") return "East";
  return "Transfer / mixed";
}

function regionForOverviewGroup(group) {
  const name = String(group?.group || '').toLowerCase();
  if (name.includes('west')) return 'West';
  if (name.includes('east')) return 'East';
  const first = group?.items?.[0];
  if (first?.type === 'hike') return regionLabelFromBase(data.hikes?.[first.id]?.bestBase);
  if (first?.type === 'drive') {
    const bestBase = data.drives?.[first.id]?.bestBase;
    return bestBase === 'both' ? 'Transfer / mixed' : regionLabelFromBase(bestBase);
  }
  return 'Transfer / mixed';
}

function nestOverviewGroups(groups=[]) {
  const regionOrder = ['West', 'East', 'Transfer / mixed'];
  const map = {};
  groups.forEach(group => {
    const region = regionForOverviewGroup(group);
    (map[region] ||= []).push(group);
  });
  return regionOrder.filter(r => map[r]?.length).map(region => ({ region, groups: map[region] }));
}

function renderOverviewItem(item) {
  let href = '';
  if (item.type === 'hike') href = data.hikes?.[item.id]?.allTrailsUrl || '';
  if (item.type === 'drive') href = buildDriveRouteLink(data.drives?.[item.id]) || '';
  return href ? `<a class="overview-link-pill" href="${href}" target="_blank" rel="noopener">${escapeHtml(item.label)}</a>` : `<span class="badge">${escapeHtml(item.label)}</span>`;
}
function renderOverviewGroups(groups=[]) {
  return nestOverviewGroups(groups).map(regionBlock => `
    <section class="overview-region-block">
      <div class="overview-region-title">${escapeHtml(regionBlock.region)}</div>
      <div class="overview-area-stack">
        ${regionBlock.groups.map(group => `
          <div class="overview-group compact">
            <div class="overview-group-title">${escapeHtml(group.group)}</div>
            <div class="overview-link-list compact">${(group.items||[]).map(renderOverviewItem).join('')}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `).join('');
}

function renderOverview() {
  const section = sectionShell('overview', 'Overview / Trip Summary', data.trip.intro);
  const body = section.querySelector('.section-body');
  const grid = el('div', 'overview-grid');
  const left = el('div', 'panel');
  left.innerHTML = `
    <h3>Route</h3>
    <p>${escapeHtml(data.trip.routeSummary)}</p>
    <div class="status-row">
      <span class="badge accent">4 nights Schgaguler</span>
      <span class="badge accent">3 nights Golden Hill</span>
      <span class="badge">Overview first</span>
      <span class="badge">Dynamic logistics</span>
    </div>
    <div class="link-list">
      <a href="#daily-plan">Go to Daily Plan</a>
      <a href="#decision-tools">Open Decision Tools</a>
      <a href="#access-booking">Check Access & Booking</a>
    </div>`;
  const right = el('div', 'cards-grid two');
  const sections = data.trip.overviewSections || {};
  right.appendChild(metricCard('Top priorities', renderOverviewGroups(sections.topPriorities || [])));
  right.appendChild(metricCard('Must-book item', 'Tre Cime / Auronzo road access is the main reservation-critical item.'));
  right.appendChild(metricCard('Best bluebird targets', renderOverviewGroups(sections.bestBluebirdTargets || [])));
  right.appendChild(metricCard('Best mixed-weather targets', renderOverviewGroups(sections.bestMixedWeatherTargets || [])));
  grid.appendChild(left); grid.appendChild(right); body.appendChild(grid);
  return section;
}

function renderControls() {
  const section = sectionShell('controls', 'Current Base & Hotel Controls', 'Base-aware recommendations and hotel-aware routes. Changing a hotel updates route links that start or end there.');
  const body = section.querySelector('.section-body');
  const grid = el('div', 'info-grid two');
  const left = el('div', 'panel');
  left.innerHTML = '<h3>Current base</h3><p class="muted">Use this to make recommendations practical for where you are staying now.</p>';
  const baseRow = el('div', 'segmented chip-row');
  data.bases.forEach(base => {
    const btn = el('button', state.selectedBase === base.id ? 'active' : '', escapeHtml(base.label));
    btn.addEventListener('click', () => { state.selectedBase = base.id; render(); });
    baseRow.appendChild(btn);
  });
  left.appendChild(baseRow);
  left.appendChild(el('div', 'toolbar-note', 'Base is treated as a hard requirement in the Decision Tools.'));
  const right = el('div', 'cards-grid two');
  right.appendChild(renderHotelControl('ortisei'));
  right.appendChild(renderHotelControl('cortina'));
  grid.appendChild(left); grid.appendChild(right); body.appendChild(grid);
  return section;
}

function renderHotelControl(base) {
  const config = data.hotels[base];
  const selection = state.hotelSelection[base];
  const card = el('div', 'panel');
  card.innerHTML = `<h3>${escapeHtml(config.label)}</h3>`;
  const presetWrap = el('div');
  presetWrap.innerHTML = `<label class="field-label">Preset hotel</label>`;
  const select = document.createElement('select');
  config.presetHotels.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.id; opt.textContent = h.name;
    if (selection.presetId === h.id) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', e => { selection.presetId = e.target.value; render(); });
  presetWrap.appendChild(select); card.appendChild(presetWrap);
  const toggleWrap = el('label', 'inline-toggle');
  const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selection.customEnabled;
  check.addEventListener('change', e => { selection.customEnabled = e.target.checked; render(); });
  toggleWrap.appendChild(check); toggleWrap.appendChild(document.createTextNode('Use custom hotel override'));
  card.appendChild(toggleWrap);
  const customWrap = el('div', selection.customEnabled ? '' : 'hidden');
  customWrap.style.marginTop = '10px';
  customWrap.innerHTML = `
    <label class="field-label">Custom hotel name</label>
    <input type="text" data-hotel-input="${base}-name" value="${escapeAttr(selection.customName)}" placeholder="e.g. Hotel name or apartment label" />
    <label class="field-label" style="margin-top:10px;">Custom Google Maps link (optional)</label>
    <input type="text" data-hotel-input="${base}-link" value="${escapeAttr(selection.customMapLink)}" placeholder="Paste Google Maps place/search link" />
    <label class="field-label" style="margin-top:10px;">Custom map query (used if no link is pasted)</label>
    <input type="text" data-hotel-input="${base}-query" value="${escapeAttr(selection.customMapQuery)}" placeholder="e.g. Hotel name Kastelruth" />`;
  customWrap.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', e => {
      if (e.target.dataset.hotelInput.endsWith('-name')) selection.customName = e.target.value;
      if (e.target.dataset.hotelInput.endsWith('-link')) selection.customMapLink = e.target.value;
      if (e.target.dataset.hotelInput.endsWith('-query')) selection.customMapQuery = e.target.value;
    });
    input.addEventListener('change', () => render());
  });
  card.appendChild(customWrap);
  const activeHotel = getSelectedHotel(base);
  card.appendChild(el('div', 'footer-note', `Active hotel: <strong>${escapeHtml(activeHotel.name)}</strong> <a href="${activeHotel.mapLink}" target="_blank" rel="noopener">[Map]</a>`));
  return card;
}

function labelCommitment(val) { return ({ must_reserve:'Must reserve', reserve_if_possible:'Better to reserve', day_of_ok:'Easy day-of', easy_day_of:'Easy day-of' })[val] || val; }
function humanWeather(id) { return ({ bluebird:'Bluebird', partly_cloudy:'Partly cloudy', high_clouds_dry:'High clouds but dry', mixed_weather:'Mixed weather', bad_weather:'Bad weather', storm_risk:'Storm risk' })[id] || id; }
function humanEnergy(id) { return ({ high:'High energy', medium:'Medium energy', low:'Low / recovery' })[id] || id; }
function renderApplicableTagBadges(weather = [], energy = [], tags = [], commitment = '') {
  const chunks = [];
  weather.forEach(w => chunks.push(`<span class="badge">${humanWeather(w)}</span>`));
  energy.forEach(e => chunks.push(`<span class="badge">${humanEnergy(e)}</span>`));
  if (tags.includes('green_meadows')) chunks.push('<span class="badge">Green meadows + huts</span>');
  if (tags.includes('dramatic_white_rock')) chunks.push('<span class="badge">Dramatic white rock</span>');
  if (tags.includes('church_postcard')) chunks.push('<span class="badge">Church / postcard village</span>');
  if (tags.includes('lake') || tags.includes('turquoise_lake')) chunks.push('<span class="badge">Lake scenery</span>');
  if (tags.includes('scenic_drive_only')) chunks.push('<span class="badge">Scenic drive only</span>');
  if (commitment) chunks.push(`<span class="badge">${labelCommitment(commitment)}</span>`);
  return chunks.join('');
}

function derivePlanMeta(plan) {
  let tags = [], weather = [], energy = [], commitment = 'day_of_ok';
  if (plan.linkedHikes?.length) {
    plan.linkedHikes.forEach(id => {
      const h = data.hikes[id]; if (!h) return;
      tags = tags.concat(h.tags || []);
      weather = weather.concat(h.weather || []);
      energy = energy.concat(h.energy || []);
      if (h.commitment === 'must_reserve') commitment = 'must_reserve';
      else if (h.commitment === 'reserve_if_possible' && commitment !== 'must_reserve') commitment = 'reserve_if_possible';
    });
  }
  if (plan.linkedDrive) {
    const d = data.drives[plan.linkedDrive];
    if (d) {
      tags = tags.concat(d.tags || []);
      weather = weather.concat(d.weather || []);
      energy = energy.concat(d.energy || []);
      if (d.commitment) commitment = d.commitment;
    }
  }
  return { id: plan.id, title: plan.title, base: plan.base === 'both' ? state.selectedBase : plan.base, weather:[...new Set(weather)], energy:[...new Set(energy)], tags:[...new Set(tags)], commitment, type: plan.type, reasoning: plan.summary };
}

function rankDecisionResults() {
  const candidates = Object.values(data.planCards)
    .filter(plan => plan.base === 'both' || plan.base === state.selectedBase)
    .map(plan => {
      const meta = derivePlanMeta(plan);
      let score = 100;
      if (meta.weather.includes(state.selectedWeather)) score += 40;
      if (meta.energy.includes(state.selectedEnergy)) score += 20;
      if (meta.tags.includes(state.selectedVibe)) score += 20;
      if (state.selectedCommitment === 'any' || meta.commitment === state.selectedCommitment) score += 10;
      if (meta.tags.includes('hero_day') || meta.tags.includes('iconic')) score += 8;
      if (meta.tags.includes('mixed_weather_ok') && ['mixed_weather','bad_weather','storm_risk'].includes(state.selectedWeather)) score += 8;
      if (meta.type === 'scenic_drive' && state.selectedVibe === 'scenic_drive_only') score += 15;
      if (meta.type === 'scenic_drive' && !['mixed_weather','bad_weather','storm_risk','scenic_drive_only'].includes(state.selectedWeather)) score -= 18;
      if (meta.commitment === 'must_reserve' && state.selectedCommitment === 'day_of_ok') score -= 15;
      return { ...meta, score };
    })
    .sort((a,b)=>b.score-a.score);
  const pick = fn => candidates.find(fn);
  return {
    best: candidates[0],
    alternate: pick(c => c.type === 'hike' && c.id !== candidates[0]?.id) || candidates[1],
    bad: pick(c => c.type === 'scenic_drive' || c.weather.includes('mixed_weather') || c.weather.includes('bad_weather')),
    low: pick(c => c.energy.includes('low')),
    wow: pick(c => c.tags.includes('hero_day') || c.tags.includes('dramatic_white_rock') || c.tags.includes('iconic'))
  };
}
function decisionTitleForKey(key) { return ({ best:'Best overall match', alternate:'Best alternate', bad:'Best bad-weather fallback', low:'Best low-effort option', wow:'Best wow-factor option' })[key]; }
function scoreLevel(score) { if (score >= 175) return 'Excellent'; if (score >= 150) return 'Strong'; if (score >= 125) return 'Fair'; return 'Limited'; }
function scoreLevelClass(score) { if (score >= 175) return 'good'; if (score >= 150) return 'accent'; if (score >= 125) return 'warn'; return 'bad'; }
function baseLabel(base) { return data.bases.find(b => b.id === base)?.label || base; }
function matchBreakdown(item) {
  const bits = [`Base: ${baseLabel(item.base)}`];
  if (item.weather.includes(state.selectedWeather)) bits.push('weather matches');
  if (item.energy.includes(state.selectedEnergy)) bits.push('energy matches');
  if (item.tags.includes(state.selectedVibe)) bits.push('vibe matches');
  if (state.selectedCommitment === 'any' || item.commitment === state.selectedCommitment) bits.push('commitment fits');
  return bits.join(' · ');
}

function segmentedGroup(label, options, selected, onSelect) {
  const wrap = el('div'); wrap.style.marginTop = '14px'; wrap.innerHTML = `<label class="field-label">${escapeHtml(label)}</label>`;
  const row = el('div', 'segmented chip-row');
  options.forEach(opt => {
    const btn = el('button', selected === opt.id ? 'active' : '', escapeHtml(opt.label));
    btn.addEventListener('click', () => onSelect(opt.id));
    row.appendChild(btn);
  });
  wrap.appendChild(row);
  return wrap;
}
function buildQuickActionsForPlan(planId) {
  const plan = data.planCards[planId];
  const actions = [];
  if (plan.linkedHikes?.length) plan.linkedHikes.forEach((hid, idx) => {
    const hike = data.hikes[hid];
    if (hike?.allTrailsUrl) actions.push({ label: idx === 0 ? 'AllTrails' : `AllTrails ${idx + 1}`, href: hike.allTrailsUrl });
  });
  if (plan.linkedDrive) {
    const drive = data.drives[plan.linkedDrive];
    const driveHref = buildDriveRouteLink(drive);
    if (driveHref) actions.push({ label: 'Drive route', href: driveHref });
    actions.push({ label: 'Drive details', href: `#drive-${drive.id}` });
  }
  if (plan.accessRoutes?.length) plan.accessRoutes.forEach((route, idx) => {
    const href = buildRouteLink(route); if (href) actions.push({ label: route.label || (idx === 0 ? 'Map' : `Map ${idx + 1}`), href });
  });
  const seen = new Set();
  return actions.filter(x => { if (!x.href || seen.has(x.href)) return false; seen.add(x.href); return true; });
}

function renderDecisionTools() {
  const section = sectionShell('decision-tools', 'Decision Tools', 'Base is required. Other filters are weighted and ranked to surface the best practical match.');
  const body = section.querySelector('.section-body');
  const grid = el('div', 'decision-grid');
  const filters = el('div', 'panel');
  filters.innerHTML = '<h3>Filters</h3><p class="muted">Use one or more of these. Results are ranked by best match, not just filtered.</p>';
  filters.appendChild(segmentedGroup('Weather', weatherOptions, state.selectedWeather, id => { state.selectedWeather = id; render(); }));
  filters.appendChild(segmentedGroup('Energy', energyOptions, state.selectedEnergy, id => { state.selectedEnergy = id; render(); }));
  filters.appendChild(segmentedGroup('Vibe', vibeOptions, state.selectedVibe, id => { state.selectedVibe = id; render(); }));
  filters.appendChild(segmentedGroup('Commitment', commitmentOptions, state.selectedCommitment, id => { state.selectedCommitment = id; render(); }));
  const resultsWrap = el('div', 'panel');
  resultsWrap.innerHTML = '<h3>Ranked results</h3><p class="muted">Base is required. Weather, energy, vibe, and commitment refine the ranking.</p>';
  const results = rankDecisionResults();
  const out = el('div', 'decision-results');
  ['best','alternate','bad','low','wow'].forEach(key => {
    const item = results[key]; if (!item) return;
    const card = el('div', 'result-card');
    const links = buildQuickActionsForPlan(item.id);
    card.innerHTML = `<h3>${decisionTitleForKey(key)}: ${escapeHtml(item.title)}</h3><p>${escapeHtml(item.reasoning)}</p><p class="muted" style="margin-top:6px;">${escapeHtml(matchBreakdown(item))}</p>`;
    const tags = el('div', 'tag-row');
    tags.appendChild(badge(`Match: ${scoreLevel(item.score)}`, scoreLevelClass(item.score)));
    tags.appendChild(badge(`Base: ${baseLabel(item.base)}`));
    card.appendChild(tags);
    const action = el('div', 'link-list');
    links.forEach(l => action.appendChild(linkEl(l.label, l.href)));
    card.appendChild(action);
    out.appendChild(card);
  });
  resultsWrap.appendChild(out);
  grid.appendChild(filters); grid.appendChild(resultsWrap); body.appendChild(grid);
  return section;
}

function renderDayPicker() {
  const section = sectionShell('day-picker', 'Day Picker', 'Jump straight to a day card.');
  const body = section.querySelector('.section-body');
  const row = el('div', 'day-jump');
  data.days.forEach(day => {
    const btn = el('button', state.selectedDay === day.id ? 'active' : '', escapeHtml(day.label));
    btn.addEventListener('click', () => {
      state.selectedDay = day.id;
      state.openDays.add(day.id);
      render();
      document.getElementById(day.id)?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    row.appendChild(btn);
  });
  body.appendChild(row);
  return section;
}

function listOrText(items) {
  if (!Array.isArray(items)) return `<div class="muted rich-text">${formatRichText(items)}</div>`;
  return `<ul class="plain-list">${items.map(i => `<li>${formatRichText(i)}</li>`).join('')}</ul>`;
}
function miniCard(title, contentHtml) {
  return el('div', 'mini-card', `<h5>${escapeHtml(title)}</h5><div class="muted rich-text">${contentHtml}</div>`);
}
function bookingRowsForPlan(plan) {
  const tokens = new Set([...(plan.linkedHikes || []), plan.linkedDrive].filter(Boolean));
  return (data.bookings || []).filter(row => {
    const text = `${row.item} ${row.note}`.toLowerCase();
    return [...tokens].some(t => text.includes(String(t).replaceAll('_',' ').split(' ')[0]));
  });
}
function renderBookingSummary(plan) {
  const base = plan.bookings?.length ? listOrText(plan.bookings) : '<div class="muted">Day-of is usually fine.</div>';
  const rows = bookingRowsForPlan(plan);
  if (!rows.length) return base;
  const extra = rows.map(row => `<li><a href="${row.link}" target="_blank" rel="noopener">${escapeHtml(row.item)}</a> — ${formatRichText(row.note)}</li>`).join('');
  return `${base}<div class="subtle-label">Useful booking links</div><ul class="plain-list">${extra}</ul>`;
}

function renderPlanCard(plan) {
  const card = el('div', 'plan-card');
  const actions = buildQuickActionsForPlan(plan.id);
  const top = el('div', 'topline', `<div class="title-block"><h4>${escapeHtml(plan.title)}</h4><p class="one-liner">${escapeHtml(plan.summary)}</p></div>`);
  card.appendChild(top);
  const links = el('div', 'link-list');
  actions.forEach(a => links.appendChild(linkEl(a.label, a.href)));
  card.appendChild(links);
  const tagRow = el('div', 'tag-row');
  tagRow.appendChild(badge(`Base: ${plan.base === 'both' ? 'Transfer' : baseLabel(plan.base)}`));
  if (plan.linkedHikes?.length) {
    const first = data.hikes[plan.linkedHikes[0]];
    if (first?.difficulty) tagRow.appendChild(badge(first.difficulty));
    if (first?.duration) tagRow.appendChild(badge(first.duration));
  }
  if (plan.type === 'scenic_drive') tagRow.appendChild(badge('Scenic drive', 'warn'));
  card.appendChild(tagRow);
  const meta = el('div', 'plan-meta');
  meta.appendChild(miniCard('When to use', formatRichText(plan.whenToUse)));
  meta.appendChild(miniCard('Timing', formatRichText(`${plan.timing.depart} depart · ${plan.timing.arrive} arrive · ${plan.timing.duration} · ${plan.timing.return} back`)));
  meta.appendChild(miniCard('Logistics', listOrText(plan.logistics)));
  meta.appendChild(miniCard('Mental map', formatRichText(plan.mentalMap)));
  card.appendChild(meta);
  const extra = el('div', 'plan-meta');
  extra.appendChild(miniCard('Cost summary', plan.costs?.length ? listOrText(plan.costs) : 'No special cost beyond standard road/parking where applicable.'));
  extra.appendChild(miniCard('Booking summary', renderBookingSummary(plan)));
  card.appendChild(extra);
  return card;
}

function renderPlanRole(title, ids, isBadWeather=false, alternateIds=[]) {
  const wrap = el('div'); wrap.style.marginTop = '14px';
  wrap.appendChild(el('div', 'plan-role', `<h4>${escapeHtml(title)}</h4>`));
  const list = el('div', 'plan-list');
  ids.forEach(id => {
    if (isBadWeather && alternateIds.includes(id)) {
      const compact = el('div', 'plan-card');
      const plan = data.planCards[id];
      const links = buildQuickActionsForPlan(id);
      compact.innerHTML = `<div class="topline"><div class="title-block"><h4>${escapeHtml(plan.title)}</h4><p class="one-liner">Same option as Alternate plan — shown here because it is also a strong bad-weather fallback.</p></div></div>`;
      const lr = el('div', 'link-list'); links.forEach(l => lr.appendChild(linkEl(l.label, l.href))); compact.appendChild(lr); list.appendChild(compact);
    } else {
      list.appendChild(renderPlanCard(data.planCards[id]));
    }
  });
  wrap.appendChild(list);
  return wrap;
}

function renderDayCard(day) {
  const dayEl = el('div', `day-card ${state.openDays.has(day.id) ? 'open' : ''}`);
  dayEl.id = day.id;
  const sleepHotel = getSelectedHotel(day.sleepBase === 'cortina' ? 'cortina' : 'ortisei');
  const primaryNames = day.primaryPlanIds.map(id => data.planCards[id].title).join(' · ');
  const alternateNames = day.alternatePlanIds.length ? day.alternatePlanIds.map(id => data.planCards[id].title).join(' · ') : 'None';
  const badNames = day.badWeatherPlanIds.length ? day.badWeatherPlanIds.map(id => data.planCards[id].title).join(' · ') : 'None';
  const head = el('div', 'day-head');
  head.innerHTML = `<div class="day-head-left"><div class="day-title-row"><h3>${escapeHtml(day.label)}</h3><span class="info-pill emphasis">Base: ${day.base === 'both' ? 'Transfer day' : baseLabel(day.base)}</span><span class="info-pill">Sleep: ${escapeHtml(sleepHotel.name)}</span></div><div class="summary"><strong>Primary:</strong> ${escapeHtml(primaryNames)}<br><strong>Alternate:</strong> ${escapeHtml(alternateNames)}<br><strong>Bad-weather:</strong> ${escapeHtml(badNames)}</div></div><div class="chip-row"><span class="small-btn">${state.openDays.has(day.id) ? 'Collapse' : 'Open'}</span></div>`;
  head.addEventListener('click', () => { if (state.openDays.has(day.id)) state.openDays.delete(day.id); else state.openDays.add(day.id); render(); });
  dayEl.appendChild(head);
  const content = el('div', 'day-content');
  content.appendChild(el('div', 'plan-preview', `<strong>Sleep location:</strong> ${escapeHtml(sleepHotel.name)} <a href="${sleepHotel.mapLink}" target="_blank" rel="noopener">[Map]</a>`));
  content.appendChild(renderPlanRole('Primary plan', day.primaryPlanIds, false));
  if (day.alternatePlanIds.length) content.appendChild(renderPlanRole('Alternate plan', day.alternatePlanIds, false));
  if (day.badWeatherPlanIds.length) content.appendChild(renderPlanRole('Bad-weather plan', day.badWeatherPlanIds, true, day.alternatePlanIds));
  dayEl.appendChild(content);
  return dayEl;
}

function renderDailyPlan() {
  const section = sectionShell('daily-plan', 'Daily Itinerary', 'Each day has a Primary plan, Alternate plan, and Bad-weather plan.');
  const body = section.querySelector('.section-body');
  const toolbar = el('div', 'toolbar-row');
  const expand = el('button', 'toolbar-btn', 'Expand all');
  const collapse = el('button', 'toolbar-btn', 'Collapse all');
  expand.addEventListener('click', () => { state.openDays = new Set(data.days.map(d => d.id)); render(); });
  collapse.addEventListener('click', () => { state.openDays = new Set(); render(); });
  toolbar.appendChild(expand); toolbar.appendChild(collapse); body.appendChild(toolbar);
  data.days.forEach(day => body.appendChild(renderDayCard(day)));
  return section;
}

function groupKeyFromName(name, fallback) {
  const m = String(name || '').match(/^\[([^\]]+)\]/);
  return m ? m[1] : fallback;
}

function renderHikeCard(hike) {
  const details = document.createElement('details');
  details.className = 'library-card';
  const liftPrimary = hike.liftRef ? data.lifts?.[hike.liftRef] : null;
  const liftOptional = hike.optionalLiftRef ? data.lifts?.[hike.optionalLiftRef] : null;
  const parking = hike.parkingRef ? (data.parkingTable || []).find(r => r.name === hike.parkingRef) : null;
  const actionLinks = [`<a href="${hike.allTrailsUrl}" target="_blank" rel="noopener">AllTrails</a>`];
  if (parking && resolvePlace(parking.mapPlaceId)?.mapLink) actionLinks.push(`<a href="${resolvePlace(parking.mapPlaceId).mapLink}" target="_blank" rel="noopener">Parking map</a>`);
  if (liftPrimary) actionLinks.push(`<a href="${liftPrimary.officialUrl}" target="_blank" rel="noopener">Lift info</a>`);
  details.innerHTML = `
    <summary>
      <div>
        <strong>${escapeHtml(hike.name)}</strong>
        <div class="muted" style="margin-top:4px;">${escapeHtml(hike.reason)}</div>
        <div class="tag-row">${renderApplicableTagBadges(hike.weather, hike.energy, hike.tags, hike.commitment)}</div>
      </div>
      <div class="chip-row"><span class="badge">${escapeHtml(baseLabel(hike.bestBase))}</span><span class="badge">${escapeHtml(hike.duration)}</span></div>
    </summary>
    <div class="library-body">
      <div class="link-list">${actionLinks.join('')}</div>
      <div class="tag-row">
        <span class="badge">Difficulty: ${escapeHtml(hike.difficulty)}</span>
        <span class="badge">Gain: ${escapeHtml(hike.gain)}</span>
        <span class="badge">Crowd: ${escapeHtml(hike.crowd)}</span>
        <span class="badge">Commitment: ${escapeHtml(labelCommitment(hike.commitment))}</span>
      </div>
      <div class="plan-meta">
        <div class="mini-card"><h5>Why it fits</h5><div class="muted rich-text">${formatRichText(hike.reason)}</div></div>
        <div class="mini-card"><h5>Access</h5><div class="muted rich-text">${formatRichText(hike.access)}</div></div>
        <div class="mini-card"><h5>Cost</h5><div class="muted rich-text">${formatRichText(hike.cost)}</div></div>
        <div class="mini-card"><h5>Booking</h5><div class="muted rich-text">${formatRichText(hike.booking)}</div></div>
        <div class="mini-card"><h5>Trailhead</h5><div class="muted rich-text">${formatRichText(hike.trailhead || 'See access note')}</div></div>
        <div class="mini-card"><h5>Lift needed</h5><div class="muted rich-text">${
          liftPrimary ? `<strong>${escapeHtml(liftPrimary.name)}</strong><br>Season: ${escapeHtml(liftPrimary.season)}<br>First / last: ${escapeHtml(liftPrimary.firstLift)} / ${escapeHtml(liftPrimary.lastLift)}<br>${escapeHtml(liftPrimary.hoursNote)}`
          : 'No lift needed.'
        }${liftOptional ? `<br><br><strong>Optional shortcut:</strong> ${escapeHtml(liftOptional.name)}<br>First / last: ${escapeHtml(liftOptional.firstLift)} / ${escapeHtml(liftOptional.lastLift)}` : ''}</div></div>
        <div class="mini-card"><h5>Parking</h5><div class="muted rich-text">${
          parking ? `<strong>${escapeHtml(parking.name)}</strong><br>Hours: ${escapeHtml(parking.hours || 'See official page')}<br>Cost: ${escapeHtml(parking.rate || parking.cost || 'Varies')}<br>Practical full-by: ${escapeHtml(parking.fullBy || 'Go early')}<br>Backup: ${escapeHtml(parking.backup || 'See access note')}<br>${escapeHtml(parking.safety || '')}`
          : 'See access note.'
        }</div></div>
      </div>
    </div>`;
  return details;
}

function renderHikeLibrary() {
  const section = sectionShell('hike-library', 'Hike Library', 'Complete reference library grouped West / East first, then by area. Every daily-plan hike is included here, plus the added Alpe di Siusi and Zans options.');
  const body = section.querySelector('.section-body');
  const toolbar = el('div', 'toolbar-row');
  const expand = el('button', 'toolbar-btn', 'Expand all');
  const collapse = el('button', 'toolbar-btn', 'Collapse all');
  expand.addEventListener('click', () => document.querySelectorAll('#hike-library details.library-card').forEach(d => d.open = true));
  collapse.addEventListener('click', () => document.querySelectorAll('#hike-library details.library-card').forEach(d => d.open = false));
  toolbar.appendChild(expand); toolbar.appendChild(collapse); body.appendChild(toolbar);

  const regions = {};
  Object.values(data.hikes).forEach(hike => {
    const region = regionLabelFromBase(hike.bestBase);
    const area = groupKeyFromName(hike.name, baseLabel(hike.bestBase));
    (((regions[region] ||= {})[area] ||= [])).push(hike);
  });
  ['West','East','Transfer / mixed'].forEach(region => {
    if (!regions[region]) return;
    const regionWrap = el('section', 'library-region');
    regionWrap.appendChild(el('h3','library-region-title',escapeHtml(region)));
    Object.entries(regions[region]).sort((a,b) => a[0].localeCompare(b[0])).forEach(([area, hikes]) => {
      const wrap = el('div','library-area');
      wrap.appendChild(el('h4','library-area-title',escapeHtml(area)));
      hikes.sort((a,b) => a.name.localeCompare(b.name)).forEach(hike => wrap.appendChild(renderHikeCard(hike)));
      regionWrap.appendChild(wrap);
    });
    body.appendChild(regionWrap);
  });
  return section;
}

function renderScenicDrives() {
  const section = sectionShell('scenic-drives', 'Scenic Drives', 'Complete scenic-drive reference library grouped West / East first, then by area. Every daily-plan drive is included here.');
  const body = section.querySelector('.section-body');
  const regions = {};
  Object.values(data.drives).forEach(drive => {
    const region = drive.bestBase === 'both' ? 'Transfer / mixed' : regionLabelFromBase(drive.bestBase);
    const area = groupKeyFromName(drive.name, drive.bestBase === 'cortina' ? 'East scenic drives' : drive.bestBase === 'ortisei' ? 'West scenic drives' : 'Transfer drives');
    (((regions[region] ||= {})[area] ||= [])).push(drive);
  });
  ['West','East','Transfer / mixed'].forEach(region => {
    if (!regions[region]) return;
    const regionWrap = el('section', 'library-region');
    regionWrap.appendChild(el('h3','library-region-title',escapeHtml(region)));
    Object.entries(regions[region]).sort((a,b) => a[0].localeCompare(b[0])).forEach(([group, drives]) => {
      regionWrap.appendChild(el('h4','library-area-title',escapeHtml(group)));
      drives.forEach(drive => {
        const card = el('div', 'plan-card'); card.id = `drive-${drive.id}`;
        card.innerHTML = `<div class="topline"><div class="title-block"><h4>${escapeHtml(drive.name)}</h4><p class="one-liner">${escapeHtml(drive.summary)}</p><div class="tag-row">${renderApplicableTagBadges(drive.weather, drive.energy, drive.tags, drive.commitment)}</div></div></div>`;
        const links = el('div', 'link-list');
        const routeHref = buildDriveRouteLink(drive); if (routeHref) links.appendChild(linkEl('Route', routeHref));
        (drive.keyStops || []).forEach(id => { const p = resolvePlace(id); if (p) links.appendChild(linkEl(p.name, p.mapLink)); });
        card.appendChild(links);
        card.appendChild(el('div', 'tag-row', `<span class="badge">Best base: ${escapeHtml(drive.bestBase === 'both' ? 'Transfer' : baseLabel(drive.bestBase))}</span><span class="badge">${escapeHtml(drive.duration || '')}</span>`));
        regionWrap.appendChild(card);
      });
    });
    body.appendChild(regionWrap);
  });
  return section;
}

function renderAccessBooking() {
  const section = sectionShell('access-booking', 'Access / Parking / Lifts / Tolls / Booking', 'Execution reference with parking, lift windows, and booking links.');
  const body = section.querySelector('.section-body');

  body.appendChild(el('h3', '', 'Parking & access'));
  const tableWrap = el('div', 'table-wrap');
  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Place</th><th>Serves</th><th>Map</th><th>Hours / rules</th><th>Cost</th><th>Practical full-by</th><th>Backup</th></tr></thead>';
  const tbody = document.createElement('tbody');
  data.parkingTable.forEach(row => {
    const place = resolvePlace(row.mapPlaceId);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(row.name)}<br><span class="muted">${escapeHtml(row.safety || '')}</span></td><td>${escapeHtml(row.serves)}</td><td>${place?.mapLink ? `<a href="${place.mapLink}" target="_blank" rel="noopener">Map</a>` : ''}</td><td>${escapeHtml(row.hours || row.rules || '')}</td><td>${escapeHtml(row.rate || row.cost || '')}</td><td>${escapeHtml(row.fullBy || '')}</td><td>${escapeHtml(row.backup || '')}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody); tableWrap.appendChild(table); body.appendChild(tableWrap);

  body.appendChild(el('h3', '', 'Lift reference'));
  const liftWrap = el('div', 'table-wrap');
  const ltable = document.createElement('table');
  ltable.innerHTML = '<thead><tr><th>Lift</th><th>Serves</th><th>Season / source</th><th>First lift</th><th>Last lift</th><th>Official link</th></tr></thead>';
  const lbody = document.createElement('tbody');
  Object.values(data.lifts || {}).forEach(lift => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(lift.name)}<br><span class="muted">${escapeHtml(lift.hoursNote || '')}</span></td><td>${escapeHtml(lift.serves || '')}</td><td>${escapeHtml(`${lift.season} · ${lift.statusSource}`)}</td><td>${escapeHtml(lift.firstLift || '')}</td><td>${escapeHtml(lift.lastLift || '')}</td><td><a href="${lift.officialUrl}" target="_blank" rel="noopener">Official</a></td>`;
    lbody.appendChild(tr);
  });
  ltable.appendChild(lbody); liftWrap.appendChild(ltable); body.appendChild(liftWrap);

  body.appendChild(el('h3', '', 'Booking checklist'));
  const bookWrap = el('div', 'table-wrap');
  const btable = document.createElement('table');
  btable.innerHTML = '<thead><tr><th>Timing</th><th>Item</th><th>Note</th><th>Link</th></tr></thead>';
  const bbody = document.createElement('tbody');
  data.bookings.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.item)}</td><td class="rich-text">${formatRichText(row.note)}</td><td><a href="${row.link}" target="_blank" rel="noopener">Open</a></td>`;
    bbody.appendChild(tr);
  });
  btable.appendChild(bbody); bookWrap.appendChild(btable); body.appendChild(bookWrap);
  body.appendChild(el('div', 'footer-note', 'Where an exact 2026 shoulder-season lift timetable was not yet published in the retrieved source, the dashboard labels it as the latest published timetable rather than pretending it is confirmed 2026 data. Practical “full by” parking times are estimates for good-weather September days, not official guarantees.'));
  return section;
}

function wireNavActive() {
  const links = [...document.querySelectorAll('.nav-row a')];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin:'-25% 0px -60% 0px', threshold:0.01 });
  document.querySelectorAll('main .section').forEach(sec => observer.observe(sec));
}

init();
