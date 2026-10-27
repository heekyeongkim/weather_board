// app.js – 화면 동작 (목록 그리기, 일정 추가)

// 04 단원 : 기본 일정은 data/tasks.json 에서 읽고, 화면에서 추가한 일정만 브라우저(wx_added)에 저장
let baseTasks = [];
let tasks = [];
let weatherByRegion = {};   // 03 단원에서 지역별 날씨를 넣음

async function loadBaseTasks() {
  const msg = document.getElementById('loadMsg');
  msg.textContent = '';
  try {
    const res = await fetch('data/tasks.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    baseTasks = await res.json();
  } catch (err) {
    baseTasks = [];
    msg.textContent = '일정 파일을 읽지 못했습니다. 배포 주소로 열어 주세요.';
  }
}

function loadTasks() {
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  tasks = baseTasks.concat(saved);
}

function weatherText(w) {
  return w ? w.tempMax + '℃ · ' + w.windMax + 'm/s · ' + w.rainProb + '%' : '-';
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

function addTask(e) {
  e.preventDefault();
  const t = {
    title: document.getElementById('titleInput').value.trim(),
    region: document.getElementById('regionInput').value,
    kind: document.getElementById('kindInput').value,
    owner: document.getElementById('ownerInput').value.trim(),
  };
  if (!t.title || !t.owner) return;
  const saved = JSON.parse(localStorage.getItem('wx_added') || '[]');
  saved.push(t);
  localStorage.setItem('wx_added', JSON.stringify(saved));
  e.target.reset();
  loadTasks();
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

function renderToday() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  document.getElementById('todayBox').textContent = d.getFullYear() + '-' + mm + '-' + dd;
}

document.getElementById('taskForm').addEventListener('submit', addTask);
renderToday();
loadBaseTasks().then(() => {
  loadTasks();
  renderTasks();
  loadWeather();
});
