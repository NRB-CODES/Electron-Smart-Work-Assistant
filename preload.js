const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveMusicFile:   (sourcePath, fileName) => ipcRenderer.invoke('save-music-file', sourcePath, fileName),
    isDesktop:       () => true,
    transcribeAudio: (audioBuffer, lang)    => ipcRenderer.invoke('transcribe-audio', audioBuffer, lang),
    pushData: (data) => ipcRenderer.invoke('push-live-data', data),
    assistant: {
        enable:   () => ipcRenderer.invoke('assistant:enable'),
        disable:  () => ipcRenderer.invoke('assistant:disable'),
        getState: () => ipcRenderer.invoke('assistant:get-state'),
    },
    reminders: {
        set:        (data)    => ipcRenderer.invoke('reminders:set', data),
        cancel:     (data)    => ipcRenderer.invoke('reminders:cancel', data),
        getActive:  (themeId) => ipcRenderer.invoke('reminders:get-active', themeId),
        onTriggered:        (cb) => ipcRenderer.on('reminder-triggered', (_, data)  => cb(data)),
        onThemeFromDeepLink:(cb) => ipcRenderer.on('apply-theme',        (_, theme) => cb(theme)),
    }
});