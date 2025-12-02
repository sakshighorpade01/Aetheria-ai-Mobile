// js/audio-input.js
// Hold-to-Record Audio Input Handler for Mobile PWA

import messageActions from './message-actions.js';
import NotificationService from './notification-service.js';

/**
 * AudioInputHandler - Manages voice input with hold-to-record functionality
 * 
 * Features:
 * - Short tap: Send message (existing behavior)
 * - Long press: Start voice recording
 * - Release: Stop recording and append transcription to input
 * - Visual feedback with heartbeat animation
 * - Haptic feedback on mobile devices
 */
class AudioInputHandler {
    constructor(config = {}) {
        this.inputElement = config.inputElement || document.getElementById('floating-input');
        this.sendButton = config.sendButton || document.getElementById('send-message');
        this.onSendCallback = config.onSend || null;
        
        // Speech recognition setup
        this.recognition = null;
        this.isRecording = false;
        this.isLongPress = false;
        
        // Long press timing
        this.longPressThreshold = 500; // ms
        this.pressTimer = null;
        this.touchStartTime = 0;
        
        // Notification service
        this.notificationService = config.notificationService || new NotificationService();
        
        // Initialize
        this.initializeSpeechRecognition();
        this.bindEvents();
    }

    /**
     * Initialize Web Speech API
     */
    initializeSpeechRecognition() {
        // Check for Speech Recognition API support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('Speech Recognition API not supported in this browser');
            return;
        }

        try {
            this.recognition = new SpeechRecognition();
            
            // Configure recognition
            this.recognition.continuous = false; // Stop after one result
            this.recognition.interimResults = true; // Show interim results
            this.recognition.lang = 'en-US'; // Default language
            this.recognition.maxAlternatives = 1;

            // Event handlers
            this.recognition.onstart = () => this.handleRecognitionStart();
            this.recognition.onresult = (event) => this.handleRecognitionResult(event);
            this.recognition.onerror = (event) => this.handleRecognitionError(event);
            this.recognition.onend = () => this.handleRecognitionEnd();
            
            console.log('Speech Recognition initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Speech Recognition:', error);
        }
    }

    /**
     * Bind touch and mouse events to send button
     */
    bindEvents() {
        if (!this.sendButton) {
            console.error('Send button not found');
            return;
        }

        // Remove existing click listener if any (we'll handle it ourselves)
        // Note: This assumes the click listener was added via addEventListener
        
        // Touch events (mobile)
        this.sendButton.addEventListener('touchstart', (e) => this.handlePressStart(e), { passive: false });
        this.sendButton.addEventListener('touchend', (e) => this.handlePressEnd(e), { passive: false });
        this.sendButton.addEventListener('touchcancel', (e) => this.handlePressCancel(e), { passive: false });
        this.sendButton.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        
        // Mouse events (desktop fallback)
        this.sendButton.addEventListener('mousedown', (e) => this.handlePressStart(e));
        this.sendButton.addEventListener('mouseup', (e) => this.handlePressEnd(e));
        this.sendButton.addEventListener('mouseleave', (e) => this.handlePressCancel(e));
        
        console.log('Audio input events bound to send button');
    }

    /**
     * Handle press start (touch or mouse down)
     */
    handlePressStart(event) {
        // Prevent default to avoid unwanted behaviors
        event.preventDefault();
        
        this.touchStartTime = Date.now();
        this.isLongPress = false;
        
        // Start timer for long press detection
        this.pressTimer = setTimeout(() => {
            this.isLongPress = true;
            this.startRecording();
        }, this.longPressThreshold);
    }

    /**
     * Handle press end (touch or mouse up)
     */
    handlePressEnd(event) {
        event.preventDefault();
        
        const pressDuration = Date.now() - this.touchStartTime;
        
        // Clear the timer
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
        
        if (this.isLongPress) {
            // Long press: Stop recording
            this.stopRecording();
        } else if (pressDuration < this.longPressThreshold) {
            // Short tap: Send message
            this.handleShortTap();
        }
        
        // Reset state
        this.isLongPress = false;
    }

    /**
     * Handle press cancel (touch cancel or mouse leave)
     */
    handlePressCancel(event) {
        // Clear timer
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
            this.pressTimer = null;
        }
        
        // If recording, stop it
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.isLongPress = false;
    }

    /**
     * Handle touch move (detect if finger slides off button)
     */
    handleTouchMove(event) {
        if (!this.isRecording) return;
        
        const touch = event.touches[0];
        const buttonRect = this.sendButton.getBoundingClientRect();
        
        // Check if touch is still within button bounds
        const isInside = (
            touch.clientX >= buttonRect.left &&
            touch.clientX <= buttonRect.right &&
            touch.clientY >= buttonRect.top &&
            touch.clientY <= buttonRect.bottom
        );
        
        // If finger slides off, cancel recording
        if (!isInside) {
            this.handlePressCancel(event);
        }
    }

    /**
     * Handle short tap - send message
     */
    handleShortTap() {
        // Trigger haptic feedback
        messageActions.triggerHaptic('light');
        
        // Call the send callback if provided
        if (this.onSendCallback && typeof this.onSendCallback === 'function') {
            this.onSendCallback();
        }
    }

    /**
     * Start voice recording
     */
    async startRecording() {
        if (!this.recognition) {
            this.notificationService.show(
                'Voice input not supported in this browser',
                'error',
                3000
            );
            return;
        }

        if (this.isRecording) {
            return;
        }

        // Check HTTPS requirement
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
            this.notificationService.show(
                'Voice input requires HTTPS',
                'error',
                3000
            );
            return;
        }

        // Request microphone permission explicitly first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Stop the stream immediately - we just needed permission
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.error('Microphone permission denied:', error);
            this.notificationService.show(
                'Microphone access denied. Please allow microphone in browser settings.',
                'error',
                5000
            );
            this.isRecording = false;
            this.sendButton.classList.remove('is-recording');
            return;
        }

        try {
            // Start recognition
            this.recognition.start();
            this.isRecording = true;
            
            // Visual feedback
            this.sendButton.classList.add('is-recording');
            
            // Haptic feedback
            messageActions.triggerHaptic('medium');
            
            console.log('Voice recording started');
        } catch (error) {
            console.error('Failed to start recording:', error);
            this.notificationService.show(
                'Failed to start voice input',
                'error',
                3000
            );
            this.isRecording = false;
            this.sendButton.classList.remove('is-recording');
        }
    }

    /**
     * Stop voice recording
     */
    stopRecording() {
        if (!this.recognition || !this.isRecording) {
            return;
        }

        try {
            this.recognition.stop();
            
            // Visual feedback
            this.sendButton.classList.remove('is-recording');
            
            // Haptic feedback
            messageActions.triggerHaptic('medium');
            
            console.log('Voice recording stopped');
        } catch (error) {
            console.error('Failed to stop recording:', error);
        }
    }

    /**
     * Handle recognition start
     */
    handleRecognitionStart() {
        console.log('Speech recognition started');
    }

    /**
     * Handle recognition result
     */
    handleRecognitionResult(event) {
        if (!event.results || event.results.length === 0) {
            return;
        }

        // Get the latest result
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        
        // Only append final results to avoid duplicates
        if (result.isFinal) {
            this.appendTranscriptToInput(transcript);
        }
    }

    /**
     * Handle recognition error
     */
    handleRecognitionError(event) {
        console.error('Speech recognition error:', event.error);
        
        this.isRecording = false;
        this.sendButton.classList.remove('is-recording');
        
        // User-friendly error messages
        let errorMessage = 'Voice input error';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected. Please try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not available';
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied';
                break;
            case 'network':
                errorMessage = 'Network error. Please check your connection.';
                break;
            case 'aborted':
                // User cancelled, don't show error
                return;
            default:
                errorMessage = `Voice input error: ${event.error}`;
        }
        
        this.notificationService.show(errorMessage, 'error', 3000);
    }

    /**
     * Handle recognition end
     */
    handleRecognitionEnd() {
        console.log('Speech recognition ended');
        this.isRecording = false;
        this.sendButton.classList.remove('is-recording');
    }

    /**
     * Append transcript to input field
     */
    appendTranscriptToInput(transcript) {
        if (!this.inputElement || !transcript) {
            return;
        }

        const currentValue = this.inputElement.value;
        const trimmedTranscript = transcript.trim();
        
        if (!trimmedTranscript) {
            return;
        }

        // Smart spacing: add space if input is not empty
        const newValue = currentValue
            ? `${currentValue} ${trimmedTranscript}`
            : trimmedTranscript;
        
        this.inputElement.value = newValue;
        
        // Dispatch input event to trigger auto-resize
        const inputEvent = new Event('input', { bubbles: true });
        this.inputElement.dispatchEvent(inputEvent);
        
        // Focus input
        this.inputElement.focus();
        
        console.log('Transcript appended:', trimmedTranscript);
    }

    /**
     * Set the send callback
     */
    setOnSendCallback(callback) {
        if (typeof callback === 'function') {
            this.onSendCallback = callback;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        // Stop recording if active
        if (this.isRecording) {
            this.stopRecording();
        }
        
        // Clear timer
        if (this.pressTimer) {
            clearTimeout(this.pressTimer);
        }
        
        // Remove event listeners
        if (this.sendButton) {
            this.sendButton.removeEventListener('touchstart', this.handlePressStart);
            this.sendButton.removeEventListener('touchend', this.handlePressEnd);
            this.sendButton.removeEventListener('touchcancel', this.handlePressCancel);
            this.sendButton.removeEventListener('touchmove', this.handleTouchMove);
            this.sendButton.removeEventListener('mousedown', this.handlePressStart);
            this.sendButton.removeEventListener('mouseup', this.handlePressEnd);
            this.sendButton.removeEventListener('mouseleave', this.handlePressCancel);
        }
        
        // Cleanup recognition
        if (this.recognition) {
            this.recognition.abort();
            this.recognition = null;
        }
    }
}

export default AudioInputHandler;
