/**
 * PROYECTO: SILABÍN – ENCUENTRA LA SÍLABA
 * Desarrollador: Kabert Studio - by LMKE (Luis Miguel Kapa Escobar)
 * Arquitectura: Motor de generación dinámica de retos basados en Diccionario Silábico.
 */

class SilabinEngine {
    constructor() {
        // Estado del juego
        this.currentMode = null;
        this.stars = parseInt(localStorage.getItem('silabin_stars')) || 0;
        this.animationFrameIds = [];
        
        // Base de datos cargada dinámicamente
        this.availableWorlds = []; // Viene de index.json
        this.loadedDictionary = []; // Palabras estructuradas del mundo actual

        // Reto actual en pantalla
        this.currentChallenge = null;
        this.lastWordId = null; // Evita repetición inmediata

        // Configuración
        this.settings = {
            audio: JSON.parse(localStorage.getItem('silabin_audio')) !== false,
            narration: JSON.parse(localStorage.getItem('silabin_narration')) !== false
        };

        this.successTexts = ["¡Muy bien!", "¡Excelente!", "¡Lo lograste!", "¡Fantástico!"];
        this.failTexts = ["¡Casi!", "Inténtalo otra vez", "Tómate tu tiempo", "Tú puedes"];

        this.initDOM();
        this.registerEvents();
        this.updateStarDisplay();
    }

    initDOM() {
        this.screens = {
            menu: document.getElementById('screen-menu'),
            game: document.getElementById('screen-game')
        };
        this.playground = document.getElementById('game-playground');
        this.targetSyllableElement = document.getElementById('target-syllable');
        this.starCountElement = document.getElementById('star-count');
        this.feedbackElement = document.getElementById('feedback-message');
        this.modalParents = document.getElementById('modal-parents');
        this.modalCredits = document.getElementById('modal-credits');
        
        document.getElementById('setting-audio').checked = this.settings.audio;
        document.getElementById('setting-narration').checked = this.settings.narration;
    }

    registerEvents() {
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
        document.getElementById('btn-reset').addEventListener('click', () => this.resetProgress());
    }

    /* ==========================================================================
       CARGA ASÍNCRONA DE LA BASE DE DATOS DICCIONARIO
       ========================================================================== */
    async startMode(modeNumber) {
        this.playSystemSound('click');
        this.currentMode = modeNumber;
        this.clearActiveTimers();

        try {
            // 1. Leer el índice general para saber qué mundos existen
            const indexResponse = await fetch('data/index.json');
            if (!indexResponse.ok) throw new Error("No se pudo cargar index.json");
            const indexData = await indexResponse.json();
            this.availableWorlds = indexData.worlds;

            // 2. Elegir un mundo/consonante de forma aleatoria para esta partida
            const randomWorld = this.availableWorlds[Math.floor(Math.random() * this.availableWorlds.length)];
            
            // 3. Cargar el JSON específico de ese mundo (ej: d.json o vocales.json)
            const worldResponse = await fetch(`data/${randomWorld}.json`);
            if (!worldResponse.ok) throw new Error(`No se pudo cargar data/${randomWorld}.json`);
            const worldData = await worldResponse.json();

            // 4. Aplanar el diccionario para trabajar cómodamente a nivel de retos
            this.buildWorkingDictionary(worldData);

            // Cambiar de pantalla
            this.screens.menu.classList.remove('active');
            this.screens.game.classList.add('active');

            this.playModeIntroAudio(modeNumber);
            this.generateChallenge();

        } catch (error) {
            console.error("Error cargando el diccionario silábico:", error);
            alert("Error al cargar la base de datos de consonantes. Verifica que index.json y tus archivos de letras existan en la carpeta /data.");
        }
    }

    // Convierte el JSON jerárquico en una lista plana de combinaciones lista para consumir
    buildWorkingDictionary(worldData) {
        this.loadedDictionary = [];
        let globalIdCounter = 1000;

        worldData.silabas.forEach(group => {
            const currentTargetSyllable = group.silaba;
            group.palabras.forEach(wordDataArray => {
                globalIdCounter++;
                this.loadedDictionary.push({
                    id: globalIdCounter,
                    target: currentTargetSyllable,
                    syllablesArray: wordDataArray,
                    fullWordString: wordDataArray.join("")
                });
            });
        });
    }

    /* ==========================================================================
       GENERADOR DINÁMICO DE RETOS (AQUÍ SUCEDE LA MAGIA)
       ========================================================================== */
    generateChallenge() {
        this.feedbackElement.innerText = "";
        this.clearActiveTimers();
        this.playground.innerHTML = "";

        // Filtrar para evitar repetir la última palabra jugada inmediatamente
        let validOptions = this.loadedDictionary.filter(item => item.id !== this.lastWordId);
        if (validOptions.length === 0) validOptions = this.loadedDictionary;

        // Seleccionar el ítem base del reto de forma aleatoria
        const challengeBase = validOptions[Math.floor(Math.random() * validOptions.length)];
        this.lastWordId = challengeBase.id;
        
        this.targetSyllableElement.innerText = challengeBase.target.toUpperCase();

        // Construir la fábrica de retos según la mecánica del modo de juego elegido
        if (this.currentMode === 1) this.setupMode1(challengeBase);
        if (this.currentMode === 2) this.setupMode2(challengeBase);
        if (this.currentMode === 3) this.setupMode3(challengeBase);
    }

// INTERRUPTOR PARA VOLVER AL MENÚ PRINCIPAL (AÑADE ESTO):
    backToMenu() {
        this.playSystemSound('click');
        this.clearActiveTimers();
        this.screens.game.classList.remove('active');
        this.screens.menu.classList.add('active');
    }

    /* ==========================================================================
       MECÁNICAS REESCRITAS
       ========================================================================== */

    // MODO 1: Encuentra la sílaba dentro de la palabra fragmentada
    setupMode1(challenge) {
        const container = document.createElement('div');
        container.className = 'word-container';

        challenge.syllablesArray.forEach((syllable) => {
            const bubble = document.createElement('div');
            bubble.className = 'syllable-bubble';
            bubble.innerText = syllable.toUpperCase();
            
            bubble.addEventListener('click', () => {
                if (syllable.toUpperCase() === challenge.target.toUpperCase()) {
                    this.handleOutcome(bubble, true);
                } else {
                    this.handleOutcome(bubble, false);
                }
            });
            container.appendChild(bubble);
        });
        this.playground.appendChild(container);
    }

    // MODO 2: Seleccionar la palabra correcta entre 3 alternativas completas
    setupMode2(challenge) {
        const grid = document.createElement('div');
        grid.className = 'words-grid';

        // Buscar señuelos (palabras de la base de datos que NO contengan la sílaba objetivo)
        let decoys = this.loadedDictionary.filter(item => item.target !== challenge.target);
        if (decoys.length < 2) decoys = this.loadedDictionary.filter(item => item.id !== challenge.id);
        
        decoys = this.shuffleArray([...decoys]);

        // Armar el juego de 3 opciones (1 correcta + 2 distractores)
        const options = [
            { text: challenge.fullWordString, correct: true },
            { text: decoys[0]?.fullWordString || "CASA", correct: false },
            { text: decoys[1]?.fullWordString || "GATO", correct: false }
        ];

        this.shuffleArray(options).forEach(opt => {
            const card = document.createElement('div');
            card.className = 'word-card';
            card.innerText = opt.text.toUpperCase();

            card.addEventListener('click', () => {
                if (opt.correct) {
                    this.handleOutcome(card, true);
                } else {
                    this.handleOutcome(card, false);
                }
            });
            grid.appendChild(card);
        });
        this.playground.appendChild(grid);
    }

    // MODO 3: Torbellino flotante de sílabas dispersas
    setupMode3(challenge) {
        const container = document.createElement('div');
        container.className = 'floating-container';
        this.playground.appendChild(container);

        // Extraer distractores mezclando otras sílabas conocidas del diccionario actual
        const allPossibleSyllables = [...new Set(this.loadedDictionary.map(item => item.target))];
        const fakeSyllables = allPossibleSyllables.filter(s => s !== challenge.target);

        // Generar pool dinámico de burbujas flotantes
        let pool = [challenge.target, challenge.target, challenge.target]; // 3 Correctas garantizadas
        for (let i = 0; i < 5; i++) {
            pool.push(fakeSyllables[Math.floor(Math.random() * fakeSyllables.length)] || "MA");
        }
        pool = this.shuffleArray(pool);

        let correctHitsNeeded = 3;
        let dynamicScore = 0;

        pool.forEach((syllable) => {
            const bubble = document.createElement('div');
            bubble.className = 'floating-syllable';
            bubble.innerText = syllable.toUpperCase();

            let posX = Math.random() * (this.playground.clientWidth - 120);
            let posY = Math.random() * (this.playground.clientHeight - 80);
            let dx = (Math.random() - 0.5) * 1.2;
            let dy = (Math.random() - 0.5) * 1.2;

            const move = () => {
                posX += dx; posY += dy;
                if (posX <= 0 || posX >= container.clientWidth - bubble.offsetWidth) dx *= -1;
                if (posY <= 0 || posY >= container.clientHeight - bubble.offsetHeight) dy *= -1;
                
                posX = Math.max(0, Math.min(posX, container.clientWidth - bubble.offsetWidth));
                posY = Math.max(0, Math.min(posY, container.clientHeight - bubble.offsetHeight));

                bubble.style.left = `${posX}px`;
                bubble.style.top = `${posY}px`;

                const animId = requestAnimationFrame(move);
                this.animationFrameIds.push(animId);
            };

            bubble.addEventListener('click', (e) => {
                e.stopPropagation();
                if (syllable.toUpperCase() === challenge.target.toUpperCase()) {
                    if (!bubble.classList.contains('hit-success')) {
                        bubble.classList.add('hit-success');
                        dynamicScore++;
                        this.playSystemSound('success');
                        if (dynamicScore >= correctHitsNeeded) {
                            this.handleOutcome(bubble, true, true);
                        }
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
       NÚCLEO DE EVENTOS UX, LOGROS Y RECOMPENSAS
       ========================================================================== */
    handleOutcome(element, isCorrect, skipSoundTrigger = false, remainsFloating = false) {
        if (isCorrect) {
            element.classList.add('hit-success');
            this.feedbackElement.style.color = "var(--color-success)";
            this.feedbackElement.innerText = this.successTexts[Math.floor(Math.random() * this.successTexts.length)];
            
            if (!skipSoundTrigger) this.playSystemSound('success');
            this.playMotivationAudio(true);
            this.triggerConfetti();

            this.stars++;
            localStorage.setItem('silabin_stars', this.stars);
            this.updateStarDisplay();

            const currentPointerState = this.playground.style.pointerEvents;
            this.playground.style.pointerEvents = 'none';

            setTimeout(() => {
                this.playground.style.pointerEvents = currentPointerState;
                this.generateChallenge();
            }, 2000);

        } else {
            element.classList.add('hit-fail');
            this.feedbackElement.style.color = "var(--color-primary)";
            this.feedbackElement.innerText = this.failTexts[Math.floor(Math.random() * this.failTexts.length)];
            
            this.playSystemSound('fail');
            this.playMotivationAudio(false);

            setTimeout(() => {
                element.classList.remove('hit-fail');
                if (remainsFloating) this.feedbackElement.innerText = "";
            }, 1000);
        }
    }

    /* ==========================================================================
       AUDIO, MULTIMEDIA Y SISTEMA NATIVO WEBAUDIO
       ========================================================================== */
    playSystemSound(type) {
        if (!this.settings.audio) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);

        if (type === 'click') {
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start(); osc.stop(ctx.currentTime + 0.1);
        } else if (type === 'success') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
            osc.start(); osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'fail') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
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
        audio.play().catch(e => console.log("Prevención de bloqueos de interacción de Audio activa."));
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
                x: canvas.width / 2, y: canvas.height / 2,
                radius: Math.random() * 6 + 4,
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
                    active = true; ctx.beginPath();
                    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                    ctx.fillStyle = p.color; ctx.fill();
                }
            });
            if (active) requestAnimationFrame(animateConfetti);
            else ctx.clearRect(0, 0, canvas.width, canvas.height);
        };
        animateConfetti();
    }

    /* ==========================================================================
       INTERRUPTORES AUXILIARES Y UTILS
       ========================================================================== */
    toggleModal(modal, show) {
        this.playSystemSound('click');
        if (show) modal.classList.add('active');
        else modal.classList.remove('active');
    }

    toggleFullscreen() {
        this.playSystemSound('click');
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
                .then(() => document.getElementById('btn-fullscreen').innerText = "Desactivar")
                .catch(() => {});
        } else {
            document.exitFullscreen();
            document.getElementById('btn-fullscreen').innerText = "Activar";
        }
    }

    resetProgress() {
        this.stars = 0;
        localStorage.setItem('silabin_stars', 0);
        this.updateStarDisplay();
        this.playSystemSound('success');
        alert("¡El progreso ha sido reiniciado con éxito!");
        this.toggleModal(this.modalParents, false);
    }

    updateStarDisplay() {
        this.starCountElement.innerText = this.stars;
    }

    clearActiveTimers() {
        this.animationFrameIds.forEach(id => cancelAnimationFrame(id));
        this.animationFrameIds = [];
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new SilabinEngine();
});