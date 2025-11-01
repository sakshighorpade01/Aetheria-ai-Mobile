// js/socket-service.js (Updated)

// This service manages the WebSocket connection to the backend.
import { supabase } from './supabase-client.js';

// The backend URL is centralized here - using deployed Render backend
const BACKEND_URL = 'https://aios-web.onrender.com';
let socket = null;

// Store callbacks for different events.
const eventListeners = {
    'response': [],
    'agent_step': [], // <-- NEW: Added listener for agent steps
    'error': [],
    'status': [],
    'connect': [],
    'disconnect': [],
    'sandbox-command-started': [],
    'sandbox-command-finished': [],
    'browser-command': [],
    'image_generated': [],
};

function setupSocketHandlers() {
    socket.on('connect', () => {
        console.log('Successfully connected to backend socket server.');
        emitEvent('connect');
    });

    socket.on('disconnect', () => {
        console.warn('Disconnected from backend socket server.');
        emitEvent('disconnect');
    });

    socket.on('response', (data) => emitEvent('response', data));
    socket.on('agent_step', (data) => emitEvent('agent_step', data)); // <-- NEW: Handle the event
    socket.on('error', (data) => emitEvent('error', data));
    socket.on('status', (data) => emitEvent('status', data));
    socket.on('sandbox-command-started', (data) => emitEvent('sandbox-command-started', data));
    socket.on('sandbox-command-finished', (data) => emitEvent('sandbox-command-finished', data));
    socket.on('browser-command', (data) => emitEvent('browser-command', data));
    socket.on('image_generated', (data) => emitEvent('image_generated', data));
}

function emitEvent(eventName, data) {
    if (eventListeners[eventName]) {
        eventListeners[eventName].forEach(callback => callback(data));
    }
}

export const socketService = {
    /**
     * Initializes the socket connection if it doesn't already exist.
     */
    init: () => {
        // Prevent creating a new socket if one already exists or is connecting.
        if (socket) {
            return;
        }
        
        console.log("Initializing socket connection...");
        // The 'io' function is available globally from the script in index.html
        socket = io(BACKEND_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionDelay: 2000,
            reconnectionAttempts: 5
        });
        setupSocketHandlers();
    },

    /**
     * Sends a message payload to the backend.
     * @param {object} messagePayload - The data to send.
     * @throws {Error} If the socket is not connected or the user is not authenticated.
     */
    sendMessage: async (messagePayload) => {
        if (!socket || !socket.connected) {
            console.error('Socket not connected. Cannot send message.');
            // Throw an error instead of using alert, so the UI can handle it gracefully.
            throw new Error('Not connected to the server. Please wait or refresh.');
        }

        // Get the access token from Supabase to authenticate the request.
        await supabase.auth.refreshSession(); // Ensure the token is fresh
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            console.error('User is not authenticated.');
            // Throw an error for the UI to handle.
            throw new Error('You are not logged in. Please log in to chat.');
        }
        
        // Add the access token to the payload.
        const authenticatedPayload = {
            ...messagePayload,
            accessToken: session.access_token
        };
        
        // The backend expects the entire payload to be a single JSON string.
        socket.emit('send_message', JSON.stringify(authenticatedPayload));
    },

    /**
     * Allows other modules to register a callback for a specific socket event.
     * @param {string} eventName - The name of the event (e.g., 'response', 'error').
     * @param {function} callback - The function to call when the event occurs.
     */
    on: (eventName, callback) => {
        if (eventListeners[eventName]) {
            eventListeners[eventName].push(callback);
        }
    },

    /**
     * Disconnects the socket if it's currently connected.
     */
    disconnect: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }
};