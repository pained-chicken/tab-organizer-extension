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
const FALLBACK_GROUPS = [
  {
    name: '📚 코딩 공부', color: 'yellow',
    pattern: /카카오테크|카카오|엘리스|elice|알고리즘|algorithm|프로그래머스|programmers|코딩테스트|파이썬|python|PCCP|백엔드|greedy|leetcode|백준/i
  },
  {
    name: '🔵 Chrome & 도구', color: 'blue',
    pattern: /chrome|크롬|claude|gemini|experiments|웹 스토어|web store|탭 관리|웹 앱 사용/i
  }
];

export async function organizeWindow(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
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
