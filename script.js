/**
 * PROYECTO: SILABÍN – ENCUENTRA LA SÍLABA
 * Desarrollador: Kabert Studio - by LMKE (Luis Miguel Kapa Escobar)
 * Versión: 2.0 (Resistente a fallos de carga HTTP / Sistema Fallback de Respaldo)
 */

class SilabinEngine {
    constructor() {
        this.playerName = "";
        this.playerRecord = 0;
        this.stars = 0;

        this.currentMode = null;
        this.currentRound = 0;
        this.maxRoundsPerLevel = 5;

        // Lista interna por defecto en caso de que falle index.json de forma externa
        this.availableWorlds = ["vocales", "m", "p"];
        this.loadedDictionary = [];
        this.lastWordId = null;
        this.animationFrameIds = [];

        this.settings = {
            audio: JSON.parse(localStorage.getItem('silabin_audio')) !== false,
            narration: JSON.parse(localStorage.getItem('silabin_narration')) !== false
        };

        this.successTexts = ["¡Muy bien!", "¡Excelente!", "¡Lo lograste!", "¡Fantástico!", "¡Increíble!"];
        this.failTexts = ["¡Casi!", "Inténtalo otra vez", "Tómate tu tiempo", "Tú puedes"];

        this.initDOM();
        this.buildVirtualKeyboard();
        this.registerEvents();
        this.runSplashLoader();
    }

    initDOM() {
        this.screens = {
            splash: document.getElementById('screen-splash'),
            profile: document.getElementById('screen-profile'),
            menu: document.getElementById('screen-menu'),
            worlds: document.getElementById('screen-worlds'),
            game: document.getElementById('screen-game'),
            victory: document.getElementById('screen-victory')
        };

        this.playground = document.getElementById('game-playground');
        this.targetSyllableElement = document.getElementById('target-syllable');
        this.starCountElement = document.getElementById('star-count');
        this.progressBarFill = document.getElementById('progress-bar-fill');
        this.feedbackElement = document.getElementById('feedback-message');
        this.modalParents = document.getElementById('modal-parents');
        this.modalCredits = document.getElementById('modal-credits');

        this.displayPlayerName = document.getElementById('display-player-name');
        this.displayPlayerRecord = document.getElementById('display-player-record');
        this.playerInput = document.getElementById('player-input');
        
        document.getElementById('setting-audio').checked = this.settings.audio;
        document.getElementById('setting-narration').checked = this.settings.narration;
    }

    runSplashLoader() {
        const progressFill = document.getElementById('splash-progress');
        const startBtn = document.getElementById('btn-splash-start');
        let width = 0;

        const interval = setInterval(() => {
            if (width >= 100) {
                clearInterval(interval);
                progressFill.parentElement.classList.add('hidden');
                startBtn.classList.remove('hidden');
            } else {
                width += 25; // Carga profesional rápida e interactiva
                progressFill.style.width = `${width}%`;
            }
        }, 150);
    }

    buildVirtualKeyboard() {
        const keyboardContainer = document.getElementById('virtual-keyboard');
        const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

        keyboardContainer.innerHTML = ""; // Limpieza preventiva
        alphabet.forEach(letter => {
            const keyBtn = document.createElement('button');
            keyBtn.className = "btn-key";
            keyBtn.innerText = letter;
            keyBtn.addEventListener('click', () => {
                this.playSystemSound('click');
                if (this.playerInput.value.length < 12) {
                    this.playerInput.value += letter;
                }
            });
            keyboardContainer.appendChild(keyBtn);
        });

        document.getElementById('btn-clear-name').addEventListener('click', () => {
            this.playSystemSound('click');
            this.playerInput.value = "";
        });
    }

    registerEvents() {
        document.getElementById('btn-splash-start').addEventListener('click', () => {
            this.playSystemSound('click');
            this.screens.splash.classList.remove('active');
            this.loadProfileFromDevice();
            if (!this.playerName) {
                this.changeScreen('profile');
            } else {
                this.playAudioFile('hola.mp3');
                this.changeScreen('menu');
            }
        });

        document.getElementById('btn-save-profile').addEventListener('click', () => this.saveProfile());
        
        document.getElementById('btn-change-user').addEventListener('click', () => {
            this.playSystemSound('click');
            this.playerInput.value = "";
            this.changeScreen('profile');
        });

        document.getElementById('btn-parents').addEventListener('click', () => this.toggleModal(this.modalParents, true));
        document.getElementById('btn-credits').addEventListener('click', () => this.toggleModal(this.modalCredits, true));
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.toggleModal(e.target.closest('.modal-overlay'), false));
        });

        document.getElementById('setting-audio').addEventListener('change', (e) => {
            this.settings.audio = e.target.checked;
            localStorage.setItem('silabin_audio', this.settings.audio);
            this.playSystemSound('click');
        });

        document.getElementById('setting-narration').addEventListener('change', (e) => {
            this.settings.narration = e.target.checked;
            localStorage.setItem('silabin_narration', this.settings.narration);
            this.playSystemSound('click');
        });

        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetEverything());
    }

    loadProfileFromDevice() {
        const activeUser = localStorage.getItem('silabin_current_user');
        if (activeUser) {
            this.playerName = activeUser;
            this.playerRecord = parseInt(localStorage.getItem(`silabin_record_${activeUser}`)) || 0;
            this.stars = parseInt(localStorage.getItem(`silabin_stars_${activeUser}`)) || 0;
            
            this.displayPlayerName.innerText = this.playerName;
            this.displayPlayerRecord.innerText = this.playerRecord;
            this.starCountElement.innerText = this.stars;
        }
    }

    saveProfile() {
        const input = this.playerInput.value.trim();
        if (!input) return;

        this.playSystemSound('click');
        this.playerName = input;
        localStorage.setItem('silabin_current_user', input);

        if (!localStorage.getItem(`silabin_record_${input}`)) {
            localStorage.setItem(`silabin_record_${input}`, 0);
            localStorage.setItem(`silabin_stars_${input}`, 0);
        }

        this.loadProfileFromDevice();
        this.playAudioFile('bienvenido_a_silabin.mp3');
        this.changeScreen('menu');
    }

    /* ==========================================================================
       CARGADOR CON FALLBACK INCORPORADO (EVITA EL ERROR DE CARGA)
       ========================================================================== */
    async selectMode(modeNumber) {
        this.playSystemSound('click');
        this.currentMode = modeNumber;
        
        try {
            // Intentar leer de index.json
            const response = await fetch('data/index.json');
            if (response.ok) {
                const data = await response.json();
                if (data && data.worlds) this.availableWorlds = data.worlds;
            }
        } catch (error) {
            console.log("Aviso: index.json inaccesible. Activando redundancia local integrada.");
            // Si el servidor falla, mantiene ["vocales", "m", "p"] definidos arriba.
        }

        // Construcción segura del grid de botones
        const container = document.getElementById('worlds-grid-container');
        container.innerHTML = "";

        this.availableWorlds.forEach(worldKey => {
            const button = document.createElement('button');
            button.className = 'btn-world';
            button.innerText = worldKey.toUpperCase();
            button.addEventListener('click', () => this.loadWorldData(worldKey));
            container.appendChild(button);
        });

        this.playAudioFile('vamos_a_jugar.mp3');
        this.changeScreen('worlds');
    }

    async loadWorldData(worldKey) {
        this.playSystemSound('click');
        try {
            const response = await fetch(`data/${worldKey}.json`);
            if (!response.ok) throw new Error();
            const worldData = await response.json();

            this.buildWorkingDictionary(worldData);
            this.currentRound = 0;
            this.updateProgressBar();
            this.changeScreen('game');

            this.playModeIntroAudio(this.currentMode);
            this.generateChallenge();
        } catch (error) {
            alert(`No se pudo leer el archivo: data/${worldKey}.json. Asegúrate de haberlo subido en minúsculas.`);
        }
    }

    buildWorkingDictionary(worldData) {
        this.loadedDictionary = [];
        let idCounter = 4000;
        worldData.silabas.forEach(group => {
            group.palabras.forEach(wordArr => {
                idCounter++;
                this.loadedDictionary.push({
                    id: idCounter,
                    target: group.silaba,
                    syllablesArray: wordArr,
                    fullWordString: wordArr.join("")
                });
            });
        });
    }

    generateChallenge() {
        this.feedbackElement.innerText = "";
        this.clearActiveTimers();
        this.playground.innerHTML = "";

        let validOptions = this.loadedDictionary.filter(item => item.id !== this.lastWordId);
        if (validOptions.length === 0) validOptions = this.loadedDictionary;

        const challengeBase = validOptions[Math.floor(Math.random() * validOptions.length)];
        this.lastWordId = challengeBase.id;
        
        this.targetSyllableElement.innerText = challengeBase.target.toUpperCase();

        if (this.currentMode === 1) this.setupMode1(challengeBase);
        if (this.currentMode === 2) this.setupMode2(challengeBase);
        if (this.currentMode === 3) this.setupMode3(challengeBase);
    }

    setupMode1(challenge) {
        const container = document.createElement('div');
        container.className = 'word-container';
        challenge.syllablesArray.forEach((syllable) => {
            const bubble = document.createElement('div');
            bubble.className = 'syllable-bubble';
            bubble.innerText = syllable.toUpperCase();
            bubble.addEventListener('click', () => {
                if (syllable.toUpperCase() === challenge.target.toUpperCase()) this.handleOutcome(bubble, true);
                else this.handleOutcome(bubble, false);
            });
            container.appendChild(bubble);
        });
        this.playground.appendChild(container);
    }

    setupMode2(challenge) {
        const grid = document.createElement('div');
        grid.className = 'words-grid';
        let decoys = this.loadedDictionary.filter(item => item.target !== challenge.target);
        if (decoys.length < 2) decoys = this.loadedDictionary.filter(item => item.id !== challenge.id);
        decoys = this.shuffleArray([...decoys]);

        const options = [
            { text: challenge.fullWordString, correct: true },
            { text: decoys[0]?.fullWordString || "SOL", correct: false },
            { text: decoys[1]?.fullWordString || "OSO", correct: false }
        ];

        this.shuffleArray(options).forEach(opt => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.innerText = opt.text.toUpperCase();
            card.addEventListener('click', () => {
                if (opt.correct) this.handleOutcome(card, true);
                else this.handleOutcome(card, false);
            });
            grid.appendChild(card);
        });
        this.playground.appendChild(grid);
    }

    setupMode3(challenge) {
        const container = document.createElement('div');
        container.className = 'floating-container';
        this.playground.appendChild(container);

        const allSyllables = [...new Set(this.loadedDictionary.map(item => item.target))];
        const fakeSyllables = allSyllables.filter(s => s !== challenge.target);

        let pool = [challenge.target, challenge.target, challenge.target];
        for (let i = 0; i < 4; i++) {
            pool.push(fakeSyllables[Math.floor(Math.random() * fakeSyllables.length)] || "LA");
        }
        pool = this.shuffleArray(pool);

        let dynamicScore = 0;
        pool.forEach((syllable) => {
            const bubble = document.createElement('div');
            bubble.className = 'floating-syllable';
            bubble.innerText = syllable.toUpperCase();

            let posX = Math.random() * (this.playground.clientWidth - 110);
            let posY = Math.random() * (this.playground.clientHeight - 70);
            let dx = (Math.random() - 0.5) * 1.6; let dy = (Math.random() - 0.5) * 1.6;

            const move = () => {
                posX += dx; posY += dy;
                if (posX <= 0 || posX >= container.clientWidth - bubble.offsetWidth) dx *= -1;
                if (posY <= 0 || posY >= container.clientHeight - bubble.offsetHeight) dy *= -1;
                bubble.style.left = `${posX}px`; bubble.style.top = `${posY}px`;
                this.animationFrameIds.push(requestAnimationFrame(move));
            };

            bubble.addEventListener('click', (e) => {
                e.stopPropagation();
                if (syllable.toUpperCase() === challenge.target.toUpperCase()) {
                    if (!bubble.classList.contains('hit-success')) {
                        bubble.classList.add('hit-success');
                        dynamicScore++;
                        this.playSystemSound('success');
                        if (dynamicScore >= 3) this.handleOutcome(bubble, true, true);
                    }
                } else {
                    this.handleOutcome(bubble, false, false, true);
                }
            });
            container.appendChild(bubble);
            move();
        });
    }

    handleOutcome(element, isCorrect, skipSoundTrigger = false, remainsFloating = false) {
        if (isCorrect) {
            element.classList.add('hit-success');
            this.feedbackElement.style.color = "var(--color-success)";
            this.feedbackElement.innerText = this.successTexts[Math.floor(Math.random() * this.successTexts.length)];
            
            if (!skipSoundTrigger) this.playSystemSound('success');
            this.playMotivationAudio(true);
            this.triggerConfetti();

            this.stars++;
            localStorage.setItem(`silabin_stars_${this.playerName}`, this.stars);
            this.updateStarDisplay();

            this.currentRound++;
            this.updateProgressBar();
            this.playground.style.pointerEvents = 'none';

            setTimeout(() => {
                this.playground.style.pointerEvents = 'auto';
                if (this.currentRound >= this.maxRoundsPerLevel) {
                    this.endLevelWithVictory();
                } else {
                    this.generateChallenge();
                }
            }, 1800);
        } else {
            element.classList.add('hit-fail');
            this.feedbackElement.style.color = "var(--color-primary)";
            this.feedbackElement.innerText = this.failTexts[Math.floor(Math.random() * this.failTexts.length)];
            this.playSystemSound('fail');
            this.playMotivationAudio(false);
            setTimeout(() => { element.classList.remove('hit-fail'); }, 1000);
        }
    }

    endLevelWithVictory() {
        this.clearActiveTimers();
        if (this.stars > this.playerRecord) {
            this.playerRecord = this.stars;
            localStorage.setItem(`silabin_record_${this.playerName}`, this.playerRecord);
            this.displayPlayerRecord.innerText = this.playerRecord;
        }
        this.playAudioFile('nivel_completado.mp3');
        this.changeScreen('victory');
        for (let i = 0; i < 3; i++) { setTimeout(() => this.triggerConfetti(), i * 500); }
    }

    updateProgressBar() {
        const percentage = (this.currentRound / this.maxRoundsPerLevel) * 100;
        this.progressBarFill.style.width = `${percentage}%`;
    }

    changeScreen(screenKey) {
        Object.values(this.screens).forEach(scr => scr.classList.remove('active'));
        this.screens[screenKey].classList.add('active');
    }

    backToMenu() { this.playSystemSound('click'); this.clearActiveTimers(); this.changeScreen('menu'); }
    toggleModal(modal, show) { this.playSystemSound('click'); if (show) modal.classList.add('active'); else modal.classList.remove('active'); }

    playSystemSound(type) {
        if (!this.settings.audio) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        if (type === 'click') {
            osc.frequency.setValueAtTime(400, ctx.currentTime); gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); osc.start(); osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4); osc.start(); osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'fail') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, ctx.currentTime); osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.12, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25); osc.start(); osc.stop(ctx.currentTime + 0.25);
        }
    }

    playAudioFile(filename) {
        if (!this.settings.narration) return;
        const audio = new Audio(`audios/${filename}`);
        audio.volume = 0.9;
        audio.play().catch(() => {});
    }

    playModeIntroAudio(mode) {
        const intros = {
            1: ["encuentra_la_silaba.mp3", "busca_la_silaba.mp3"],
            2: ["busca_la_palabra_correcta.mp3", "elige_la_correcta.mp3"],
            3: ["escucha_con_atencion.mp3", "toca_la_respuesta_correcta.mp3"]
        };
        this.playAudioFile(intros[mode][Math.floor(Math.random() * 2)]);
    }

    playMotivationAudio(isCorrect) {
        const correctTracks = ["muy_bien.mp3", "excelente.mp3", "correcto.mp3", "fantastico.mp3", "lo_lograste.mp3"];
        const incorrectTracks = ["casi.mp3", "intentalo_otra_vez.mp3", "sigue_adelante.mp3", "puedes_volver_a_intentarlo.mp3"];
        if (Math.random() > 0.4) {
            this.playAudioFile(isCorrect ? correctTracks[Math.floor(Math.random() * 5)] : incorrectTracks[Math.floor(Math.random() * 4)]);
        }
    }

    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas'); const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        let particles = []; const colors = ['#FF6B6B', '#4DBCFF', '#6BCB77', '#FFA62F', '#FFF'];
        for (let i = 0; i < 50; i++) {
            particles.push({ x: canvas.width / 2, y: canvas.height / 2, radius: Math.random() * 5 + 3, color: colors[Math.floor(Math.random() * 5)], vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.7) * 10, gravity: 0.2 });
        }
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height); let active = false;
            particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += p.gravity; if (p.y < canvas.height) { active = true; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); } });
            if (active) requestAnimationFrame(animate);
        };
        animate();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().then(() => document.getElementById('btn-fullscreen').innerText = "Desactivar").catch(() => {});
        else { document.exitFullscreen(); document.getElementById('btn-fullscreen').innerText = "Activar"; }
    }

    resetEverything() { localStorage.clear(); alert("Reiniciado."); window.location.reload(); }
    updateStarDisplay() { this.starCountElement.innerText = this.stars; }
    clearActiveTimers() { this.animationFrameIds.forEach(id => cancelAnimationFrame(id)); this.animationFrameIds = []; }
    shuffleArray(array) { for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } return array; }
}

let game;
window.addEventListener('DOMContentLoaded', () => { game = new SilabinEngine(); });