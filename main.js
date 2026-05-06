const { app, BrowserWindow, ipcMain, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'ima2table4ppt',
    backgroundColor: '#f0ede8'
  });
  mainWindow.loadFile('renderer/index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// 파일 열기 다이얼로그
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'gif'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
  return { dataUrl: `data:${mime};base64,${base64}`, filePath };
});

// 이미지 전처리: sharp로 그레이스케일 + 대비 강화 → OCR 정확도 향상
ipcMain.handle('preprocess-image', async (event, dataUrl) => {
  try {
    const base64 = dataUrl.split(',')[1];
    const buffer = Buffer.from(base64, 'base64');
    const processed = await sharp(buffer)
      .greyscale()
      .normalise()
      .sharpen()
      .toBuffer();
    return { success: true, dataUrl: `data:image/png;base64,${processed.toString('base64')}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// HTML을 클립보드에 복사 (Electron clipboard API — HTML 형식 지원)
ipcMain.handle('copy-html-to-clipboard', async (event, html) => {
  try {
    clipboard.write({ html, text: html });
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// 템플릿 저장/불러오기 (userData 폴더에 JSON)
const templatesPath = path.join(app.getPath('userData'), 'ima2table4ppt-templates.json');

ipcMain.handle('load-templates', () => {
  try {
    if (fs.existsSync(templatesPath)) return JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
    return [];
  } catch { return []; }
});

ipcMain.handle('save-templates', (event, templates) => {
  try {
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});
