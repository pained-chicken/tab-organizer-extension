import { classifyTabsWithAI }                                  from './ai_classifier.js';
import { organizeWindow, organizeAllWindows,
         organizeAllWindowsWithAI, ungroupAllWindows }         from './organizer.js';

// ─── DOM 요소 ─────────────────────────────────────────────────────
const statusEl      = document.getElementById('status');
const resultWrap    = document.getElementById('resultWrap');
const groupChips    = document.getElementById('groupChips');
const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressPct   = document.getElementById('progressPct');
const progressLabel = document.getElementById('progressLabel');
const progressSub   = document.getElementById('progressSub');
const progressFile  = document.getElementById('progressFile');
const allBtns       = document.querySelectorAll('.btn');

// 탭 요약 DOM
const statTabs    = document.getElementById('statTabs');
const statWindows = document.getElementById('statWindows');
const statGroups  = document.getElementById('statGroups');
const statDomains = document.getElementById('statDomains');
const domainBar   = document.getElementById('domainBar');

// 테마 토글
const themeToggle = document.getElementById('themeToggle');

// 커스텀 카테고리
const customCatToggle = document.getElementById('customCatToggle');
const customCatPanel  = document.getElementById('customCatPanel');
const customCatInput  = document.getElementById('customCategories');

// ─── 테마 관리 (3-3) ────────────────────────────────────────────
const savedTheme = localStorage.getItem('tab-organizer-theme') ?? 'dark';
document.documentElement.dataset.theme = savedTheme;
themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  themeToggle.textContent = next === 'dark' ? '🌙' : '☀️';
  localStorage.setItem('tab-organizer-theme', next);
});

// ─── 커스텀 카테고리 토글 + 저장 ─────────────────────────────
const savedCategories = localStorage.getItem('tab-organizer-categories') ?? '';
customCatInput.value = savedCategories;

customCatToggle.addEventListener('click', () => {
  customCatToggle.classList.toggle('open');
  customCatPanel.classList.toggle('open');
  if (customCatPanel.classList.contains('open')) {
    customCatInput.focus();
  }
});

// 입력 변경 시 localStorage에 저장
customCatInput.addEventListener('input', () => {
  localStorage.setItem('tab-organizer-categories', customCatInput.value);
});

// 이전에 값이 있었으면 패널 열린 상태로 복원
if (savedCategories.trim()) {
  customCatToggle.classList.add('open');
  customCatPanel.classList.add('open');
}

// ─── 탭 요약 (3-1) ────────────────────────────────────────────────
// tabGroups chrome API의 색상명 → CSS 색상 매핑
const GROUP_COLOR_MAP = {
  grey:   '#9ca3af', blue:   '#3b82f6', red:    '#ef4444',
  yellow: '#f59e0b', green:  '#22c55e', pink:   '#ec4899',
  purple: '#a855f7', cyan:   '#06b6d4', orange: '#f97316',
};

// 도메인 바 색상 팔레트
const DOMAIN_COLORS = [
  '#cba6f7','#89b4fa','#a6e3a1','#f9e2af','#f38ba8',
  '#fab387','#94e2d5','#74c7ec','#b4befe','#cdd6f4',
];

async function updateSummary() {
  try {
    const [windows, allTabs] = await Promise.all([
      chrome.windows.getAll({ windowTypes: ['normal'] }),
      chrome.tabs.query({}),
    ]);

    const httpTabs = allTabs.filter(t => t.url?.startsWith('http'));
    const groupedTabs = allTabs.filter(t => t.groupId && t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);

    // 도메인 집계
    const domainCounts = {};
    for (const t of httpTabs) {
      try {
        const host = new URL(t.url).hostname.replace(/^www\./, '');
        domainCounts[host] = (domainCounts[host] ?? 0) + 1;
      } catch {}
    }
    const domainEntries = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]);

    statTabs.textContent    = httpTabs.length;
    statWindows.textContent = windows.length;
    statGroups.textContent  = groupedTabs.length;
    statDomains.textContent = domainEntries.length;

    // 도메인 색상 바 (최대 10개 도메인)
    domainBar.innerHTML = '';
    const topDomains = domainEntries.slice(0, 10);
    const totalVisible = topDomains.reduce((s, [, c]) => s + c, 0);
    topDomains.forEach(([, count], i) => {
      const seg = document.createElement('div');
      seg.className = 'domain-bar-seg';
      seg.style.flex = count / totalVisible;
      seg.style.background = DOMAIN_COLORS[i % DOMAIN_COLORS.length];
      seg.title = `${domainEntries[i][0]}: ${count}탭`;
      domainBar.appendChild(seg);
    });
  } catch (e) {
    console.warn('[TabOrganizer] 요약 로드 실패:', e);
  }
}

// 팝업 열릴 때 요약 로드
updateSummary();

// ─── UI 헬퍼 ──────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  // 결과 칩은 숨기고 텍스트 상태 표시
  resultWrap.style.display = 'none';
  statusEl.style.display = 'block';
  statusEl.className = isError ? 'error' : '';
  statusEl.textContent = msg;
}

// 3-4: 결과를 그룹 칩으로 시각화
function setResultChips(lines) {
  statusEl.style.display = 'none';
  groupChips.innerHTML = '';

  const colorNames = {
    grey:'#9ca3af', blue:'#3b82f6', red:'#ef4444', yellow:'#f59e0b',
    green:'#22c55e', pink:'#ec4899', purple:'#a855f7', cyan:'#06b6d4', orange:'#f97316',
  };

  // 라인에서 그룹 정보 파싱
  // 형식: 🤖 "이름" (색상): N개 탭  또는  ✅ 이름: N개 탭  또는 일반 텍스트
  for (const line of lines) {
    if (!line.trim()) continue;
    const chip = document.createElement('div');
    chip.className = 'group-chip';

    const aiMatch = line.match(/🤖\s+"([^"]+)"\s+\((\w+)\):\s+(\d+)/);
    const patMatch = line.match(/✅\s+(.+?):\s+(\d+)/);
    const windowMatch = line.match(/^──/);

    if (aiMatch) {
      const [, name, color, count] = aiMatch;
      const hex = colorNames[color] ?? '#9ca3af';
      chip.innerHTML = `
        <div class="color-dot" style="background:${hex};box-shadow:0 0 5px ${hex}88"></div>
        <span class="chip-name">${name}</span>
        <span class="chip-count">${count}개</span>`;
    } else if (patMatch) {
      const [, name, count] = patMatch;
      chip.innerHTML = `
        <div class="color-dot" style="background:var(--accent)"></div>
        <span class="chip-name">${name}</span>
        <span class="chip-count">${count}개</span>`;
    } else if (windowMatch) {
      chip.style.background = 'transparent';
      chip.style.border = 'none';
      chip.style.padding = '2px 0';
      chip.innerHTML = `<span style="color:var(--text-muted);font-size:10px;font-weight:600;">${line}</span>`;
    } else {
      chip.innerHTML = `<span style="color:var(--text-dim);font-size:11px;">${line}</span>`;
    }
    groupChips.appendChild(chip);
  }

  resultWrap.style.display = 'block';
  // 요약 갱신
  updateSummary();
}

function setProgress(pct, label, sub = '', file = '') {
  progressWrap.style.display  = 'block';
  progressFill.style.width    = Math.min(pct, 100) + '%';
  progressPct.textContent     = Math.round(pct) + '%';
  progressLabel.textContent   = label;
  progressSub.textContent     = sub;
  progressFile.textContent    = file ? `📄 ${file}` : '';
}

function hideProgress() { progressWrap.style.display = 'none'; }
function lockBtns()     { allBtns.forEach(b => b.disabled = true); }
function unlockBtns()   { allBtns.forEach(b => b.disabled = false); }

// 소요 시간 포맷
function formatElapsed(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}초`;
  const min = Math.floor(sec / 60);
  return `${min}분 ${(sec % 60).toFixed(0)}초`;
}

// 타임아웃 래퍼 (120초)
function withTimeout(promise, ms = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() =>
      reject(new Error(`작업이 ${ms / 1000}초를 초과하여 자동 취소되었습니다.`)), ms);
    promise
      .then(val => { clearTimeout(timer); resolve(val); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

// ─── AI 정리 ──────────────────────────────────────────────────────
document.getElementById('btnAIAll').addEventListener('click', async () => {
  lockBtns();
  statusEl.style.display  = 'none';
  resultWrap.style.display = 'none';
  setProgress(0, '준비 중...');
  const startTime = performance.now();

  try {
    // 커스텀 카테고리 파싱 (쉼표 구분, 빈 문자열 제거)
    const customCategories = customCatInput.value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const results = await withTimeout(
      organizeAllWindowsWithAI(
        (tabs) => classifyTabsWithAI(tabs, (pct, label, sub, file) => setProgress(pct, label, sub, file), customCategories)
      )
    );
    hideProgress();
    const elapsed = formatElapsed(performance.now() - startTime);
    setResultChips([`🤖 AI 분류 완료 (${elapsed})`, ...results]);
  } catch (e) {
    hideProgress();
    const elapsed = formatElapsed(performance.now() - startTime);
    const isWebGPU  = e.message?.includes('WebGPU') || e.message?.includes('GPU');
    const isTimeout = e.message?.includes('초과');
    setStatus(
      `❌ ${e.message}\n\n` +
      (isTimeout
        ? '시간이 너무 오래 걸렸습니다.\n네트워크를 확인하거나 아래 패턴 기반 버튼을 사용해보세요.'
        : isWebGPU
          ? 'WebGPU 미지원 환경입니다.\nChrome 113+ 및 GPU 가속이 필요해요.\n아래 패턴 기반 버튼을 대신 사용하세요.'
          : '아래 패턴 기반 버튼을 사용해보세요.') +
      `\n\n⏱ 경과: ${elapsed}`,
      true
    );
  } finally {
    unlockBtns();
  }
});

// ─── 패턴 기반 정리 ───────────────────────────────────────────────
document.getElementById('btnCurrentWindow').addEventListener('click', async () => {
  lockBtns();
  const startTime = performance.now();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await organizeWindow(tab.windowId);
    const elapsed = formatElapsed(performance.now() - startTime);
    setResultChips([`✅ 패턴 기반 정리 완료 (${elapsed})`, ...results]);
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

document.getElementById('btnAllWindows').addEventListener('click', async () => {
  lockBtns();
  const startTime = performance.now();
  try {
    const results = await organizeAllWindows();
    const elapsed = formatElapsed(performance.now() - startTime);
    setResultChips([`✅ 패턴 기반 정리 완료 (${elapsed})`, ...results]);
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

// ─── 그룹 해제 ────────────────────────────────────────────────────
document.getElementById('btnUngroupAll').addEventListener('click', async () => {
  lockBtns();
  try {
    const results = await ungroupAllWindows();
    setResultChips(results);
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});
