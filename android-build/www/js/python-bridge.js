const { ipcMain } = require('electron');
const io = require('socket.io-client');
const config = require('./config');

class PythonBridge {
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.socket = null;
        this.initialized = false;
        this.reconnectAttempts = 10;
        this.maxReconnectAttempts = config.backend.maxReconnectAttempts;
        this.reconnectDelay = config.backend.reconnectDelay;
        this.ongoingStreams = {};

        // Get configuration for the Docker container from config.js
        this.serverUrl = config.backend.url;
    }

    async start() {
        console.log(`Connecting to Docker container at ${this.serverUrl}...`);
        this.setupIpcHandlers();
        await this.connectWebSocket();
    }

    setupIpcHandlers() {
        // Handle messages from chat.js to send to Python backend
        ipcMain.on('send-message', (event, data) => {
            this.sendMessage(data);
        });

        // Handle session termination requests, now with authentication data
        ipcMain.on('terminate-session', (event, data) => {
            this.sendMessage({
                type: 'terminate_session',
                message: 'terminate',
                // Pass the accessToken from the data object received from chat.js
                accessToken: data ? data.accessToken : null
            });
        });

        // Legacy handler for backward compatibility
        ipcMain.on('python-message', (event, message) => {
            this.sendMessage(message);
        });

        ipcMain.on('check-connection-status', () => {
            if (this.socket && this.socket.connected) {
                this.mainWindow.webContents.send('socket-connect');
            } else {
                this.mainWindow.webContents.send('socket-disconnect');
            }
        });

        ipcMain.on('restart-python-bridge', () => {
            console.log('Received restart request from renderer');
            this.stop();
            setTimeout(() => this.start(), 1000);
        });
    }

    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            // Only log first connection attempt
            if (this.reconnectAttempts <= 1) {
                console.log(`Connecting to Socket.IO server at ${this.serverUrl}...`);
            }

            this.socket = io(this.serverUrl, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: config.backend.connectionTimeout
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
                // Only log detailed error on first attempt
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
        // Handle final response messages from Python backend
        this.socket.on('response', (data) => {
            this.mainWindow.webContents.send('chat-response', data);
        });

        // --- NEW: Handle intermediate agent steps ---
        this.socket.on('agent_step', (data) => {
            this.mainWindow.webContents.send('agent-step', data);
        });
        // --- END NEW ---

        // Handle critical errors
        this.socket.on('error', (error) => {
            if (typeof error === 'object') {
                console.error('Socket.IO error:', error.message || 'Unknown error');
            } else {
                console.error('Socket.IO error:', error);
            }
            this.mainWindow.webContents.send('socket-error', error);
        });

        // Handle status messages
        this.socket.on('status', (data) => {
            this.mainWindow.webContents.send('socket-status', data);
        });

        // Handle disconnection
        this.socket.on('disconnect', () => {
            if (this.initialized) {
                console.log('Socket.IO disconnected');
            }
            this.initialized = false;
            this.mainWindow.webContents.send('socket-connection-status', { connected: false });
            this.handleReconnection();
        });
    }

    async handleReconnection() {
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
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.initialized = false;
        this.ongoingStreams = {};
    }

    stop() {
        this.cleanup();
    }
}

module.exports = PythonBridge;