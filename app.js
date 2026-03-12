let data = null;
const state = {
  selectedBase: 'ortisei',
  selectedDay: 'day1',
  selectedWeather: 'bluebird',
  selectedEnergy: 'medium',
  selectedVibe: 'green_meadows',
  selectedCommitment: 'any',
  hotelSelection: {
    ortisei: { presetId: 'gardena_grodnerhof', customEnabled: false, customName: '', customMapLink: '', customMapQuery: '' },
    cortina: { presetId: 'hotel_de_len', customEnabled: false, customName: '', customMapLink: '', customMapQuery: '' }
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
    render();
    registerServiceWorker();
  } catch (e) {
    console.error(e);
    const app = document.getElementById('app');
    app.innerHTML = '<section class="section"><div class="section-header"><h2>Could not load trip data</h2><p>Please make sure <code>trip-data.json</code> is published correctly.</p></div><div class="section-body"></div></section>';
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
}

function getSelectedHotel(base) {
  const selection = state.hotelSelection[base];
  if (selection.customEnabled && selection.customName && (selection.customMapLink || selection.customMapQuery)) {
    const query = selection.customMapQuery || selection.customName;
    return { id: 'custom', name: selection.customName, mapQuery: query, mapLink: selection.customMapLink || googleSearchLink(query) };
  }
  const preset = data.hotels[base].presetHotels.find(h => h.id === selection.presetId) || data.hotels[base].presetHotels[0];
  return preset;
}

function googleSearchLink(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleDirectionsLink({ originQuery, destinationQuery, waypoints = [], travelMode = 'driving' }) {
  const params = new URLSearchParams({ api: '1', origin: originQuery, destination: destinationQuery, travelmode: travelMode });
  if (waypoints.length) params.set('waypoints', waypoints.join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function resolvePlace(id) { return data.places[id] || null; }

function buildRouteLink(routeDef) {
  if (!routeDef) return null;
  let originQuery = '';
  let destinationQuery = '';
  const waypoints = [];
  const travelMode = routeDef.travelMode || 'driving';
  if (routeDef.originBase) originQuery = getSelectedHotel(routeDef.originBase).mapQuery;
  if (routeDef.destinationBase) destinationQuery = getSelectedHotel(routeDef.destinationBase).mapQuery;
  if (routeDef.originPlace) originQuery = resolvePlace(routeDef.originPlace)?.mapQuery || '';
  if (routeDef.destination) destinationQuery = resolvePlace(routeDef.destination)?.mapQuery || '';
  if (routeDef.waypoints) routeDef.waypoints.forEach(id => { const p = resolvePlace(id); if (p) waypoints.push(p.mapQuery); });
  if (routeDef.transferBetweenBases) {
    originQuery = getSelectedHotel(routeDef.originBase).mapQuery;
    destinationQuery = getSelectedHotel(routeDef.destinationBase).mapQuery;
  }
  if (!originQuery || !destinationQuery) return null;
  return googleDirectionsLink({ originQuery, destinationQuery, waypoints, travelMode });
}

function buildDriveRouteLink(drive) {
  if (!drive) return null;
  const route = drive.route;
  const originBase = route.base || drive.bestBase;
  const originQuery = getSelectedHotel(originBase === 'both' ? state.selectedBase : originBase).mapQuery;
  const wp = (route.waypoints || []).map(id => resolvePlace(id)?.mapQuery).filter(Boolean);
  let destinationQuery = originQuery;
  if (route.destinationBase) destinationQuery = getSelectedHotel(route.destinationBase).mapQuery;
  if (route.returnToOrigin) destinationQuery = originQuery;
  return googleDirectionsLink({ originQuery, destinationQuery, waypoints: wp, travelMode: 'driving' });
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function updateTopBar() {
  document.getElementById('top-current-base').textContent = `Base: ${data.bases.find(b => b.id === state.selectedBase).label}`;
  document.getElementById('top-ortisei-hotel').textContent = `Ortisei hotel: ${getSelectedHotel('ortisei').name}`;
  document.getElementById('top-cortina-hotel').textContent = `Cortina hotel: ${getSelectedHotel('cortina').name}`;
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

function renderOverview() {
  const section = sectionShell('overview', 'Overview / Trip Summary', data.trip.intro);
  const body = section.querySelector('.section-body');
  const grid = el('div', 'overview-grid');
  const left = el('div', 'panel');
  left.innerHTML = `
    <h3>Route</h3>
    <p>${data.trip.routeSummary}</p>
    <div class="status-row">
      <span class="badge accent">4 nights Ortisei</span>
      <span class="badge accent">3 nights Cortina</span>
      <span class="badge">Overview first</span>
      <span class="badge">Mobile-first dashboard</span>
    </div>
    <div class="link-list">
      <a href="#daily-plan">Go to Daily Plan</a>
      <a href="#decision-tools">Open Decision Tools</a>
      <a href="#access-booking">Check Booking Items</a>
    </div>`;
  const right = el('div', 'cards-grid two');
  right.appendChild(metricCard('Top priorities', 'Seceda, Adolf Munkel, Hans & Paula Steger, Santa Maddalena, Cinque Torri, Tre Cime + Cadini, Lago di Sorapis'));
  right.appendChild(metricCard('Must-book item', 'Tre Cime / Auronzo road access is the main reservation-critical item.'));
  right.appendChild(metricCard('Best bluebird targets', 'Seceda, Tre Cime + Cadini, Cinque Torri, Sorapis'));
  right.appendChild(metricCard('Best mixed-weather targets', 'Adolf Munkel, Santa Maddalena, Hans & Paula Steger, Val di Funes drive'));
  grid.appendChild(left); grid.appendChild(right); body.appendChild(grid); return section;
}
function metricCard(title, text) { return el('div', 'metric-card', `<h3>${title}</h3><p class="muted">${text}</p>`); }

function renderControls() {
  const section = sectionShell('controls', 'Current Base & Hotel Controls', 'Base-aware recommendations and hotel-aware routes. Changing a hotel updates route links that start or end there.');
  const body = section.querySelector('.section-body');
  const grid = el('div', 'info-grid two');
  const left = el('div', 'panel');
  left.innerHTML = '<h3>Current base</h3><p class="muted">Use this to make recommendations practical for where you are staying now.</p>';
  const baseRow = el('div', 'segmented chip-row');
  data.bases.forEach(base => {
    const btn = el('button', state.selectedBase === base.id ? 'active' : '', base.label);
    btn.addEventListener('click', () => { state.selectedBase = base.id; render(); });
    baseRow.appendChild(btn);
  });
  left.appendChild(baseRow);
  left.appendChild(el('div', 'toolbar-note', 'Base is treated as a hard requirement in the Decision Tools.'));
  const right = el('div', 'cards-grid two');
  right.appendChild(renderHotelControl('ortisei'));
  right.appendChild(renderHotelControl('cortina'));
  grid.appendChild(left); grid.appendChild(right); body.appendChild(grid); return section;
}

function renderHotelControl(base) {
  const config = data.hotels[base]; const selection = state.hotelSelection[base]; const card = el('div', 'panel');
  card.innerHTML = `<h3>${config.label}</h3>`;
  const presetWrap = el('div');
  presetWrap.innerHTML = `<label class="field-label">Preset hotel</label>`;
  const select = document.createElement('select');
  config.presetHotels.forEach(h => {
    const opt = document.createElement('option'); opt.value = h.id; opt.textContent = h.name; if (selection.presetId === h.id) opt.selected = true; select.appendChild(opt);
  });
  select.addEventListener('change', e => { selection.presetId = e.target.value; render(); });
  presetWrap.appendChild(select); card.appendChild(presetWrap);
  const toggleWrap = el('label', 'inline-toggle'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selection.customEnabled;
  check.addEventListener('change', e => { selection.customEnabled = e.target.checked; render(); });
  toggleWrap.appendChild(check); toggleWrap.appendChild(document.createTextNode('Use custom hotel override')); card.appendChild(toggleWrap);
  const customWrap = el('div', selection.customEnabled ? '' : 'hidden'); customWrap.style.marginTop = '10px';
  customWrap.innerHTML = `
    <label class="field-label">Custom hotel name</label>
    <input type="text" data-hotel-input="${base}-name" value="${escapeAttr(selection.customName)}" placeholder="e.g. Hotel name or apartment label" />
    <label class="field-label" style="margin-top:10px;">Custom Google Maps link (optional)</label>
    <input type="text" data-hotel-input="${base}-link" value="${escapeAttr(selection.customMapLink)}" placeholder="Paste Google Maps place/search link" />
    <label class="field-label" style="margin-top:10px;">Custom map query (used if no link is pasted)</label>
    <input type="text" data-hotel-input="${base}-query" value="${escapeAttr(selection.customMapQuery)}" placeholder="e.g. Hotel Name Ortisei" />`;
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
  card.appendChild(el('div', 'footer-note', `Active hotel: <strong>${activeHotel.name}</strong> <a href="${activeHotel.mapLink}" target="_blank" rel="noopener">[Map]</a>`));
  return card;
}

function renderDecisionTools() {
  const section = sectionShell('decision-tools', 'Decision Tools', 'Base is required. Other filters are weighted and ranked to surface the best practical match.');
  const body = section.querySelector('.section-body'); const grid = el('div', 'decision-grid');
  const filters = el('div', 'panel');
  filters.innerHTML = '<h3>Filters</h3><p class="muted">Use one or more of these. Results are ranked by best match, not just filtered.</p>';
  filters.appendChild(segmentedGroup('Weather', weatherOptions, state.selectedWeather, id => { state.selectedWeather = id; render(); }));
  filters.appendChild(segmentedGroup('Energy', energyOptions, state.selectedEnergy, id => { state.selectedEnergy = id; render(); }));
  filters.appendChild(segmentedGroup('Vibe', vibeOptions, state.selectedVibe, id => { state.selectedVibe = id; render(); }));
  filters.appendChild(segmentedGroup('Commitment', commitmentOptions, state.selectedCommitment, id => { state.selectedCommitment = id; render(); }));
  const resultsWrap = el('div', 'panel');
  resultsWrap.innerHTML = '<h3>Ranked results</h3><p class="muted">Base is required. Weather, energy, vibe, and commitment refine the ranking. Match levels mean: <strong>Excellent</strong> = strong fit for current base and most selected filters, <strong>Strong</strong> = good fit, <strong>Fair</strong> = workable, <strong>Limited</strong> = partial fit only.</p>';
  const results = rankDecisionResults(); const out = el('div', 'decision-results');
  ['best','alternate','bad','low','wow'].forEach(key => {
    const item = results[key]; if (!item) return;
    const card = el('div', 'result-card'); const links = buildQuickActionsForPlan(item.id);
    card.innerHTML = `<h3>${decisionTitleForKey(key)}: ${item.title}</h3><p>${item.reasoning}</p><p class="muted" style="margin-top:6px;">${matchBreakdown(item)}</p>`;
    const tags = el('div', 'tag-row'); tags.appendChild(badge(`Match: ${scoreLevel(item.score)}`, scoreLevelClass(item.score))); tags.appendChild(badge(`Base: ${baseLabel(item.base)}`)); card.appendChild(tags);
    const action = el('div', 'link-list'); links.forEach(l => action.appendChild(linkEl(l.label, l.href))); card.appendChild(action); out.appendChild(card);
  });
  resultsWrap.appendChild(out); grid.appendChild(filters); grid.appendChild(resultsWrap); body.appendChild(grid); return section;
}

function segmentedGroup(label, options, selected, onSelect) {
  const wrap = el('div'); wrap.style.marginTop = '14px'; wrap.innerHTML = `<label class="field-label">${label}</label>`;
  const row = el('div', 'segmented chip-row');
  options.forEach(opt => { const btn = el('button', selected === opt.id ? 'active' : '', opt.label); btn.addEventListener('click', () => onSelect(opt.id)); row.appendChild(btn); });
  wrap.appendChild(row); return wrap;
}

function rankDecisionResults() {
  const candidates = Object.values(data.planCards).filter(plan => plan.base === 'both' || plan.base === state.selectedBase).map(plan => {
    const meta = derivePlanMeta(plan); let score = 100;
    if (meta.weather.includes(state.selectedWeather)) score += 40;
    if (meta.energy.includes(state.selectedEnergy)) score += 20;
    if (meta.tags.includes(state.selectedVibe)) score += 20;
    if (state.selectedCommitment === 'any' || meta.commitment === state.selectedCommitment) score += 10;
    if (meta.tags.includes('hero_day')) score += 8;
    if (meta.tags.includes('backup')) score += 6;
    if (meta.tags.includes('mixed_weather_ok') && ['mixed_weather', 'bad_weather', 'storm_risk'].includes(state.selectedWeather)) score += 8;
    if (meta.type === 'scenic_drive' && state.selectedVibe === 'scenic_drive_only') score += 15;
    if (meta.type === 'scenic_drive' && !['mixed_weather','bad_weather','storm_risk','scenic_drive_only'].includes(state.selectedWeather)) score -= 18;
    if (meta.commitment === 'must_reserve' && state.selectedCommitment === 'day_of_ok') score -= 15;
    return { ...meta, score };
  }).sort((a,b)=>b.score-a.score);
  const pick = predicate => candidates.find(predicate);
  return {
    best: candidates[0],
    alternate: pick(c => c.tags.includes('backup') || c.type === 'hike') || candidates[1],
    bad: pick(c => c.type === 'scenic_drive' || c.weather.includes('bad_weather') || c.weather.includes('mixed_weather')),
    low: pick(c => c.energy.includes('low')),
    wow: pick(c => c.tags.includes('hero_day') || c.tags.includes('dramatic_white_rock'))
  };
}

function derivePlanMeta(plan) {
  let tags = [], weather = [], energy = [], commitment = 'day_of_ok'; let shortReason = plan.summary;
  if (plan.linkedHikes?.length) {
    plan.linkedHikes.forEach(id => {
      const h = data.hikes[id]; if (!h) return;
      tags = tags.concat(h.tags || []); weather = weather.concat(h.weather || []); energy = energy.concat(h.energy || []);
      if (h.commitment === 'must_reserve') commitment = 'must_reserve';
      else if (h.commitment === 'reserve_if_possible' && commitment !== 'must_reserve') commitment = 'reserve_if_possible';
    });
  }
  if (plan.linkedDrive) {
    const d = data.drives[plan.linkedDrive];
    tags = tags.concat(d.tags || []); weather = weather.concat(d.weather || []); energy = energy.concat(d.energy || ['low','medium']); if (d.commitment) commitment = d.commitment;
  }
  return { id: plan.id, title: plan.title, base: plan.base === 'both' ? state.selectedBase : plan.base, weather: [...new Set(weather)], energy: [...new Set(energy)], tags: [...new Set(tags)], commitment, type: plan.type, reasoning: shortReason };
}

function decisionTitleForKey(key) { return ({ best: 'Best overall match', alternate: 'Best alternate', bad: 'Best bad-weather fallback', low: 'Best low-effort option', wow: 'Best wow-factor option' })[key]; }
function scoreLevel(score) { if (score >= 175) return 'Excellent'; if (score >= 150) return 'Strong'; if (score >= 125) return 'Fair'; return 'Limited'; }
function scoreLevelClass(score) { if (score >= 175) return 'good'; if (score >= 150) return 'accent'; if (score >= 125) return 'warn'; return 'bad'; }
function matchBreakdown(item) {
  const bits = [`Base: ${baseLabel(item.base)}`];
  if (item.weather.includes(state.selectedWeather)) bits.push('weather matches');
  if (item.energy.includes(state.selectedEnergy)) bits.push('energy matches');
  if (item.tags.includes(state.selectedVibe)) bits.push('vibe matches');
  if (state.selectedCommitment === 'any' || item.commitment === state.selectedCommitment) bits.push('commitment fits');
  return bits.join(' · ');
}
function baseLabel(base) { return data.bases.find(b => b.id === base)?.label || base; }

function renderDayPicker() {
  const section = sectionShell('day-picker', 'Day Picker', 'Jump straight to a day card.'); const body = section.querySelector('.section-body'); const row = el('div', 'day-jump');
  data.days.forEach(day => { const btn = el('button', state.selectedDay === day.id ? 'active' : '', day.label); btn.addEventListener('click', () => { state.selectedDay = day.id; state.openDays.add(day.id); render(); document.getElementById(day.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }); row.appendChild(btn); });
  body.appendChild(row); return section;
}

function renderDailyPlan() {
  const section = sectionShell('daily-plan', 'Daily Itinerary', 'Each day has a Primary plan, Alternate plan, and Bad-weather plan. Reusable plan cards prevent duplicated content.');
  const body = section.querySelector('.section-body'); const toolbar = el('div', 'toolbar-row');
  const expand = el('button', 'toolbar-btn', 'Expand all'); const collapse = el('button', 'toolbar-btn', 'Collapse all');
  expand.addEventListener('click', () => { state.openDays = new Set(data.days.map(d => d.id)); render(); });
  collapse.addEventListener('click', () => { state.openDays = new Set(); render(); });
  toolbar.appendChild(expand); toolbar.appendChild(collapse); body.appendChild(toolbar); data.days.forEach(day => body.appendChild(renderDayCard(day))); return section;
}

function renderDayCard(day) {
  const dayEl = el('div', `day-card ${state.openDays.has(day.id) ? 'open' : ''}`); dayEl.id = day.id;
  const sleepHotel = getSelectedHotel(day.sleepBase === 'cortina' ? 'cortina' : 'ortisei');
  const primaryNames = day.primaryPlanIds.map(id => data.planCards[id].title).join(' · ');
  const alternateNames = day.alternatePlanIds.length ? day.alternatePlanIds.map(id => data.planCards[id].title).join(' · ') : 'None';
  const badNames = day.badWeatherPlanIds.length ? day.badWeatherPlanIds.map(id => data.planCards[id].title).join(' · ') : 'None';
  const head = el('div', 'day-head');
  head.innerHTML = `<div class="day-head-left"><div class="day-title-row"><h3>${day.label}</h3><span class="info-pill emphasis">Base: ${day.base === 'both' ? 'Transfer day' : baseLabel(day.base)}</span><span class="info-pill">Sleep: ${sleepHotel.name}</span></div><div class="summary"><strong>Primary:</strong> ${primaryNames}<br><strong>Alternate:</strong> ${alternateNames}<br><strong>Bad-weather:</strong> ${badNames}</div></div><div class="chip-row"><span class="small-btn">${state.openDays.has(day.id) ? 'Collapse' : 'Open'}</span></div>`;
  head.addEventListener('click', () => { if (state.openDays.has(day.id)) state.openDays.delete(day.id); else state.openDays.add(day.id); render(); });
  dayEl.appendChild(head);
  const content = el('div', 'day-content'); content.appendChild(el('div', 'plan-preview', `<strong>Sleep location:</strong> ${sleepHotel.name} <a href="${sleepHotel.mapLink}" target="_blank" rel="noopener">[Map]</a>`));
  content.appendChild(renderPlanRole('Primary plan', day.primaryPlanIds, false));
  if (day.alternatePlanIds.length) content.appendChild(renderPlanRole('Alternate plan', day.alternatePlanIds, false));
  if (day.badWeatherPlanIds.length) content.appendChild(renderPlanRole('Bad-weather plan', day.badWeatherPlanIds, true, day.alternatePlanIds));
  dayEl.appendChild(content); return dayEl;
}

function renderPlanRole(title, ids, isBadWeather = false, alternateIds = []) {
  const wrap = el('div'); wrap.style.marginTop = '14px'; const head = el('div', 'plan-role', `<h4>${title}</h4>`); wrap.appendChild(head); const list = el('div', 'plan-list');
  ids.forEach(id => {
    if (isBadWeather && alternateIds.includes(id)) {
      const compact = el('div', 'plan-card'); const plan = data.planCards[id]; const links = buildQuickActionsForPlan(id);
      compact.innerHTML = `<div class="topline"><div class="title-block"><h4>${plan.title}</h4><p class="one-liner">Same option as Alternate plan — shown here because it is also a strong bad-weather fallback.</p></div></div>`;
      const lr = el('div', 'link-list'); links.forEach(l => lr.appendChild(linkEl(l.label, l.href))); compact.appendChild(lr); list.appendChild(compact);
    } else list.appendChild(renderPlanCard(data.planCards[id]));
  });
  wrap.appendChild(list); return wrap;
}

function renderPlanCard(plan) {
  const card = el('div', 'plan-card'); const actions = buildQuickActionsForPlan(plan.id); const top = el('div', 'topline', `<div class="title-block"><h4>${plan.title}</h4><p class="one-liner">${plan.summary}</p></div>`); card.appendChild(top);
  const links = el('div', 'link-list'); actions.forEach(a => links.appendChild(linkEl(a.label, a.href))); card.appendChild(links);
  const tagRow = el('div', 'tag-row'); tagRow.appendChild(badge(`Base: ${plan.base === 'both' ? 'Transfer' : baseLabel(plan.base)}`));
  if (plan.linkedHikes?.length) { const first = data.hikes[plan.linkedHikes[0]]; if (first?.difficulty) tagRow.appendChild(badge(first.difficulty)); if (first?.duration) tagRow.appendChild(badge(first.duration)); }
  if (plan.type === 'scenic_drive') tagRow.appendChild(badge('Scenic drive', 'warn')); card.appendChild(tagRow);
  const meta = el('div', 'plan-meta'); meta.appendChild(miniCard('When to use', plan.whenToUse)); meta.appendChild(miniCard('Timing', `${plan.timing.depart} depart · ${plan.timing.arrive} arrive · ${plan.timing.duration} · ${plan.timing.return} back`)); meta.appendChild(miniCard('Logistics', listOrText(plan.logistics))); meta.appendChild(miniCard('Mental map', plan.mentalMap)); card.appendChild(meta);
  const extra = el('div', 'plan-meta'); extra.appendChild(miniCard('Cost summary', plan.costs?.length ? listOrText(plan.costs) : 'No special cost beyond standard road/parking where applicable.')); extra.appendChild(miniCard('Booking summary', plan.bookings?.length ? listOrText(plan.bookings) : 'Day-of is usually fine.')); card.appendChild(extra); return card;
}

function buildQuickActionsForPlan(planId) {
  const plan = data.planCards[planId]; const actions = [];
  if (plan.linkedHikes?.length) plan.linkedHikes.forEach((hid, idx) => { const hike = data.hikes[hid]; if (hike?.allTrailsUrl) actions.push({ label: idx === 0 ? 'AllTrails' : `AllTrails ${idx + 1}`, href: hike.allTrailsUrl }); });
  if (plan.linkedDrive) { const drive = data.drives[plan.linkedDrive]; actions.push({ label: 'Drive route', href: buildDriveRouteLink(drive) }); actions.push({ label: 'Drive details', href: `#drive-${drive.id}` }); }
  if (plan.accessRoutes?.length) plan.accessRoutes.forEach((route, idx) => { const href = buildRouteLink(route); if (href) actions.push({ label: route.label || (idx === 0 ? 'Map' : `Map ${idx + 1}`), href }); });
  return dedupeActions(actions.filter(a => a.href));
}
function dedupeActions(items) { const seen = new Set(); return items.filter(i => { const key = i.href; if (seen.has(key)) return false; seen.add(key); return true; }); }

function renderHikeLibrary() {
  const section = sectionShell('hike-library', 'Hike Library', 'Primary reference cards grouped by region. Each card surfaces the practical conditions it actually fits.');
  const body = section.querySelector('.section-body'); const toolbar = el('div', 'toolbar-row');
  const expand = el('button', 'toolbar-btn', 'Expand all'); const collapse = el('button', 'toolbar-btn', 'Collapse all');
  expand.addEventListener('click', () => document.querySelectorAll('#hike-library details.library-card').forEach(d => d.open = true));
  collapse.addEventListener('click', () => document.querySelectorAll('#hike-library details.library-card').forEach(d => d.open = false));
  toolbar.appendChild(expand); toolbar.appendChild(collapse); body.appendChild(toolbar);
  body.appendChild(renderHikeGroup('West Dolomites', ['seceda_primary','seceda_secondary','adolf_munkel_primary','adolf_munkel_short','santa_maddalena_panoramic','santa_maddalena_viewpoint','hans_paula_primary','bullaccia_secondary']));
  body.appendChild(renderHikeGroup('East Dolomites', ['cinque_torri_primary','tre_cime_primary','cadini_primary','sorapis_primary']));
  return section;
}

function renderHikeGroup(title, hikeIds) {
  const wrap = el('div'); wrap.style.marginTop = '6px'; wrap.appendChild(el('h3', '', title));
  hikeIds.forEach(id => {
    const hike = data.hikes[id]; const details = document.createElement('details'); details.className = 'library-card';
    details.innerHTML = `<summary><div><strong>${hike.name}</strong><div class="muted" style="margin-top:4px;">${hike.reason}</div><div class="tag-row">${renderApplicableTagBadges(hike.weather, hike.energy, hike.tags, hike.commitment)}</div></div><div class="chip-row"><span class="badge">${baseLabel(hike.bestBase)}</span><span class="badge">${hike.duration}</span></div></summary><div class="library-body"><div class="link-list"><a href="${hike.allTrailsUrl}" target="_blank" rel="noopener">AllTrails</a></div><div class="tag-row"><span class="badge">Difficulty: ${hike.difficulty}</span><span class="badge">Gain: ${hike.gain}</span><span class="badge">Crowd: ${hike.crowd}</span><span class="badge">Commitment: ${labelCommitment(hike.commitment)}</span></div><div class="plan-meta"><div class="mini-card"><h5>Why it fits</h5><div class="muted">${hike.reason}</div></div><div class="mini-card"><h5>Access</h5><div class="muted">${hike.access}</div></div><div class="mini-card"><h5>Cost</h5><div class="muted">${hike.cost}</div></div><div class="mini-card"><h5>Booking</h5><div class="muted">${hike.booking}</div></div></div></div>`;
    wrap.appendChild(details);
  });
  return wrap;
}

function renderScenicDrives() {
  const section = sectionShell('scenic-drives', 'Scenic Drives', 'Kept as a separate reference layer, but also linked directly inside day cards for fast action.');
  const body = section.querySelector('.section-body');
  Object.values(data.drives).forEach(drive => {
    const card = el('div', 'plan-card'); card.id = `drive-${drive.id}`;
    card.innerHTML = `<div class="topline"><div class="title-block"><h4>${drive.name}</h4><p class="one-liner">${drive.summary}</p><div class="tag-row">${renderApplicableTagBadges(drive.weather, drive.energy, drive.tags, drive.commitment)}</div></div></div>`;
    const links = el('div', 'link-list'); links.appendChild(linkEl('Route', buildDriveRouteLink(drive))); drive.keyStops.forEach(id => links.appendChild(linkEl(resolvePlace(id).name, resolvePlace(id).mapLink))); card.appendChild(links);
    const tags = el('div', 'tag-row'); tags.appendChild(badge(`Best base: ${drive.bestBase === 'both' ? 'Transfer' : baseLabel(drive.bestBase)}`)); card.appendChild(tags); body.appendChild(card);
  });
  return section;
}

function renderAccessBooking() {
  const section = sectionShell('access-booking', 'Access / Parking / Lifts / Tolls / Booking', 'Reference tables for execution details.');
  const body = section.querySelector('.section-body'); body.appendChild(el('h3', '', 'Parking & access'));
  const tableWrap = el('div', 'table-wrap'); const table = document.createElement('table'); table.innerHTML = '<thead><tr><th>Place</th><th>Serves</th><th>Map</th><th>Rules</th><th>Cost</th></tr></thead>'; const tbody = document.createElement('tbody');
  data.parkingTable.forEach(row => { const place = resolvePlace(row.mapPlaceId); const tr = document.createElement('tr'); tr.innerHTML = `<td>${row.name}</td><td>${row.serves}</td><td><a href="${place?.mapLink || '#'}" target="_blank" rel="noopener">Map</a></td><td>${row.rules}</td><td>${row.cost}</td>`; tbody.appendChild(tr); });
  table.appendChild(tbody); tableWrap.appendChild(table); body.appendChild(tableWrap);
  const bookTitle = el('h3', '', 'Booking checklist'); bookTitle.style.marginTop = '18px'; body.appendChild(bookTitle);
  const bookWrap = el('div', 'table-wrap'); const btable = document.createElement('table'); btable.innerHTML = '<thead><tr><th>Timing</th><th>Item</th><th>Note</th><th>Link</th></tr></thead>'; const bbody = document.createElement('tbody');
  data.bookings.forEach(row => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${row.category}</td><td>${row.item}</td><td>${row.note}</td><td><a href="${row.link}" target="_blank" rel="noopener">Open</a></td>`; bbody.appendChild(tr); });
  btable.appendChild(bbody); bookWrap.appendChild(btable); body.appendChild(bookWrap);
  body.appendChild(el('div', 'footer-note', 'Lift pass note: for this current itinerary, buying individual tickets is the practical default. A Gardena Card only becomes attractive if you deliberately stack more Val Gardena lifts into the same consecutive window. General motorway tolls are paid at toll plazas; the special preplanned one is Tre Cime / Auronzo road access.'));
  return section;
}

function sectionShell(id, title, subtitle) {
  const section = el('section', 'section'); section.id = id; section.innerHTML = `<div class="section-header"><h2>${title}</h2><p>${subtitle}</p></div><div class="section-body"></div>`; return section;
}
function miniCard(title, content) { return el('div', 'mini-card', `<h5>${title}</h5><div class="muted">${content}</div>`); }
function listOrText(items) { if (!Array.isArray(items)) return items; return `<ul class="plain-list">${items.map(i => `<li>${i}</li>`).join('')}</ul>`; }
function linkEl(label, href) { const a = document.createElement('a'); a.href = href; if (!href.startsWith('#')) { a.target = '_blank'; a.rel = 'noopener'; } a.textContent = label; return a; }
function badge(text, cls = '') { return el('span', `badge ${cls}`.trim(), text); }
function labelCommitment(val) { return ({ must_reserve: 'Must reserve', reserve_if_possible: 'Better to reserve', day_of_ok: 'Easy day-of', easy_day_of: 'Easy day-of' })[val] || val; }
function renderApplicableTagBadges(weather = [], energy = [], tags = [], commitment = '') {
  const chunks = [];
  weather.forEach(w => chunks.push(`<span class="badge">${humanWeather(w)}</span>`));
  energy.forEach(e => chunks.push(`<span class="badge">${humanEnergy(e)}</span>`));
  if (tags.includes('green_meadows')) chunks.push('<span class="badge">Green meadows + huts</span>');
  if (tags.includes('dramatic_white_rock')) chunks.push('<span class="badge">Dramatic white rock</span>');
  if (tags.includes('church_postcard')) chunks.push('<span class="badge">Church / postcard village</span>');
  if (tags.includes('lake')) chunks.push('<span class="badge">Lake scenery</span>');
  if (tags.includes('scenic_drive_only')) chunks.push('<span class="badge">Scenic drive only</span>');
  if (commitment) chunks.push(`<span class="badge">${labelCommitment(commitment)}</span>`);
  return chunks.join('');
}
function humanWeather(id) { return ({ bluebird: 'Bluebird', partly_cloudy: 'Partly cloudy', high_clouds_dry: 'High clouds but dry', mixed_weather: 'Mixed weather', bad_weather: 'Bad weather', storm_risk: 'Storm risk' })[id] || id; }
function humanEnergy(id) { return ({ high: 'High energy', medium: 'Medium energy', low: 'Low / recovery' })[id] || id; }
function escapeAttr(value) { return (value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

function wireNavActive() {
  const links = [...document.querySelectorAll('.nav-row a')]; const ids = links.map(a => a.getAttribute('href').slice(1));
  const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`)); }); }, { rootMargin: '-25% 0px -60% 0px', threshold: 0.01 });
  ids.forEach(id => { const target = document.getElementById(id); if (target) observer.observe(target); });
}

init();
