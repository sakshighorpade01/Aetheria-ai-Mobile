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
    'send-message',
    'check-socket-connection',
    'restart-python-bridge',
    'terminate-session',
    'deepsearch-request',
    // Auth related channels
    'handle-auth-redirect'
];

const validReceiveChannels = [
    'chat-response',
    'socket-error',
    'socket-status',
    'socket-connection-status',
    'agent-step',
    'window-state-changed',
    // Auth related events
    'auth-state-changed'
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
            onAuthChange: (callback) => {
                const wrappedCallback = (user) => callback(user);
                return authService.onAuthChange(wrappedCallback);
            }
        }
    }
);