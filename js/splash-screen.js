// Splash Screen Controller - AI Awakening Experience

class SplashScreen {
    constructor() {
        this.splashElement = null;
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationFrame = null;
        this.loadingStages = [
            { text: 'Initializing neural networks...', duration: 800 },
            { text: 'Loading AI models...', duration: 1000 },
            { text: 'Preparing interface...', duration: 700 }
        ];
        this.currentStage = 0;
        this.progress = 0;
        this.isComplete = false;
    }

    init() {
        // Create splash screen HTML
        this.createSplashHTML();
        
        // Initialize canvas for neural network animation
        this.initCanvas();
        
        // Start loading sequence
        this.startLoadingSequence();
        
        // Start neural network animation
        this.animateNeuralNetwork();
    }

    createSplashHTML() {
        const splashHTML = `
            <div class="splash-screen" id="splash-screen">
                <div class="splash-background">
                    <canvas class="neural-canvas" id="neural-canvas"></canvas>
                </div>
                
                <div class="splash-logo-container">
                    <img src="/assets/icon.png?v=2" alt="Aetheria AI" class="splash-logo">
                </div>
                
                <div class="splash-loading-container">
                    <div class="splash-loading-text" id="splash-loading-text"></div>
                    <div class="splash-percentage" id="splash-percentage">0%</div>
                    <div class="splash-progress-container">
                        <div class="splash-progress-bar" id="splash-progress-bar"></div>
                    </div>
                </div>
                
                <div class="splash-branding">
                    <div class="splash-branding-text">Powered by Aetheria AI</div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('afterbegin', splashHTML);
        this.splashElement = document.getElementById('splash-screen');
    }

    initCanvas() {
        this.canvas = document.getElementById('neural-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Handle window resize
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Create particles
        this.createParticles();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        const particleCount = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 15000));
        this.particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }

    animateNeuralNetwork() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update and draw particles
        this.particles.forEach((particle, i) => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(99, 102, 241, 0.6)';
            this.ctx.fill();
            
            // Draw connections to nearby particles
            this.particles.slice(i + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 150) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(otherParticle.x, otherParticle.y);
                    this.ctx.strokeStyle = `rgba(99, 102, 241, ${0.2 * (1 - distance / 150)})`;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            });
        });
        
        // Continue animation
        if (!this.isComplete) {
            this.animationFrame = requestAnimationFrame(() => this.animateNeuralNetwork());
        }
    }

    startLoadingSequence() {
        this.updateLoadingStage(0);
    }

    updateLoadingStage(stageIndex) {
        if (stageIndex >= this.loadingStages.length) {
            this.completeLoading();
            return;
        }
        
        const stage = this.loadingStages[stageIndex];
        const loadingText = document.getElementById('splash-loading-text');
        
        if (loadingText) {
            // Type out the text character by character
            this.typeText(loadingText, stage.text, () => {
                // Update progress
                const targetProgress = ((stageIndex + 1) / this.loadingStages.length) * 100;
                this.animateProgress(this.progress, targetProgress, stage.duration, () => {
                    // Move to next stage
                    setTimeout(() => {
                        this.currentStage++;
                        this.updateLoadingStage(this.currentStage);
                    }, 200);
                });
            });
        }
    }

    typeText(element, text, callback) {
        element.textContent = '';
        let charIndex = 0;
        
        const typeInterval = setInterval(() => {
            if (charIndex < text.length) {
                element.textContent += text[charIndex];
                charIndex++;
            } else {
                clearInterval(typeInterval);
                if (callback) callback();
            }
        }, 30);
    }

    animateProgress(from, to, duration, callback) {
        const startTime = Date.now();
        const progressBar = document.getElementById('splash-progress-bar');
        const percentageText = document.getElementById('splash-percentage');
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentProgress = from + (to - from) * eased;
            
            this.progress = currentProgress;
            
            if (progressBar) {
                progressBar.style.width = `${currentProgress}%`;
            }
            
            if (percentageText) {
                percentageText.textContent = `${Math.round(currentProgress)}%`;
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (callback) callback();
            }
        };
        
        animate();
    }

    completeLoading() {
        // Final stage - complete
        const loadingText = document.getElementById('splash-loading-text');
        if (loadingText) {
            loadingText.textContent = 'Ready!';
        }
        
        // Ensure progress reaches 100%
        this.animateProgress(this.progress, 100, 300, () => {
            // Wait a moment before hiding
            setTimeout(() => {
                this.hide();
            }, 500);
        });
    }

    hide() {
        this.isComplete = true;
        
        // Cancel animation frame
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        // Fade out splash screen
        if (this.splashElement) {
            this.splashElement.classList.add('fade-out');
            
            // Remove from DOM after transition
            setTimeout(() => {
                if (this.splashElement && this.splashElement.parentNode) {
                    this.splashElement.parentNode.removeChild(this.splashElement);
                }
            }, 600);
        }
    }

    // Public method to manually complete the splash screen
    forceComplete() {
        if (!this.isComplete) {
            this.completeLoading();
        }
    }
}

// Initialize splash screen immediately
const splashScreen = new SplashScreen();
splashScreen.init();

// Export for external control
window.splashScreen = splashScreen;
