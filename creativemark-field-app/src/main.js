import { supabase } from './supabase.js';

// ─── Constants ─────────────────────────────────────────────────────────────────
const HEARTBEAT_MS = 2 * 60 * 1000;   // push location every 2 min
const MIN_ACCURACY_M = 200;            // reject visit if GPS fuzzier than this
const STATS_INTERVAL = 30_000;         // refresh dashboard stats every 30s

// ─── App state ─────────────────────────────────────────────────────────────────
let currentUser = null;
let isTracking = false;
let heartbeatTimer = null;
let statsTimer = null;
let activeShiftId = null;
let lastSyncTs = null;
let selfieFile = null;
let buildingFile = null;
let visitsRange = 'today';
let cachedVisits = [];
let employeeProject = 'society_one'; // 'society_one', 'smart_tap_ai', 'both'
let shiftStartSelfie = null;
let shiftEndSelfie = null;
let noWorkFlag = false;
let shopSelfieFile = null;
let shopBuildingFile = null;
let shopInterest = 'interested';
let cachedShopVisits = [];

// ─── DOM helpers ───────────────────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function show(el) { if (typeof el === 'string') el = $(el); el?.classList.add('active'); }
function hide(el) { if (typeof el === 'string') el = $(el); el?.classList.remove('active'); }

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  show(`#${id}`);
}

function showTab(name) {
  $$('.tab-page').forEach(p => p.classList.remove('active'));
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  show(`#tab-${name}`);
  document.querySelector(`.tab-btn[data-tab="${name}"]`)?.classList.add('active');
  if (name === 'assignments') loadAssignments();
  if (name === 'visits') loadMyVisits();
  if (name === 'dashboard') loadDashboardStats();
}

function applyProjectFilter() {
  const isSociety = employeeProject === 'society_one' || employeeProject === 'both';
  const isSmartTap = employeeProject === 'smart_tap_ai' || employeeProject === 'both';

  // Show/hide project-specific tab buttons
  $$('.tab-btn.project-society').forEach(el => el.style.display = isSociety ? '' : 'none');
  $$('.tab-btn.project-smart-tap').forEach(el => el.style.display = isSmartTap ? '' : 'none');
}

let toastTimeout;
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.className = 'toast', 3000);
}

// ─── Geolocation helper ────────────────────────────────────────────────────────
function getCurrentPosition(highAccuracy = true) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: highAccuracy,
      timeout: 15000,
      maximumAge: 10000,
    });
  });
}

// ─── Photo upload helper ───────────────────────────────────────────────────────
async function uploadPhoto(file, userId, kind) {
  try {
    const path = `${userId}/${Date.now()}-${kind}.jpg`;
    const arrayBuffer = await file.arrayBuffer();
    const { error } = await supabase.storage
      .from('field-evidence')
      .upload(path, arrayBuffer, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error) { console.log('upload error', error.message); return null; }
    const { data } = supabase.storage.from('field-evidence').getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.log('uploadPhoto error', e);
    return null;
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    enterApp();
  } else {
    showScreen('login');
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      currentUser = session.user;
      enterApp();
    } else {
      currentUser = null;
      exitApp();
    }
  });
}

async function handleLogin() {
  const email = $('#login-email').value.trim();
  const password = $('#login-password').value;
  const errEl = $('#login-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Enter email and password'; return; }

  $('#btn-login').disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $('#btn-login').disabled = false;

  if (error) { errEl.textContent = error.message; }
}

async function handleLogout() {
  await stopTracking();
  await supabase.auth.signOut();
}

async function enterApp() {
  showScreen('app');

  // Fetch employee's project assignment
  if (currentUser) {
    const { data: empRow } = await supabase.from('employees')
      .select('project').eq('id', currentUser.id).maybeSingle();
    employeeProject = empRow?.project || 'society_one';
  }
  applyProjectFilter();

  showTab('dashboard');
  loadDashboardStats();
  reconcileShift();
  statsTimer = setInterval(loadDashboardStats, STATS_INTERVAL);
}

function exitApp() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
  isTracking = false;
  activeShiftId = null;
  showScreen('login');
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────
async function loadDashboardStats() {
  if (!currentUser) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const visitTable = employeeProject === 'smart_tap_ai' ? 'shop_visits' : 'society_data';
  const [empRes, countRes] = await Promise.all([
    supabase.from('employees').select('lead_target_daily').eq('id', currentUser.id).maybeSingle(),
    supabase.from(visitTable).select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', start.toISOString()),
  ]);

  const target = empRes.data?.lead_target_daily || 15;
  const visited = countRes.count || 0;
  const pct = target > 0 ? Math.min(100, Math.round((visited / target) * 100)) : 0;

  $('#stat-target').textContent = target;
  $('#stat-visited').textContent = visited;
  const pctEl = $('#stat-progress');
  pctEl.textContent = pct + '%';
  pctEl.className = 'stat-value ' + (pct >= 100 ? 'green' : 'accent');
  $('#progress-bar').style.width = pct + '%';

  updateTrackingUI();
  updateStatusList();
}

function updateTrackingUI() {
  const desc = $('#tracking-desc');
  const startBtn = $('#btn-start-shift');
  const stopBtn = $('#btn-stop-shift');
  if (isTracking) {
    desc.textContent = `Your location is being shared. Last sync: ${formatRelative(lastSyncTs)}.`;
    startBtn.style.display = 'none';
    stopBtn.style.display = '';
  } else {
    desc.textContent = 'Start your shift to share your location with your manager.';
    startBtn.style.display = '';
    stopBtn.style.display = 'none';
  }
}

function formatRelative(ts) {
  if (!ts) return 'never';
  const diff = Math.max(0, Date.now() - ts);
  if (diff < 60000) return Math.floor(diff / 1000) + 's ago';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  return Math.floor(diff / 3600000) + 'h ago';
}

async function updateStatusList() {
  const list = $('#status-list');
  let gpsOk = false;
  let permOk = false;

  try {
    const state = await navigator.permissions.query({ name: 'geolocation' });
    permOk = state.state === 'granted';
  } catch { /* some browsers don't support this */ }

  try {
    await getCurrentPosition(false);
    gpsOk = true;
  } catch { gpsOk = false; }

  const rows = [
    { ok: gpsOk, label: gpsOk ? 'GPS: Available' : 'GPS: Unavailable' },
    { ok: permOk, label: permOk ? 'Location permission: Granted' : 'Location permission: Not granted' },
    { ok: isTracking, label: isTracking ? 'Tracking: Running' : 'Tracking: Stopped' },
    { ok: lastSyncTs && (Date.now() - lastSyncTs < 5 * 60000), label: `Last sync: ${formatRelative(lastSyncTs)}` },
  ];

  list.innerHTML = rows.map(r =>
    `<div class="status-row"><span class="dot ${r.ok ? 'dot-green' : 'dot-amber'}"></span><span>${r.label}</span></div>`
  ).join('');
}

// ─── Shift & Tracking ──────────────────────────────────────────────────────────
async function reconcileShift() {
  if (!currentUser) return;
  const { data: openShift } = await supabase
    .from('employee_shifts')
    .select('id')
    .eq('employee_id', currentUser.id)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openShift?.id) {
    activeShiftId = openShift.id;
    isTracking = true;
    startHeartbeat();
    updateTrackingUI();
  }
}

function handleStartShift() {
  if (!currentUser) return;
  // Reset modal state
  shiftStartSelfie = null;
  noWorkFlag = false;
  $('#shift-planned-work').value = '';
  $('#shift-start-error').textContent = '';
  resetPhotoBox('photo-shift-start', 'Tap to take selfie');
  $('#btn-no-work-flag').classList.remove('no-work-active');
  $('#btn-no-work-flag').innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> No Work Assigned Today';
  $('#shift-start-modal').classList.add('open');
}

async function confirmStartShift() {
  if (!currentUser) return;
  const errEl = $('#shift-start-error');
  errEl.textContent = '';

  if (!shiftStartSelfie) {
    errEl.textContent = 'Please take a selfie to start your shift.';
    return;
  }

  const plannedWork = $('#shift-planned-work').value.trim();
  if (!plannedWork && !noWorkFlag) {
    errEl.textContent = 'Enter your planned work or tap "No Work Assigned".';
    return;
  }

  const btn = $('#btn-confirm-shift-start');
  btn.disabled = true;
  btn.textContent = 'Getting location...';

  // Request location
  try {
    await getCurrentPosition();
  } catch (e) {
    errEl.textContent = 'Please allow location access to start your shift.';
    btn.disabled = false;
    btn.textContent = 'Start Shift';
    return;
  }

  let startLat = null, startLng = null;
  try {
    const pos = await getCurrentPosition();
    startLat = pos.coords.latitude;
    startLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  btn.textContent = 'Uploading selfie...';
  const selfieUrl = await uploadPhoto(shiftStartSelfie, currentUser.id, 'shift-start');

  btn.textContent = 'Starting shift...';
  const { data: row, error } = await supabase
    .from('employee_shifts')
    .insert({
      employee_id: currentUser.id,
      start_lat: startLat,
      start_lng: startLng,
      start_selfie_url: selfieUrl,
      planned_work: plannedWork || null,
      no_work_flag: noWorkFlag,
    })
    .select('id')
    .single();

  btn.disabled = false;
  btn.textContent = 'Start Shift';

  if (error) {
    if (error.code === '23505') {
      errEl.textContent = 'A shift is already open. Stop it first.';
      await reconcileShift();
    } else {
      errEl.textContent = error.message || 'Could not start shift';
    }
    return;
  }

  activeShiftId = row?.id || null;
  isTracking = true;
  startHeartbeat();
  updateTrackingUI();
  $('#shift-start-modal').classList.remove('open');
  toast('Shift started! Your location is being shared.', 'success');
}

async function handleStopShift() {
  if (!currentUser || !activeShiftId) return;

  // Check shift duration for early-end warning
  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  const SHIFT_HOURS = 8;
  let elapsedMin = 0;
  if (shiftRow?.started_at) {
    elapsedMin = Math.max(0, Math.round((Date.now() - new Date(shiftRow.started_at).getTime()) / 60000));
  }

  // Reset modal state
  shiftEndSelfie = null;
  $('#shift-work-summary').value = '';
  $('#shift-shops-count').value = '';
  $('#shift-end-error').textContent = '';
  resetPhotoBox('photo-shift-end', 'Tap to take selfie');

  // Show early warning if < 8 hours
  const warningEl = $('#early-shift-warning');
  if (elapsedMin < SHIFT_HOURS * 60) {
    const hrs = Math.floor(elapsedMin / 60);
    const mins = elapsedMin % 60;
    $('#early-warning-text').textContent = `You've worked ${hrs}h ${mins}m of your ${SHIFT_HOURS}-hour shift. This will be recorded.`;
    warningEl.style.display = 'flex';
  } else {
    warningEl.style.display = 'none';
  }

  $('#shift-end-modal').classList.add('open');
}

async function confirmEndShift() {
  if (!currentUser || !activeShiftId) return;
  const errEl = $('#shift-end-error');
  errEl.textContent = '';

  if (!shiftEndSelfie) {
    errEl.textContent = 'Please take a selfie to end your shift.';
    return;
  }

  const workSummary = $('#shift-work-summary').value.trim();
  if (!workSummary) {
    errEl.textContent = 'Please fill in your work summary for today.';
    return;
  }

  const btn = $('#btn-confirm-shift-end');
  btn.disabled = true;
  btn.textContent = 'Uploading selfie...';

  const endSelfieUrl = await uploadPhoto(shiftEndSelfie, currentUser.id, 'shift-end');

  btn.textContent = 'Ending shift...';

  let endLat = null, endLng = null;
  try {
    const pos = await getCurrentPosition(false);
    endLat = pos.coords.latitude;
    endLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  // Compute shift duration + visit count
  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  let durationMin = null, visitCount = 0;
  if (shiftRow?.started_at) {
    const started = new Date(shiftRow.started_at);
    durationMin = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    const { count } = await supabase
      .from('society_data')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', started.toISOString());
    visitCount = count || 0;
  }

  const shopsCount = $('#shift-shops-count').value ? parseInt($('#shift-shops-count').value) : visitCount;

  await supabase.from('employee_shifts').update({
    ended_at: new Date().toISOString(),
    end_lat: endLat,
    end_lng: endLng,
    end_selfie_url: endSelfieUrl,
    duration_min: durationMin,
    visit_count: shopsCount,
    work_summary: workSummary,
  }).eq('id', activeShiftId);

  // Stop tracking
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  isTracking = false;
  activeShiftId = null;
  updateTrackingUI();

  btn.disabled = false;
  btn.textContent = 'End Shift';
  $('#shift-end-modal').classList.remove('open');
  toast('Shift ended successfully.', 'success');
  loadDashboardStats();
}

async function stopTracking() {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  isTracking = false;
  updateTrackingUI();

  if (!currentUser || !activeShiftId) return;

  // Fallback for logout without end-shift modal
  let endLat = null, endLng = null;
  try {
    const pos = await getCurrentPosition(false);
    endLat = pos.coords.latitude;
    endLng = pos.coords.longitude;
  } catch { /* non-fatal */ }

  const { data: shiftRow } = await supabase
    .from('employee_shifts')
    .select('started_at')
    .eq('id', activeShiftId)
    .maybeSingle();

  let durationMin = null, visitCount = 0;
  if (shiftRow?.started_at) {
    const started = new Date(shiftRow.started_at);
    durationMin = Math.max(0, Math.round((Date.now() - started.getTime()) / 60000));
    const { count } = await supabase
      .from('society_data')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', currentUser.id)
      .gte('created_at', started.toISOString());
    visitCount = count || 0;
  }

  await supabase.from('employee_shifts').update({
    ended_at: new Date().toISOString(),
    end_lat: endLat,
    end_lng: endLng,
    duration_min: durationMin,
    visit_count: visitCount,
  }).eq('id', activeShiftId);

  activeShiftId = null;
  toast('Shift ended.', 'success');
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  pushLocation(); // immediate first tick
  heartbeatTimer = setInterval(pushLocation, HEARTBEAT_MS);
}

async function pushLocation() {
  if (!currentUser) return;
  try {
    const pos = await getCurrentPosition(false);
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
    const now = new Date().toISOString();

    await Promise.all([
      supabase.from('employees').update({
        current_lat: lat,
        current_lng: lng,
        last_location_update: now,
      }).eq('id', currentUser.id),
      supabase.from('employee_location_history').insert({
        employee_id: currentUser.id,
        lat, lng,
        timestamp: now,
        accuracy_m: accuracy,
        is_mock: false,
      }),
    ]);
    lastSyncTs = Date.now();
  } catch (e) {
    console.log('pushLocation failed:', e);
  }
}

// ─── Assignments ───────────────────────────────────────────────────────────────
async function loadAssignments() {
  if (!currentUser) return;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('assigned_societies')
    .select('id, society_name, address, lat, lng, priority, notes, visited_at, assigned_date')
    .eq('employee_id', currentUser.id)
    .gte('assigned_date', todayStart.toISOString())
    .lte('assigned_date', todayEnd.toISOString())
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  const list = $('#assignments-list');
  const subtitle = $('#assignments-subtitle');

  if (error) {
    subtitle.textContent = 'Failed to load assignments';
    list.innerHTML = '';
    return;
  }

  const assignments = data || [];
  const pending = assignments.filter(a => !a.visited_at);
  const visited = assignments.filter(a => a.visited_at);

  subtitle.textContent = assignments.length === 0
    ? 'No assignments for today.'
    : `${visited.length} / ${assignments.length} completed`;

  if (assignments.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Your manager hasn\'t assigned any societies for today.</p></div>';
    return;
  }

  let html = '';
  if (pending.length > 0) {
    html += '<p style="font-size:14px;font-weight:700;color:#E2E8F0;margin-bottom:6px">Pending</p>';
    html += pending.map(a => assignCard(a, false)).join('');
  }
  if (visited.length > 0) {
    html += '<p style="font-size:14px;font-weight:700;color:#E2E8F0;margin:12px 0 6px">Completed</p>';
    html += visited.map(a => assignCard(a, true)).join('');
  }
  list.innerHTML = html;
}

function assignCard(a, done) {
  return `<div class="assign-card ${done ? 'done' : 'pending'}">
    <div class="assign-header">
      <div style="display:flex;align-items:center;gap:8px;flex:1">
        <svg class="assign-status-icon" viewBox="0 0 24 24" width="18" height="18" fill="${done ? '#22C55E' : 'none'}" stroke="${done ? '#22C55E' : '#F59E0B'}" stroke-width="2"><circle cx="12" cy="12" r="10"/>${done ? '<polyline points="9 12 11 14 15 10"/>' : ''}</svg>
        <span class="assign-name">${esc(a.society_name)}</span>
      </div>
      ${a.priority > 0 ? `<span class="assign-badge">P${a.priority}</span>` : ''}
    </div>
    ${a.address ? `<div class="assign-address" style="margin-left:26px">${esc(a.address)}</div>` : ''}
    ${a.notes ? `<div class="assign-notes" style="margin-left:26px">${esc(a.notes)}</div>` : ''}
    ${!done ? `<button class="assign-done-btn" data-assign-id="${a.id}">Mark Done</button>` : ''}
  </div>`;
}

async function markAssignmentDone(assignId) {
  const btn = document.querySelector(`[data-assign-id="${assignId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  const { error } = await supabase.from('assigned_societies')
    .update({ visited_at: new Date().toISOString() })
    .eq('id', assignId);
  if (error) {
    toast('Failed to mark done: ' + error.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Mark Done'; }
  } else {
    toast('Assignment marked done!', 'success');
    loadAssignments();
    loadDashboardStats();
  }
}

// ─── My Visits ──────────────────────────────────────────────────────────────────
function getDateRange(range) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - start.getDay());
  if (range === 'month') start.setDate(1);
  return start.toISOString();
}

async function loadMyVisits() {
  if (!currentUser) return;

  // For smart_tap_ai project, load shop visits instead
  if (employeeProject === 'smart_tap_ai') {
    return loadShopVisits();
  }
  // For 'both' project, load society visits in main list (shop visits in Shop tab)

  const list = $('#visits-list');
  const subtitle = $('#visits-subtitle');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const since = getDateRange(visitsRange);
  const { data, error } = await supabase.from('society_data')
    .select('id, name, address, contact_person, contact_phone, number_of_flats, status, verification_status, selfie_url, building_photo_url, created_at')
    .eq('employee_id', currentUser.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    subtitle.textContent = 'Failed to load';
    list.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
    return;
  }

  cachedVisits = data || [];
  const count = cachedVisits.length;
  const rangeLabel = visitsRange === 'today' ? 'today' : visitsRange === 'week' ? 'this week' : 'this month';
  subtitle.textContent = `${count} societ${count === 1 ? 'y' : 'ies'} visited ${rangeLabel}`;

  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const activeVisits = cachedVisits.filter(v => new Date(v.created_at) >= eightHoursAgo);

  if (count === 0) {
    list.innerHTML = '<div class="empty-state"><p>No visits logged yet.</p></div>';
    return;
  }

  if (activeVisits.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Older visits are no longer visible here.</p></div>';
    return;
  }

  list.innerHTML = activeVisits.map(v => {
    const time = new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const vs = v.verification_status || 'pending';
    return `<div class="visit-card" data-visit-id="${v.id}">
      <div class="visit-card-top">
        <div class="visit-card-name">${esc(v.name)}</div>
        <div class="visit-card-time">${date}, ${time}</div>
      </div>
      ${v.address ? `<div class="visit-card-address">${esc(v.address)}</div>` : ''}
      <div class="visit-card-meta">
        ${v.number_of_flats ? `<span class="visit-card-tag">${v.number_of_flats} flats</span>` : ''}
        ${v.contact_person ? `<span class="visit-card-tag">${esc(v.contact_person)}</span>` : ''}
        <span class="visit-card-tag ${vs === 'pending' ? 'pending' : vs === 'verified' ? 'verified' : 'rejected'}">${vs}</span>
      </div>
    </div>`;
  }).join('');
}

// ─── Visit Detail Modal ──────────────────────────────────────────────────────────
function openVisitModal(visitId) {
  const v = cachedVisits.find(x => x.id === visitId);
  if (!v) return;

  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  if (new Date(v.created_at) < eightHoursAgo) {
    // Show a toast message if they somehow try to open it
    showToast('Details are no longer available for older visits.', 'error');
    return;
  }

  const modal = $('#visit-modal');
  const body = $('#modal-body');
  const time = new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  let photosHtml = '';
  if (v.selfie_url || v.building_photo_url) {
    photosHtml = `<div class="modal-photos">
      ${v.selfie_url ? `<img src="${v.selfie_url}" alt="Selfie" />` : ''}
      ${v.building_photo_url ? `<img src="${v.building_photo_url}" alt="Building" />` : ''}
    </div>`;
  }

  body.innerHTML = `
    <div class="modal-row"><span class="modal-row-label">Society</span><span class="modal-row-value">${esc(v.name)}</span></div>
    <div class="modal-row"><span class="modal-row-label">Address</span><span class="modal-row-value">${esc(v.address || '-')}</span></div>
    <div class="modal-row"><span class="modal-row-label">Contact Person</span><span class="modal-row-value">${esc(v.contact_person || '-')}</span></div>
    <div class="modal-row"><span class="modal-row-label">Contact Phone</span><span class="modal-row-value">${esc(v.contact_phone || '-')}</span></div>
    <div class="modal-row"><span class="modal-row-label">Flats</span><span class="modal-row-value">${v.number_of_flats || '-'}</span></div>
    <div class="modal-row"><span class="modal-row-label">Status</span><span class="modal-row-value">${v.verification_status || 'pending'}</span></div>
    <div class="modal-row"><span class="modal-row-label">Logged</span><span class="modal-row-value">${time}</span></div>
    ${photosHtml}
    <div class="modal-actions">
      <button class="btn btn-primary btn-sm" id="btn-edit-visit" data-vid="${v.id}">Edit Details</button>
    </div>
  `;
  modal.classList.add('open');

  $('#btn-edit-visit').addEventListener('click', () => openEditForm(v));
}

function closeModal() { $('#visit-modal').classList.remove('open'); }

function openEditForm(v) {
  const body = $('#modal-body');
  $('#modal-title').textContent = 'Edit Visit';
  body.innerHTML = `
    <div class="modal-edit-form">
      <div class="form-group"><label>Society Name</label><input id="edit-name" type="text" value="${esc(v.name)}" /></div>
      <div class="form-group"><label>Address</label><input id="edit-address" type="text" value="${esc(v.address || '')}" /></div>
      <div class="form-group"><label>Contact Person</label><input id="edit-contact" type="text" value="${esc(v.contact_person || '')}" /></div>
      <div class="form-group"><label>Contact Phone</label><input id="edit-phone" type="tel" value="${esc(v.contact_phone || '')}" /></div>
      <div class="form-group"><label>Number of Flats</label><input id="edit-flats" type="number" value="${v.number_of_flats || ''}" inputmode="numeric" /></div>
      <div class="modal-actions">
        <button class="btn btn-outline-danger btn-sm" id="btn-cancel-edit">Cancel</button>
        <button class="btn btn-primary btn-sm" id="btn-save-edit" data-vid="${v.id}">Save</button>
      </div>
    </div>
  `;
  $('#btn-cancel-edit').addEventListener('click', () => { closeModal(); });
  $('#btn-save-edit').addEventListener('click', () => saveVisitEdit(v.id));
}

async function saveVisitEdit(visitId) {
  const btn = $('#btn-save-edit');
  btn.disabled = true; btn.textContent = 'Saving...';

  const updates = {
    name: $('#edit-name').value.trim(),
    address: $('#edit-address').value.trim(),
    contact_person: $('#edit-contact').value.trim() || null,
    contact_phone: $('#edit-phone').value.trim() || null,
    number_of_flats: $('#edit-flats').value ? parseInt($('#edit-flats').value) : null,
  };

  if (!updates.name) { toast('Society name is required', 'error'); btn.disabled = false; btn.textContent = 'Save'; return; }

  const { error } = await supabase.from('society_data').update(updates).eq('id', visitId);
  if (error) {
    toast('Save failed: ' + error.message, 'error');
    btn.disabled = false; btn.textContent = 'Save';
  } else {
    toast('Visit updated!', 'success');
    closeModal();
    loadMyVisits();
  }
}

function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Smart Tap AI Shop Visit ────────────────────────────────────────────────────
async function handleSubmitShop() {
  const personName = $('#shop-person-name').value.trim();
  const mobile = $('#shop-mobile').value.trim();
  const shopName = $('#shop-name').value.trim();
  const nextCall = $('#shop-next-call').value;
  const notes = $('#shop-notes').value.trim();
  const errEl = $('#shop-error');
  const successEl = $('#shop-success');
  errEl.textContent = '';
  successEl.textContent = '';

  if (!personName || !mobile) {
    errEl.textContent = 'Person name and mobile number are required.';
    return;
  }

  const btn = $('#btn-submit-shop');
  btn.disabled = true;
  btn.textContent = 'Getting location...';

  let lat = null, lng = null, accuracy = null;
  try {
    const pos = await getCurrentPosition(true);
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit Shop Visit';
    errEl.textContent = 'Could not get GPS location. Move outdoors and try again.';
    return;
  }

  btn.textContent = 'Uploading photos...';
  let selfieUrl = null, shopPhotoUrl = null;
  if (shopSelfieFile) selfieUrl = await uploadPhoto(shopSelfieFile, currentUser.id, 'shop-selfie');
  if (shopBuildingFile) shopPhotoUrl = await uploadPhoto(shopBuildingFile, currentUser.id, 'shop-photo');

  const googleMapLink = `https://www.google.com/maps?q=${lat},${lng}`;

  btn.textContent = 'Submitting...';
  const { error } = await supabase.from('shop_visits').insert({
    employee_id: currentUser.id,
    person_name: personName,
    mobile,
    shop_name: shopName || null,
    interest_status: shopInterest,
    lat, lng,
    accuracy_m: accuracy,
    selfie_url: selfieUrl,
    shop_photo_url: shopPhotoUrl,
    next_call_date: nextCall || null,
    notes: notes || null,
    google_map_link: googleMapLink,
  });

  btn.disabled = false;
  btn.textContent = 'Submit Shop Visit';

  if (error) {
    errEl.textContent = 'Error: ' + error.message;
    return;
  }

  successEl.textContent = 'Shop visit logged successfully!';
  $('#shop-person-name').value = '';
  $('#shop-mobile').value = '';
  $('#shop-name').value = '';
  $('#shop-next-call').value = '';
  $('#shop-notes').value = '';
  shopSelfieFile = null;
  shopBuildingFile = null;
  shopInterest = 'interested';
  resetPhotoBox('photo-shop-selfie', 'Your Selfie');
  resetPhotoBox('photo-shop-building', 'Shop Photo');
  // Reset pill selection
  $$('.pill-btn').forEach(b => b.classList.remove('active'));
  $('.pill-btn[data-interest="interested"]')?.classList.add('active');

  loadDashboardStats();
  setTimeout(() => { successEl.textContent = ''; }, 5000);
}

async function loadShopVisits() {
  if (!currentUser) return;
  const list = $('#visits-list');
  const subtitle = $('#visits-subtitle');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const since = getDateRange(visitsRange);
  const { data, error } = await supabase.from('shop_visits')
    .select('id, person_name, mobile, shop_name, interest_status, next_call_date, selfie_url, shop_photo_url, created_at, google_map_link')
    .eq('employee_id', currentUser.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    subtitle.textContent = 'Failed to load';
    list.innerHTML = `<div class="empty-state"><p>${error.message}</p></div>`;
    return;
  }

  cachedShopVisits = data || [];
  const count = cachedShopVisits.length;
  const rangeLabel = visitsRange === 'today' ? 'today' : visitsRange === 'week' ? 'this week' : 'this month';
  subtitle.textContent = `${count} shop${count === 1 ? '' : 's'} visited ${rangeLabel}`;

  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const activeShopVisits = cachedShopVisits.filter(v => new Date(v.created_at) >= eightHoursAgo);

  if (count === 0) {
    list.innerHTML = '<div class="empty-state"><p>No shop visits logged yet.</p></div>';
    return;
  }

  if (activeShopVisits.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Older visits are no longer visible here.</p></div>';
    return;
  }

  list.innerHTML = activeShopVisits.map(v => {
    const time = new Date(v.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const date = new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const interest = v.interest_status || 'not_contacted';
    const interestLabel = interest === 'interested' ? 'Interested' : interest === 'not_interested' ? 'Not Interested' : interest === 'follow_up' ? 'Follow Up' : 'Not Contacted';
    const interestClass = interest === 'interested' ? 'verified' : interest === 'not_interested' ? 'rejected' : 'pending';
    return `<div class="visit-card" data-shop-visit-id="${v.id}">
      <div class="visit-card-top">
        <div class="visit-card-name">${esc(v.person_name)}</div>
        <div class="visit-card-time">${date}, ${time}</div>
      </div>
      ${v.shop_name ? `<div class="visit-card-address">${esc(v.shop_name)}</div>` : ''}
      <div class="visit-card-meta">
        ${v.mobile ? `<span class="visit-card-tag">${esc(v.mobile)}</span>` : ''}
        <span class="visit-card-tag ${interestClass}">${interestLabel}</span>
        ${v.next_call_date ? `<span class="visit-card-tag">Follow: ${v.next_call_date}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ─── Log Visit ─────────────────────────────────────────────────────────────────
async function handleSubmitVisit() {
  const name = $('#visit-name').value.trim();
  const address = $('#visit-address').value.trim();
  const contactPerson = $('#visit-contact').value.trim();
  const contactPhone = $('#visit-phone').value.trim();
  const flatsRaw = $('#visit-flats').value.trim();
  const errEl = $('#visit-error');
  const successEl = $('#visit-success');
  errEl.textContent = '';
  successEl.textContent = '';

  if (!name || !address) {
    errEl.textContent = 'Society name and address are required.';
    return;
  }

  const btn = $('#btn-submit-visit');
  btn.disabled = true;
  btn.textContent = 'Getting location...';

  // Get GPS position
  let lat = null, lng = null, accuracy = null;
  try {
    const pos = await getCurrentPosition(true);
    lat = pos.coords.latitude;
    lng = pos.coords.longitude;
    accuracy = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = 'Could not get GPS location. Move outdoors and try again.';
    return;
  }

  if (accuracy != null && accuracy > MIN_ACCURACY_M) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = `GPS accuracy too low (${Math.round(accuracy)}m). Move to an open area (need < ${MIN_ACCURACY_M}m).`;
    return;
  }

  btn.textContent = 'Uploading photos...';

  // Upload photos
  let selfieUrl = null, buildingUrl = null;
  if (selfieFile) selfieUrl = await uploadPhoto(selfieFile, currentUser.id, 'selfie');
  if (buildingFile) buildingUrl = await uploadPhoto(buildingFile, currentUser.id, 'building');

  btn.textContent = 'Submitting...';

  const { data: visitRow, error } = await supabase.from('society_data')
    .insert({
      employee_id: currentUser.id,
      name,
      address,
      contact_person: contactPerson || null,
      contact_phone: contactPhone || null,
      number_of_flats: flatsRaw ? parseInt(flatsRaw) : null,
      status: 'Pending',
      lat, lng,
      accuracy_m: accuracy,
      is_mock: false,
      selfie_url: selfieUrl,
      building_photo_url: buildingUrl,
      verification_status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    btn.disabled = false;
    btn.textContent = 'Submit Visit';
    errEl.textContent = 'Error: ' + error.message;
    return;
  }

  // Auto-match to today's assignment
  if (visitRow?.id) {
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data: candidates } = await supabase
        .from('assigned_societies')
        .select('id, society_name')
        .eq('employee_id', currentUser.id)
        .is('visited_at', null)
        .gte('assigned_date', todayStart.toISOString())
        .lte('assigned_date', todayEnd.toISOString());

      if (candidates?.length) {
        const normName = name.toLowerCase();
        const match = candidates.find(c => c.society_name.trim().toLowerCase() === normName);
        if (match) {
          await supabase.from('assigned_societies')
            .update({ visited_at: new Date().toISOString(), visit_id: visitRow.id })
            .eq('id', match.id);
        }
      }
    } catch { /* non-fatal */ }
  }

  // Reset form
  btn.disabled = false;
  btn.textContent = 'Submit Visit';
  successEl.textContent = 'Visit logged successfully! The calling team will verify it.';
  $('#visit-name').value = '';
  $('#visit-address').value = '';
  $('#visit-contact').value = '';
  $('#visit-phone').value = '';
  $('#visit-flats').value = '';
  selfieFile = null;
  buildingFile = null;
  resetPhotoBox('photo-selfie', 'Take Selfie');
  resetPhotoBox('photo-building', 'Building Photo');
  $('#visit-location-info').classList.remove('visible');

  // Refresh dashboard stats
  loadDashboardStats();

  setTimeout(() => { successEl.textContent = ''; }, 5000);
}

function resetPhotoBox(id, label) {
  const box = $(`#${id}`);
  const img = box.querySelector('img');
  if (img) img.remove();
  const check = box.querySelector('.photo-check');
  if (check) check.remove();
  const span = box.querySelector('span');
  if (span) span.textContent = label;
}

// ─── Photo preview handler ─────────────────────────────────────────────────────
function handlePhotoInput(e) {
  const input = e.target;
  const file = input.files?.[0];
  if (!file) return;
  const kind = input.dataset.kind;
  const box = input.closest('.photo-box');

  if (kind === 'selfie') selfieFile = file;
  else if (kind === 'building') buildingFile = file;
  else if (kind === 'shift-start') shiftStartSelfie = file;
  else if (kind === 'shift-end') shiftEndSelfie = file;
  else if (kind === 'shop-selfie') shopSelfieFile = file;
  else if (kind === 'shop-building') shopBuildingFile = file;

  // Preview
  const existing = box.querySelector('img');
  if (existing) existing.remove();
  const existingCheck = box.querySelector('.photo-check');
  if (existingCheck) existingCheck.remove();

  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  box.appendChild(img);

  const check = document.createElement('div');
  check.className = 'photo-check';
  check.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="#22C55E"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
  box.appendChild(check);
}

// ─── Wire up event listeners ───────────────────────────────────────────────────
function bindEvents() {
  // Login
  $('#btn-login').addEventListener('click', handleLogin);
  $('#login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

  // Logout
  $('#btn-logout').addEventListener('click', handleLogout);

  // Tabs
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });

  // Shift start/stop
  $('#btn-start-shift').addEventListener('click', handleStartShift);
  $('#btn-stop-shift').addEventListener('click', handleStopShift);

  // Shift start modal
  $('#btn-confirm-shift-start').addEventListener('click', confirmStartShift);
  $('#btn-close-shift-start').addEventListener('click', () => $('#shift-start-modal').classList.remove('open'));
  $('#shift-start-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#shift-start-modal').classList.remove('open'); });

  // No-work flag toggle
  $('#btn-no-work-flag').addEventListener('click', () => {
    noWorkFlag = !noWorkFlag;
    const btn = $('#btn-no-work-flag');
    if (noWorkFlag) {
      btn.classList.add('no-work-active');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg> No Work Flagged';
    } else {
      btn.classList.remove('no-work-active');
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> No Work Assigned Today';
    }
  });

  // Shift end modal
  $('#btn-confirm-shift-end').addEventListener('click', confirmEndShift);
  $('#btn-close-shift-end').addEventListener('click', () => $('#shift-end-modal').classList.remove('open'));
  $('#shift-end-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('#shift-end-modal').classList.remove('open'); });

  // Visit submit
  $('#btn-submit-visit').addEventListener('click', handleSubmitVisit);

  // Shop visit submit
  $('#btn-submit-shop').addEventListener('click', handleSubmitShop);

  // Interest pills (Smart Tap AI form)
  $$('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shopInterest = btn.dataset.interest;
    });
  });

  // Photo inputs
  $$('.photo-input').forEach(input => {
    input.addEventListener('change', handlePhotoInput);
  });

  // Assignment mark-done (delegated)
  document.addEventListener('click', (e) => {
    const doneBtn = e.target.closest('.assign-done-btn');
    if (doneBtn) markAssignmentDone(doneBtn.dataset.assignId);
  });

  // Visits filter buttons
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      visitsRange = btn.dataset.range;
      loadMyVisits();
    });
  });

  // Visit card tap → open detail modal (delegated)
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.visit-card');
    if (card && card.dataset.visitId) openVisitModal(card.dataset.visitId);
  });

  // Close modal
  $('#btn-close-modal').addEventListener('click', closeModal);
  $('#visit-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await initAuth();
  hide('#splash');
});
