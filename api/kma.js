// api/kma.js – GET /api/kma?region=대전
// 우리 DB(Supabase wx_tasks)의 해당 지역 일정 + 기상청 오늘 날씨 + 판단(logic.js judge)을 JSON 으로 돌려줌
// 환경변수(Vercel): KMA_KEY, SUPABASE_URL, SUPABASE_ANON_KEY  (키는 코드에 적지 않음)
const { judge } = require('../logic.js');

// 기상청 격자 좌표 (위도 · 경도를 기상청 공식 변환식으로 계산한 값)
const GRIDS = {
  세종: { nx: 66, ny: 103 },
  대전: { nx: 67, ny: 100 },
  태안: { nx: 48, ny: 109 },
  보령: { nx: 54, ny: 100 },
};

const KMA_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

// 한국 시간 기준 날짜 · 시각
function kstNow() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// 단기예보 발표 기준: 02:10 이후면 오늘 0200, 그 전이면 어제 2300
function baseTime(now) {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minutes >= 2 * 60 + 10) return { date: ymd(now), time: '0200' };
  return { date: ymd(new Date(now.getTime() - 24 * 60 * 60 * 1000)), time: '2300' };
}

// 기상청 응답 → { tempMax, windMax, rainProb } (오늘 하루 최댓값). 값이 없으면 null
function parseKma(json, today) {
  const items = json && json.response && json.response.body && json.response.body.items
    && json.response.body.items.item;
  if (!Array.isArray(items)) return null;
  const pick = (cat) => items
    .filter((i) => i.category === cat && i.fcstDate === today)
    .map((i) => Number(i.fcstValue))
    .filter((n) => !Number.isNaN(n));
  const tmx = pick('TMX');
  const wsd = pick('WSD');
  const pop = pick('POP');
  if (!tmx.length || !wsd.length || !pop.length) return null;
  return { tempMax: Math.max(...tmx), windMax: Math.max(...wsd), rainProb: Math.max(...pop) };
}

// 진단용: 오류 이유를 짧은 글로 알려 줌 (키 · 주소는 절대 포함하지 않음)
function safeReason(err) {
  return err && err.safe ? err.message : '호출 실패';
}
function safeError(msg) {
  const e = new Error(msg);
  e.safe = true;
  return e;
}

async function fetchWeather(region, now) {
  const key = process.env.KMA_KEY;
  if (!key) throw safeError('KMA_KEY 환경변수 없음');
  const { nx, ny } = GRIDS[region];
  const base = baseTime(now);
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key);   // 인코딩된 키 · 아닌 키 모두 허용
  const url = KMA_URL + '?serviceKey=' + serviceKey
    + '&pageNo=1&numOfRows=1000&dataType=JSON'
    + '&base_date=' + base.date + '&base_time=' + base.time + '&nx=' + nx + '&ny=' + ny;
  const res = await fetch(url);
  if (!res.ok) throw safeError('기상청 HTTP ' + res.status);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw safeError('기상청 응답이 JSON 이 아님 (키 종류 · 승인 상태 확인)');
  }
  const weather = parseKma(json, ymd(now));
  if (!weather) {
    const h = json && json.response && json.response.header;
    throw safeError('기상청 값 없음' + (h && h.resultMsg ? ' (' + h.resultMsg + ')' : ''));
  }
  return weather;
}

async function fetchTasks(region) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url) throw safeError('SUPABASE_URL 환경변수 없음');
  if (!key) throw safeError('SUPABASE_ANON_KEY 환경변수 없음');
  if (!/^https:\/\/[^\s'"]+$/.test(url)) throw safeError('SUPABASE_URL 형식 이상 (https:// 로 시작, 공백 · 따옴표 없이)');
  const q = '/rest/v1/wx_tasks?select=title,region,kind,owner&order=id&region=eq.' + encodeURIComponent(region);
  const res = await fetch(url.replace(/\/+$/, '') + q, { headers: { apikey: key.trim() } });
  if (!res.ok) throw safeError('DB HTTP ' + res.status);
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'GET 으로 호출해 주세요.' }));
  }

  const region = new URL(req.url, 'http://localhost').searchParams.get('region');
  if (!region || !Object.prototype.hasOwnProperty.call(GRIDS, region)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'region 은 세종 · 대전 · 태안 · 보령 중 하나여야 합니다.' }));
  }

  const now = kstNow();
  let tasks;
  try {
    tasks = await fetchTasks(region);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: '일정을 불러오지 못했습니다.', detail: safeReason(err) }));
  }

  // 날씨가 실패해도 일정은 그대로 돌려줌 (판단은 '날씨 확인 전')
  let weather = null;
  let weatherNote;
  try {
    weather = await fetchWeather(region, now);
  } catch (err) {
    weather = null;
    weatherNote = safeReason(err);
  }
  if (weatherNote) res.setHeader('Cache-Control', 'no-store');

  res.statusCode = 200;
  res.end(JSON.stringify({
    region,
    date: now.toISOString().slice(0, 10),
    weather,
    ...(weatherNote ? { weatherNote } : {}),
    tasks: tasks.map((t) => ({ ...t, judge: judge(t.kind, weather || undefined) })),
  }, null, 2));
};

module.exports.parseKma = parseKma;
module.exports.baseTime = baseTime;
