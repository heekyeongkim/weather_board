// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 04 단원 : 일정은 Supabase 표 wx_tasks 에서 읽고 저장 (config.js 의 주소 · 공개용 키 사용)
// 연결이 안 되면 예비로 data/tasks.json 을 읽어 목록만 보여 줌 (이때는 추가 불가)
let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음
let dbOk = false;

function createDb() {
  const hasConfig = typeof SUPABASE_URL === 'string' && typeof SUPABASE_ANON_KEY === 'string'
    && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('여기에')
    && !SUPABASE_ANON_KEY.includes('여기에');
  if (!hasConfig || typeof supabase === 'undefined') return null;
  return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
const db = createDb();

async function loadFallbackTasks() {
  try {
    const res = await fetch('data/tasks.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    return [];
  }
}

async function loadTasks() {
  const msg = document.getElementById('loadMsg');
  msg.textContent = '';
  dbOk = false;
  try {
    if (!db) throw new Error('연결 정보 없음');
    const { data, error } = await db.from('wx_tasks').select('title, region, kind, owner').order('id');
    if (error) throw error;
    tasks = data;
    dbOk = true;
  } catch (err) {
    tasks = await loadFallbackTasks();
    msg.textContent = '저장소(Supabase)에 연결하지 못했습니다. 예비 목록만 보이며 일정 추가는 할 수 없습니다.';
  }
}

function renderTasks() {
  const body = document.getElementById('taskList');
  body.innerHTML = '';
  for (const t of tasks) {
    const w = weatherByRegion[t.region];
    const r = judge(t.kind, w);
    const tr = document.createElement('tr');
    for (const v of [t.title, t.region, t.kind, t.owner, weatherText(w)]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.textContent = r.text;
    td.className = r.level;
    tr.appendChild(td);
    body.appendChild(tr);
  }
}

async function addTask(e) {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('msgBox');
  msg.textContent = '';
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  if (!dbOk) {
    msg.textContent = '저장소에 연결되지 않아 일정을 추가할 수 없습니다.';
    return;
  }
  const { error } = await db.from('wx_tasks').insert(t);
  if (error) {
    msg.textContent = '일정을 저장하지 못했습니다. 입력 내용(길이 · 지역 · 구분)을 확인해 주세요.';
    return;
  }
  form.reset();
  await loadTasks();
  renderTasks();
}

// 03 단원 : 날씨를 받아 표를 다시 그림 (실패해도 목록은 이미 보임)
async function loadWeather() {
  const box = document.getElementById('weatherBox');
  box.textContent = '날씨 불러오는 중…';
  try {
    const res = await fetch(buildWeatherUrl());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const map = parseWeather(await res.json());
    if (Object.keys(map).length === 0) throw new Error('빈 응답');
    weatherByRegion = applyTestMode(map, location.search);
    renderTasks();
    const testOn = weatherByRegion['세종'] && /test=wind/.test(location.search);
    box.textContent = '오늘 날씨 반영 완료 (Open-Meteo)' + (testOn ? ' · 시험 모드: 풍속 12 m/s' : '');
  } catch (err) {
    box.textContent = '날씨를 불러오지 못했습니다. 일정은 그대로 볼 수 있고, 판단은 "날씨 확인 전"으로 표시됩니다.';
  }
}

function todayString() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + mm + '-' + dd;
}

function renderToday() {
  document.getElementById('todayBox').textContent = todayString();
}

// 지금 표를 마크다운 파일로 내려받기 (현장일정_판단_YYYY-MM-DD.md)
function downloadMarkdown() {
  const today = todayString();
  const text = buildMarkdown(tasks, weatherByRegion, today);
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = '현장일정_판단_' + today + '.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

document.getElementById('taskForm').addEventListener('submit', addTask);
document.getElementById('mdBtn').addEventListener('click', downloadMarkdown);
renderToday();
loadTasks().then(() => {
  renderTasks();
  loadWeather();
});
