# CLAUDE.md – 현장 일정 날씨판 작업 규칙

## 프로젝트 개요
- 교육용 프로토타입이다. 무엇을 만들지는 PRD.md를 따른다.
- PRD.md에 없는 기능은 먼저 제안하고, 내가 승인한 뒤에만 구현한다.

## 기술 스택 (변경 금지)
- HTML + CSS + 순수 JavaScript만 사용한다. (React 등 프레임워크, 빌드 도구 사용 금지)
- 외부 스크립트는 supabase-js 하나만 허용한다. (버전을 고정해 <script> 로 불러온다. 그 밖의 라이브러리 금지)
- index.html 을 더블클릭해서 열 수 있어야 한다.

## 폴더 구조
- index.html : 화면 구조
- style.css  : 디자인
- logic.js   : 판단 규칙만 (화면을 다루는 코드 금지)
- app.js     : 화면 동작 (목록 그리기, 일정 추가)
- config.js  : 연결 정보 두 줄 (Supabase 주소 · 공개용 anon 키)
- setup.sql  : Supabase 표 wx_tasks 만들기 (사용자가 SQL Editor 에서 직접 실행)
- data/tasks.json : 예비 일정 목록 (가상 데이터, DB 연결 실패 시 목록만 표시)
- PRD.md · CLAUDE.md · README.md : 문서

## 작업 방식
1. 코드를 고치기 전에 계획(수정할 파일과 이유)을 먼저 보여 주고 승인을 받는다.
2. 한 번에 한 가지만 고친다.
3. 끝나면 바꾼 파일, 내가 확인할 방법(T-번호), 남은 문제를 보고한다.

## 데이터 규칙
- 일정 목록은 Supabase 표 wx_tasks 에서 읽고, 화면에서 추가한 일정도 같은 표에 저장한다. 코드 안에 일정을 직접 적지 않는다.
- 표 만들기와 규칙(구분 · 지역 CHECK, RLS)은 setup.sql 에만 둔다. 구분 · 지역 규칙은 화면과 DB 양쪽에서 막는다.
- 연결 정보는 config.js 의 두 줄(SUPABASE_URL, SUPABASE_ANON_KEY)만 쓴다. 공개용(anon) 키만 허용하고, service_role 등 비밀 키는 어디에도 넣지 않는다.
- DB 에 연결하지 못하면 data/tasks.json 으로 목록만 보여 주고, 화면에 연결 실패 안내를 띄운다. 이때 일정 추가는 막는다.
- 브라우저 저장소(wx_added)는 더 이상 쓰지 않는다.

## 보안 · 데이터 규칙
- 가상 데이터만 사용한다. 실제 이름 · 연락처 · 기관 내부 자료를 넣지 않는다.
- 사용자가 입력한 글자는 textContent 로 표시한다.
- 비밀 키는 코드 · 채팅 · GitHub 에 넣지 않는다.
