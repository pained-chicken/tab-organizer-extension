# Tab Organizer — Agent Context

> 이 파일은 이 프로젝트를 작업하는 모든 AI 에이전트가 반드시 먼저 읽어야 합니다.
> 작업 시작 전 현재 상태를 파악하고, 작업 완료 후 이 파일을 업데이트해주세요.

---

## 프로젝트 한 줄 요약
Chrome 확장 프로그램 (MV3). Gemma 4 E2B ONNX + Transformers.js + WebGPU로 탭을 AI가 자동 그룹화. 외부 API/서버 없음.

## 현재 브랜치 상태

```
main
 ├── fix/ai-model-integration  ✅ main에 머지 완료
 ├── feat/error-handling-ux    🔵 커밋 완료, 미머지 (사용자 검증 후 머지 예정)
 └── feat/popup-redesign       🔵 커밋 완료, 미머지 (사용자 검증 후 머지 예정)
```

## 파일 구조 및 역할

| 파일 | 역할 |
|------|------|
| `manifest.json` | MV3 선언. permissions: tabs/tabGroups/windows/storage. CSP 설정. |
| `popup.html` | 확장 팝업 UI. 다크/라이트 테마, 탭 요약 카드, 버튼, 결과 칩 |
| `popup.js` | ES module. 버튼 핸들러, 테마 토글, 탭 요약, 결과 시각화 |
| `ai_classifier.js` | Transformers.js pipeline 로드, 추론, JSON 파싱 |
| `organizer.js` | chrome.tabs / tabGroups API로 그룹 생성/해제 |
| `transformers.min.js` | Transformers.js 로컬 번들 (557KB). CDN import 불가로 로컬 포함 |
| `icons/` | 아이콘 16/48/128px |

## 핵심 기술 결정사항 (변경 금지)

- **모델 ID**: `onnx-community/gemma-4-E2B-it-ONNX` (대소문자 중요 — `IT` ❌ `it` ✅)
- **dtype**: `q4f16`
- **device**: `webgpu` (WebGPU 필수. 미지원 시 에러 안내 후 폴백 버튼 안내)
- **import 방식**: `import { pipeline } from './transformers.min.js'` (CDN 사용 불가 — CSP 이슈)
- **모든 JS 파일**: `type="module"` ES module
- **http 아닌 탭** (chrome://, file:// 등): AI 분류에서 자동 제외

## 완료된 작업 목록

### Branch 1: `fix/ai-model-integration` (✅ main 반영)
- 모델 ID 대소문자 수정 (`IT` → `it`)
- 프롬프트를 `messages[]` 배열 형식으로 전환 (chat template 자동 적용)
- Gemma 4 thinking 토큰 (`<|channel>thought...`) 자동 제거
- JSON 파싱 4단계 폴백 + 누락 탭 자동 ungrouped 처리
- 디버그 로깅: `[TabOrganizer AI] 원본 응답:`, 추론 시간 등

### Branch 2: `feat/error-handling-ux` (🔵 미머지)
- http 탭 0개 상황 방어 처리
- AI 작업 120초 타임아웃 자동 취소
- 패턴 기반 폴백 카테고리 2개 → 8개
  (💻 개발 / 📚 학습 / 🤖 AI / 🔵 구글 / 🎬 미디어 / 🛒 쇼핑 / 📰 뉴스·SNS / 🔧 Chrome도구)
- 모든 결과에 소요 시간 표시

### Branch 3: `feat/popup-redesign` (🔵 미머지)
- 팝업 전면 리디자인 (340px, 다크/라이트 토글, `localStorage` 유지)
- 탭/창/그룹/도메인 수 실시간 요약 카드 + 도메인 색상 바
- AI 그룹 결과를 색상 칩으로 시각화
- 아이콘 3종 추가 (icons/icon16/48/128.png)
- manifest.json 버전 4.1 → 4.2

## 미완료 / 다음 할 일

- [ ] **사용자가 Chrome에서 직접 검증** 필요
  - `chrome://extensions` → 압축 해제 로드
  - AI 버튼 클릭 → DevTools 콘솔에서 `[TabOrganizer AI] 원본 응답:` 로그 확인
  - 모델 다운로드 progress bar 정상 동작 확인
- [ ] 검증 통과 시 `feat/error-handling-ux` → `feat/popup-redesign` 순으로 main 머지
- [ ] README.md 최신 상태 반영 (Branch 1~3 내용 반영 필요)
- [ ] (선택) `parseAIResponse` 유닛 테스트 추가
- [ ] (선택) WebGPU 미지원 환경에서 WASM 폴백 자동 전환 검토

## 알려진 제약 및 주의사항

- **CSP**: `script-src 'self' 'wasm-unsafe-eval'` — CDN import, eval 모두 불가
- **popup.html 팝업 크기**: Chrome이 width 제한. 현재 340px 고정
- **Gemma 4 응답**: thinking 모드 활성화 시 JSON 앞에 `<|channel>thought...` 토큰 포함될 수 있음
  → `ai_classifier.js`의 `stripThinkingTokens()`가 처리
- **모델 로드 시간**: 첫 실행 시 ~500MB 다운로드. 이후엔 브라우저 캐시 사용
- **`_generator` 싱글턴**: `ai_classifier.js`에서 모듈 레벨로 캐싱. 팝업 닫으면 초기화됨

## 작업 컨벤션

- 브랜치당 하나의 기능/버그픽스
- 커밋 메시지: `feat:` / `fix:` / `docs:` / `refactor:` + 한글 설명 가능
- 브랜치 → main 머지는 사용자 검증 후 진행 (즉시 머지 금지)
- 이 파일(AGENTS.md) 작업 후 반드시 업데이트
