const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const PythonBridge = require('./python-bridge');
const { spawn } = require('child_process');
const http = require('http');

// Register custom protocol for deep linking
if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('aios', process.execPath, [path.resolve(process.argv[1])]);
    }
} else {
    app.setAsDefaultProtocolClient('aios');
}

let mainWindow;
let pythonBridge;

function createWindow() {
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

    // Initialize the Python bridge to connect to the Docker container
    pythonBridge = new PythonBridge(mainWindow);
    console.log('Connecting to Python backend in Docker...');
    pythonBridge.start().catch(error => {
        console.error('Python bridge error:', error.message);
        // Notify the renderer process about the error
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('socket-connection-status', { 
                connected: false,
                error: 'Failed to connect to Python backend: ' + error.message
            });
        });
        
        // Try reconnecting after a delay
        setTimeout(() => {
            console.log('Attempting to reconnect to Python backend...');
            if (pythonBridge) {
                pythonBridge.stop();
            }
            pythonBridge = new PythonBridge(mainWindow);
            pythonBridge.start().catch(err => {
                console.error('Python bridge reconnection failed:', err.message);
            });
        }, 10000);
    });

    ipcMain.on('minimize-window', () => {
        mainWindow.minimize();
    });

    ipcMain.on('toggle-maximize-window', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
        mainWindow.webContents.send('window-state-changed', mainWindow.isMaximized());
    });

    ipcMain.on('close-window', () => {
        mainWindow.close();
    });

    ipcMain.on('deepsearch-request', (event, data) => {
        pythonBridge.sendMessage(data);
    });

    ipcMain.on('check-socket-connection', (event) => {
        const isConnected = pythonBridge.socket && pythonBridge.socket.connected;
        event.reply('socket-connection-status', { connected: isConnected });
    });

    ipcMain.on('restart-python-bridge', () => {
        if (pythonBridge) {
            pythonBridge.stop();
        }
        pythonBridge = new PythonBridge(mainWindow);
        pythonBridge.start().catch(error => {
            console.error('Failed to restart Python bridge:', error);
            mainWindow.webContents.send('socket-connection-status', { 
                connected: false,
                error: 'Failed to connect to Python backend: ' + error.message
            });
        });
    });


}

// Handle deep linking on macOS
app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
});

// Handle deep linking on Windows
function handleDeepLink(url) {
    if (!url || !url.startsWith('aios://')) return;
    
    try {
        // Parse the URL
        const urlObj = new URL(url);
        
        // Check if it's an auth callback
        if (urlObj.hostname === 'auth-callback') {
            const token = urlObj.searchParams.get('token');
            const refreshToken = urlObj.searchParams.get('refresh_token');
            
            if (token && mainWindow) {
                mainWindow.webContents.send('auth-state-changed', { token, refreshToken });
            }
        }
    } catch (error) {
        console.error('Error handling deep link:', error);
    }
}

// File handling IPC handlers for artifact download
const fs = require('fs').promises;

// Handler for showing save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  const { dialog } = require('electron');
  return await dialog.showSaveDialog(mainWindow, options);
});

// Handler for saving file content
ipcMain.handle('save-file', async (event, { filePath, content }) => {
  try {
    await fs.writeFile(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
});

// Path resolution IPC handlers
ipcMain.handle('get-path', (event, pathName) => {
    try {
        return app.getPath(pathName);
    } catch (error) {
        console.error(`Error getting path for ${pathName}:`, error);
        return null;
    }
});

ipcMain.handle('get-app-path', () => {
    return app.getAppPath();
});

ipcMain.handle('resolve-app-resource', (event, ...segments) => {
    return path.join(app.getAppPath(), ...segments);
});

app.whenReady().then(createWindow);

// Handle deep linking on Windows
if (process.platform === 'win32') {
    // For Windows: handle the protocol when app is already running
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
        
        // Check for deep link in command line arguments
        const deepLinkUrl = commandLine.find(arg => arg.startsWith('aios://'));
        if (deepLinkUrl) {
            handleDeepLink(deepLinkUrl);
        }
    });
    
    // For Windows: handle the protocol when app starts
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
    } else {
        // Check for deep link in process.argv
        const deepLinkArg = process.argv.find(arg => arg.startsWith('aios://'));
        if (deepLinkArg) {
            handleDeepLink(deepLinkArg);
        }
    }
}

app.on('window-all-closed', () => {
    // Clean up Python bridge
    if (pythonBridge) {
        try {
            pythonBridge.stop();
            pythonBridge = null;
        } catch (error) {
            console.error('Error stopping Python bridge:', error.message);
        }
    }
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', (event) => {
    // Clean up resources before quitting
    // Make sure Python bridge is properly cleaned up
    if (pythonBridge) {
        try {
            pythonBridge.stop();
            pythonBridge = null;
        } catch (error) {
            console.error('Error stopping Python bridge:', error.message);
        }
    }
});