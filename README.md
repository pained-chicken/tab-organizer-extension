# Tab Organizer (AI WebGPU 기반)

이 확장 프로그램은 **브라우저 안에서 직접 동작(Local)**하는 소형 웹 AI 모델을 활용하여, 어지럽게 열려있는 크롬 탭들을 주제에 맞게 **자동으로 카테고리별 탭 그룹으로 묶어주는** Chrome 확장 프로그램 (Manifest V3 기반)입니다.

## ✨ 주요 특징
* **완전한 로컬 동작**: 외부 서버 통신이나 유료 API 키(OpenAI 등)가 전혀 필요하지 않은 브라우저 내장 완전 로컬 실행 방식입니다. 사용자의 방문 기록이 외부로 유출되지 않으며 프라이버시가 완벽히 보장됩니다.
* **WebGPU 가속**: WebGPU를 활용하여 브라우저에서 모델을 빠르고 부드럽게 추론합니다.
* **유연한 AI 분류**: 정해진 고정 카테고리가 아니라, 현재 열려있는 탭들의 실제 내용을 바탕으로 AI가 스스로 적절한 그룹 이름, 색상 및 갯수를 판단합니다.

## 🛠 기술 스택
* **Transformers.js**: 로컬 번들 적용 (`./transformers.min.js`, 548KB)
* **Gemma 4 E2B ONNX**: WebGPU 추론 (HuggingFace에서 다운로드)
  * 모델 ID: `onnx-community/Gemma-4-E2B-IT-ONNX`
  * Dtype: `q4f16`
* **Chrome Extension Manifest V3**

## 📂 파일 구조
```text
tab-organizer-extension/
├── manifest.json        # MV3, permissions: tabs/tabGroups/windows/storage
├── popup.html           # UI (progress bar, 버튼 3개)
├── popup.js             # ES module, 버튼 핸들러
├── ai_classifier.js     # Transformers.js 모델 로드 + 추론
├── organizer.js         # chrome.tabs/tabGroups API로 그룹 생성
└── transformers.min.js  # Transformers.js 로컬 번들 (548KB)
```

## 🔘 팝업 버튼 구성
1. 🤖 **AI로 모든 창 정리**: Gemma 4 E2B로 동적 분류 후 그룹 생성
2. 🪟 **현재 창만 정리**: 하드코딩 패턴 기반 폴백
3. 🌐 **모든 창 정리**: 하드코딩 패턴 기반 폴백
4. ✂️ **모든 탭 그룹 풀기**: 모든 창의 탭 그룹 해제

## 🧠 AI 분류 흐름
1. `classifyTabsWithAI(tabs)` 호출
2. Gemma 4 모델에 탭 목록(제목 + 도메인) 전달
3. AI가 그룹 수, 그룹 이름, 색상, 인덱스를 JSON 형태로 자유롭게 결정
4. `organizeWindowWithAI()`가 반환된 JSON을 바탕으로 Chrome API를 사용하여 그룹 생성

## 📌 알려진 제약 사항
* **CSP 제한 해결**: CSP(Content Security Policy) 문제로 CDN import가 불가하여, `transformers.min.js`를 로컬에 직접 포함시켰습니다.
* **ES Module 환경**: `popup.js`, `ai_classifier.js`, `organizer.js` 등 모든 스크립트는 ES 모듈(`type="module"`)로 구성되어 있습니다.
* **AI 분류 제외 대상**: `chrome://` 등 http/https가 아닌 탭은 AI 분류 대상에서 자동으로 제외됩니다.

## 🔜 현재 미확인 사항 (다음 작업)
* [ ] AI 버튼 클릭 시 콘솔에 `[TabOrganizer AI] 원본 응답:` 로그가 찍히는지 확인 필요 (AI 실제 실행 여부 검증)
* [ ] 모델 ID(`onnx-community/Gemma-4-E2B-IT-ONNX`)가 정확한지 확인 필요 (다를 경우 모델 로드 에러 발생)
* [ ] 모델 다운로드 Progress Bar 동작 확인 필요

---

## 🚀 수동 설치 가이드 (개발자 모드)
1. 우측 상단의 `Code` 버튼을 눌러 프로젝트를 다운로드(ZIP) 하거나 원격 저장소에서 Clone 합니다.
2. 다운로드 된 압축 파일을 풉니다.
3. 크롬 브라우저를 열고 주소창에 `chrome://extensions/` 를 복사하여 이동합니다.
4. 화면 우측 상단의 **'개발자 모드 (Developer mode)'** 스위치를 켭니다.
5. 죄측 최상단에 나타난 **'압축해제된 확장 프로그램을 로드합니다 (Load unpacked)'** 버튼을 클릭합니다.
6. 다운로드 받은 폴더를 통째로 선택합니다.
7. 브라우저 주소창 옆의 '퍼즐 모양' 아이콘을 클릭하여 표시된 `Tab Organizer`를 툴바에 고정하여 사용합니다.
