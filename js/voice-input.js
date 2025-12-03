// js/voice-input.js - Voice Input Handler with Live Waveform

class VoiceInputHandler {
  constructor() {
    this.isListening = false;
    this.recognition = null;
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.mediaStream = null;
    this.dataArray = null;
    this.animationId = null;
    this.finalTranscript = '';
    
    this.micButton = null;
    this.inputField = null;
    this.isAndroid = /android/i.test(navigator.userAgent || '');
    
    this.initialize();
  }

  initialize() {
    this.micButton = document.getElementById('voice-input-btn');
    this.inputField = document.getElementById('floating-input');
    
    if (!this.micButton || !this.inputField) {
      console.warn('[VoiceInput] Required elements not found');
      return;
    }

    console.log('[VoiceInput] User agent:', navigator.userAgent);
    console.log('[VoiceInput] Detected platform:', this.isAndroid ? 'Android' : 'Non-Android');

    // Check for speech recognition support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('[VoiceInput] Speech recognition not supported');
      this.micButton.style.display = 'none';
      return;
    }

    // Check for microphone API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('[VoiceInput] getUserMedia not supported - microphone access unavailable');
      console.warn('[VoiceInput] This usually means the site is not served over HTTPS');
      // Don't hide the button, but show a warning when clicked
      this.micButton.title = 'Voice input requires HTTPS';
    }

    this.setupSpeechRecognition();
    this.bindEvents();
    
    console.log('[VoiceInput] Initialized successfully');
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = !this.isAndroid;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      console.log('[VoiceInput] Speech recognition started');
      console.log('[VoiceInput] Recognition settings:', {
        continuous: this.recognition.continuous,
        interimResults: this.recognition.interimResults,
        lang: this.recognition.lang
      });
    };
    
    this.recognition.onresult = (event) => {
      console.log('[VoiceInput] Speech recognition result received');
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + ' ';
          console.log('[VoiceInput] Final transcript:', transcript);
        } else {
          interimTranscript += transcript;
          console.log('[VoiceInput] Interim transcript:', transcript);
        }
      }
      
      // Update input field with final + interim results
      const currentValue = this.inputField.value;
      const baseValue = currentValue.replace(/\s*\[Speaking...\].*$/, '').trim();
      
      let newValue = baseValue;
      if (this.finalTranscript.trim()) {
        newValue = baseValue ? `${baseValue} ${this.finalTranscript.trim()}` : this.finalTranscript.trim();
      }
      
      if (interimTranscript.trim()) {
        newValue += ` [Speaking...] ${interimTranscript}`;
      }
      
      this.inputField.value = newValue;
      this.autoResizeInput();
    };
    
    this.recognition.onend = () => {
      console.log('[VoiceInput] Speech recognition ended');
      if (this.isListening) {
        // Clean up interim results when stopping
        const currentValue = this.inputField.value;
        const cleanValue = currentValue.replace(/\s*\[Speaking...\].*$/, '').trim();
        this.inputField.value = cleanValue;
        this.autoResizeInput();
        
        console.log('[VoiceInput] onend triggered while still listening - invoking stopListening()');
        this.stopListening();
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('[VoiceInput] Speech recognition error:', event.error);
      console.error('[VoiceInput] Error details:', event);
      console.error('[VoiceInput] Recognition state at error:', {
        isListening: this.isListening,
        hasStream: !!this.mediaStream,
        hasAudioContext: !!this.audioContext
      });
      
      // Handle specific errors
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        this.showNotification('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if (event.error === 'no-speech') {
        console.log('[VoiceInput] No speech detected');
        // Don't show error for no-speech, just stop
      } else if (event.error === 'audio-capture') {
        this.showNotification('Could not capture audio. Please check your microphone.');
      } else if (event.error === 'network') {
        this.showNotification('Network error. Please check your internet connection.');
      } else if (event.error === 'aborted') {
        console.log('[VoiceInput] Speech recognition aborted');
      } else {
        this.showNotification(`Voice input error: ${event.error}`);
      }
      
      this.stopListening();
    };
  }

  async setupAudioAnalyser() {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[VoiceInput] getUserMedia is not supported in this browser/context');
        console.error('[VoiceInput] Make sure the site is served over HTTPS or localhost');
        this.showNotification('Voice input requires HTTPS. Please use a secure connection.');
        return false;
      }

      console.log('[VoiceInput] Requesting microphone access from user...');
      
      // Request microphone access with explicit constraints
      // This will trigger the permission prompt on mobile
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('[VoiceInput] Microphone access granted, setting up audio context...');
      if (this.mediaStream) {
        const tracks = this.mediaStream.getAudioTracks() || [];
        console.log('[VoiceInput] Active audio tracks:', tracks.map(track => ({
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          settings: track.getSettings ? track.getSettings() : {}
        })));
      }
      
      // Check if we got a valid stream
      if (!this.mediaStream || !this.mediaStream.active) {
        console.error('[VoiceInput] Media stream is not active');
        this.showNotification('Could not access microphone. Please try again.');
        return false;
      }

      // Create audio context (with webkit prefix for older browsers)
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error('[VoiceInput] AudioContext not supported');
        this.showNotification('Audio processing not supported in this browser.');
        return false;
      }

      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      console.log('[VoiceInput] AudioContext state after init:', this.audioContext.state);
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      this.microphone.connect(this.analyser);
      
      console.log('[VoiceInput] Audio analyser setup complete');
      return true;
      
    } catch (error) {
      console.error('[VoiceInput] Audio setup failed:', error);
      console.error('[VoiceInput] Error name:', error.name);
      console.error('[VoiceInput] Error message:', error.message);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.error('[VoiceInput] Microphone permission denied by user');
        this.showNotification('Microphone access denied. Please allow microphone permissions and try again.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.error('[VoiceInput] No microphone found on this device');
        this.showNotification('No microphone found. Please check your device settings.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        console.error('[VoiceInput] Microphone is already in use by another application');
        this.showNotification('Microphone is already in use. Please close other apps using the microphone.');
      } else if (error.name === 'SecurityError') {
        console.error('[VoiceInput] Security error - likely HTTPS issue');
        this.showNotification('Security error. Voice input requires HTTPS connection.');
      } else if (error.name === 'TypeError') {
        console.error('[VoiceInput] Type error - API might not be supported');
        this.showNotification('Voice input is not supported in this browser.');
      } else {
        console.error('[VoiceInput] Unknown error accessing microphone');
        this.showNotification('Could not access microphone. Please check your browser settings and try again.');
      }
      
      return false;
    }
  }

  bindEvents() {
    this.micButton.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
        return;
      }

      // Fire-and-forget permission query; awaiting here would drop the user gesture
      this.checkMicrophonePermission();
      this.startListening();
    });
  }

  async checkMicrophonePermission() {
    // Check if Permissions API is available
    if (!navigator.permissions || !navigator.permissions.query) {
      console.log('[VoiceInput] Permissions API not available, will request on getUserMedia');
      return;
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
      console.log('[VoiceInput] Microphone permission status:', permissionStatus.state);
      
      if (permissionStatus.state === 'denied') {
        console.warn('[VoiceInput] Microphone permission is denied');
        this.showNotification('Microphone access is blocked. Please enable it in your browser settings.');
        return false;
      }
      
      if (permissionStatus.state === 'prompt') {
        console.log('[VoiceInput] Will prompt user for microphone permission');
      }
      
      return true;
    } catch (error) {
      // Permissions API might not support 'microphone' query on all browsers
      console.log('[VoiceInput] Could not query microphone permission:', error.message);
      return true; // Continue anyway, getUserMedia will handle it
    }
  }

  async startListening() {
    if (this.isListening) return;
    
    try {
      // Reset transcript for new session
      this.finalTranscript = '';
      
      // First, request microphone permission explicitly
      // This is crucial for mobile devices
      console.log('[VoiceInput] Requesting microphone permission...');
      console.log('[VoiceInput] Current listening state before setup:', {
        isListening: this.isListening,
        hasStream: !!this.mediaStream,
        hasAudioContext: !!this.audioContext
      });
      
      const audioSetup = await this.setupAudioAnalyser();
      
      if (!audioSetup) {
        console.error('[VoiceInput] Could not access microphone - aborting');
        // Don't proceed if we can't get microphone access
        // Speech recognition needs microphone permission too
        return;
      }
      
      console.log('[VoiceInput] Microphone access granted, starting speech recognition...');
      
      // Start speech recognition only after we have microphone access
      this.recognition.start();
      this.isListening = true;
      console.log('[VoiceInput] Listening flag set true, stream/context ready?', {
        hasStream: !!this.mediaStream,
        audioContextState: this.audioContext?.state
      });
      
      // Update UI to listening state
      this.updateButtonState();
      
      // Start waveform animation
      this.startWaveformAnimation();
      
      console.log('[VoiceInput] Started listening successfully');
      
    } catch (error) {
      console.error('[VoiceInput] Failed to start listening:', error);
      
      // Make sure to clean up and reset UI
      this.isListening = false;
      this.updateButtonState();
      
      // Stop any media streams that might have been created
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.showNotification('Could not start voice input. Please check microphone permissions.');
    }
  }

  stopListening() {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    // Stop speech recognition
    if (this.recognition) {
      console.log('[VoiceInput] Calling recognition.stop()');
      this.recognition.stop();
    }
    
    // Stop media stream tracks (releases microphone)
    if (this.mediaStream) {
      console.log('[VoiceInput] Stopping media stream tracks');
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Stop audio analysis
    if (this.audioContext) {
      console.log('[VoiceInput] Closing audio context');
      this.audioContext.close();
      this.audioContext = null;
    }
    
    // Stop waveform animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // Update UI to idle state
    this.updateButtonState();
    
    console.log('[VoiceInput] Stopped listening');
  }

  updateButtonState() {
    if (!this.micButton) return;
    
    if (this.isListening) {
      this.micButton.classList.add('listening');
      this.micButton.classList.remove('idle');
    } else {
      this.micButton.classList.add('idle');
      this.micButton.classList.remove('listening');
    }
  }

  startWaveformAnimation() {
    const waveformContainer = this.micButton.querySelector('.waveform-container');
    if (!waveformContainer) return;
    
    const bars = waveformContainer.querySelectorAll('.waveform-bar');
    
    const animate = () => {
      if (!this.isListening || !this.analyser) return;
      
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i];
      }
      const average = sum / this.dataArray.length;
      
      // Update each bar with different frequency ranges
      bars.forEach((bar, index) => {
        const startIndex = Math.floor((index / bars.length) * this.dataArray.length);
        const endIndex = Math.floor(((index + 1) / bars.length) * this.dataArray.length);
        
        let barSum = 0;
        for (let i = startIndex; i < endIndex; i++) {
          barSum += this.dataArray[i];
        }
        const barAverage = barSum / (endIndex - startIndex);
        
        // Convert to height percentage (20% to 100%)
        const height = Math.max(20, (barAverage / 255) * 100);
        bar.style.height = `${height}%`;
      });
      
      this.animationId = requestAnimationFrame(animate);
    };
    
    animate();
  }

  autoResizeInput() {
    if (!this.inputField) return;
    
    requestAnimationFrame(() => {
      this.inputField.style.height = 'auto';
      this.inputField.style.height = `${this.inputField.scrollHeight}px`;
    });
  }

  // Public method to check if voice input is supported
  isSupported() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  }

  // Show user-friendly notification
  showNotification(message) {
    // Try to use the app's notification system if available
    if (window.chat && typeof window.chat.showNotification === 'function') {
      window.chat.showNotification(message, 'error');
      return;
    }

    // Fallback to console and alert
    console.warn('[VoiceInput]', message);
    
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'voice-input-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--error-bg, #ff4444);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 90%;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

export default VoiceInputHandler;