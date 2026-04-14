import { classifyTabsWithAI }                                  from './ai_classifier.js';
import { organizeWindow, organizeAllWindows,
         organizeAllWindowsWithAI, ungroupAllWindows }         from './organizer.js';

// ─── DOM 요소 ─────────────────────────────────────────────────────
const statusEl      = document.getElementById('status');
const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressPct   = document.getElementById('progressPct');
const progressLabel = document.getElementById('progressLabel');
const progressSub   = document.getElementById('progressSub');
const progressFile  = document.getElementById('progressFile');
const allBtns       = document.querySelectorAll('.btn');

// ─── UI 헬퍼 ──────────────────────────────────────────────────────
function setStatus(msg, isError = false) {
  statusEl.style.display = 'block';
  statusEl.className = isError ? 'error' : '';
  statusEl.textContent = msg;
}

/**
 * @param {number} pct       - 0~100
 * @param {string} label     - 상단 제목 (예: "모델 다운로드 중...")
 * @param {string} sub       - 하단 보조 텍스트 (예: "123 MB / 500 MB")
 * @param {string} [file]    - 현재 파일명 (선택)
 */
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

// ─── AI 정리 ──────────────────────────────────────────────────────
document.getElementById('btnAIAll').addEventListener('click', async () => {
  lockBtns();
  statusEl.style.display = 'none';
  setProgress(0, '준비 중...');

  try {
    const results = await organizeAllWindowsWithAI(
      (tabs) => classifyTabsWithAI(tabs, (pct, label, sub, file) => setProgress(pct, label, sub, file))
    );
    hideProgress();
    // 🤖 AI 결과임을 명확히 표시
    setStatus('🤖 AI 분류 완료\n' + results.join('\n'));
  } catch (e) {
    hideProgress();
    const isWebGPU = e.message?.includes('WebGPU') || e.message?.includes('GPU');
    setStatus(
      `❌ ${e.message}\n\n` +
      (isWebGPU
        ? 'WebGPU 미지원 환경입니다.\nChrome 113+ 및 GPU 가속이 필요해요.\n아래 패턴 기반 버튼을 대신 사용하세요.'
        : '아래 패턴 기반 버튼을 사용해보세요.'),
      true
    );
  } finally {
    unlockBtns();
  }
});

// ─── 패턴 기반 정리 ───────────────────────────────────────────────
document.getElementById('btnCurrentWindow').addEventListener('click', async () => {
  lockBtns();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    setStatus((await organizeWindow(tab.windowId)).join('\n'));
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

document.getElementById('btnAllWindows').addEventListener('click', async () => {
  lockBtns();
  try { setStatus((await organizeAllWindows()).join('\n')); }
  catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

// ─── 그룹 해제 ────────────────────────────────────────────────────
document.getElementById('btnUngroupAll').addEventListener('click', async () => {
  lockBtns();
  try { setStatus((await ungroupAllWindows()).join('\n')); }
  catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});
