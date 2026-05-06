// ─── 상태 ────────────────────────────────────────────────────────────
const TOL = 3;
let currentTab = 'image';
let tableModel = null;   // { header, rows: [[{text,bg,fg,align,colspan,rowspan,merged,fs,bold}]] }
let tableHtml  = '';
let selectedCell = null; // { el, r, c }
let currentTool  = null; // 'hline' | 'vline' | null
let uploadedDataUrl = null;
let manualLines = { h: [], v: [] };
let imgNW = 0, imgNH = 0, imgDW = 0, imgDH = 0;
let selectedTpl = null;
let userTemplates = [];

const BUILTIN_TEMPLATES = [
  { name: '기본 블루',   headerBg: '#273140', headerFg: '#ffffff', bodyBg: '#EFF5FB', bodyAltBg: '#D3E9FF', bodyFg: '#010A41' },
  { name: '그린 계열',   headerBg: '#0F6E56', headerFg: '#ffffff', bodyBg: '#E1F5EE', bodyAltBg: '#9FE1CB', bodyFg: '#04342C' },
  { name: '심플 그레이', headerBg: '#444441', headerFg: '#ffffff', bodyBg: '#F1EFE8', bodyAltBg: '#D3D1C7', bodyFg: '#2C2C2A' },
  { name: '코럴 레드',   headerBg: '#993C1D', headerFg: '#ffffff', bodyBg: '#FAECE7', bodyAltBg: '#F5C4B3', bodyFg: '#4A1B0C' },
  { name: '딥 퍼플',    headerBg: '#3C3489', headerFg: '#ffffff', bodyBg: '#EEEDFE', bodyAltBg: '#CECBF6', bodyFg: '#26215C' },
  { name: '노 컬러',    headerBg: '#333333', headerFg: '#ffffff', bodyBg: '#ffffff', bodyAltBg: '#f5f5f5', bodyFg: '#111111' },
];

// ─── 초기화 ───────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  userTemplates = (await window.api.loadTemplates()) || [];
  selectedTpl = BUILTIN_TEMPLATES[0];
  renderTemplates();
  initDropZone();
  initPaste();
});

// ─── 탭 전환 ──────────────────────────────────────────────────────────
function switchTab(t) {
  currentTab = t;
  document.getElementById('tab-image').classList.toggle('active', t === 'image');
  document.getElementById('tab-figma').classList.toggle('active', t === 'figma');
  document.getElementById('pane-image').style.display = t === 'image' ? '' : 'none';
  document.getElementById('pane-figma').style.display = t === 'figma' ? '' : 'none';
}

// ─── 드롭존 & 파일 처리 ───────────────────────────────────────────────
function initDropZone() {
  const dz = document.getElementById('drop-zone');
  dz.addEventListener('click', async () => {
    const result = await window.api.openFileDialog();
    if (result) loadImage(result.dataUrl);
  });
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => loadImage(ev.target.result);
      reader.readAsDataURL(file);
    }
  });
}

function initPaste() {
  document.addEventListener('paste', e => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = ev => loadImage(ev.target.result);
          reader.readAsDataURL(file);
        }
      }
    }
  });
}

function loadImage(dataUrl) {
  uploadedDataUrl = dataUrl;
  manualLines = { h: [], v: [] };
  const img = document.getElementById('preview-img');
  img.src = dataUrl;
  img.onload = () => {
    imgNW = img.naturalWidth;
    imgNH = img.naturalHeight;
    document.getElementById('drop-zone').style.display = 'none';
    document.getElementById('img-section').style.display = '';
    document.getElementById('ocr-status').style.display = 'none';
    setTimeout(updateCanvas, 60);
  };
}

function resetImage() {
  uploadedDataUrl = null;
  manualLines = { h: [], v: [] };
  document.getElementById('drop-zone').style.display = '';
  document.getElementById('img-section').style.display = 'none';
  document.getElementById('ocr-status').style.display = 'none';
  currentTool = null;
  updateToolBtns();
}

// ─── 캔버스 (구분선 그리기) ───────────────────────────────────────────
function updateCanvas() {
  const img    = document.getElementById('preview-img');
  const canvas = document.getElementById('line-canvas');
  imgDW = img.offsetWidth;
  imgDH = img.offsetHeight;
  canvas.width  = imgDW;
  canvas.height = imgDH;
  canvas.style.width  = imgDW + 'px';
  canvas.style.height = imgDH + 'px';
  drawLines();
}

document.getElementById('line-canvas').addEventListener('click', e => {
  if (!currentTool) return;
  const rect = e.target.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (currentTool === 'hline') manualLines.h.push(Math.round(y * imgNH / imgDH));
  else                          manualLines.v.push(Math.round(x * imgNW / imgDW));
  drawLines();
});

function drawLines() {
  const canvas = document.getElementById('line-canvas');
  const ctx    = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sx = imgDW / imgNW, sy = imgDH / imgNH;
  ctx.strokeStyle = '#e24b4a';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  for (const y of manualLines.h) {
    ctx.beginPath(); ctx.moveTo(0, y * sy); ctx.lineTo(canvas.width, y * sy); ctx.stroke();
  }
  for (const x of manualLines.v) {
    ctx.beginPath(); ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, canvas.height); ctx.stroke();
  }
}

function setTool(t) { currentTool = currentTool === t ? null : t; updateToolBtns(); }
function updateToolBtns() {
  document.getElementById('btn-hline').classList.toggle('active-tool', currentTool === 'hline');
  document.getElementById('btn-vline').classList.toggle('active-tool', currentTool === 'vline');
}
function clearLines() { manualLines = { h: [], v: [] }; drawLines(); }
window.addEventListener('resize', () => { if (uploadedDataUrl) updateCanvas(); });

// ─── OCR (Tesseract.js) ───────────────────────────────────────────────
async function doRecognize() {
  if (!uploadedDataUrl) return;
  const btn = document.getElementById('btn-recognize');
  btn.disabled = true;
  setStatus('ocr-status', 'loading', '이미지 전처리 중…');

  // 1. sharp로 전처리 (그레이스케일 + 대비 강화)
  const preResult  = await window.api.preprocessImage(uploadedDataUrl);
  const ocrSource  = preResult.success ? preResult.dataUrl : uploadedDataUrl;

  setStatus('ocr-status', 'loading', 'Tesseract OCR 실행 중… (첫 실행 시 언어 데이터 다운로드로 시간이 걸릴 수 있어요)');

  try {
    const { data } = await Tesseract.recognize(ocrSource, 'kor+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          setStatus('ocr-status', 'loading', `OCR 진행 중… ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const model = buildModelFromOcr(data, manualLines);
    if (model.error) {
      setStatus('ocr-status', 'err', '⚠ ' + model.error);
      btn.disabled = false;
      return;
    }

    tableModel = model;
    rerenderPreview();
    const rows = model.rows.length;
    const cols = model.rows[0]?.length || 0;
    setStatus('ocr-status', 'ok', `✅ 인식 완료 — ${rows}행 × ${cols}열. 셀을 클릭해서 편집할 수 있어요.`);
  } catch (e) {
    setStatus('ocr-status', 'err', '❌ OCR 오류: ' + e.message);
  }
  btn.disabled = false;
}

// ─── OCR 결과 → 표 모델 ──────────────────────────────────────────────
function buildModelFromOcr(ocrData, manualLines) {
  // 단어 bounding box 수집
  const words = [];
  for (const block of ocrData.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        for (const word of line.words || []) {
          if (word.text.trim() && word.confidence > 30) {
            words.push({
              text: word.text.trim(),
              cx: (word.bbox.x0 + word.bbox.x1) / 2,
              cy: (word.bbox.y0 + word.bbox.y1) / 2
            });
          }
        }
      }
    }
  }

  if (!words.length) return { error: '텍스트를 인식하지 못했어요. 이미지 품질을 확인하거나 구분선을 수동으로 그어봐요.' };

  // 행/열 경계 계산 (수동선 우선, 없으면 좌표 클러스터링)
  let rowBounds, colBounds;

  if (manualLines.h.length >= 1) {
    const sorted = [...manualLines.h].sort((a, b) => a - b);
    rowBounds = [0, ...sorted, imgNH];
  } else {
    const rowCenters = cluster(words.map(w => w.cy), 12);
    rowBounds = [0];
    for (let i = 0; i < rowCenters.length - 1; i++) {
      rowBounds.push(Math.round((rowCenters[i] + rowCenters[i + 1]) / 2));
    }
    rowBounds.push(imgNH);
  }

  if (manualLines.v.length >= 1) {
    const sorted = [...manualLines.v].sort((a, b) => a - b);
    colBounds = [0, ...sorted, imgNW];
  } else {
    const colCenters = cluster(words.map(w => w.cx), 20);
    colBounds = [0];
    for (let i = 0; i < colCenters.length - 1; i++) {
      colBounds.push(Math.round((colCenters[i] + colCenters[i + 1]) / 2));
    }
    colBounds.push(imgNW);
  }

  const numRows = rowBounds.length - 1;
  const numCols = colBounds.length - 1;

  if (numRows === 0 || numCols === 0) {
    return { error: '행/열 구조를 파악하지 못했어요. 구분선을 수동으로 그어봐요.' };
  }

  // 그리드 초기화
  const grid = [];
  for (let r = 0; r < numRows; r++) {
    grid[r] = [];
    for (let c = 0; c < numCols; c++) {
      grid[r][c] = { text: '', bg: null, fg: null, align: 'center', colspan: 1, rowspan: 1, merged: false, fs: 9, bold: false };
    }
  }

  // 단어를 셀에 배치
  for (const w of words) {
    const r = rowBounds.findIndex((b, i) => w.cy >= b && w.cy < (rowBounds[i + 1] ?? Infinity)) ;
    const c = colBounds.findIndex((b, i) => w.cx >= b && w.cx < (colBounds[i + 1] ?? Infinity));
    if (r >= 0 && r < numRows && c >= 0 && c < numCols) {
      grid[r][c].text = grid[r][c].text ? grid[r][c].text + ' ' + w.text : w.text;
    }
  }

  return { header: null, rows: grid };
}

// 좌표 클러스터링
function cluster(values, tol) {
  const t   = tol || TOL;
  const arr = [...values].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const groups = [];
  for (const v of arr) {
    if (!groups.length) { groups.push([v]); continue; }
    const g    = groups[groups.length - 1];
    const mean = g.reduce((s, x) => s + x, 0) / g.length;
    if (Math.abs(v - mean) <= t) g.push(v);
    else groups.push([v]);
  }
  return groups.map(g => Math.round(g.reduce((s, x) => s + x, 0) / g.length));
}

// ─── 미리보기 렌더링 ──────────────────────────────────────────────────
function rerenderPreview() {
  if (!tableModel) return;
  const { previewHtml, exportHtml } = buildHtml(tableModel, selectedTpl);
  tableHtml = exportHtml;
  document.getElementById('preview-area').innerHTML = previewHtml;
  document.getElementById('html-out').textContent   = exportHtml;
  document.getElementById('btn-copy').style.display      = '';
  document.getElementById('btn-cell-edit').style.display = '';

  document.querySelectorAll('#preview-area td').forEach(td => {
    td.addEventListener('click', () => selectCell(td));
  });
}

function buildHtml(model, tpl) {
  const t      = tpl || BUILTIN_TEMPLATES[0];
  const scale  = 0.75;
  const toPt   = px => (Number.isFinite(px) ? Math.round(px * scale * 100) / 100 : 0) + 'pt';
  const fonts  = `'Pretendard', Arial, 'Malgun Gothic', sans-serif`;
  const tblSt  = 'border-collapse:collapse;table-layout:fixed;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;';

  let prev = `<table style="${tblSt}font-family:${fonts};font-size:11px">`;
  let exp  = `<table cellpadding="0" cellspacing="0" border="0" style="${tblSt}">`;

  if (model.header && model.header.text) {
    const cols = (model.rows[0] || []).reduce((s, c) => s + (!c.merged ? (c.colspan || 1) : 0), 0) || 1;
    const hbg  = model.header.bg || t.headerBg;
    const hfg  = model.header.fg || t.headerFg;
    prev += `<tr><td colspan="${cols}" style="background:${hbg};color:${hfg};text-align:center;padding:6px 8px;font-weight:600;font-size:12px">${esc(model.header.text)}</td></tr>`;
    exp  += `<tr><td colspan="${cols}" style="background:${hbg};color:${hfg};text-align:center;vertical-align:middle;font-family:${fonts};font-size:${toPt(12)};font-weight:600;padding:0;height:${toPt(20)};mso-height-rule:exactly">${esc(model.header.text)}</td></tr>`;
  }

  model.rows.forEach((row, ri) => {
    prev += '<tr>';
    exp  += '<tr>';
    row.forEach((cell, ci) => {
      if (cell.merged) return;
      const bg  = cell.bg    || (ri % 2 === 0 ? t.bodyBg : t.bodyAltBg);
      const fg  = cell.fg    || t.bodyFg;
      const fs  = cell.fs    || 9;
      const al  = cell.align || 'center';
      const cs  = cell.colspan || 1;
      const rs  = cell.rowspan || 1;
      const fw  = cell.bold ? 600 : 400;
      const rsa = rs > 1 ? ` rowspan="${rs}"` : '';
      const csa = cs > 1 ? ` colspan="${cs}"` : '';

      prev += `<td${csa}${rsa} style="background:${bg};color:${fg};text-align:${al};padding:4px 6px;font-size:${fs}px;font-weight:${fw};border:0.5px solid rgba(0,0,0,0.08)" data-r="${ri}" data-c="${ci}" data-bg="${bg}" data-fg="${fg}" data-fs="${fs}" data-al="${al}">${esc(cell.text || '')}</td>`;
      exp  += `<td${csa}${rsa} style="background:${bg};color:${fg};text-align:${al};vertical-align:middle;font-family:${fonts};font-size:${toPt(fs)};font-weight:${fw};padding:0;height:${toPt(20)};mso-height-rule:exactly;border:none">${esc(cell.text || '')}</td>`;
    });
    prev += '</tr>';
    exp  += '</tr>';
  });

  prev += '</table>';
  exp  += '</table>';
  return { previewHtml: prev, exportHtml: exp };
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── 셀 편집 ─────────────────────────────────────────────────────────
function selectCell(el) {
  document.querySelectorAll('#preview-area td').forEach(td => td.classList.remove('selected-cell'));
  el.classList.add('selected-cell');
  selectedCell = { el, r: +el.dataset.r, c: +el.dataset.c };
  document.getElementById('ce-bg').value      = hexOnly(el.dataset.bg);
  document.getElementById('ce-color').value   = hexOnly(el.dataset.fg);
  document.getElementById('ce-size').value    = el.dataset.fs || 9;
  document.getElementById('ce-align').value   = el.dataset.al || 'center';
  document.getElementById('ce-colspan').value = el.getAttribute('colspan') || 1;
  document.getElementById('ce-rowspan').value = el.getAttribute('rowspan') || 1;
}

function hexOnly(c) {
  if (!c || c === 'transparent') return '#ffffff';
  return c.startsWith('#') ? c.slice(0, 7) : '#ffffff';
}

function toggleCellEditor() {
  const el = document.getElementById('cell-editor');
  el.style.display = el.style.display === 'none' ? '' : 'none';
}

function applyCellStyle() {
  if (!selectedCell || !tableModel) return;
  const { r, c } = selectedCell;
  const cell = tableModel.rows[r]?.[c];
  if (!cell) return;
  cell.bg      = document.getElementById('ce-bg').value;
  cell.fg      = document.getElementById('ce-color').value;
  cell.fs      = +document.getElementById('ce-size').value;
  cell.align   = document.getElementById('ce-align').value;
  cell.colspan = +document.getElementById('ce-colspan').value || 1;
  cell.rowspan = +document.getElementById('ce-rowspan').value || 1;
  rerenderPreview();
}

// ─── 클립보드 복사 ────────────────────────────────────────────────────
async function copyForPPT() {
  if (!tableHtml) return;
  const result = await window.api.copyHtmlToClipboard(tableHtml);
  if (result.success) {
    setStatus('copy-status', 'ok', '✅ 클립보드에 복사됐어. PowerPoint에서 Ctrl+V 해봐.');
  } else {
    setStatus('copy-status', 'err', '❌ 복사 실패: ' + result.error);
  }
  document.getElementById('copy-status').style.display = 'flex';
}

// ─── 상태 표시 ────────────────────────────────────────────────────────
function setStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.style.display = 'flex';
  el.className = 'status-bar' +
    (type === 'ok' ? ' ok' : type === 'err' ? ' err' : type === 'loading' ? ' loading' : '');
  el.innerHTML = (type === 'loading' ? '<span class="spinner"></span>' : '') + msg;
}

// ─── 디자인 템플릿 ────────────────────────────────────────────────────
function renderTemplates() {
  const all = [...BUILTIN_TEMPLATES, ...userTemplates];
  const g   = document.getElementById('tpl-grid');
  g.innerHTML = '';
  all.forEach(tpl => {
    const d = document.createElement('div');
    d.className = 'tpl-card' + (tpl === selectedTpl ? ' selected' : '');
    d.innerHTML = `<div class="tpl-swatch"><span style="background:${tpl.headerBg}"></span><span style="background:${tpl.bodyBg}"></span><span style="background:${tpl.bodyAltBg}"></span></div><div class="tpl-card-name">${tpl.name}</div>`;
    d.onclick   = () => { selectedTpl = tpl; renderTemplates(); if (tableModel) rerenderPreview(); };
    g.appendChild(d);
  });
}

async function saveTemplate() {
  const name = document.getElementById('tpl-name-input').value.trim() || '내 템플릿';
  const tpl  = {
    name,
    headerBg:   selectedTpl.headerBg,
    headerFg:   selectedTpl.headerFg,
    bodyBg:     selectedTpl.bodyBg,
    bodyAltBg:  selectedTpl.bodyAltBg,
    bodyFg:     selectedTpl.bodyFg
  };
  userTemplates.push(tpl);
  await window.api.saveTemplates(userTemplates);
  renderTemplates();
  setStatus('ocr-status', 'ok', `"${name}" 템플릿 저장 완료.`);
  document.getElementById('ocr-status').style.display = 'flex';
}

// ─── Figma CSS 파서 (기존 로직 포팅) ─────────────────────────────────
function parseFigmaCSS() {
  const css = document.getElementById('figma-input').value;
  if (!css.trim()) { setStatus('figma-status', 'err', 'CSS를 먼저 붙여넣어줘.'); return; }
  try {
    const blocks = parseCssBlocks(css);
    const model  = buildFigmaTableModel(blocks);
    if (model.error) { setStatus('figma-status', 'err', model.error); return; }
    const out = figmaModelToHtml(model);
    if (out.error) { setStatus('figma-status', 'err', out.error); return; }
    tableHtml = out.html;
    document.getElementById('preview-area').innerHTML = out.html;
    document.getElementById('html-out').textContent   = out.html;
    document.getElementById('btn-copy').style.display = '';
    setStatus('figma-status', 'ok', `✅ 변환 완료 — ${model.rows}행 × ${model.cols}열`);
  } catch (e) {
    setStatus('figma-status', 'err', '변환 오류: ' + e.message);
  }
}

function parseCssBlocks(input) {
  const lines = input.replace(/\r/g, '').split('\n');
  const blocks = []; let current = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const c = line.match(/^\/\*\s*(.*?)\s*\*\/$/);
    if (c) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && lines[j].trim().startsWith('position:')) {
        if (current) blocks.push(current);
        current = { name: c[1], raw: [] };
      }
      continue;
    }
    if (current && line) current.raw.push(line);
  }
  if (current) blocks.push(current);
  return blocks.map(b => {
    const p = {};
    for (const r of b.raw) {
      if (r.startsWith('width:'))      p.width      = parsePx(r);
      if (r.startsWith('height:'))     p.height     = parsePx(r);
      if (r.startsWith('left:'))       p.left       = parsePosPx(r);
      if (r.startsWith('top:'))        p.top        = parsePosPx(r);
      if (r.startsWith('background:')) p.background = parseHex(r);
      if (r.startsWith('color:'))      p.color      = parseHex(r);
      if (r.startsWith('font-family:')) {
        const m = r.match(/font-family:\s*'?(.*?)'?(;|$)/);
        if (m) p.fontFamily = m[1];
      }
      if (r.startsWith('font-weight:')) {
        const m = r.match(/font-weight:\s*(\d+)/);
        if (m) p.fontWeight = +m[1];
      }
      if (r.startsWith('font-size:'))   p.fontSize   = parsePx(r);
      if (r.startsWith('line-height:')) p.lineHeight = parsePx(r);
      if (r.startsWith('text-align:')) {
        const m = r.match(/text-align:\s*(left|center|right)/);
        if (m) p.textAlign = m[1];
      }
    }
    const isShape = !!p.background && Number.isFinite(p.width) && Number.isFinite(p.height) && Number.isFinite(p.left) && Number.isFinite(p.top);
    const isText  = !!p.fontFamily && !!p.color;
    return { name: b.name, props: p, kind: isShape ? 'shape' : isText ? 'text' : 'unknown' };
  });
}

function parsePx(l)    { const m = l.match(/(-?\d+(?:\.\d+)?)px/); return m ? +m[1] : null; }
function parsePosPx(l) { return l.toLowerCase().includes('calc(') ? null : parsePx(l); }
function parseHex(l)   { const m = l.match(/#([0-9A-Fa-f]{6})/); return m ? `#${m[1].toUpperCase()}` : null; }

function clusterF(values) {
  const arr = [...values].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const groups = [];
  for (const v of arr) {
    if (!groups.length) { groups.push([v]); continue; }
    const g    = groups[groups.length - 1];
    const mean = g.reduce((s, x) => s + x, 0) / g.length;
    if (Math.abs(v - mean) <= 2) g.push(v); else groups.push([v]);
  }
  return groups.map(g => Math.round(g.reduce((s, x) => s + x, 0) / g.length));
}

function buildFigmaTableModel(blocks) {
  const shapes = blocks.filter(b => b.kind === 'shape');
  const texts  = blocks.filter(b => b.kind === 'text');
  if (!shapes.length) return { error: '사각형(셀) 후보를 찾지 못했어요.' };
  const sorted      = [...shapes].sort((a, b) => (b.props.width || 0) - (a.props.width || 0));
  const headerShape = sorted[0];
  const bodyShapes  = shapes.filter(s => s !== headerShape);
  if (!bodyShapes.length) return { error: '바디 셀을 찾지 못했어요.' };
  const allL = [], allT = [];
  for (const s of bodyShapes) {
    allL.push(s.props.left, s.props.left + s.props.width);
    allT.push(s.props.top,  s.props.top  + s.props.height);
  }
  const colLefts = clusterF(allL), rowTops = clusterF(allT);
  const colWidths = [], rowHeights = [];
  for (let i = 0; i < colLefts.length - 1; i++) colWidths.push(colLefts[i + 1] - colLefts[i]);
  for (let i = 0; i < rowTops.length  - 1; i++) rowHeights.push(rowTops[i + 1] - rowTops[i]);
  const gR = rowTops.length - 1, gC = colLefts.length - 1;
  const grid = [];
  for (let r = 0; r < gR; r++) {
    grid[r] = [];
    for (let c = 0; c < gC; c++) grid[r][c] = { bg: null, text: '', rowspan: 1, colspan: 1, skip: false };
  }
  for (const s of bodyShapes) {
    const cc = [];
    for (let r = 0; r < gR; r++) for (let c = 0; c < gC; c++) {
      if (s.props.left <= colLefts[c] + 2 && s.props.left + s.props.width >= colLefts[c + 1] - 2 &&
          s.props.top  <= rowTops[r]  + 2 && s.props.top  + s.props.height >= rowTops[r  + 1] - 2) {
        cc.push({ r, c });
      }
    }
    if (!cc.length) continue;
    const minR = Math.min(...cc.map(x => x.r)), maxR = Math.max(...cc.map(x => x.r));
    const minC = Math.min(...cc.map(x => x.c)), maxC = Math.max(...cc.map(x => x.c));
    const sc = grid[minR][minC];
    sc.bg      = s.props.background || null;
    sc.rowspan = maxR - minR + 1;
    sc.colspan = maxC - minC + 1;
    for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) if (r !== minR || c !== minC) grid[r][c].skip = true;
  }
  const hTxt = texts.filter(t => (t.props.color || '').toUpperCase() === '#FFFFFF')
                    .sort((a, b) => (b.props.fontWeight || 0) - (a.props.fontWeight || 0))[0] || null;
  const header = headerShape ? { bg: headerShape.props.background, text: hTxt ? hTxt.name : '', colSpan: gC } : null;
  const bodyRects = [];
  for (let r = 0; r < gR; r++) for (let c = 0; c < gC; c++) {
    if (grid[r][c].skip) continue;
    const cell = grid[r][c]; let w = 0, h = 0;
    for (let i = 0; i < cell.colspan; i++) w += colWidths[c + i]  || 0;
    for (let i = 0; i < cell.rowspan; i++) h += rowHeights[r + i] || 0;
    bodyRects.push({ r, c, left: colLefts[c], top: rowTops[r], width: w, height: h });
  }
  const bodyTexts = texts.filter(t => t !== hTxt);
  for (const t of bodyTexts) {
    if (!Number.isFinite(t.props.left) || !Number.isFinite(t.props.top)) continue;
    const cx = t.props.left + (t.props.width  || 0) / 2;
    const cy = t.props.top  + (t.props.height || 0) / 2;
    const hit = bodyRects.find(rc => cx >= rc.left - 2 && cx <= rc.left + rc.width + 2 && cy >= rc.top - 2 && cy <= rc.top + rc.height + 2);
    if (!hit) continue;
    const cell = grid[hit.r][hit.c];
    cell.text = cell.text ? cell.text + '\n' + t.name : t.name;
  }
  return { header, rows: gR, cols: gC, colWidths, rowHeights, grid };
}

function figmaModelToHtml(model) {
  if (model?.error) return { html: '', error: model.error };
  const { header, colWidths, rowHeights, grid } = model;
  const cols  = colWidths.length;
  const toPt  = px => Number.isFinite(px) ? Math.round(px * 0.75 * 100) / 100 + 'pt' : '0pt';
  const fonts = `'Pretendard', Arial, 'Malgun Gothic', sans-serif`;
  const tblSt = 'border-collapse:collapse;table-layout:fixed;border-spacing:0;mso-table-lspace:0pt;mso-table-rspace:0pt;';
  let html = `<table cellpadding="0" cellspacing="0" border="0" style="${tblSt}">`;
  html += `<colgroup>${colWidths.map(w => `<col style="width:${toPt(w)}">`).join('')}</colgroup>`;
  if (header) {
    const tw = colWidths.reduce((s, w) => s + w, 0);
    html += `<tr><td colspan="${Math.max(1, header.colSpan)}" style="width:${toPt(tw)};background:${header.bg || '#273140'};color:#FFFFFF;text-align:center;vertical-align:middle;font-family:${fonts};font-size:${toPt(10)};font-weight:600;padding:0;height:${toPt(16)};mso-height-rule:exactly">${esc(header.text || '')}</td></tr>`;
  }
  for (let r = 0; r < grid.length; r++) {
    html += `<tr style="height:${toPt(rowHeights[r])};mso-height-rule:exactly">`;
    for (let c = 0; c < cols; c++) {
      const cell = grid[r][c]; if (cell.skip) continue;
      let cw = 0, ch = 0;
      for (let i = 0; i < cell.colspan; i++) cw += colWidths[c + i]  || 0;
      for (let i = 0; i < cell.rowspan; i++) ch += rowHeights[r + i] || 0;
      const rsa = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : '';
      const csa = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : '';
      html += `<td${csa}${rsa} style="width:${toPt(cw)};height:${toPt(ch)};background:${cell.bg || 'transparent'};text-align:center;vertical-align:middle;font-family:${fonts};font-size:${toPt(9)};font-weight:400;color:#111111;padding:0;mso-height-rule:exactly;border:none">${(cell.text || '').split('\n').map(esc).join('<br/>')}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return { html, error: '' };
}
