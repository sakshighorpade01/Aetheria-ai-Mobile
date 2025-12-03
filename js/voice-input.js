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
    
    this.initialize();
  }

  initialize() {
    this.micButton = document.getElementById('voice-input-btn');
    this.inputField = document.getElementById('floating-input');
    
    if (!this.micButton || !this.inputField) {
      console.warn('[VoiceInput] Required elements not found');
      return;
    }

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
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          this.finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
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
      if (this.isListening) {
        // Clean up interim results when stopping
        const currentValue = this.inputField.value;
        const cleanValue = currentValue.replace(/\s*\[Speaking...\].*$/, '').trim();
        this.inputField.value = cleanValue;
        this.autoResizeInput();
        
        this.stopListening();
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('[VoiceInput] Speech recognition error:', event.error);
      this.stopListening();
    };
  }

  async setupAudioAnalyser() {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('[VoiceInput] getUserMedia is not supported in this browser/context');
        console.error('[VoiceInput] Make sure the site is served over HTTPS or localhost');
        return false;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      this.microphone.connect(this.analyser);
      
      return true;
    } catch (error) {
      console.error('[VoiceInput] Audio setup failed:', error);
      
      // Provide more specific error messages
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        console.error('[VoiceInput] Microphone permission denied by user');
        this.showNotification('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        console.error('[VoiceInput] No microphone found on this device');
        this.showNotification('No microphone found. Please connect a microphone and try again.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        console.error('[VoiceInput] Microphone is already in use by another application');
        this.showNotification('Microphone is already in use. Please close other apps using the microphone.');
      } else {
        console.error('[VoiceInput] Unknown error accessing microphone:', error.message);
        this.showNotification('Could not access microphone. Please check your browser settings.');
      }
      
      return false;
    }
  }

  bindEvents() {
    this.micButton.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
  }

  async startListening() {
    if (this.isListening) return;
    
    try {
      // Reset transcript for new session
      this.finalTranscript = '';
      
      // Setup audio analyser for waveform
      const audioSetup = await this.setupAudioAnalyser();
      if (!audioSetup) {
        console.error('[VoiceInput] Could not access microphone');
        // Still try to start speech recognition even if audio analyser fails
        // The waveform just won't work, but speech recognition might still work
        try {
          this.recognition.start();
          this.isListening = true;
          this.updateButtonState();
          console.log('[VoiceInput] Started listening (without waveform)');
        } catch (recError) {
          console.error('[VoiceInput] Speech recognition also failed:', recError);
          this.showNotification('Voice input is not available. Please check your browser settings.');
        }
        return;
      }
      
      // Start speech recognition
      this.recognition.start();
      this.isListening = true;
      
      // Update UI to listening state
      this.updateButtonState();
      
      // Start waveform animation
      this.startWaveformAnimation();
      
      console.log('[VoiceInput] Started listening');
      
    } catch (error) {
      console.error('[VoiceInput] Failed to start listening:', error);
      this.stopListening();
    }
  }

  stopListening() {
    if (!this.isListening) return;
    
    this.isListening = false;
    
    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
    }
    
    // Stop media stream tracks (releases microphone)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Stop audio analysis
    if (this.audioContext) {
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
}

export default VoiceInputHandler;