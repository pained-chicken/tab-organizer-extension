// ─── Transformers.js + WebGPU 기반 AI 탭 분류 ──────────────────────
import { pipeline } from './transformers.min.js';

const MODEL_ID     = 'onnx-community/Gemma-4-E2B-IT-ONNX';
const DTYPE        = 'q4f16';
const VALID_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

let _generator = null;

// ─── 모델 로드 ────────────────────────────────────────────────────
export async function loadModel(onProgress) {
  if (_generator) return _generator;

  onProgress(0, '모델 초기화 중...', '', '');

  const fileProgress = {};

  function calcOverall() {
    const entries = Object.values(fileProgress);
    if (!entries.length) return 0;
    const totalLoaded = entries.reduce((s, e) => s + e.loaded, 0);
    const totalSize   = entries.reduce((s, e) => s + e.total,  0);
    return totalSize > 0 ? (totalLoaded / totalSize) * 100 : 0;
  }

  _generator = await pipeline('text-generation', MODEL_ID, {
    device: 'webgpu',
    dtype: DTYPE,
    progress_callback: (info) => {
      if (info.status === 'initiate') {
        if (info.file && info.total) fileProgress[info.file] = { loaded: 0, total: info.total };
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
      } else if (info.status === 'loading' || info.status === 'ready') {
        onProgress(98, 'GPU에 모델 올리는 중...', '거의 다 됐어요!', '');
      }
    }
  });

  onProgress(100, '준비 완료! 🎉', 'AI 분석을 시작합니다...', '');
  return _generator;
}

// ─── AI 탭 분류 ───────────────────────────────────────────────────
export async function classifyTabsWithAI(tabs, onProgress) {
  const generator = await loadModel(onProgress);
  onProgress(100, 'AI가 탭을 분석하는 중...', '', '');

  const tabList = tabs
    .map((t, i) => `${i}: "${t.title}" | ${safeHostname(t.url)}`)
    .join('\n');

  // ── 핵심: 그룹 수/이름을 AI가 자유롭게 결정하도록 유도 ──
  const prompt =
`<start_of_turn>user
You are a browser tab organizer. Look at the tabs below and group them by topic or purpose.

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
- Return ONLY valid JSON. No explanation, no markdown.

JSON format:
{"groups":[{"name":"그룹명","color":"색상","indices":[0,2,5]},...],"ungrouped":[1,3]}
<end_of_turn>
<start_of_turn>model
`;

  const output = await generator(prompt, {
    max_new_tokens: 512,
    do_sample: false,
    return_full_text: false,
  });

  const raw = output[0]?.generated_text ?? '';

  // 디버그: 콘솔에서 AI 실제 응답 확인 가능
  console.log('[TabOrganizer AI] 원본 응답:', raw);

  return parseAIResponse(raw, tabs.length);
}

// ─── 내부 유틸 ────────────────────────────────────────────────────
function parseAIResponse(raw, tabCount) {
  let parsed;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 응답을 JSON으로 파싱할 수 없습니다.\n원본: ' + raw.slice(0, 300));
    parsed = JSON.parse(match[0]);
  }

  parsed.groups = (parsed.groups ?? []).map(g => ({
    name:    g.name   ?? '기타',
    color:   VALID_COLORS.includes(g.color) ? g.color : 'grey',
    indices: (g.indices ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < tabCount),
  })).filter(g => g.indices.length > 0);  // 빈 그룹 제거

  parsed.ungrouped = (parsed.ungrouped ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < tabCount);

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
