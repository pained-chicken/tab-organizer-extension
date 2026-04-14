// ─── Transformers.js + WebGPU 기반 AI 탭 분류 ──────────────────────
import { pipeline } from './transformers.min.js';

// ⚠️ 모델 ID 대소문자 주의: HuggingFace 실제 ID와 정확히 일치
const MODEL_ID     = 'onnx-community/gemma-4-E2B-it-ONNX';
const DTYPE        = 'q4f16';
const VALID_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

let _generator = null;

// ─── 모델 로드 ────────────────────────────────────────────────────
export async function loadModel(onProgress) {
  if (_generator) {
    console.log('[TabOrganizer AI] 캐시된 모델 재사용');
    return _generator;
  }

  console.log(`[TabOrganizer AI] 모델 로드 시작: ${MODEL_ID} (dtype: ${DTYPE})`);
  const loadStart = performance.now();
  onProgress(0, '모델 초기화 중...', '', '');

  const fileProgress = {};

  function calcOverall() {
    const entries = Object.values(fileProgress);
    if (!entries.length) return 0;
    const totalLoaded = entries.reduce((s, e) => s + e.loaded, 0);
    const totalSize   = entries.reduce((s, e) => s + e.total,  0);
    return totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;
  }

  try {
    _generator = await pipeline('text-generation', MODEL_ID, {
      device: 'webgpu',
      dtype: DTYPE,
      progress_callback: (info) => {
        if (info.status === 'initiate') {
          if (info.file && info.total) fileProgress[info.file] = { loaded: 0, total: info.total };
          console.log(`[TabOrganizer AI] 파일 다운로드 시작: ${info.file ?? '?'}`);
        } else if (info.status === 'progress' || info.status === 'downloading') {
          const file = info.file ?? '';
          if (file) fileProgress[file] = { loaded: info.loaded ?? 0, total: info.total ?? fileProgress[file]?.total ?? 0 };
          const overall     = calcOverall();
          const totalLoaded = Object.values(fileProgress).reduce((s, e) => s + e.loaded, 0);
          const totalSize   = Object.values(fileProgress).reduce((s, e) => s + e.total,  0);
          onProgress(overall, '모델 다운로드 중...', `${formatBytes(totalLoaded)} / ${formatBytes(totalSize)}`, file);
        } else if (info.status === 'done') {
          if (info.file && fileProgress[info.file]) fileProgress[info.file].loaded = fileProgress[info.file].total;
          onProgress(calcOverall(), '모델 다운로드 중...', `파일 완료: ${info.file ?? ''}`, '');
          console.log(`[TabOrganizer AI] 파일 다운로드 완료: ${info.file ?? '?'}`);
        } else if (info.status === 'loading' || info.status === 'ready') {
          onProgress(98, 'GPU에 모델 올리는 중...', '거의 다 됐어요!', '');
        }
      }
    });
  } catch (err) {
    _generator = null;
    console.error('[TabOrganizer AI] 모델 로드 실패:', err);
    throw new Error(`모델 로드 실패: ${err.message}`);
  }

  const loadTime = ((performance.now() - loadStart) / 1000).toFixed(1);
  console.log(`[TabOrganizer AI] 모델 로드 완료 (${loadTime}초)`);
  onProgress(100, '준비 완료! 🎉', 'AI 분석을 시작합니다...', '');
  return _generator;
}

// ─── AI 탭 분류 ───────────────────────────────────────────────────
export async function classifyTabsWithAI(tabs, onProgress) {
  const generator = await loadModel(onProgress);
  onProgress(100, 'AI가 탭을 분석하는 중...', `${tabs.length}개 탭 분석 중`, '');

  const tabList = tabs
    .map((t, i) => `${i}: "${t.title}" | ${safeHostname(t.url)}`)
    .join('\n');

  console.log(`[TabOrganizer AI] 분류 대상 탭 ${tabs.length}개:`);
  console.log(tabList);

  // ── pipeline의 chat template을 활용한 messages 형식 ──
  const messages = [
    {
      role: 'user',
      content: `You are a browser tab organizer. Look at the tabs below and group them by topic or purpose.

Tabs:
${tabList}

Instructions:
- Decide the number of groups yourself based on the actual content. Do NOT force a fixed number.
- If tabs cover 5 different topics, make 5 groups. If they share 2 themes, make 2 groups.
- Give each group a short, specific Korean name (2–6 chars) that describes its actual content.
  Example good names: 알고리즘, 뉴스, 쇼핑, 유튜브, 코테준비, 크롬설정
  Example bad names: 그룹1, 기타, 미분류 (too vague)
- Choose a color for each group: grey, blue, red, yellow, green, pink, purple, cyan, orange
- Every tab index must appear exactly once — either in a group or in "ungrouped"
- "ungrouped" is for tabs that truly don't fit any theme (e.g. blank tabs, one-off pages)
- Return ONLY valid JSON. No explanation, no markdown, no code fences.

JSON format:
{"groups":[{"name":"그룹명","color":"색상","indices":[0,2,5]},...],\"ungrouped\":[1,3]}`
    }
  ];

  const inferStart = performance.now();

  const output = await generator(messages, {
    max_new_tokens: 512,
    do_sample: false,
    return_full_text: false,
  });

  const inferTime = ((performance.now() - inferStart) / 1000).toFixed(1);

  // pipeline은 messages 형식 결과를 반환 → generated_text 추출
  let raw = '';
  if (output?.[0]?.generated_text) {
    const genText = output[0].generated_text;
    // messages 형식일 경우 마지막 assistant 메시지에서 텍스트 추출
    if (Array.isArray(genText)) {
      const lastMsg = genText[genText.length - 1];
      raw = lastMsg?.content ?? '';
    } else {
      raw = genText;
    }
  }

  // 디버그: 콘솔에서 AI 실제 응답 확인 가능
  console.log(`[TabOrganizer AI] 추론 시간: ${inferTime}초`);
  console.log('[TabOrganizer AI] 원본 응답:', raw);

  return parseAIResponse(raw, tabs.length);
}

// ─── thinking 토큰 제거 ───────────────────────────────────────────
function stripThinkingTokens(text) {
  // Gemma 4의 thinking 토큰 패턴 제거
  // <|channel>thought\n...<channel|> 형식
  let cleaned = text.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, '');

  // <think>...</think> 형식 (일부 버전)
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');

  return cleaned.trim();
}

// ─── 내부 유틸 ────────────────────────────────────────────────────
function parseAIResponse(raw, tabCount) {
  // 1) thinking 토큰 제거
  const cleaned = stripThinkingTokens(raw);
  console.log('[TabOrganizer AI] 클린 응답:', cleaned);

  // 2) JSON 파싱 시도 (여러 전략)
  let parsed = null;

  // 전략 1: 직접 파싱
  try {
    parsed = JSON.parse(cleaned.trim());
  } catch {
    // 전략 2: 코드 펜스 제거 후 파싱
    const fenceRemoved = cleaned.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
    try {
      parsed = JSON.parse(fenceRemoved.trim());
    } catch {
      // 전략 3: JSON 객체 패턴 매칭
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          // 전략 4: 줄바꿈/제어문자 제거 후 재시도
          try {
            const sanitized = match[0].replace(/[\x00-\x1f\x7f]/g, ' ');
            parsed = JSON.parse(sanitized);
          } catch (finalErr) {
            console.error('[TabOrganizer AI] JSON 파싱 최종 실패:', finalErr);
            throw new Error('AI 응답을 JSON으로 파싱할 수 없습니다.\n원본: ' + cleaned.slice(0, 500));
          }
        }
      } else {
        throw new Error('AI 응답에서 JSON 객체를 찾을 수 없습니다.\n원본: ' + cleaned.slice(0, 500));
      }
    }
  }

  // 3) 결과 검증 및 정규화
  parsed.groups = (parsed.groups ?? []).map(g => ({
    name:    g.name   ?? '기타',
    color:   VALID_COLORS.includes(g.color) ? g.color : 'grey',
    indices: (g.indices ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < tabCount),
  })).filter(g => g.indices.length > 0);  // 빈 그룹 제거

  parsed.ungrouped = (parsed.ungrouped ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < tabCount);

  // 4) 누락된 탭 인덱스 감지 → ungrouped에 추가
  const assignedIndices = new Set([
    ...parsed.groups.flatMap(g => g.indices),
    ...parsed.ungrouped
  ]);
  const missing = [];
  for (let i = 0; i < tabCount; i++) {
    if (!assignedIndices.has(i)) missing.push(i);
  }
  if (missing.length > 0) {
    console.warn(`[TabOrganizer AI] 누락된 탭 ${missing.length}개를 ungrouped에 추가:`, missing);
    parsed.ungrouped.push(...missing);
  }

  console.log('[TabOrganizer AI] 파싱 결과:', JSON.stringify(parsed, null, 2));
  return parsed;
}

function safeHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function formatBytes(bytes) {
  if (!bytes) return '?';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
