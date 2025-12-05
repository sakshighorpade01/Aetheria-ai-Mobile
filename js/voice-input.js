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
    this.timeDomainArray = null;
    this.audioSetupInProgress = false;

    this.animationId = null;
    this.finalTranscript = '';
    
    this.micButton = null;
    this.inputField = null;

    this.waveformContainer = null;
    this.waveformBaseHeights = [24, 44, 68, 50, 32];
    this.waveformOffsets = [];
    this.simulatedEnergyLevel = 0;
    this.simulatedEnergyTarget = 0;
    this.lastSoundDetectedAt = 0;
    this.silenceThreshold = 0.05;
    this.usingSimulatedWaveform = true;
    
    // Robust Android detection

    this.isAndroid = /android/i.test(navigator.userAgent || '');
    
    this.initialize();
  }

  initialize() {
    this.micButton = document.getElementById('voice-input-btn');
    this.inputField = document.getElementById('floating-input');
    this.waveformContainer = this.micButton?.querySelector('.waveform-container') || null;
    
    if (!this.micButton || !this.inputField) {
      console.warn('[VoiceInput] Required elements not found');
      return;
    }

    if (this.waveformContainer) {
      const barCount = this.waveformContainer.querySelectorAll('.waveform-bar').length || this.waveformBaseHeights.length;
      this.waveformOffsets = Array.from({ length: barCount }, () => Math.random() * Math.PI * 2);
      this.resetWaveform();
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

    const handleSoundActivity = (isActive) => {
      if (!this.isAndroid) return;
      this.updateSimulatedActivity(isActive);
    };
    this.recognition.onsoundstart = () => handleSoundActivity(true);
    this.recognition.onspeechstart = () => handleSoundActivity(true);
    this.recognition.onspeechend = () => handleSoundActivity(false);
    this.recognition.onsoundend = () => handleSoundActivity(false);
    
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
  }

  async setupAudioAnalyser() {
    if (this.audioSetupInProgress) {
      await this.audioSetupInProgress;
      return Boolean(this.analyser);
    }

    this.audioSetupInProgress = (async () => {
      try {
        if (this.analyser && this.mediaStream) {
          this.usingSimulatedWaveform = false;
          return true;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          this.showNotification('Voice input requires HTTPS.');
          this.usingSimulatedWaveform = true;
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

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          this.usingSimulatedWaveform = true;
          return false;
        }

        this.audioContext = new AudioContextClass();
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.minDecibels = -90;
        this.analyser.maxDecibels = -10;
        this.analyser.smoothingTimeConstant = 0.72;

        this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.microphone.connect(this.analyser);

        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainArray = new Uint8Array(this.analyser.fftSize);

        this.usingSimulatedWaveform = false;
        console.log('[VoiceInput] Audio analyser setup complete');
        return true;
      } catch (error) {
        console.error('[VoiceInput] Audio setup failed:', error);
        this.usingSimulatedWaveform = true;
        return false;
      } finally {
        this.audioSetupInProgress = null;
      }
    })();

    return this.audioSetupInProgress;
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
      
      let audioSetup = false;
      try {
        audioSetup = await this.setupAudioAnalyser();
      } catch (audioError) {
        console.warn('[VoiceInput] Audio analyser unavailable, using simulated waveform.', audioError);
        audioSetup = false;
      }
      this.usingSimulatedWaveform = !audioSetup;

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
      this.timeDomainArray = null;
    }
    
    // Stop waveform animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.resetWaveform();
    this.simulatedEnergyLevel = 0;
    this.simulatedEnergyTarget = 0;
    this.usingSimulatedWaveform = true;

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
    if (!this.waveformContainer) return;
    const bars = this.waveformContainer.querySelectorAll('.waveform-bar');
    if (!bars.length) return;

    const baseHeights = this.waveformBaseHeights;
    const lastHeights = Array.from(bars).map((_, index) => baseHeights[index % baseHeights.length]);

    const animate = () => {
      if (!this.isListening) {
        this.waveformContainer.classList.add('is-silent');
        return;
      }

      let isSilent = true;

      if (!this.usingSimulatedWaveform && this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        if (this.timeDomainArray) {
          this.analyser.getByteTimeDomainData(this.timeDomainArray);
        }
        const binsPerBar = Math.max(1, Math.floor(this.dataArray.length / bars.length));
        const targets = new Array(bars.length).fill(0);
        let totalEnergy = 0;
        let amplitude = this.computeSignalEnergy(this.timeDomainArray);

        bars.forEach((bar, index) => {
          const start = index * binsPerBar;

          const end = Math.min(this.dataArray.length, start + binsPerBar);
          let sum = 0;
          for (let i = start; i < end; i++) {
            sum += this.dataArray[i];
          }
          const average = sum / Math.max(1, end - start);
          const normalized = average / 255;
          totalEnergy += normalized;

          const emphasis = 0.85 + (index / bars.length) * 0.35;
          const jitter = 0.9 + (Math.random() * 0.2);
          const amplitudeBoost = Math.min(1, amplitude * 1.4);
          const blended = Math.min(1, normalized * emphasis * 0.75 + amplitudeBoost * 0.65);
          const dynamicHeight = 18 + blended * 82 * jitter;
          targets[index] = Math.max(baseHeights[index % baseHeights.length], Math.min(98, dynamicHeight));
        });

        const averageEnergy = Math.max(totalEnergy / bars.length, amplitude * 1.1);
        isSilent = averageEnergy < this.silenceThreshold;
        if (!isSilent) {
          this.lastSoundDetectedAt = performance.now();
        }

        bars.forEach((bar, index) => {
          const target = isSilent ? baseHeights[index % baseHeights.length] : targets[index];

          lastHeights[index] = this.easeHeight(lastHeights[index], target, isSilent ? 0.2 : 0.35);
          bar.style.height = `${lastHeights[index]}%`;
        });
      } else {
        const now = performance.now();
        this.simulatedEnergyLevel += (this.simulatedEnergyTarget - this.simulatedEnergyLevel) * 0.08;
        const holdActive = now - this.lastSoundDetectedAt < 250;
        isSilent = !holdActive && this.simulatedEnergyLevel < 0.05;

        bars.forEach((bar, index) => {
          const base = baseHeights[index % baseHeights.length];

          const offset = this.waveformOffsets[index] || 0;
          const wobble = (Math.sin(now / (120 + index * 18) + offset) + 1) / 2;
          const amplitude = isSilent ? 0 : (0.3 + wobble * 0.7) * this.simulatedEnergyLevel;
          const target = base + amplitude * 60;
          lastHeights[index] = this.easeHeight(lastHeights[index], target, isSilent ? 0.18 : 0.28);
          bar.style.height = `${lastHeights[index]}%`;
        });
      }

      this.waveformContainer.classList.toggle('is-silent', isSilent);

      this.animationId = requestAnimationFrame(animate);
    };

    animate();
  }

  updateSimulatedActivity(isActive) {
    this.simulatedEnergyTarget = isActive ? 1 : 0;
    if (isActive) {
      this.lastSoundDetectedAt = performance.now();
    }
  }

  resetWaveform() {
    if (!this.waveformContainer) return;
    const bars = this.waveformContainer.querySelectorAll('.waveform-bar');
    if (!bars.length) return;
    bars.forEach((bar, index) => {
      bar.style.height = `${this.waveformBaseHeights[index % this.waveformBaseHeights.length]}%`;
    });
    this.waveformContainer.classList.add('is-silent');
  }

  easeHeight(current, target, factor = 0.25) {
    if (typeof current !== 'number') return target;
    return current + (target - current) * factor;
  }

  computeSignalEnergy(timeDomainArray) {
    if (!timeDomainArray || !timeDomainArray.length) return 0;
    let sumSquares = 0;
    for (let i = 0; i < timeDomainArray.length; i += 1) {
      const centered = (timeDomainArray[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    return Math.sqrt(sumSquares / timeDomainArray.length);
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