// js/audio-input.js
// Slide-to-Record Audio Input Handler with Real-Time Visualization

/**
 * AudioInputHandler - Manages voice input with slide-to-record functionality
 * 
 * Features:
 * - Short tap: Send message (existing behavior)
 * - Slide left: Start voice recording with real-time visualization
 * - Release: Stop recording and append transcription to input
 * - Visual feedback with animated audio bars
 * - iOS Safari compatible
 */
class AudioInputHandler {
    constructor(config = {}) {
        this.inputElement = config.inputElement || document.getElementById('floating-input');
        this.sendButton = config.sendButton || document.getElementById('send-message');
        this.onSendCallback = config.onSend || null;
        
        // Speech recognition setup
        this.recognition = null;
        this.isRecording = false;
        
        // Gesture tracking
        this.isDragging = false;
        this.recordingStarted = false; // Prevent multiple triggers during same drag
        this.startX = 0;
        this.currentX = 0;
        this.slideThreshold = 50; // pixels to slide before activating
        
        // Audio visualization
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.microphoneStream = null;
        this.animationFrameId = null;
        this.visualizerBars = [];
        
        // Initialize
        this.initializeSpeechRecognition();
        this.setupVisualizerDOM();
        this.bindEvents();
        
        console.log('[AudioInput] Initialized');
    }

    /**
     * Initialize Web Speech API
     */
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.warn('[AudioInput] Speech Recognition API not supported');
            return;
        }

        try {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            this.recognition.maxAlternatives = 1;

            this.recognition.onstart = () => this.handleRecognitionStart();
            this.recognition.onresult = (event) => this.handleRecognitionResult(event);
            this.recognition.onerror = (event) => this.handleRecognitionError(event);
            this.recognition.onend = () => this.handleRecognitionEnd();
            
            console.log('[AudioInput] Speech Recognition initialized');
        } catch (error) {
            console.error('[AudioInput] Failed to initialize Speech Recognition:', error);
        }
    }

    /**
     * Setup visualizer DOM structure inside send button
     */
    setupVisualizerDOM() {
        if (!this.sendButton) {
            console.error('[AudioInput] Send button not found');
            return;
        }

        // Create visualizer container
        const visualizer = document.createElement('div');
        visualizer.className = 'audio-visualizer';
        visualizer.innerHTML = `
            <div class="visualizer-bar"></div>
            <div class="visualizer-bar"></div>
            <div class="visualizer-bar"></div>
            <div class="visualizer-bar"></div>
            <div class="visualizer-bar"></div>
        `;
        
        this.sendButton.appendChild(visualizer);
        this.visualizerBars = visualizer.querySelectorAll('.visualizer-bar');
        
        console.log('[AudioInput] Visualizer DOM created');
    }

    /**
     * Bind touch and mouse events to send button
     */
    bindEvents() {
        if (!this.sendButton) {
            console.error('[AudioInput] Send button not found');
            return;
        }

        // Touch events (mobile)
        this.sendButton.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.sendButton.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.sendButton.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.sendButton.addEventListener('touchcancel', (e) => this.handleTouchCancel(e), { passive: false });
        
        // Mouse events (desktop)
        this.sendButton.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.sendButton.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.sendButton.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.sendButton.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        
        console.log('[AudioInput] Events bound');
    }

    // ==================== TOUCH HANDLERS ====================
    
    handleTouchStart(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const touch = event.touches[0];
        this.startX = touch.clientX;
        this.currentX = touch.clientX;
        this.isDragging = true;
        this.recordingStarted = false; // Reset flag
        
        console.log('[AudioInput] Touch start at X:', this.startX);
        
        // Haptic feedback (if available)
        this.triggerHaptic('light');
    }

    handleTouchMove(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const touch = event.touches[0];
        this.currentX = touch.clientX;
        const deltaX = this.startX - this.currentX; // Positive when sliding left
        
        console.log('[AudioInput] Touch move - deltaX:', deltaX);
        
        // Apply transform to button (visual feedback) - only horizontal movement
        if (deltaX > 0) {
            const translateAmount = Math.min(deltaX, 100);
            this.sendButton.style.transform = `translateX(-${translateAmount}px) translateY(0)`;
            console.log('[AudioInput] Button transform:', `-${translateAmount}px`);
        } else {
            this.sendButton.style.transform = 'translateX(0) translateY(0)';
        }
        
        // Only trigger once when threshold is crossed
        if (deltaX >= this.slideThreshold && !this.isRecording && !this.recordingStarted) {
            console.log('[AudioInput] Threshold reached! Starting recording...');
            this.recordingStarted = true; // Prevent multiple triggers
            this.startRecording();
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.isDragging) return;
        
        const deltaX = this.startX - this.currentX;
        
        console.log('[AudioInput] Touch end - deltaX:', deltaX, 'isRecording:', this.isRecording);
        
        // Reset button position with smooth animation
        this.sendButton.style.transform = 'translateX(0) translateY(0)';
        
        if (this.isRecording) {
            // Stop recording
            console.log('[AudioInput] Stopping recording...');
            this.stopRecording();
        } else if (deltaX < this.slideThreshold) {
            // Short tap - send message
            console.log('[AudioInput] Short tap detected - sending message');
            this.handleShortTap();
        }
        
        this.isDragging = false;
    }

    handleTouchCancel(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('[AudioInput] Touch cancelled');
        
        this.sendButton.style.transform = 'translateX(0) translateY(0)';
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.isDragging = false;
    }

    // ==================== MOUSE HANDLERS ====================
    
    handleMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.startX = event.clientX;
        this.currentX = event.clientX;
        this.isDragging = true;
        this.recordingStarted = false; // Reset flag
        
        console.log('[AudioInput] Mouse down at X:', this.startX);
    }

    handleMouseMove(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        this.currentX = event.clientX;
        const deltaX = this.startX - this.currentX;
        
        console.log('[AudioInput] Mouse move - deltaX:', deltaX);
        
        if (deltaX > 0) {
            const translateAmount = Math.min(deltaX, 100);
            this.sendButton.style.transform = `translateX(-${translateAmount}px) translateY(0)`;
            console.log('[AudioInput] Button transform:', `-${translateAmount}px`);
        } else {
            this.sendButton.style.transform = 'translateX(0) translateY(0)';
        }
        
        // Only trigger once when threshold is crossed
        if (deltaX >= this.slideThreshold && !this.isRecording && !this.recordingStarted) {
            console.log('[AudioInput] Threshold reached! Starting recording...');
            this.recordingStarted = true; // Prevent multiple triggers
            this.startRecording();
        }
    }

    handleMouseUp(event) {
        if (!this.isDragging) return;
        
        event.preventDefault();
        event.stopPropagation();
        
        const deltaX = this.startX - this.currentX;
        
        console.log('[AudioInput] Mouse up - deltaX:', deltaX, 'isRecording:', this.isRecording);
        
        this.sendButton.style.transform = 'translateX(0) translateY(0)';
        
        if (this.isRecording) {
            console.log('[AudioInput] Stopping recording...');
            this.stopRecording();
        } else if (deltaX < this.slideThreshold) {
            console.log('[AudioInput] Short click detected - sending message');
            this.handleShortTap();
        }
        
        this.isDragging = false;
    }

    handleMouseLeave(event) {
        if (!this.isDragging) return;
        
        console.log('[AudioInput] Mouse leave - cancelling drag');
        
        this.sendButton.style.transform = 'translateX(0) translateY(0)';
        
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.isDragging = false;
    }

    // ==================== RECORDING LOGIC ====================
    
    handleShortTap() {
        this.triggerHaptic('light');
        
        if (this.onSendCallback && typeof this.onSendCallback === 'function') {
            this.onSendCallback();
        }
    }

    async startRecording() {
        console.log('[AudioInput] startRecording() called');
        
        if (!this.recognition) {
            console.error('[AudioInput] Speech recognition not available');
            this.showNotification('Voice input not supported in this browser', 'error');
            return;
        }

        if (this.isRecording) {
            console.warn('[AudioInput] Already recording, ignoring');
            return;
        }

        try {
            console.log('[AudioInput] Starting speech recognition...');
            
            // Start speech recognition
            this.recognition.start();
            this.isRecording = true;
            
            console.log('[AudioInput] Speech recognition started, adding visual feedback...');
            
            // Visual feedback - hide plane, show visualizer
            this.sendButton.classList.add('is-recording');
            
            // Haptic feedback
            this.triggerHaptic('medium');
            
            console.log('[AudioInput] Initializing audio visualization...');
            
            // Initialize audio visualization
            await this.initializeAudioVisualization();
            
            console.log('[AudioInput] ✅ Recording started successfully');
        } catch (error) {
            console.error('[AudioInput] ❌ Failed to start recording:', error);
            console.error('[AudioInput] Error name:', error.name);
            console.error('[AudioInput] Error message:', error.message);
            this.showNotification('Failed to start voice input: ' + error.message, 'error');
            this.isRecording = false;
            this.sendButton.classList.remove('is-recording');
        }
    }

    stopRecording() {
        if (!this.recognition || !this.isRecording) return;

        try {
            this.recognition.stop();
            this.sendButton.classList.remove('is-recording');
            this.triggerHaptic('medium');
            
            // Stop audio visualization
            this.stopAudioVisualization();
            
            console.log('[AudioInput] Recording stopped');
        } catch (error) {
            console.error('[AudioInput] Failed to stop recording:', error);
        }
    }

    // ==================== AUDIO VISUALIZATION ====================
    
    async initializeAudioVisualization() {
        console.log('[AudioInput] initializeAudioVisualization() called');
        
        try {
            // Check if getUserMedia is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('[AudioInput] getUserMedia not available');
                console.error('[AudioInput] navigator.mediaDevices:', navigator.mediaDevices);
                console.error('[AudioInput] This usually means:');
                console.error('[AudioInput] 1. Page is not served over HTTPS or localhost');
                console.error('[AudioInput] 2. Browser does not support getUserMedia');
                
                // Try legacy getUserMedia as fallback
                const legacyGetUserMedia = navigator.getUserMedia || 
                                          navigator.webkitGetUserMedia || 
                                          navigator.mozGetUserMedia;
                
                if (!legacyGetUserMedia) {
                    throw new Error('getUserMedia is not supported. Please use HTTPS or localhost.');
                }
                
                console.log('[AudioInput] Using legacy getUserMedia...');
                // We'll skip visualization but continue with speech recognition
                console.warn('[AudioInput] Skipping audio visualization (getUserMedia not available)');
                return;
            }
            
            // Create AudioContext (iOS requires user interaction)
            if (!this.audioContext) {
                console.log('[AudioInput] Creating AudioContext...');
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContext();
                console.log('[AudioInput] AudioContext created, state:', this.audioContext.state);
            }
            
            // Resume context (required for iOS)
            if (this.audioContext.state === 'suspended') {
                console.log('[AudioInput] AudioContext suspended, resuming...');
                await this.audioContext.resume();
                console.log('[AudioInput] AudioContext resumed, state:', this.audioContext.state);
            }
            
            console.log('[AudioInput] Requesting microphone access...');
            
            // Get microphone stream
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            console.log('[AudioInput] ✅ Microphone access granted');
            
            // Create analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 32; // Small FFT for 5 bars
            this.analyser.smoothingTimeConstant = 0.8;
            
            console.log('[AudioInput] Analyser created, FFT size:', this.analyser.fftSize);
            
            // Connect microphone to analyser
            this.microphone = this.audioContext.createMediaStreamSource(this.microphoneStream);
            this.microphone.connect(this.analyser);
            
            console.log('[AudioInput] Microphone connected to analyser');
            
            // Start visualization loop
            this.startVisualizationLoop();
            
            console.log('[AudioInput] ✅ Audio visualization initialized successfully');
        } catch (error) {
            console.error('[AudioInput] ❌ Failed to initialize audio visualization:', error);
            console.error('[AudioInput] Error name:', error.name);
            console.error('[AudioInput] Error message:', error.message);
            
            if (error.name === 'NotAllowedError') {
                this.showNotification('Microphone permission denied', 'error');
            } else if (error.name === 'NotFoundError') {
                this.showNotification('No microphone found', 'error');
            } else {
                this.showNotification('Audio error: ' + error.message, 'error');
            }
        }
    }

    startVisualizationLoop() {
        if (!this.analyser || !this.isRecording) {
            console.warn('[AudioInput] Cannot start visualization - analyser or recording not ready');
            return;
        }
        
        console.log('[AudioInput] Starting visualization loop...');
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        console.log('[AudioInput] Buffer length:', bufferLength);
        console.log('[AudioInput] Visualizer bars count:', this.visualizerBars.length);
        
        let frameCount = 0;
        
        const animate = () => {
            if (!this.isRecording) {
                console.log('[AudioInput] Stopping visualization loop (not recording)');
                return;
            }
            
            this.animationFrameId = requestAnimationFrame(animate);
            
            // Get frequency data
            this.analyser.getByteFrequencyData(dataArray);
            
            // Log first frame for debugging
            if (frameCount === 0) {
                console.log('[AudioInput] First frame data:', Array.from(dataArray).slice(0, 5));
            }
            
            // Update visualizer bars (use first 5 frequency bins)
            this.visualizerBars.forEach((bar, index) => {
                const value = dataArray[index] || 0;
                const height = Math.max(20, (value / 255) * 100); // 20% to 100%
                bar.style.height = `${height}%`;
            });
            
            frameCount++;
            
            // Log every 60 frames (roughly 1 second at 60fps)
            if (frameCount % 60 === 0) {
                console.log('[AudioInput] Visualization running... frame:', frameCount);
            }
        };
        
        animate();
        console.log('[AudioInput] ✅ Visualization loop started');
    }

    stopAudioVisualization() {
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Stop microphone stream
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        
        // Disconnect microphone
        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone = null;
        }
        
        // Reset visualizer bars
        this.visualizerBars.forEach((bar, index) => {
            // Reset to asymmetrical default heights
            const defaultHeights = [30, 50, 40, 60, 35];
            bar.style.height = `${defaultHeights[index]}%`;
        });
        
        // Keep AudioContext alive for next use (don't close it)
    }

    // ==================== RECOGNITION HANDLERS ====================
    
    handleRecognitionStart() {
        console.log('[AudioInput] 🎤 Speech recognition started (listening...)');
    }

    handleRecognitionResult(event) {
        console.log('[AudioInput] Recognition result received');
        
        if (!event.results || event.results.length === 0) {
            console.warn('[AudioInput] No results in event');
            return;
        }

        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        
        console.log('[AudioInput] Transcript:', transcript);
        console.log('[AudioInput] Confidence:', confidence);
        console.log('[AudioInput] Is final:', result.isFinal);
        
        // Only append final results
        if (result.isFinal) {
            console.log('[AudioInput] ✅ Final result - appending to input');
            this.appendTranscriptToInput(transcript);
        } else {
            console.log('[AudioInput] Interim result - waiting for final...');
        }
    }

    handleRecognitionError(event) {
        console.error('[AudioInput] ❌ Speech recognition error:', event.error);
        console.error('[AudioInput] Error details:', event);
        
        this.isRecording = false;
        this.sendButton.classList.remove('is-recording');
        this.stopAudioVisualization();
        
        let errorMessage = 'Voice input error';
        
        switch (event.error) {
            case 'no-speech':
                errorMessage = 'No speech detected';
                console.warn('[AudioInput] No speech was detected');
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not available';
                console.error('[AudioInput] Could not capture audio from microphone');
                break;
            case 'not-allowed':
                errorMessage = 'Microphone permission denied';
                console.error('[AudioInput] Microphone permission was denied');
                break;
            case 'network':
                errorMessage = 'Network error';
                console.error('[AudioInput] Network error occurred');
                break;
            case 'aborted':
                console.log('[AudioInput] Recognition aborted by user');
                return; // User cancelled, don't show error
            default:
                errorMessage = `Voice input error: ${event.error}`;
                console.error('[AudioInput] Unknown error:', event.error);
        }
        
        this.showNotification(errorMessage, 'error');
    }

    handleRecognitionEnd() {
        console.log('[AudioInput] 🛑 Speech recognition ended');
        this.isRecording = false;
        this.sendButton.classList.remove('is-recording');
        this.stopAudioVisualization();
    }

    appendTranscriptToInput(transcript) {
        if (!this.inputElement || !transcript) return;

        const currentValue = this.inputElement.value;
        const trimmedTranscript = transcript.trim();
        
        if (!trimmedTranscript) return;

        // Smart spacing - add space if input is not empty
        const newValue = currentValue
            ? `${currentValue} ${trimmedTranscript}`
            : trimmedTranscript;
        
        this.inputElement.value = newValue;
        
        // Trigger auto-resize by dispatching input event
        const inputEvent = new Event('input', { bubbles: true });
        this.inputElement.dispatchEvent(inputEvent);
        
        this.inputElement.focus();
        
        console.log('[AudioInput] Transcript appended:', trimmedTranscript);
    }

    // ==================== UTILITIES ====================
    
    triggerHaptic(intensity = 'light') {
        // Haptic feedback for mobile devices
        if (navigator.vibrate) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30
            };
            navigator.vibrate(patterns[intensity] || 10);
        }
    }

    showNotification(message, type = 'info') {
        // Use global notification service if available
        if (window.chat && window.chat.showNotification) {
            window.chat.showNotification(message, type, 3000);
        } else {
            console.log(`[AudioInput] ${type.toUpperCase()}: ${message}`);
        }
    }

    // ==================== PUBLIC API ====================
    
    setOnSendCallback(callback) {
        if (typeof callback === 'function') {
            this.onSendCallback = callback;
        }
    }

    destroy() {
        if (this.isRecording) {
            this.stopRecording();
        }
        
        this.stopAudioVisualization();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.recognition) {
            this.recognition.abort();
            this.recognition = null;
        }
        
        console.log('[AudioInput] Destroyed');
    }
}

export default AudioInputHandler;
