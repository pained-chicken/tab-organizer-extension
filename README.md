# Tab Organizer (AI WebGPU 기반)

브라우저에 열린 탭을 AI가 자동으로 카테고리별 탭 그룹으로 묶어주는 Chrome 확장 프로그램입니다. Manifest V3 기반으로 동작합니다.

## ✨ 프로젝트 개요
브라우저에 열린 탭들을 한눈에 보기 쉽게 관리하기 위해 기획되었습니다. 로컬에서 실행되는 소형 AI 모델을 사용해 현재 열려있는 탭들의 내용을 바탕으로 AI가 스스로 적절한 탭 그룹을 생성하여 정리합니다.

## 🛠 기술 스택
- Vanilla JavaScript (HTML, CSS)
- **Transformers.js**: 로컬 환경에서 실행하기 위해 557KB 크기로 최소화된 로컬 번들 파일(`./transformers.min.js`) 포함
- **Gemma 4 E2B ONNX**: WebGPU를 통해 실행되며 HuggingFace에서 다운로드하여 사용
  - 모델 ID: `onnx-community/gemma-4-E2B-it-ONNX`
  - dtype: `q4f16`
- **완전 로컬 실행**: 외부 서버 통신이나 API 키(OpenAI 등) 없음. 브라우저 내에서 완전 로컬로 실행

## 📂 파일 구조
```
tab-organizer-extension/
├── manifest.json        # MV3, permissions: tabs/tabGroups/windows/storage
├── popup.html           # UI (다크 모드, 요약 카드, 커스텀 카테고리, 윈도우 옵션)
├── popup.js             # ES module, UI 로직 및 상태(localStorage) 저장
├── ai_classifier.js     # Transformers.js 모델 로드 + 추론
├── organizer.js         # chrome.tabs/tabGroups API로 그룹 생성 및 후처리
├── transformers.min.js  # Transformers.js 로컬 번들
└── icons/               # 확장 프로그램 아이콘 리소스
```

## 🔘 주요 기능 및 UI
1. **🤖 AI 탭 분류 (모든 창 정리)**
   - Gemma 4 E2B 모델로 탭들을 동적으로 분류합니다.
   - **커스텀 카테고리 (옵션)**: 사용자가 원하는 카테고리를 직접 입력하면, AI가 해당 항목 내에서만 분류하게끔 유도합니다.
2. **숫자 번호 매기기 (옵션)**
   - "창별 번호 붙이기" 옵션을 켜면, 서로 다른 곳에 동일한 이름의 탭 그룹(예: `AI`)이 발생할 시 자동으로 `AI - 1`, `AI - 2` 와 같이 번호를 부여하여 구분을 명확히 합니다.
3. **패턴 기반 탭 정리 (Fallback 패턴)**
   - WebGPU 로드에 실패하거나 빠른 정리가 필요할 때 사용하는 기능으로 8가지 범주(💻 개발, 📚 학습, 🤖 AI, 🔵 구글, 🎬 미디어, 🛒 쇼핑, 📰 뉴스·SNS, 🔧 Chrome·도구)에 맞춰 정리합니다.
   - **🪟 현재 창**만 정리하거나, **🌐 전체 창**을 정리할 수 있습니다.
4. **리디자인된 요약 팝업 UI**
   - 다크/라이트 테마 지원 (설정 저장 됨)
   - 색상별 탭 그룹 칩 결과 시각화
   - 탭, 창, 그룹, 도메인 수를 실시간으로 계산해 주는 요약 보드

## 🧠 AI 분류 흐름
1. `classifyTabsWithAI(tabs, progressCallback, customCategories)` 호출
2. Gemma 4 모델 프롬프트를 구성해 탭 목록(제목 + 도메인) 전달 (Thinking 토큰이 있을 경우 자동 제거)
3. 4단계에 걸쳐 JSON 폴백 파싱을 거친 후, 그룹 이름, 색상, 탭 인덱스를 반환
4. `organizeWindowWithAI()` 함수가 Chrome API를 사용해 그룹 생성 후 시각화
5. 옵션에 따라 후처리 로직(`applyWindowNumbering`)을 실행하여 겹치는 그룹 이름에 중복 번호 방지 처리

## 🚧 TODO (테스트 및 개발 예정 사항)
- AI 버튼 클릭 시 콘솔에 `"[TabOrganizer AI] 원본 응답:"` 로그가 찍히는지 사용자 환경 로컬 테스트 확인
- 초기 로드 시 500MB 모델 다운로드가 Progress Bar로 잘 연동되는지 동작 검증 통과 필요

## 📌 알려진 문제 및 제약사항 (Known Issues)
- **CSP 문제**: 확장 프로그램의 특성상 CSP 이슈로 인해 CDN `import`나 `eval()`이 불가능하여 `transformers.min.js`를 로컬에 직접 포함시켰습니다.
- **팝업 크기 제한**: Chrome 확장 팝업은 너비와 높이가 제한되어 있으므로 현재 UI는 340px 너비로 최적화되었습니다.
- **HTTP 외 탭 제외**: `chrome://`, `file://` 등 `http`/`https` 기반이 아닌 탭은 탭 그룹으로 정리가 불가능하며 AI 분류 대상에서 제외됩니다.
