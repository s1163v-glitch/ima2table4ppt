const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openFileDialog:      ()       => ipcRenderer.invoke('open-file-dialog'),
  preprocessImage:     (dataUrl)=> ipcRenderer.invoke('preprocess-image', dataUrl),
  copyHtmlToClipboard: (html)   => ipcRenderer.invoke('copy-html-to-clipboard', html),
  loadTemplates:       ()       => ipcRenderer.invoke('load-templates'),
  saveTemplates:       (tpls)   => ipcRenderer.invoke('save-templates', tpls)
});
