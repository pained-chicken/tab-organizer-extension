# Tab Organizer (AI WebGPU 기반)

브라우저에 열린 탭을 AI가 자동으로 카테고리별 탭 그룹으로 묶어주는 Chrome 확장 프로그램입니다. Manifest V3 기반으로 동작합니다.

## ✨ 프로젝트 개요
브라우저에 열린 탭들을 한눈에 보기 쉽게 관리하기 위해 기획되었습니다. 로컬에서 실행되는 소형 AI 모델을 사용해 현재 열려있는 탭들의 내용을 바탕으로 AI가 스스로 적절한 탭 그룹을 생성하여 정리합니다.

## 🛠 기술 스택
- Vanilla JavaScript (HTML, CSS)
- **Transformers.js**: 로컬 환경에서 실행하기 위해 548KB 크기로 최소화된 로컬 번들 파일(`./transformers.min.js`) 포함
- **Gemma 4 E2B ONNX**: WebGPU를 통해 실행되며 HuggingFace에서 다운로드하여 사용
  - 모델 ID: `onnx-community/Gemma-4-E2B-IT-ONNX`
  - dtype: `q4f16`
- **완전 로컬 실행**: 외부 서버 통신이나 API 키(OpenAI 등) 없음. 브라우저 내에서 완전 로컬로 실행

## 📂 파일 구조
```
tab-organizer-extension/
├── manifest.json        # MV3, permissions: tabs/tabGroups/windows/storage
├── popup.html           # UI (progress bar, 버튼 3개)
├── popup.js             # ES module, 버튼 핸들러
├── ai_classifier.js     # Transformers.js 모델 로드 + 추론
├── organizer.js         # chrome.tabs/tabGroups API로 그룹 생성
└── transformers.min.js  # Transformers.js 로컬 번들 (548KB)
```

## 🔘 팝업 버튼 구성
1. **🤖 AI로 모든 창 정리** → Gemma 4 E2B 모델로 동적 분류 후 그룹 생성
2. **🪟 현재 창만 정리**    → 하드코딩 패턴 기반 폴백
3. **🌐 모든 창 정리**      → 하드코딩 패턴 기반 폴백
4. **✂️ 모든 탭 그룹 풀기** → 모든 창의 그룹 해제

## 🧠 AI 분류 흐름
1. `classifyTabsWithAI(tabs)` 호출
2. Gemma 4 모델에 탭 목록(제목 + 도메인) 전달
3. AI가 적절한 분석을 통해 그룹 수, 이름, 색상, 포함될 탭 인덱스를 JSON 형태로 자유롭게 결정
4. `organizeWindowWithAI()` 함수가 Chrome API(`chrome.tabs`, `chrome.tabGroups`)를 사용하여 탭 그룹 생성

## 🚧 TODO (테스트 및 개발 예정 사항)
- AI 버튼 클릭 시 콘솔에 `"[TabOrganizer AI] 원본 응답:"` 로그가 찍히는지 확인 필요 (AI의 실제 실행 여부 검증)
- 모델 ID(`onnx-community/Gemma-4-E2B-IT-ONNX`)가 정확한지 확인 필요 (이름이 틀릴 경우 모델 로드 에러 발생)
- 초기 모델 파일 다운로드 시 나오는 progress bar 동작 확인 필요

## 📌 알려진 문제 및 제약사항 (Known Issues)
- **CSP 문제**: 확장 프로그램의 특성상 CSP 이슈로 인해 CDN `import`가 불가능하여 `transformers.min.js`를 로컬에 직접 포함하는 방식으로 전환하여 해결
- **ES Module**: `popup.js`, `ai_classifier.js`, `organizer.js` 스크립트 모두 ES module (`type="module"`) 형태로 사용
- **HTTP 외 탭 제외**: `chrome://`, `file://` 등 `http`/`https` 기반이 아닌 탭은 AI 분류 대상에서 자동으로 제외됨
