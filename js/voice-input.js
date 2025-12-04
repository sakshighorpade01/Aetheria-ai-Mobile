// js/voice-input.js - Voice Input Handler with Live Waveform (Android Fixed)

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
    this.speechActive = false;
    // Robust Android detection
    this.isAndroid = /android/i.test(navigator.userAgent || '');
    this.silenceThreshold = 12; // Avg frequency magnitude before we treat input as silent
    
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
      this.micButton.title = 'Voice input requires HTTPS';
    }

    this.setupSpeechRecognition();
    this.bindEvents();
    
    console.log('[VoiceInput] Initialized successfully');
  }

  setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    // Android Chrome handles continuous differently; often better to restart manually if needed
    this.recognition.continuous = !this.isAndroid;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      console.log('[VoiceInput] Speech recognition started');
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
        }
      }
      
      // Update input field with final + interim results
      const currentValue = this.inputField.value;
      // Remove previous [Speaking...] placeholder
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
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        this.showNotification('Microphone permission denied. Please allow microphone access.');
      } else if (event.error === 'no-speech') {
        console.log('[VoiceInput] No speech detected');
      } else if (event.error === 'audio-capture') {
        this.showNotification('Could not capture audio. Please check your microphone.');
      } else if (event.error === 'network') {
        this.showNotification('Network error. Please check your internet connection.');
      } else if (event.error !== 'aborted') {
        this.showNotification(`Voice input error: ${event.error}`);
      }
      
      this.stopListening();
    };

    this.recognition.onaudiostart = () => {
      this.speechActive = true;
    };

    this.recognition.onaudioend = () => {
      this.speechActive = false;
    };

    this.recognition.onsoundstart = () => {
      this.speechActive = true;
    };

    this.recognition.onsoundend = () => {
      this.speechActive = false;
    };

    this.recognition.onspeechstart = () => {
      this.speechActive = true;
    };

    this.recognition.onspeechend = () => {
      this.speechActive = false;
    };
  }

  async setupAudioAnalyser() {
    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showNotification('Voice input requires HTTPS.');
        return false;
      }

      console.log('[VoiceInput] Requesting microphone access for visualizer...');
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Create audio context
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return false;

      this.audioContext = new AudioContextClass();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      this.microphone.connect(this.analyser);
      
      console.log('[VoiceInput] Audio analyser setup complete');
      return true;
      
    } catch (error) {
      console.error('[VoiceInput] Audio setup failed:', error);
      return false;
    }
  }

  bindEvents() {
    this.micButton.addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
        return;
      }
      this.startListening();
    });
  }

  async startListening() {
    if (this.isListening) return;
    
    try {
      this.finalTranscript = '';
      this.speechActive = false;
      
      // --- CRITICAL FIX FOR ANDROID ---
      // Android Chrome cannot handle getUserMedia (AudioContext) AND SpeechRecognition 
      // simultaneously. It locks the mic resource.
      // We skip the real audio analyser on Android and use a simulated animation instead.
      if (this.isAndroid) {
        console.log('[VoiceInput] Android detected: Skipping AudioContext setup to prevent mic conflict.');
        // We rely on recognition.start() to trigger the permission prompt on Android.
      } else {
        // Desktop: Setup real audio analysis
        const audioSetup = await this.setupAudioAnalyser();
        if (!audioSetup) {
          console.error('[VoiceInput] Could not access microphone for analyser - aborting');
          return;
        }
      }
      
      console.log('[VoiceInput] Starting speech recognition...');
      this.recognition.start();
      
      this.isListening = true;
      this.updateButtonState();
      
      // Start waveform animation (handles both real and simulated data)
      this.startWaveformAnimation();
      
      console.log('[VoiceInput] Started listening successfully');
      
    } catch (error) {
      console.error('[VoiceInput] Failed to start listening:', error);
      this.isListening = false;
      this.updateButtonState();
      
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
    this.speechActive = false;
    
    // Stop speech recognition
    if (this.recognition) {
      this.recognition.stop();
    }
    
    // Stop media stream tracks (releases microphone on Desktop)
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    
    // Stop audio analysis
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
    
    // Stop waveform animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
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
    const barConfigs = Array.from(bars, (_, index) => ({
      baseHeight: 20 + Math.random() * 20,
      amplitude: 35 + Math.random() * 35,
      frequency: 0.6 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      drift: 0.002 + Math.random() * 0.004,
      secondary: 0.4 + Math.random() * 0.6,
      noise: 3 + Math.random() * 4,
      idleHeight: 6 + Math.random() * 6,
      index
    }));

    let silenceFrames = 0;

    const animate = () => {
      if (!this.isListening) return;
      
      if (this.analyser) {

        // --- DESKTOP: Real Audio Data ---
        this.analyser.getByteFrequencyData(this.dataArray);
        let total = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          total += this.dataArray[i];
        }
        const averageLevel = total / this.dataArray.length;
        if (averageLevel < this.silenceThreshold) {
          silenceFrames = Math.min(silenceFrames + 1, 12);
        } else {
          silenceFrames = 0;
          this.speechActive = true;
        }
        const holdSilence = silenceFrames > 4;
        
        bars.forEach((bar, index) => {
          const startIndex = Math.floor((index / bars.length) * this.dataArray.length);
          const endIndex = Math.floor(((index + 1) / bars.length) * this.dataArray.length);
          
          let barSum = 0;
          for (let i = startIndex; i < endIndex; i++) {
            barSum += this.dataArray[i];
          }
          const barAverage = barSum / (endIndex - startIndex);
          
          // Convert to height percentage (20% to 100%)
          const dynamicHeight = Math.max(12, (barAverage / 255) * 100);
          const idleHeight = barConfigs[index].idleHeight;
          const height = holdSilence ? idleHeight : dynamicHeight;
          bar.style.height = `${height}%`;
        });
      } else {
        // --- ANDROID: Simulated Animation ---
        // Freeze bars when recognition thinks user is silent, animate when speech is detected.
        if (!this.speechActive) {
          bars.forEach((bar, index) => {
            const idleHeight = barConfigs[index].idleHeight;
            bar.style.height = `${idleHeight}%`;
          });
        } else {
          const time = performance.now() / 1000;
          bars.forEach((bar, index) => {
            const config = barConfigs[index];
            config.phase += config.drift; // slow phase drift keeps motion from repeating

            const primary = Math.sin(time * config.frequency + config.phase);
            const secondary = Math.sin((time * (config.frequency + config.secondary)) + index * 0.5);
            const noise = (Math.random() - 0.5) * config.noise;

            let height = config.baseHeight
              + Math.abs(primary) * config.amplitude * 0.7
              + Math.abs(secondary) * config.amplitude * 0.3
              + noise;

            height = Math.max(10, Math.min(95, height));
            bar.style.height = `${height}%`;
          });
        }
      }

      
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

  isSupported() {
    return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  }

  showNotification(message) {
    if (window.chat && typeof window.chat.showNotification === 'function') {
      window.chat.showNotification(message, 'error');
      return;
    }

    console.warn('[VoiceInput]', message);
    
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