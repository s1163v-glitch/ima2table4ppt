const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ocrFile:       (filePath)   => ipcRenderer.invoke('ocr-file', filePath),
  ocrBase64:     (b64, mime)  => ipcRenderer.invoke('ocr-base64', b64, mime),
  copyHtml:      (html)       => ipcRenderer.invoke('copy-html', html),
  loadTemplates: ()           => ipcRenderer.invoke('load-templates'),
  saveTemplates: (tpls)       => ipcRenderer.invoke('save-templates', tpls),
});
