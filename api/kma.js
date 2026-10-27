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

async function fetchWeather(region, now) {
  const key = process.env.KMA_KEY;
  if (!key) return null;
  const { nx, ny } = GRIDS[region];
  const base = baseTime(now);
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key);   // 인코딩된 키 · 아닌 키 모두 허용
  const url = KMA_URL + '?serviceKey=' + serviceKey
    + '&pageNo=1&numOfRows=1000&dataType=JSON'
    + '&base_date=' + base.date + '&base_time=' + base.time + '&nx=' + nx + '&ny=' + ny;
  const res = await fetch(url);
  if (!res.ok) throw new Error('KMA HTTP ' + res.status);
  return parseKma(await res.json(), ymd(now));
}

async function fetchTasks(region) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('DB 환경변수 없음');
  const q = '/rest/v1/wx_tasks?select=title,region,kind,owner&order=id&region=eq.' + encodeURIComponent(region);
  const res = await fetch(url + q, { headers: { apikey: key } });
  if (!res.ok) throw new Error('DB HTTP ' + res.status);
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
    return res.end(JSON.stringify({ error: '일정을 불러오지 못했습니다.' }));
  }

  // 날씨가 실패해도 일정은 그대로 돌려줌 (판단은 '날씨 확인 전')
  let weather = null;
  try {
    weather = await fetchWeather(region, now);
  } catch (err) {
    weather = null;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({
    region,
    date: now.toISOString().slice(0, 10),
    weather,
    tasks: tasks.map((t) => ({ ...t, judge: judge(t.kind, weather || undefined) })),
  }, null, 2));
};

module.exports.parseKma = parseKma;
module.exports.baseTime = baseTime;
