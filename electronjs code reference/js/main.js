// main.js (Definitive Version with Correct Deep Link Handling and Logging)

const electron = require('electron');
const { app, BrowserWindow, ipcMain, BrowserView, shell } = electron;
const path = require('path');
const PythonBridge = require('./python-bridge');
const http = require('http');  
const { EventEmitter } = require('events'); 
const BrowserHandler = require('./browser-handler.js'); 

let mainWindow;

// --- Protocol Registration ---
// This tells the OS that our app can handle 'aios://' links.
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('aios', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('aios');
}

let pythonBridge;
let browserHandler;
let linkWebView = null;

// --- CRITICAL SECTION 1: The Deep Link Handler ---
// This function's only job is to receive the URL from the OS and pass it to the UI.
function handleDeepLink(url) {
    console.log('[main.js] >>> handleDeepLink function triggered.');
    console.log(`[main.js] >>> Received URL: ${url}`);

    if (!mainWindow) {
        console.error('[main.js] >>> Error: mainWindow is not available. The app might still be launching.');
        return;
    }

    // Bring the app window to the front, this is crucial.
    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    mainWindow.focus();

    console.log('[main.js] >>> Forwarding "auth-state-changed" IPC message to the renderer process.');
    // We send the raw URL. The Supabase client in the renderer will handle it.
    mainWindow.webContents.send('auth-state-changed', { url });
}

// --- CRITICAL SECTION 2: Single Instance Lock ---
// This ensures that when a deep link is clicked, the URL is sent to your
// ALREADY RUNNING application, instead of trying to launch a new one.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // If we don't get the lock, another instance is already running, so this new one quits.
    app.quit();
} else {
    // This event fires in the PRIMARY instance when a second instance is launched.
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        console.log('[main.js] >>> "second-instance" event fired.');
        const deepLinkUrl = commandLine.find(arg => arg.startsWith('aios://'));
        
        if (deepLinkUrl) {
            console.log('[main.js] >>> Deep link found in second instance arguments.');
            handleDeepLink(deepLinkUrl);
        } else if (mainWindow) {
            // If it wasn't a deep link, just focus the existing window.
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // This handles the case where the app is launched for the first time via a deep link.
    const deepLinkArg = process.argv.find(arg => arg.startsWith('aios://'));
    if (deepLinkArg) {
        app.whenReady().then(() => handleDeepLink(deepLinkArg));
    }
}


function createWindow() {
    const mainProcessEmitter = new EventEmitter();
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(app.getAppPath(), 'assets/icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: true,
            enableRemoteModule: true,
            webSecurity: false
        },
        frame: true,
        transparent: true
    });

    mainWindow.maximize();
    mainWindow.loadFile('index.html');

    pythonBridge = new PythonBridge(mainWindow, mainProcessEmitter);

    const getAuthToken = async () => {
        try {
            const session = await mainWindow.webContents.executeJavaScript(
                'window.electron.auth.getSession()', 
                true
            );
            return session ? session.access_token : null;
        } catch (error) {
            console.error("Main process failed to get auth token:", error);
            return null;
        }
    };

    const appDataPath = app.getPath('userData');
    browserHandler = new BrowserHandler(mainProcessEmitter, appDataPath, getAuthToken);
    
    browserHandler.initialize();
    
    pythonBridge.setBrowserController(browserHandler);
    pythonBridge.start().catch(error => {
        console.error('Python bridge error:', error.message);
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('socket-connection-status', { 
                connected: false,
                error: 'Failed to connect to Python backend: ' + error.message
            });
        });
        
        setTimeout(() => {
            console.log('Attempting to reconnect to Python backend...');
            if (pythonBridge) {
                pythonBridge.stop();
            }
            pythonBridge = new PythonBridge(mainWindow, mainProcessEmitter); 
            pythonBridge.start().catch(err => {
                console.error('Python bridge reconnection failed:', err.message);
            });
        }, 10000);
    });

    ipcMain.on('minimize-window', () => { mainWindow.minimize(); });
    ipcMain.on('toggle-maximize-window', () => {
        if (mainWindow.isMaximized()) { mainWindow.unmaximize(); } else { mainWindow.maximize(); }
        mainWindow.webContents.send('window-state-changed', mainWindow.isMaximized());
    });
    ipcMain.on('close-window', () => { mainWindow.close(); });
    ipcMain.on('deepsearch-request', (event, data) => { pythonBridge.sendMessage(data); });
    ipcMain.on('check-socket-connection', (event) => {
        const isConnected = pythonBridge.socket && pythonBridge.socket.connected;
        event.reply('socket-connection-status', { connected: isConnected });
    });
    ipcMain.on('restart-python-bridge', () => {
        if (pythonBridge) { pythonBridge.stop(); }
        pythonBridge = new PythonBridge(mainWindow, mainProcessEmitter);
        pythonBridge.start().catch(error => {
            console.error('Failed to restart Python bridge:', error);
            mainWindow.webContents.send('socket-connection-status', { 
                connected: false,
                error: 'Failed to connect to Python backend: ' + error.message
            });
        });
    });
    ipcMain.on('open-webview', (event, url) => {
        console.log('Received open-webview request for URL:', url);

        if (linkWebView) {
            try {
                mainWindow.removeBrowserView(linkWebView);
                linkWebView.webContents.destroy();
                linkWebView = null;
            } catch (error) {
                console.error('Error closing existing linkWebView:', error);
            }
        }

        try {
            linkWebView = new BrowserView({
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                }
            });

            mainWindow.addBrowserView(linkWebView);

            const contentBounds = mainWindow.getContentBounds();
            const bounds = {
                x: Math.round(contentBounds.width * 0.65),
                y: 100,
                width: Math.round(contentBounds.width * 0.30),
                height: Math.round(contentBounds.height * 0.5)
            };

            linkWebView.setBounds({
                x: bounds.x + 10,
                y: bounds.y + 60,
                width: bounds.width - 20,
                height: bounds.height - 70
            });

            linkWebView.webContents.on('did-start-loading', () => {
                mainWindow.webContents.send('webview-navigation-updated', { url: linkWebView.webContents.getURL(), loading: true });
            });
            linkWebView.webContents.on('did-finish-load', () => {
                const currentUrl = linkWebView.webContents.getURL();
                mainWindow.webContents.send('webview-navigation-updated', { url: currentUrl, loading: false, canGoBack: linkWebView.webContents.canGoBack(), canGoForward: linkWebView.webContents.canGoForward() });
                mainWindow.webContents.send('webview-page-loaded');
            });
            linkWebView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
                console.error('linkWebView failed to load:', errorDescription);
                mainWindow.webContents.send('webview-navigation-updated', { error: errorDescription });
            });
            
            // Listen for navigation to aios:// deep link (OAuth callback)
            linkWebView.webContents.on('will-navigate', (event, navigationUrl) => {
                console.log('linkWebView will-navigate:', navigationUrl);
                
                // Check if navigating to aios:// deep link
                if (navigationUrl.startsWith('aios://auth/callback')) {
                    event.preventDefault();
                    console.log('OAuth callback detected, closing webview and processing deep link');
                    
                    // Parse the deep link URL
                    try {
                        const url = new URL(navigationUrl);
                        const params = new URLSearchParams(url.search);
                        const success = params.get('success') === 'true';
                        const provider = params.get('provider');
                        const error = params.get('error');
                        
                        // Close the webview
                        if (linkWebView) {
                            mainWindow.removeBrowserView(linkWebView);
                            linkWebView.webContents.destroy();
                            linkWebView = null;
                            mainWindow.webContents.send('webview-closed');
                        }
                        
                        // Send OAuth callback result to renderer
                        mainWindow.webContents.send('oauth-integration-callback', {
                            success: success,
                            provider: provider,
                            error: error
                        });
                        
                    } catch (e) {
                        console.error('Error parsing OAuth callback URL:', e);
                    }
                }
            });
            linkWebView.webContents.loadURL(url).then(() => {
                console.log('URL loaded successfully:', url);
                mainWindow.webContents.send('webview-created', bounds);
            }).catch((error) => {
                console.error('Failed to load URL:', error);
                mainWindow.webContents.send('socket-error', { message: `Failed to load URL: ${error.message}` });
            });
        } catch (error) {
            console.error('Error creating linkWebView:', error);
            mainWindow.webContents.send('socket-error', { message: `Error creating linkWebView: ${error.message}` });
        }
    });
    ipcMain.on('resize-webview', (event, bounds) => { if (linkWebView) { linkWebView.setBounds({ x: bounds.x + 10, y: bounds.y + 60, width: bounds.width - 20, height: bounds.height - 70 }); } });
    ipcMain.on('drag-webview', (event, { x, y }) => { if (linkWebView) { const currentBounds = linkWebView.getBounds(); linkWebView.setBounds({ x: x + 10, y: y + 60, width: currentBounds.width, height: currentBounds.height }); } });
    ipcMain.on('close-webview', () => { if (linkWebView) { mainWindow.removeBrowserView(linkWebView); linkWebView.webContents.destroy(); linkWebView = null; mainWindow.webContents.send('webview-closed'); } });
}

// --- macOS Deep Link Handler ---
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

const fs = require('fs').promises;
ipcMain.handle('show-save-dialog', async (event, options) => { const { dialog } = require('electron'); return await dialog.showSaveDialog(mainWindow, options); });
ipcMain.handle('save-file', async (event, { filePath, content }) => { try { await fs.writeFile(filePath, content, 'utf8'); return true; } catch (error) { console.error('Error saving file:', error); return false; } });
ipcMain.handle('get-path', (event, pathName) => { try { return app.getPath(pathName); } catch (error) { console.error(`Error getting path for ${pathName}:`, error); return null; } });
ipcMain.handle('get-app-path', () => { return app.getAppPath(); });
ipcMain.handle('resolve-app-resource', (event, ...segments) => { return path.join(app.getAppPath(), ...segments); });

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    if (browserHandler) { await browserHandler.cleanup(); }
    if (linkWebView) { try { mainWindow.removeBrowserView(linkWebView); linkWebView.webContents.destroy(); linkWebView = null; } catch (error) { console.error('Error cleaning up linkWebView:', error.message); } }
    if (pythonBridge) { try { pythonBridge.stop(); pythonBridge = null; } catch (error) { console.error('Error stopping Python bridge:', error.message); } }
});