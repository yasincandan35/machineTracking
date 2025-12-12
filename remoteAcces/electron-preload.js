const { contextBridge, ipcRenderer } = require('electron');

// IPC iletişimi için güvenli bridge
contextBridge.exposeInMainWorld('electronAPI', {
  mouseMove: (data) => ipcRenderer.send('mouse-move', data),
  mouseClick: (data) => ipcRenderer.send('mouse-click', data),
  keyPress: (data) => ipcRenderer.send('key-press', data),
  scroll: (data) => ipcRenderer.send('scroll', data),
  isElectron: true,
  // Ekran paylaşımı için desktopCapturer - IPC üzerinden
  getDesktopSources: async (options) => {
    try {
      console.log('🖥️ IPC üzerinden desktop sources isteniyor...', options);
      const sources = await ipcRenderer.invoke('get-desktop-sources', options);
      console.log('✅ Desktop sources alındı:', sources.length);
      return sources;
    } catch (error) {
      console.error('❌ Desktop sources error:', error);
      throw error;
    }
  }
});

