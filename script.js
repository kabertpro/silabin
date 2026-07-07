/**
 * PROYECTO: SILABÍN – ENCUENTRA LA SÍLABA
 * Desarrollador: Kabert Studio - by LMKE (Luis Miguel Kapa Escobar)
 * Arquitectura: Conectores de Diccionario Modular y Sistema de Progreso por Pasos.
 */

class SilabinEngine {
    constructor() {
        // Variables del Jugador y Récords
        this.playerName = "";
        this.playerRecord = 0;
        this.stars = 0;

        // Estructura de Control de Niveles Finitos (5 retos por juego)
        this.currentMode = null;
        this.currentRound = 0;
        this.maxRoundsPerLevel = 5;

        // Base de datos cargada
        this.availableWorlds = [];
        this.loadedDictionary = [];
        this.currentChallenge = null;
        this.lastWordId = null;
        this.animationFrameIds = [];

        // Parámetros del Panel
        this.settings = {
            audio: JSON.parse(localStorage.getItem('silabin_audio')) !== false,
            narration: JSON.parse(localStorage.getItem('silabin_narration')) !== false
        };

        this.successTexts = ["¡Muy bien!", "¡Excelente!", "¡Lo lograste!", "¡Fantástico!", "¡Muy bien hecho!"];
        this.failTexts = ["¡Casi!", "Inténtalo otra vez", "Tómate tu tiempo", "Tú puedes"];

        this.initDOM();
        this.registerEvents();
        this.loadProfileFromDevice();
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

        // Textos del Menú
        this.displayPlayerName = document.getElementById('display-player-name');
        this.displayPlayerRecord = document.getElementById('display-player-record');
        
        document.getElementById('setting-audio').checked = this.settings.audio;
        document.getElementById('setting-narration').checked = this.settings.narration;
    }

    registerEvents() {
        // Pantalla Splash
        document.getElementById('btn-splash-start').addEventListener('click', () => {
            this.playSystemSound('click');
            this.playAudioFile('hola.mp3');
            if (!this.playerName) {
                this.changeScreen('profile');
            } else {
                this.changeScreen('menu');
            }
        });

        // Pantalla de Nombre
        document.getElementById('btn-save-profile').addEventListener('click', () => this.saveProfile());
        document.getElementById('btn-change-user').addEventListener('click', () => {
            this.playSystemSound('click');
            this.changeScreen('profile');
        });

        // Modales Básicos
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

    /* ==========================================================================
       SISTEMA DE PERFILES DE JUGADORES
       ========================================================================== */
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
        const input = document.getElementById('player-input').value.trim();
        if (!input) return alert("Por favor escribe tu nombre");

        this.playSystemSound('click');
        this.playerName = input;
        localStorage.setItem('silabin_current_user', input);

        // Si es un perfil totalmente nuevo, inicializamos su registro histórico en 0
        if (!localStorage.getItem(`silabin_record_${input}`)) {
            localStorage.setItem(`silabin_record_${input}`, 0);
            localStorage.setItem(`silabin_stars_${input}`, 0);
        }

        this.loadProfileFromDevice();
        document.getElementById('player-input').value = ""; // Limpiar input
        this.playAudioFile('bienvenido_a_silabin.mp3');
        this.changeScreen('menu');
    }

    /* ==========================================================================
       SELECTOR DE MUNDOS / CONSONANTES (NO ALEATORIO)
       ========================================================================== */
    async selectMode(modeNumber) {
        this.playSystemSound('click');
        this.currentMode = modeNumber;
        
        try {
            // Leer index.json para renderizar los botones disponibles
            const response = await fetch('data/index.json');
            if (!response.ok) throw new Error("Falta index.json");
            const data = await response.json();
            this.availableWorlds = data.worlds;

            // Renderizado interactivo del Grid de Letras
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

        } catch (error) {
            console.error(error);
            alert("Error al cargar la lista de mundos.");
        }
    }

    async loadWorldData(worldKey) {
        this.playSystemSound('click');
        try {
            const response = await fetch(`data/${worldKey}.json`);
            if (!response.ok) throw new Error(`Falta el archivo data/${worldKey}.json`);
            const worldData = await response.json();

            this.buildWorkingDictionary(worldData);
            
            // Inicializar las 5 rondas finitas del nivel
            this.currentRound = 0;
            this.updateProgressBar();
            this.changeScreen('game');

            this.playModeIntroAudio(this.currentMode);
            this.generateChallenge();

        } catch (error) {
            console.error(error);
            alert("Error al cargar el archivo de la letra seleccionada.");
        }
    }

    buildWorkingDictionary(worldData) {
        this.loadedDictionary = [];
        let idCounter = 2000;

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

    /* ==========================================================================
       GENERADOR DINÁMICO DE RETOS Y MECÁNICAS
       ========================================================================== */
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
        for (let i = 0; i < 5; i++) {
            pool.push(fakeSyllables[Math.floor(Math.random() * fakeSyllables.length)] || "LA");
        }
        pool = this.shuffleArray(pool);

        let dynamicScore = 0;
        pool.forEach((syllable) => {
            const bubble = document.createElement('div');
            bubble.className = 'floating-syllable';
            bubble.innerText = syllable.toUpperCase();

            let posX = Math.random() * (this.playground.clientWidth - 120);
            let posY = Math.random() * (this.playground.clientHeight - 80);
            let dx = (Math.random() - 0.5) * 1.2; let dy = (Math.random() - 0.5) * 1.2;

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

    /* ==========================================================================
       MANEJO DE FIN DE RETO Y PROGRESO FINITO DE NIVEL
       ========================================================================== */
    handleOutcome(element, isCorrect, skipSoundTrigger = false, remainsFloating = false) {
        if (isCorrect) {
            element.classList.add('hit-success');
            this.feedbackElement.style.color = "var(--color-success)";
            this.feedbackElement.innerText = this.successTexts[Math.floor(Math.random() * this.successTexts.length)];
            
            if (!skipSoundTrigger) this.playSystemSound('success');
            this.playMotivationAudio(true);
            this.triggerConfetti();

            // Guardar estrellas locales por perfil
            this.stars++;
            localStorage.setItem(`silabin_stars_${this.playerName}`, this.stars);
            this.updateStarDisplay();

            // Avanzar ronda en la barra
            this.currentRound++;
            this.updateProgressBar();

            this.playground.style.pointerEvents = 'none';

            setTimeout(() => {
                this.playground.style.pointerEvents = 'auto';
                
                // CONTROLADOR DE CIERRE DEL NIVEL (Acaba a los 5 aciertos)
                if (this.currentRound >= this.maxRoundsPerLevel) {
                    this.endLevelWithVictory();
                } else {
                    this.generateChallenge();
                }
            }, 2000);

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
        
        // Evaluar si se superó el récord histórico personal del niño
        if (this.stars > this.playerRecord) {
            this.playerRecord = this.stars;
            localStorage.setItem(`silabin_record_${this.playerName}`, this.playerRecord);
            this.displayPlayerRecord.innerText = this.playerRecord;
        }

        this.playAudioFile('nivel_completado.mp3');
        this.changeScreen('victory');
        
        // Lanzamiento masivo de confeti en bucle por fin de nivel
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.triggerConfetti(), i * 600);
        }
    }

    updateProgressBar() {
        const percentage = (this.currentRound / this.maxRoundsPerLevel) * 100;
        this.progressBarFill.style.width = `${percentage}%`;
    }

    /* ==========================================================================
       AUDIO, SWITCH DE PANTALLAS Y SISTEMA FX NATIVO
       ========================================================================== */
    changeScreen(screenKey) {
        Object.values(this.screens).forEach(scr => scr.classList.remove('active'));
        this.screens[screenKey].classList.add('active');
    }

    backToMenu() {
        this.playSystemSound('click');
        this.clearActiveTimers();
        this.changeScreen('menu');
    }

    toggleModal(modal, show) {
        this.playSystemSound('click');
        if (show) modal.classList.add('active');
        else modal.classList.remove('active');
    }

    playSystemSound(type) {
        if (!this.settings.audio) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'fail') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
            osc.start(); osc.stop(ctx.currentTime + 0.25);
        }
    }

    playAudioFile(filename) {
        if (!this.settings.narration) return;
        const audio = new Audio(`audios/${filename}`);
        audio.volume = 0.9;
        audio.play().catch(e => console.log("Audio balance interactivo prevenido."));
    }

    playModeIntroAudio(mode) {
        const intros = {
            1: ["encuentra_la_silaba.mp3", "busca_la_silaba.mp3"],
            2: ["busca_la_palabra_correcta.mp3", "elige_la_correcta.mp3"],
            3: ["escucha_con_atencion.mp3", "toca_la_respuesta_correcta.mp3"]
        };
        const choices = intros[mode];
        this.playAudioFile(choices[Math.floor(Math.random() * choices.length)]);
    }

    playMotivationAudio(isCorrect) {
        const correctTracks = ["muy_bien.mp3", "excelente.mp3", "correcto.mp3", "fantastico.mp3", "lo_lograste.mp3"];
        const incorrectTracks = ["casi.mp3", "intentalo_otra_vez.mp3", "sigue_adelante.mp3", "puedes_volver_a_intentarlo.mp3"];
        if (Math.random() > 0.4) {
            const track = isCorrect ? correctTracks[Math.floor(Math.random() * correctTracks.length)] : incorrectTracks[Math.floor(Math.random() * incorrectTracks.length)];
            this.playAudioFile(track);
        }
    }

    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        let particles = [];
        const colors = ['#FF6B6B', '#4DBCFF', '#6BCB77', '#FFA62F', '#FFF'];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: canvas.width / 2, y: canvas.height / 2, radius: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.7) * 12, gravity: 0.25
            });
        }
        const animateConfetti = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
                if (p.y < canvas.height) {
                    active = true; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color; ctx.fill();
                }
            });
            if (active) requestAnimationFrame(animateConfetti);
        };
        animateConfetti();
    }

    toggleFullscreen() {
        this.playSystemSound('click');
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => document.getElementById('btn-fullscreen').innerText = "Desactivar").catch(() => {});
        } else {
            document.exitFullscreen();
            document.getElementById('btn-fullscreen').innerText = "Activar";
        }
    }

    resetEverything() {
        localStorage.clear();
        this.playerName = "";
        this.playerRecord = 0;
        this.stars = 0;
        alert("Todos los datos del dispositivo han sido borrados de fábrica.");
        window.location.reload();
    }

    updateStarDisplay() { this.starCountElement.innerText = this.stars; }
    clearActiveTimers() { this.animationFrameIds.forEach(id => cancelAnimationFrame(id)); this.animationFrameIds = []; }
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

let game;
window.addEventListener('DOMContentLoaded', () => { game = new SilabinEngine(); });