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

// 2-4: 소요 시간 포맷 헬퍼
function formatElapsed(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}초`;
  const min = Math.floor(sec / 60);
  const remainSec = (sec % 60).toFixed(0);
  return `${min}분 ${remainSec}초`;
}

// 2-2: 타임아웃 래퍼 (기본 120초)
function withTimeout(promise, ms = 120_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`작업이 ${ms / 1000}초를 초과하여 자동 취소되었습니다.`));
    }, ms);
    promise
      .then(val => { clearTimeout(timer); resolve(val); })
      .catch(err => { clearTimeout(timer); reject(err); });
  });
}

// ─── AI 정리 ──────────────────────────────────────────────────────
document.getElementById('btnAIAll').addEventListener('click', async () => {
  lockBtns();
  statusEl.style.display = 'none';
  setProgress(0, '준비 중...');
  const startTime = performance.now();

  try {
    const results = await withTimeout(
      organizeAllWindowsWithAI(
        (tabs) => classifyTabsWithAI(tabs, (pct, label, sub, file) => setProgress(pct, label, sub, file))
      )
    );
    hideProgress();
    const elapsed = formatElapsed(performance.now() - startTime);
    // 🤖 AI 결과임을 명확히 표시 + 소요 시간
    setStatus(`🤖 AI 분류 완료 (${elapsed})\n` + results.join('\n'));
  } catch (e) {
    hideProgress();
    const elapsed = formatElapsed(performance.now() - startTime);
    const isWebGPU = e.message?.includes('WebGPU') || e.message?.includes('GPU');
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
    setStatus(results.join('\n') + `\n\n⏱ ${elapsed}`);
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

document.getElementById('btnAllWindows').addEventListener('click', async () => {
  lockBtns();
  const startTime = performance.now();
  try {
    const results = await organizeAllWindows();
    const elapsed = formatElapsed(performance.now() - startTime);
    setStatus(results.join('\n') + `\n\n⏱ ${elapsed}`);
  } catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});

// ─── 그룹 해제 ────────────────────────────────────────────────────
document.getElementById('btnUngroupAll').addEventListener('click', async () => {
  lockBtns();
  try { setStatus((await ungroupAllWindows()).join('\n')); }
  catch (e) { setStatus('❌ ' + e.message, true); }
  finally { unlockBtns(); }
});
