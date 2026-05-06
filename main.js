const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'ima2table4ppt',
    backgroundColor: '#f0f2f5'
  });
  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// OCR: 파일 경로
ipcMain.handle('ocr-file', async (event, filePath) => {
  try {
    const { createWorker } = require('tesseract.js');
    const sharp = require('sharp');
    const tmpPath = path.join(os.tmpdir(), 'i2t_' + Date.now() + '.png');
    await sharp(filePath).greyscale().normalise().sharpen().png().toFile(tmpPath);
    const worker = await createWorker(['kor', 'eng']);
    const { data } = await worker.recognize(tmpPath, {}, { blocks: true });
    await worker.terminate();
    try { fs.unlinkSync(tmpPath); } catch(e) {}
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// OCR: base64 (클립보드 붙여넣기)
ipcMain.handle('ocr-base64', async (event, base64Data, mimeType) => {
  try {
    const { createWorker } = require('tesseract.js');
    const sharp = require('sharp');
    const buf = Buffer.from(base64Data, 'base64');
    const tmpIn  = path.join(os.tmpdir(), 'i2t_in_'  + Date.now() + '.png');
    const tmpOut = path.join(os.tmpdir(), 'i2t_out_' + Date.now() + '.png');
    fs.writeFileSync(tmpIn, buf);
    await sharp(tmpIn).greyscale().normalise().sharpen().png().toFile(tmpOut);
    try { fs.unlinkSync(tmpIn); } catch(e) {}
    const worker = await createWorker(['kor', 'eng']);
    const { data } = await worker.recognize(tmpOut, {}, { blocks: true });
    await worker.terminate();
    try { fs.unlinkSync(tmpOut); } catch(e) {}
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 클립보드에 HTML 복사
ipcMain.handle('copy-html', async (event, html) => {
  try {
    clipboard.write({ html, text: html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 템플릿 저장/불러오기
const tplPath = () => path.join(app.getPath('userData'), 'templates.json');

ipcMain.handle('load-templates', async () => {
  try {
    if (!fs.existsSync(tplPath())) return { ok: true, templates: [] };
    return { ok: true, templates: JSON.parse(fs.readFileSync(tplPath(), 'utf8')) };
  } catch (e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('save-templates', async (event, templates) => {
  try {
    fs.writeFileSync(tplPath(), JSON.stringify(templates, null, 2), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});
