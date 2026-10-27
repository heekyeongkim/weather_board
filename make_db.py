# make_db.py – data/tasks.json 을 SQLite 파일 tasks.db 로 만들고 SQL 로 조회 (파이썬 기본 기능만)
# 실행: python make_db.py   (tasks.db 는 GitHub 에 올리지 않음 – .gitignore 의 *.db)
import json
import sqlite3
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

BASE = Path(__file__).parent
DB_PATH = BASE / 'tasks.db'
JSON_PATH = BASE / 'data' / 'tasks.json'

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS tasks (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  title  TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('세종', '대전', '태안', '보령')),
  kind   TEXT NOT NULL CHECK (kind   IN ('야외', '고소', '실내')),
  owner  TEXT NOT NULL
)
"""

con = sqlite3.connect(DB_PATH)
con.execute(CREATE_SQL)

# 다시 실행해도 결과가 같도록 비우고 넣음
tasks = json.loads(JSON_PATH.read_text(encoding='utf-8'))
con.execute('DELETE FROM tasks')
con.execute("DELETE FROM sqlite_sequence WHERE name = 'tasks'")
con.executemany(
    'INSERT INTO tasks (title, region, kind, owner) VALUES (:title, :region, :kind, :owner)',
    tasks,
)
con.commit()
print(f'tasks.json {len(tasks)}건 → tasks.db')

print('\n① 지역별 일정 수')
for region, n in con.execute('SELECT region, COUNT(*) FROM tasks GROUP BY region ORDER BY COUNT(*) DESC, region'):
    print(f'  {region}: {n}건')

print('\n② 고소 일정만')
for title, region, owner in con.execute("SELECT title, region, owner FROM tasks WHERE kind = '고소' ORDER BY id"):
    print(f'  {title} · {region} · {owner}')

print('\nCHECK 시험 : kind 에 \'지하\' 넣어 보기')
try:
    con.execute("INSERT INTO tasks (title, region, kind, owner) VALUES ('시험', '세종', '지하', '시험')")
    print('  ※ 막히지 않음 (규칙 오류)')
except sqlite3.IntegrityError as e:
    print('  막힘 →', e)
con.rollback()

print('\n남은 행 수 (시험 데이터 없어야 함):', con.execute('SELECT COUNT(*) FROM tasks').fetchone()[0])
con.close()
