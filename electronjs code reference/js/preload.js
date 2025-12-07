const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const authService = require('./auth-service');

// Define allowed IPC channels for security
const validSendChannels = [
    'minimize-window',
    'toggle-maximize-window',
    'close-window',
    'open-webview',
    'send-message',
    'webview-navigate',
    'close-webview',
    'resize-webview',
    'drag-webview',
    'check-socket-connection',
    'restart-python-bridge',
    'terminate-session',
    'deepsearch-request',
    // Browse AI related channels
    'open-browse-ai-webview',
    'close-browse-ai-webview',
    'browse-ai-webview-navigate',
    'browse-ai-header-height',
    'browse-ai-send-message',
    'initialize-browser-agent',
    // Auth related channels
    'handle-auth-redirect'
];

const validReceiveChannels = [
    'chat-response',
    'socket-error',
    'socket-status',
    'socket-connection-status',
    'agent-step',
    'image_generated',  // CRITICAL FIX: Allow image_generated events from main process
    'webview-created',
    'webview-closed',
    'webview-navigation-updated',
    'webview-page-loaded',
    'webview-content-captured',
    'window-state-changed',
    'sandbox-command-started',
    'sandbox-command-update',
    'sandbox-command-finished',

    // Browse AI related channels
    'browse-ai-webview-created',
    'browse-ai-webview-closed',
    'browse-ai-webview-navigation-updated',
    'browse-ai-response',
    'browse-ai-error',
    'browse-ai-status',
    'browse-ai-interaction',
    'browse-ai-agent-initialized',
    // Auth related events
    'auth-state-changed',
    'oauth-integration-callback'
];

const validInvokeChannels = [
    'show-save-dialog',
    'save-file',
    'get-path',
    'get-app-path',
    'resolve-app-resource'
];

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld(
    "electron", {
        // IPC functions
        ipcRenderer: {
            send: (channel, data) => {
                if (validSendChannels.includes(channel)) {
                    ipcRenderer.send(channel, data);
                }
            },
            on: (channel, func) => {
                if (validReceiveChannels.includes(channel)) {
                    // Deliberately strip event as it includes sender 
                    ipcRenderer.on(channel, (event, ...args) => func(...args));
                }
            },
            invoke: async (channel, ...args) => {
                if (validInvokeChannels.includes(channel)) {
                    return await ipcRenderer.invoke(channel, ...args);
                }
                return null;
            },
            removeAllListeners: (channel) => {
                if (validReceiveChannels.includes(channel)) {
                    ipcRenderer.removeAllListeners(channel);
                }
            }
        },

        // File system operations
        fs: {
            // Synchronous operations
            existsSync: (path) => fs.existsSync(path),
            readFileSync: (path, options) => fs.readFileSync(path, options),
            writeFileSync: (path, data, options) => fs.writeFileSync(path, data, options),
            unlinkSync: (path) => fs.unlinkSync(path),
            mkdirSync: (path, options) => fs.mkdirSync(path, options),
            readdirSync: (path, options) => fs.readdirSync(path, options),
            statSync: (path, options) => {
                const stat = fs.statSync(path, options);
                return {
                    isFile: () => stat.isFile(),
                    isDirectory: () => stat.isDirectory(),
                    mtime: stat.mtime,
                    size: stat.size
                };
            },

            // Promise-based operations
            promises: {
                readFile: async (path, options) => await fs.promises.readFile(path, options),
                writeFile: async (path, data, options) => await fs.promises.writeFile(path, data, options),
                unlink: async (path) => await fs.promises.unlink(path),
                mkdir: async (path, options) => await fs.promises.mkdir(path, options),
                readdir: async (path, options) => await fs.promises.readdir(path, options),
                stat: async (path, options) => {
                    const stat = await fs.promises.stat(path, options);
                    return {
                        isFile: () => stat.isFile(),
                        isDirectory: () => stat.isDirectory(),
                        mtime: stat.mtime,
                        size: stat.size
                    };
                }
            }
        },

        // Path operations
        path: {
            join: (...paths) => path.join(...paths),
            basename: (path, ext) => path.basename(path, ext),
            dirname: (path) => path.dirname(path),
            extname: (path) => path.extname(path),
            resolve: (...paths) => path.resolve(...paths),
            isAbsolute: (path) => path.isAbsolute(path)
        },

        // Child process operations
        childProcess: {
            spawn: (command, args, options) => {
                const childProcess = spawn(command, args, options);

                // Return a simplified API that works across contextBridge
                return {
                    pid: childProcess.pid,
                    stdout: {
                        on: (event, callback) => {
                            if (event === 'data') {
                                childProcess.stdout.on('data', (data) => {
                                    callback(data.toString());
                                });
                            }
                        }
                    },
                    stderr: {
                        on: (event, callback) => {
                            if (event === 'data') {
                                childProcess.stderr.on('data', (data) => {
                                    callback(data.toString());
                                });
                            }
                        }
                    },
                    on: (event, callback) => {
                        if (['close', 'exit', 'error'].includes(event)) {
                            childProcess.on(event, callback);
                        }
                    },
                    kill: (signal) => childProcess.kill(signal)
                };
            }
        },

        // Auth service
        auth: {
            init: async () => await authService.init(),
            signUp: async (email, password, name) => await authService.signUp(email, password, name),
            signIn: async (email, password) => await authService.signIn(email, password),
            signOut: async () => await authService.signOut(),
            getCurrentUser: () => authService.getCurrentUser(),
            isAuthenticated: () => authService.isAuthenticated(),
            getSession: async () => await authService.getSession(),
            fetchUserSessions: async (limit) => await authService.fetchUserSessions(limit),
            fetchSessionTitles: async (limit) => await authService.fetchSessionTitles(limit),
            fetchSessionData: async (sessionId) => await authService.fetchSessionData(sessionId),
            fetchSessionAttachments: async (sessionId) => await authService.fetchSessionAttachments(sessionId),
            onAuthChange: (callback) => {
                const wrappedCallback = (user) => callback(user);
                return authService.onAuthChange(wrappedCallback);
            },
            // Expose Supabase client methods for attachment persistence
            insertAttachments: async (records) => {
                if (!authService.supabase) {
                    throw new Error('Supabase client not initialized');
                }
                return await authService.supabase.from('attachment').insert(records);
            }
        },

        // Local File Archive Service
        fileArchive: {
            /**
             * Saves a file to the local archive and returns the relative path
             * @param {File} file - Browser File object
             * @returns {Promise<{relativePath: string, fullPath: string}>}
             */
            saveFile: async (file) => {
                try {
                    // Get userData path
                    const userDataPath = await ipcRenderer.invoke('get-path', 'userData');
                    if (!userDataPath) {
                        throw new Error('Could not get userData path');
                    }

                    // Generate unique directory for this file
                    const fileId = crypto.randomUUID();
                    const archiveDir = path.join(userDataPath, 'attachments', fileId);
                    
                    // Create directory if it doesn't exist
                    if (!fs.existsSync(archiveDir)) {
                        fs.mkdirSync(archiveDir, { recursive: true });
                    }

                    // Full path for the file
                    const fullPath = path.join(archiveDir, file.name);
                    
                    // Read file as ArrayBuffer and convert to Buffer
                    const arrayBuffer = await file.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    // Write file to disk
                    await fs.promises.writeFile(fullPath, buffer);
                    
                    // Return relative path (from userData) and full path
                    const relativePath = path.join('attachments', fileId, file.name);
                    
                    return { relativePath, fullPath };
                } catch (error) {
                    console.error('Error saving file to local archive:', error);
                    throw error;
                }
            },

            /**
             * Resolves a relative path to a full absolute path
             * @param {string} relativePath - Relative path from userData
             * @returns {Promise<string>} Full absolute path
             */
            resolvePath: async (relativePath) => {
                try {
                    const userDataPath = await ipcRenderer.invoke('get-path', 'userData');
                    if (!userDataPath) {
                        throw new Error('Could not get userData path');
                    }
                    return path.join(userDataPath, relativePath);
                } catch (error) {
                    console.error('Error resolving path:', error);
                    throw error;
                }
            },

            /**
             * Reads a file from the local archive
             * @param {string} relativePath - Relative path from userData
             * @returns {Promise<Buffer>} File contents as Buffer
             */
            readFile: async (relativePath) => {
                try {
                    const fullPath = await ipcRenderer.invoke('get-path', 'userData');
                    if (!fullPath) {
                        throw new Error('Could not get userData path');
                    }
                    const filePath = path.join(fullPath, relativePath);
                    return await fs.promises.readFile(filePath);
                } catch (error) {
                    console.error('Error reading file from archive:', error);
                    throw error;
                }
            },

            /**
             * Checks if a file exists in the local archive
             * @param {string} relativePath - Relative path from userData
             * @returns {Promise<boolean>}
             */
            fileExists: async (relativePath) => {
                try {
                    const userDataPath = await ipcRenderer.invoke('get-path', 'userData');
                    if (!userDataPath) {
                        return false;
                    }
                    const filePath = path.join(userDataPath, relativePath);
                    return fs.existsSync(filePath);
                } catch (error) {
                    console.error('Error checking file existence:', error);
                    return false;
                }
            },

            /**
             * Opens a file with the system's default application
             * @param {string} relativePath - Relative path from userData
             * @returns {Promise<void>}
             */
            openFile: async (relativePath) => {
                try {
                    const userDataPath = await ipcRenderer.invoke('get-path', 'userData');
                    if (!userDataPath) {
                        throw new Error('Could not get userData path');
                    }
                    const filePath = path.join(userDataPath, relativePath);
                    
                    // Use shell.openPath via IPC
                    const { shell } = require('electron');
                    await shell.openPath(filePath);
                } catch (error) {
                    console.error('Error opening file:', error);
                    throw error;
                }
            }
        }
    }
);