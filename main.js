const { app, BrowserWindow, ipcMain, Notification, screen } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http'); // built-in Node — no install needed

// ─── SQUIRREL STARTUP ────────────────────────────────────────────────────────
if (require('electron-squirrel-startup')) app.quit();

// ─── PROTOCOL (kept for packaged app deep links) ──────────────────────────────
if (process.defaultApp) {
    if (process.argv.length >= 2)
        app.setAsDefaultProtocolClient('smartassistant', process.execPath, [path.resolve(process.argv[1])]);
} else {
    app.setAsDefaultProtocolClient('smartassistant');
}

let mainWindow  = null;
let deeplinkUrl = null;

// ─── PERSISTENT STATE ─────────────────────────────────────────────────────────
const statePath = path.join(app.getPath('userData'), 'assistant-state.json');

function loadState() {
    try {
        if (fs.existsSync(statePath))
            return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (e) { console.error('[State] Load error:', e); }
    return { enabled: true };
}

function saveState(enabled) {
    try { fs.writeFileSync(statePath, JSON.stringify({ enabled })); }
    catch (e) { console.error('[State] Save error:', e); }
}

// ─── LOCAL HTTP CONTROL SERVER ────────────────────────────────────────────────
// Listens on http://localhost:57432
// Website calls this with fetch() — works in any browser, no protocol needed.
//
//   GET  http://localhost:57432/status   → { enabled: true/false }
//   POST http://localhost:57432/enable   → shows window, saves state
//   POST http://localhost:57432/disable  → hides window, saves state
//
const CONTROL_PORT = 57432;

function startControlServer() {
    const server = http.createServer((req, res) => {
        // Allow website (any origin) to call this
        res.setHeader('Access-Control-Allow-Origin',  '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

        const url = req.url.split('?')[0];

        if (req.method === 'GET' && url === '/status') {
            res.writeHead(200);
            res.end(JSON.stringify(loadState()));
            return;
        }

        if (req.method === 'POST' && url === '/enable') {
            saveState(true);
            if (mainWindow) mainWindow.show();
            else createWindow();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, enabled: true }));
            return;
        }

        if (req.method === 'POST' && url === '/disable') {
            saveState(false);
            if (mainWindow) mainWindow.hide();
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, enabled: false }));
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    });

    server.listen(CONTROL_PORT, '127.0.0.1', () => {
        console.log(`[Control Server] Running on http://localhost:${CONTROL_PORT}`);
    });

    server.on('error', (e) => {
        console.error('[Control Server] Error:', e.message);
    });
}

// ─── DEEP LINK (still kept for packaged builds) ───────────────────────────────
app.on('open-url', (event, url) => {
    event.preventDefault();
    deeplinkUrl = url;
    if (app.isReady()) handleDeepLink(url);
});

// ─── CREATE WINDOW ────────────────────────────────────────────────────────────
function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    const windowWidth  = 345;
    const windowHeight = 335;
     

    mainWindow = new BrowserWindow({
        width:  windowWidth,
        height: windowHeight,
        x: width  - windowWidth,
        y: height - windowHeight,
         alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        frame:       false,
        transparent: true,
        resizable:   true,
        movable:     true,
        show:        false
    });
mainWindow.setAlwaysOnTop(true, 'screen-saver'); 
mainWindow.setVisibleOnAllWorkspaces(true);
    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        const { enabled } = loadState();
        if (enabled) mainWindow.show();
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── APP READY ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
    startControlServer();   // ← start HTTP server first
    createWindow();
    loadPersistentReminders();

    const deepArg = process.argv.find(arg => arg.startsWith('smartassistant://'));
    if (deepArg) handleDeepLink(deepArg);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// ─── DEEP LINK HANDLER ────────────────────────────────────────────────────────
function handleDeepLink(url) {
    try {
        const parsed = new URL(url);
        const cmd    = parsed.searchParams.get('cmd');
        const theme  = parsed.searchParams.get('theme');

        if (cmd === 'enable')  { saveState(true);  if (mainWindow) mainWindow.show();  else createWindow(); return; }
        if (cmd === 'disable') { saveState(false); if (mainWindow) mainWindow.hide();  return; }

        if (theme) {
            saveState(true);
            if (!mainWindow) createWindow();
            mainWindow.show();
            mainWindow.webContents.send('apply-theme', theme);
        }
    } catch (e) { console.error('[DeepLink] Error:', e); }
}

// ─── IPC: ENABLE / DISABLE (from inside Electron pages) ──────────────────────
ipcMain.handle('assistant:enable',    () => { saveState(true);  if (mainWindow) mainWindow.show();  return { success: true, enabled: true  }; });
ipcMain.handle('assistant:disable',   () => { saveState(false); if (mainWindow) mainWindow.hide();  return { success: true, enabled: false }; });
ipcMain.handle('assistant:get-state', () => loadState());

// ─── POMODORO ─────────────────────────────────────────────────────────────────
let pomodoroWindow;
function createPomodoroWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    pomodoroWindow = new BrowserWindow({
        width: 400, height: 500, x: width - 400, y: height - 500,
        webPreferences: { preload: path.join(__dirname, 'pomodoroPreload.js'), contextIsolation: true }
    });
    pomodoroWindow.loadFile('pomodoro.html');
}
ipcMain.on('open-pomodoro', () => createPomodoroWindow());

// ─── MUSIC FILE SAVE ──────────────────────────────────────────────────────────
ipcMain.handle('save-music-file', async (event, sourcePath, fileName) => {
    const musicDir = path.join(__dirname, 'music');
    if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);
    const uniqueFileName = Date.now() + '_' + fileName.replace(/\s+/g, '_');
    fs.copyFileSync(sourcePath, path.join(musicDir, uniqueFileName));
    return `music/${uniqueFileName}`;
});

// ─── BACKGROUND REMINDERS ────────────────────────────────────────────────────
const remindersPath = path.join(app.getPath('userData'), 'reminders.json');
let activeReminders = {};

function loadPersistentReminders() {
    try {
        if (fs.existsSync(remindersPath)) {
            const data = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
            Object.entries(data).forEach(([, config]) => startBackgroundTimer(config.themeId, config.type, config.minutes, false));
        }
    } catch (e) { console.error('[Reminders] Load error:', e); }
}

function savePersistentReminders() {
    try {
        const data = {};
        Object.entries(activeReminders).forEach(([key, val]) => {
            data[key] = { themeId: val.themeId, type: val.type, minutes: val.minutes, nextTrigger: val.nextTrigger };
        });
        fs.writeFileSync(remindersPath, JSON.stringify(data));
    } catch (e) { console.error('[Reminders] Save error:', e); }
}

function startBackgroundTimer(themeId, type, minutes, isNew = true) {
    const key = `${themeId}_${type}`;
    if (activeReminders[key]) clearInterval(activeReminders[key].timer);
    const intervalMs = minutes * 60 * 1000;
    const timer      = setInterval(() => triggerReminder(themeId, type), intervalMs);
    activeReminders[key] = { timer, nextTrigger: Date.now() + intervalMs, minutes, themeId, type };
    if (isNew) savePersistentReminders();
}

function stopBackgroundTimer(themeId, type) {
    const key = `${themeId}_${type}`;
    if (activeReminders[key]) { clearInterval(activeReminders[key].timer); delete activeReminders[key]; savePersistentReminders(); }
}

function triggerReminder(themeId, type) {
    const config = activeReminders[`${themeId}_${type}`];
    if (!config) return;
    config.nextTrigger = Date.now() + config.minutes * 60 * 1000;
    const titles   = { water: '💧 Hydration Time!', screen: '👁️ Eye Rest Time!' };
    const messages = { water: 'Take a water break!', screen: 'Look away for 20 seconds.' };
    if (Notification.isSupported())
        new Notification({ title: titles[type] || 'Reminder', body: messages[type] || '' }).show();
    BrowserWindow.getAllWindows().forEach(win =>
        win.webContents.send('reminder-triggered', { themeId, type, title: titles[type], message: messages[type] }));
}

ipcMain.handle('reminders:set',       (event, { themeId, type, minutes }) => { startBackgroundTimer(themeId, type, minutes); return { success: true, nextTrigger: activeReminders[`${themeId}_${type}`].nextTrigger }; });
ipcMain.handle('reminders:cancel',    (event, { themeId, type })          => { stopBackgroundTimer(themeId, type); return { success: true }; });
ipcMain.handle('reminders:get-active',(event, themeId) => {
    const result = {};
    Object.entries(activeReminders).forEach(([, val]) => { if (val.themeId === themeId) result[val.type] = { minutes: val.minutes, nextTrigger: val.nextTrigger }; });
    return result;
});

// ─── WHISPER ──────────────────────────────────────────────────────────────────
let whisperPipeline = null;
async function getWhisperPipeline() {
    if (whisperPipeline) return whisperPipeline;
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowRemoteModels = false;
    env.allowLocalModels  = true;
    env.localModelPath    = app.isPackaged ? path.join(process.resourcesPath, 'models') : path.join(__dirname, 'models');
    whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', { quantized: true, device: 'cpu' });
    return whisperPipeline;
}
ipcMain.handle('transcribe-audio', async (event, audioBuffer, lang) => {
    try {
        const transcriber = await getWhisperPipeline();
        const result      = await transcriber(audioBuffer, { language: lang.split('-')[0], task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
        return result.text.trim();
    } catch (err) { console.error('[Whisper] Error:', err); return { error: err.message }; }
});