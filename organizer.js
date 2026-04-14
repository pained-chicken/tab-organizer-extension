// ─── 공통 그룹 해제 ───────────────────────────────────────────────
async function clearGroups(tabs) {
  const grouped = tabs.filter(t => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);
  if (grouped.length > 0) {
    await chrome.tabs.ungroup(grouped.map(t => t.id)).catch(() => {});
  }
}

// ─── AI 기반 정리 (단일 창) ────────────────────────────────────────
export async function organizeWindowWithAI(windowId, classifyFn) {
  const tabs      = await chrome.tabs.query({ windowId });
  const validTabs = tabs.filter(t => t.url?.startsWith('http'));
  const skipped   = tabs.filter(t => !t.url?.startsWith('http'));

  // 2-1: http 탭이 0개일 때 빈 결과 에러 방지
  if (validTabs.length === 0) {
    const results = ['ℹ️ 분류 가능한 탭이 없습니다 (http/https 탭 0개)'];
    if (skipped.length > 0)
      results.push(`⚠️ 스킵(chrome:// 등): ${skipped.length}개`);
    return results;
  }

  const classified = await classifyFn(validTabs);

  await clearGroups(tabs);

  const results = [];
  for (const group of classified.groups) {
    const tabIds = group.indices.map(i => validTabs[i]?.id).filter(Boolean);
    if (!tabIds.length) continue;
    const groupId = await chrome.tabs.group({ tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { title: group.name, color: group.color, collapsed: false });
    results.push(`🤖 "${group.name}" (${group.color}): ${tabIds.length}개 탭`);
  }
  if ((classified.ungrouped ?? []).length > 0)
    results.push(`📋 미분류: ${classified.ungrouped.length}개`);
  if (skipped.length > 0)
    results.push(`⚠️ 스킵(chrome:// 등): ${skipped.length}개`);
  return results;
}

// ─── AI 기반 정리 (모든 창) ───────────────────────────────────────
export async function organizeAllWindowsWithAI(classifyFn) {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const all = [];
  for (const win of windows) {
    all.push(`── 창 #${win.id} ──`);
    all.push(...await organizeWindowWithAI(win.id, classifyFn));
  }
  return all;
}

// ─── 패턴 기반 정리 (폴백) ────────────────────────────────────────
// 2-3: 패턴 기반 카테고리 확장 (2개 → 8개)
const FALLBACK_GROUPS = [
  {
    name: '💻 개발', color: 'yellow',
    pattern: /github|gitlab|bitbucket|stackoverflow|stack overflow|vscode|developer|개발|코딩|coding|api|documentation|docs|npm|pypi|docker|terraform/i
  },
  {
    name: '📚 학습', color: 'cyan',
    pattern: /카카오테크|카카오|엘리스|elice|알고리즘|algorithm|프로그래머스|programmers|코딩테스트|파이썬|python|PCCP|백엔드|greedy|leetcode|백준|udemy|coursera|inflearn|인프런|강의|lecture|tutorial|학습/i
  },
  {
    name: '🤖 AI', color: 'purple',
    pattern: /claude|chatgpt|openai|gemini|bard|huggingface|hugging face|copilot|ai|artificial|machine learning|deep learning|llm|gpt/i
  },
  {
    name: '🔵 구글', color: 'blue',
    pattern: /google\.com|gmail|drive\.google|docs\.google|sheets\.google|calendar\.google|maps\.google|구글|google cloud|firebase/i
  },
  {
    name: '🎬 미디어', color: 'red',
    pattern: /youtube|youtu\.be|netflix|twitch|spotify|music|video|vimeo|유튜브|넷플릭스|트위치|음악/i
  },
  {
    name: '🛒 쇼핑', color: 'green',
    pattern: /amazon|coupang|쿠팡|gmarket|11번가|naver\.shopping|shopping|shop|store|쇼핑|mall|배달|baemin|yogiyo/i
  },
  {
    name: '📰 뉴스·SNS', color: 'orange',
    pattern: /news|뉴스|reddit|twitter|x\.com|instagram|facebook|linkedin|naver\.com\/news|tistory|velog|medium|blog|블로그/i
  },
  {
    name: '🔧 Chrome·도구', color: 'grey',
    pattern: /chrome|크롬|extensions|experiments|웹 스토어|web store|탭 관리|웹 앱 사용|설정|settings/i
  }
];

export async function organizeWindow(windowId) {
  const tabs = await chrome.tabs.query({ windowId });

  // 2-1: 탭이 없는 경우 방어
  if (tabs.length === 0) {
    return ['ℹ️ 이 창에 탭이 없습니다.'];
  }

  const buckets = Object.fromEntries(FALLBACK_GROUPS.map(g => [g.name, { ...g, tabIds: [] }]));
  const ungrouped = [];

  for (const tab of tabs) {
    const match = FALLBACK_GROUPS.find(g => g.pattern.test(tab.title) || g.pattern.test(tab.url ?? ''));
    if (match) buckets[match.name].tabIds.push(tab.id);
    else ungrouped.push(tab);
  }

  await clearGroups(tabs);
  const results = [];
  for (const def of Object.values(buckets)) {
    if (!def.tabIds.length) continue;
    const groupId = await chrome.tabs.group({ tabIds: def.tabIds, createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { title: def.name, color: def.color, collapsed: false });
    results.push(`✅ ${def.name}: ${def.tabIds.length}개 탭`);
  }
  if (ungrouped.length) results.push(`📋 미분류: ${ungrouped.length}개`);
  return results;
}

export async function organizeAllWindows() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const all = [];
  for (const win of windows) {
    all.push(`── 창 #${win.id} ──`);
    all.push(...await organizeWindow(win.id));
  }
  return all;
}

// ─── 그룹 해제 ────────────────────────────────────────────────────
export async function ungroupAllWindows() {
  const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  const all = [];
  for (const win of windows) {
    const tabs = await chrome.tabs.query({ windowId: win.id });
    const grouped = tabs.filter(t => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);
    if (!grouped.length) { all.push(`── 창 #${win.id} ── 그룹된 탭 없음`); continue; }
    await chrome.tabs.ungroup(grouped.map(t => t.id));
    all.push(`── 창 #${win.id} ── ✅ ${grouped.length}개 해제`);
  }
  return all;
}
