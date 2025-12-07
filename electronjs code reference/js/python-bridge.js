const { ipcMain } = require('electron');
const io = require('socket.io-client');
const config = require('./config');

class PythonBridge {
    constructor(mainWindow, eventEmitter) {
        this.mainWindow = mainWindow;
        this.eventEmitter = eventEmitter;
        this.browserController = null; // <-- FIX: To hold a reference to the browser controller
        this.socket = null;
        this.initialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = config.backend.maxReconnectAttempts;
        this.reconnectDelay = config.backend.reconnectDelay;
        this.ongoingStreams = {};
        this.serverUrl = config.backend.url;
    }

    /**
     * FIX: Adds the missing function to allow main.js to link the modules.
     * @param {BrowserController} controller - The instance of the browser controller.
     */
    setBrowserController(controller) {
        this.browserController = controller;
    }

    async start() {
        console.log(`Connecting to backend server at ${this.serverUrl}...`);
        this.setupIpcHandlers();
        await this.connectWebSocket();
    }

    setupIpcHandlers() {
        // This method is unchanged and correctly handles communication from the renderer.
        ipcMain.on('send-message', (event, data) => {
            this.sendMessage(data);
        });

        ipcMain.on('terminate-session', (event, data) => {
            this.sendMessage({
                type: 'terminate_session',
                message: 'terminate',
                accessToken: data ? data.accessToken : null,
                conversationId: data.conversationId
            });
        });

        ipcMain.on('check-connection-status', () => {
            if (this.socket && this.socket.connected) {
                this.mainWindow.webContents.send('socket-connection-status', { connected: true });
            } else {
                this.mainWindow.webContents.send('socket-connection-status', { connected: false });
            }
        });

        ipcMain.on('restart-python-bridge', () => {
            console.log('Received restart request from renderer');
            this.stop();
            setTimeout(() => this.start(), 1000);
        });

        // Listen for browser command results from the BrowserHandler
        this.eventEmitter.on('browser-command-result', (resultPayload) => {
            console.log('PythonBridge: Received browser-command-result from BrowserHandler:', resultPayload.request_id);
            this.sendBrowserResult(resultPayload);
        });
    }

    async connectWebSocket() {
        // This method is unchanged.
        return new Promise((resolve, reject) => {
            if (this.reconnectAttempts <= 1) {
                console.log(`Connecting to Socket.IO server at ${this.serverUrl}...`);
            }
            this.socket = io(this.serverUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: config.backend.connectionTimeout,
                maxHttpBufferSize: 10 * 1024 * 1024  // 10MB limit to match server
            });
            const connectionTimeout = setTimeout(() => {
                console.error('Socket.IO connection timeout');
                this.socket.disconnect();
                reject(new Error('Socket.IO connection timeout'));
            }, config.backend.connectionTimeout);
            this.socket.on('connect', () => {
                clearTimeout(connectionTimeout);
                console.log(`Connected to Socket.IO server at ${this.serverUrl}`);
                this.initialized = true;
                this.reconnectAttempts = 0;
                this.mainWindow.webContents.send('socket-connection-status', { connected: true });
                resolve();
            });
            this.socket.on('connect_error', (error) => {
                clearTimeout(connectionTimeout);
                if (this.reconnectAttempts <= 1) {
                    console.error('Socket.IO connect error:', error.message);
                }
                this.mainWindow.webContents.send('socket-connection-status', {
                    connected: false,
                    error: error.message
                });
                reject(error);
            });
            this.setupSocketHandlers();
        });
    }

    setupSocketHandlers() {
        // This method is mostly unchanged, but the 'browser-command' handler is now functional.
        this.socket.on('response', (data) => {
            this.mainWindow.webContents.send('chat-response', data);
        });
        this.socket.on('agent_step', (data) => {
            this.mainWindow.webContents.send('agent-step', data);
        });
        this.socket.on('error', (error) => {
            console.error('Socket.IO error:', error.message || error);
            this.mainWindow.webContents.send('socket-error', error);
        });
        this.socket.on('status', (data) => {
            this.mainWindow.webContents.send('socket-status', data);
        });
        this.socket.on('disconnect', () => {
            if (this.initialized) {
                console.log('Socket.IO disconnected');
            }
            this.initialized = false;
            this.mainWindow.webContents.send('socket-connection-status', { connected: false });
            this.handleReconnection();
        });

        this.socket.on('image_generated', (data) => {
            this.mainWindow.webContents.send('image_generated', data);
        });

        // FIX: This handler now correctly forwards the command to the browserController instance.
        this.socket.on('browser-command', (commandPayload) => {
            console.log('PythonBridge: Received browser-command from server:', commandPayload.action);
            if (this.browserController) {
                // Use the event emitter pattern for better decoupling
                console.log('PythonBridge: Emitting execute-browser-command to BrowserHandler');
                this.eventEmitter.emit('execute-browser-command', commandPayload);
            } else {
                console.error('PythonBridge: BrowserController is not linked. Cannot handle browser command.');
            }
        });
    }

    /**
     * FIX: This new method is called by the BrowserController to send results back to the server.
     * @param {object} resultPayload - The payload containing the request_id and result.
     */
    sendBrowserResult(resultPayload) {
        if (this.socket && this.socket.connected) {
            console.log('PythonBridge: Relaying browser command result to server:', resultPayload.request_id);
            this.socket.emit('browser-command-result', resultPayload);
        } else {
            console.error('PythonBridge: Cannot send browser result, socket not connected.');
        }
    }

    async handleReconnection() {
        // This method is unchanged.
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.mainWindow.webContents.send('socket-connection-status', {
                connected: false,
                error: 'Max reconnection attempts reached'
            });
            this.cleanup();
            return;
        }
        this.reconnectAttempts++;
        if (this.reconnectAttempts % 5 === 1 || this.reconnectAttempts === this.maxReconnectAttempts) {
            console.log(`Reconnecting: attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        }
        this.mainWindow.webContents.send('socket-connection-status', {
            connected: false,
            reconnecting: true,
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts
        });
        try {
            await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
            await this.connectWebSocket();
        } catch (error) {
            if (this.reconnectAttempts === 1 || this.reconnectAttempts % 5 === 0) {
                console.error('Reconnection failed:', error.message);
            }
            this.handleReconnection();
        }
    }

    sendMessage(message) {
        // This method is unchanged.
        if (!this.socket || !this.socket.connected) {
            console.error('Socket not connected');
            this.mainWindow.webContents.send('socket-error', {
                message: 'Cannot send message, socket not connected'
            });
            return;
        }
        try {
            this.socket.emit('send_message', JSON.stringify(message));
        } catch (error) {
            console.error('Error sending message:', error);
            this.mainWindow.webContents.send('socket-error', {
                message: 'Error sending message: ' + error.message
            });
        }
    }

    cleanup() {
        // This method is unchanged.
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.initialized = false;
        this.ongoingStreams = {};
    }

    stop() {
        // This method is unchanged.
        this.cleanup();
    }
}

module.exports = PythonBridge;