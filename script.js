// --- Game Setup & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Preload Images ---
const images = {
    groundTexture: 'images/ground_texture.png',
    thornyBush: 'images/thorny_bush.png',
    obstacleRock: 'images/obstacle_rock.png',
    obstacleSeagull: 'images/obstacle_seagull.png',
    obstacleSnake: 'images/obstacle_snake.png',
    waterDrop: 'images/water_drop.png',
    yellowJerryCan: 'images/yellow_jerry_can.png',
    userSprite: 'images/user_sprite.png'
};
const loadedImages = {};
for (const [key, src] of Object.entries(images)) {
    loadedImages[key] = new Image();
    loadedImages[key].src = src;
}

// --- UI Elements ---
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
// const winScreen = document.getElementById('win-screen'); // REMOVE: not used anymore
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');
const winRestartButton = document.getElementById('winRestartButton');
const learnMoreButton = document.getElementById('learnMoreButton');
const winLearnMoreButton = document.getElementById('winLearnMoreButton');
const pauseResumeButton = document.getElementById('pauseResumeButton');
const finalScoreText = document.getElementById('finalScoreText');
const gameOverFact = document.getElementById('gameOverFact');
const scoreText = document.getElementById('score-text');
const jerrycanFill = document.getElementById('jerrycan-fill');
const factsTicker = document.querySelector('#facts-ticker .fact-text');
const timerValue = document.getElementById('timer-value');
const bestTimeValue = document.getElementById('best-time-value');
const resetButton = document.getElementById('resetButton');
const levelSelect = document.getElementById('level');
const scoreCardButton = document.getElementById('scoreCardButton');
const scoreCardModal = document.getElementById('score-card-modal');
const closeScoreCardModal = document.getElementById('closeScoreCardModal');
const scoreCardList = document.getElementById('scoreCardList');
const helpButton = document.getElementById('helpButton');
const helpModal = document.getElementById('help-modal');
const closeHelpModal = document.getElementById('closeHelpModal');
const winModal = document.getElementById('win-modal');
const closeWinModal = document.getElementById('closeWinModal');

// --- Game State Variables ---
let gameRunning = false;
let gamePaused = false;
let isPaused = false;
let score = 0;
let character;
let obstacles = [];
let waterItems = [];
let animationFrameId;
let lastFrameTime = 0;
let currentLevel = 'easy';
let fallingDroplets = [];
let groundSegments = [];
let splashDroplets = [];
let splashActive = false;

// --- Game Constants ---
const GRAVITY = 0.5;
const JUMP_STRENGTH = -12;
let GAME_SPEED = 7;
const WINNING_SCORE = 100;
const OBSTACLE_SPAWN_INTERVAL_MIN = 800;
const OBSTACLE_SPAWN_INTERVAL_MAX = 1800;
const WATER_ITEM_SPAWN_INTERVAL_MIN = 500;
const WATER_ITEM_SPAWN_INTERVAL_MAX = 1200;
let lastObstacleTime = 0;
let lastWaterItemTime = 0;

// --- Awareness Facts ---
const awarenessFacts = [
    "1 in 10 people lack access to clean water worldwide.",
    "Women and girls spend 200 million hours a day collecting water.",
    "Clean water can reduce child mortality by 21%.",
    "Charity: Water has funded 186,000+ water projects in 29 countries.",
    "Every $1 invested in water and sanitation yields $4-12 in economic returns.",
    "100% of public donations to Charity: Water fund clean water projects."
];
let currentFactIndex = 0;
let factTimer = 0;
const FACT_DISPLAY_TIME = 8000;

// --- Colors ---
const COLORS = {
    BLUE: "#4FC3F7",
    YELLOW: '#FFB300',
    WHITE: '#FFFFFF',
    DARK_GRAY: '#333333',
    LIGHT_BLUE_BG: '#E0F2F7',
    GROUND: '#8B4513'
};

// --- Level Settings ---
const LEVELS = {
    easy: {
        speed: 7,
        obstacleMin: 800,
        obstacleMax: 1800,
        obstacleWidth: 28,
        obstacleHeight: 38
    },
    normal: {
        speed: 10,
        obstacleMin: 600,
        obstacleMax: 1200,
        obstacleWidth: 38,
        obstacleHeight: 48
    },
    hard: {
        speed: 13,
        obstacleMin: 400,
        obstacleMax: 900,
        obstacleWidth: 48,
        obstacleHeight: 58
    }
};

// --- Terrain / Rows Logic ---
const MIN_GROUND_HEIGHT = 50;
const MAX_GROUND_HEIGHT = 150;
const GROUND_SEGMENT_WIDTH_MIN = 200;
const GROUND_SEGMENT_WIDTH_MAX = 500;
const MAX_TERRAIN_DIFFERENCE = 70;

function generateNewGroundSegment() {
    const lastSegment = groundSegments.length > 0 ? groundSegments[groundSegments.length - 1] : null;
    const startX = lastSegment ? lastSegment.endX : 0;
    const width = Math.random() * (GROUND_SEGMENT_WIDTH_MAX - GROUND_SEGMENT_WIDTH_MIN) + GROUND_SEGMENT_WIDTH_MIN;
    const endX = startX + width;
    let newHeight;
    if (lastSegment) {
        const minH = Math.max(MIN_GROUND_HEIGHT, lastSegment.height - MAX_TERRAIN_DIFFERENCE);
        const maxH = Math.min(MAX_GROUND_HEIGHT, lastSegment.height + MAX_TERRAIN_DIFFERENCE);
        newHeight = Math.random() * (maxH - minH) + minH;
    } else {
        newHeight = MIN_GROUND_HEIGHT;
    }
    groundSegments.push({ startX, endX, height: newHeight });
}

function updateGroundSegments(dt = 1) {
    groundSegments = groundSegments.filter(segment => segment.endX > 0);
    groundSegments.forEach(segment => {
        segment.startX -= GAME_SPEED * dt;
        segment.endX -= GAME_SPEED * dt;
    });
    if (groundSegments.length === 0 || groundSegments[groundSegments.length - 1].endX < canvas.width + 100) {
        generateNewGroundSegment();
    }
}

function getCurrentGroundHeight(xPos) {
    for (const segment of groundSegments) {
        if (xPos >= segment.startX && xPos < segment.endX) {
            return segment.height;
        }
    }
    return -Infinity;
}

function getRowY(row, itemHeight = 36) {
    const groundHeight = getCurrentGroundHeight(canvas.width);
    if (row === 'ground') {
        return canvas.height - groundHeight - itemHeight - 2;
    } else if (row === 'middle') {
        return canvas.height - groundHeight - 110;
    } else if (row === 'top') {
        return canvas.height - groundHeight - 180;
    }
    return canvas.height - groundHeight - itemHeight - 2;
}

// --- Game Objects ---
function Character() {
    this.x = 80;
    this.y = canvas.height - MIN_GROUND_HEIGHT - 60;
    this.width = 40;
    this.height = 60;
    this.velocityY = 0;
    this.isJumping = false;
    this.groundY = canvas.height - MIN_GROUND_HEIGHT;

    this.draw = function() {
        if (
            loadedImages.userSprite &&
            loadedImages.userSprite.complete &&
            loadedImages.userSprite.naturalWidth !== 0
        ) {
            ctx.drawImage(loadedImages.userSprite, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = COLORS.BLUE;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    };

    this.update = function(dt = 1) {
        this.velocityY += GRAVITY * dt;
        this.y += this.velocityY * dt;
        this.groundY = canvas.height - getCurrentGroundHeight(this.x + this.width / 2);
        if (this.y + this.height >= this.groundY) {
            this.y = this.groundY - this.height;
            this.isJumping = false;
            this.velocityY = 0;
        }
        if (this.y > canvas.height + 50 || this.x < -this.width) {
            endGame("stuck");
        }
    };

    this.jump = function() {
        if (!this.isJumping) {
            this.velocityY = JUMP_STRENGTH;
            this.isJumping = true;
            playSound(sounds.jump);
        }
    };
}

function Obstacle(x, y, width, height, type) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isHit = false;
    this.type = type;

    this.draw = function() {
        if (this.type === 'bush' && loadedImages.thornyBush.complete && loadedImages.thornyBush.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.thornyBush, this.x, this.y, this.width, this.height);
        } else if (this.type === 'rock' && loadedImages.obstacleRock.complete && loadedImages.obstacleRock.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.obstacleRock, this.x, this.y, this.width, this.height);
        } else if (this.type === 'seagull' && loadedImages.obstacleSeagull.complete && loadedImages.obstacleSeagull.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.obstacleSeagull, this.x, this.y, this.width, this.height);
        } else if (this.type === 'snake' && loadedImages.obstacleSnake.complete && loadedImages.obstacleSnake.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.obstacleSnake, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = COLORS.DARK_GRAY;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }
    };

    this.update = function(dt = 1) {
        this.x -= GAME_SPEED * dt;
    };
}

function WaterItem(x, y, width, height, type = 'drop') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.collected = false;
    this.type = type;
    this.value = (type === 'barrel') ? 5 : 1;

    this.draw = function() {
        if (this.type === 'barrel' && loadedImages.yellowJerryCan.complete && loadedImages.yellowJerryCan.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.yellowJerryCan, this.x, this.y, this.width, this.height);
        } else if (this.type === 'drop' && loadedImages.waterDrop.complete && loadedImages.waterDrop.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.waterDrop, this.x, this.y, this.width, this.height);
        } else {
            ctx.fillStyle = this.type === 'barrel' ? COLORS.YELLOW : COLORS.BLUE;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    };

    this.update = function(dt = 1) {
        this.x -= GAME_SPEED * dt;
    };
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// --- Timer ---
let startTime = 0;
let elapsedTime = 0;
let timerRunning = false;
let bestTime = null;

function startTimer() {
    startTime = performance.now();
    elapsedTime = 0;
    timerRunning = true;
}

function stopTimer() {
    timerRunning = false;
}

function resetTimer() {
    elapsedTime = 0;
    if (timerValue) timerValue.textContent = "0.00";
}

function updateTimer(currentTime) {
    if (timerRunning) {
        elapsedTime = (currentTime - startTime) / 1000;
        if (timerValue) timerValue.textContent = elapsedTime.toFixed(2);
    }
}

function loadBestTime() {
    const stored = localStorage.getItem('waterRunnerBestTime');
    bestTime = stored ? parseFloat(stored) : null;
    if (bestTimeValue) bestTimeValue.textContent = bestTime ? bestTime.toFixed(2) : "--";
}

function saveBestTime(time) {
    if (!bestTime || time < bestTime) {
        bestTime = time;
        localStorage.setItem('waterRunnerBestTime', bestTime);
        if (bestTimeValue) bestTimeValue.textContent = bestTime.toFixed(2);
    }
}

// --- Water Splash Effect ---
const SPLASH_DROPLET_COUNT = 32;

function startSplashEffect() {
    splashDroplets = [];
    splashActive = true;
    for (let i = 0; i < SPLASH_DROPLET_COUNT; i++) {
        const angle = Math.random() * Math.PI;
        const speed = 6 + Math.random() * 6;
        splashDroplets.push({
            x: canvas.width / 2,
            y: canvas.height - 60,
            vx: Math.cos(angle) * speed,
            vy: -Math.abs(Math.sin(angle) * speed) - 2,
            radius: 6 + Math.random() * 6,
            alpha: 1
        });
    }
}

function updateSplashEffect(dt = 1) {
    if (!splashActive) return;
    splashDroplets.forEach(d => {
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 0.35 * dt;
        d.alpha -= 0.012 * dt;
    });
    splashDroplets = splashDroplets.filter(d => d.alpha > 0);
    if (splashDroplets.length === 0) splashActive = false;
}

function drawSplashEffect() {
    if (!splashActive) return;
    splashDroplets.forEach(d => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, d.alpha);
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.BLUE;
        ctx.shadowColor = COLORS.BLUE;
        ctx.shadowBlur = 8;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(d.x + d.radius/3, d.y - d.radius/3, d.radius/3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.shadowBlur = 0;
        ctx.fill();

        ctx.restore();
    });
}

// --- Sound Effects ---
const sounds = {
    jump: new Audio('sounds/jump.mp3'),
    collect: new Audio('sounds/water_drip.wav'),
    hit: new Audio('sounds/sprite_ouch.mp3'),
    win: new Audio('sounds/winning_game.mp3'),
    reset: new Audio('sounds/reset_button.mp3'),
    pause: new Audio('sounds/pause_button.mp3'),
    help: new Audio('sounds/help_button.mp3'),
    scoreCard: new Audio('sounds/score_card.mp3')
};

// Utility to play a sound safely
function playSound(sound, isRapid = false) {
    if (!sound) return;
    if (isRapid) {
        const s = new Audio(sound.src);
        s.volume = sound.volume ?? 1;
        s.play();
    } else {
        sound.currentTime = 0;
        sound.play();
    }
}

// --- Update Character jump to play sound ---
Character.prototype.jump = function() {
    if (!this.isJumping) {
        this.velocityY = JUMP_STRENGTH;
        this.isJumping = true;
        playSound(sounds.jump);
    }
};

// --- Play sound when collecting water ---
function collectWaterItem(index) {
    score = Math.max(0, score + waterItems[index].value);
    updateJerryCan();
    waterItems.splice(index, 1);
    playSound(sounds.collect, true);
}

// --- Play sound when hitting obstacle ---
function hitObstacle(obstacle) {
    score = Math.max(0, score - 3);
    updateJerryCan();
    obstacle.isHit = true;
    playSound(sounds.hit);
}

// --- Background Music by Level ---
const backgroundMusic = {
    easy: new Audio('sounds/level_one_background_music.mp3'),
    normal: new Audio('sounds/level_two_background_music.mp3'),
    hard: new Audio('sounds/level_three_background_music.mp3')
};

for (const music of Object.values(backgroundMusic)) {
    music.loop = true;
    music.volume = 0.5;
}

function stopAllMusic() {
    for (const music of Object.values(backgroundMusic)) {
        music.pause();
        music.currentTime = 0;
    }
}

function playLevelMusic(level) {
    stopAllMusic();
    if (backgroundMusic[level]) {
        backgroundMusic[level].play();
    }
}

// --- Game Loop ---
function gameLoop(currentTime) {
    if (!gameRunning || gamePaused) return;

    const deltaTime = currentTime - lastFrameTime || 16.67;
    lastFrameTime = currentTime;
    const dt = deltaTime / 16.67;

    updateTimer(currentTime);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.LIGHT_BLUE_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    updateGroundSegments(dt);

    groundSegments.forEach(segment => {
        if (loadedImages.groundTexture.complete && loadedImages.groundTexture.naturalWidth !== 0) {
            ctx.drawImage(
                loadedImages.groundTexture,
                segment.startX,
                canvas.height - segment.height,
                segment.endX - segment.startX,
                segment.height
            );
        } else {
            ctx.fillStyle = COLORS.GROUND;
            ctx.fillRect(segment.startX, canvas.height - segment.height, segment.endX - segment.startX, segment.height);
        }
    });

    character.update(dt);
    character.draw();

    const obstacleMin = LEVELS[currentLevel].obstacleMin;
    const obstacleMax = LEVELS[currentLevel].obstacleMax;
    const obstacleWidth = LEVELS[currentLevel].obstacleWidth;
    const obstacleHeight = LEVELS[currentLevel].obstacleHeight;
    if (currentTime - lastObstacleTime > Math.random() * (obstacleMax - obstacleMin) + obstacleMin) {
        const spawnX = canvas.width;
        const groundAtSpawnX = getCurrentGroundHeight(spawnX);
        if (groundAtSpawnX !== -Infinity) {
            let type, y;
            const rand = Math.random();
            if (rand < 0.3) {
                type = 'bush';
                y = canvas.height - groundAtSpawnX - obstacleHeight;
            } else if (rand < 0.6) {
                type = 'rock';
                y = canvas.height - groundAtSpawnX - obstacleHeight;
            } else if (rand < 0.8) {
                type = 'snake';
                y = canvas.height - groundAtSpawnX - obstacleHeight;
            } else {
                type = 'seagull';
                const seagullRow = Math.random() < 0.5 ? 'middle' : 'top';
                y = getRowY(seagullRow, obstacleHeight);
            }
            obstacles.push(new Obstacle(spawnX, y, obstacleWidth, obstacleHeight, type));
            lastObstacleTime = currentTime;
        }
    }

    if (
        currentTime - lastWaterItemTime >
        Math.random() * (WATER_ITEM_SPAWN_INTERVAL_MAX - WATER_ITEM_SPAWN_INTERVAL_MIN) +
        WATER_ITEM_SPAWN_INTERVAL_MIN
    ) {
        const itemWidth = 28;
        const itemHeight = 36;
        const spawnX = canvas.width;
        const groundAtSpawnX = getCurrentGroundHeight(spawnX);
        if (groundAtSpawnX !== -Infinity) {
            const rand = Math.random();
            let row, type;
            if (rand < 0.33) {
                row = 'ground';
                type = 'barrel';
            } else {
                row = Math.random() < 0.5 ? 'middle' : 'top';
                type = 'drop';
            }
            const y = getRowY(row, itemHeight);
            waterItems.push(new WaterItem(spawnX, y, itemWidth, itemHeight, type));
            lastWaterItemTime = currentTime;
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.update(dt);
        obstacle.draw();
        if (!obstacle.isHit && checkCollision(character, obstacle)) {
            hitObstacle(obstacle);

            const jerryCanElem = document.getElementById('score-jerrycan');
            if (jerryCanElem) {
                const rect = jerryCanElem.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                const dropX = rect.left + rect.width / 2 - canvasRect.left - 14;
                const dropY = rect.top + rect.height / 2 - canvasRect.top;
                fallingDroplets.push({
                    x: dropX,
                    y: dropY,
                    width: 28,
                    height: 36,
                    vy: 6
                });
            }
        }
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    for (let i = fallingDroplets.length - 1; i >= 0; i--) {
        const d = fallingDroplets[i];
        d.y += d.vy * dt;
        if (
            loadedImages.waterDrop &&
            loadedImages.waterDrop.complete &&
            loadedImages.waterDrop.naturalWidth !== 0
        ) {
            ctx.drawImage(loadedImages.waterDrop, d.x, d.y, d.width, d.height);
        } else {
            ctx.fillStyle = COLORS.BLUE;
            ctx.beginPath();
            ctx.arc(d.x + d.width / 2, d.y + d.height / 2, d.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        if (d.y > canvas.height) {
            fallingDroplets.splice(i, 1);
        }
    }

    for (let i = waterItems.length - 1; i >= 0; i--) {
        const item = waterItems[i];
        item.update(dt);
        item.draw();
        if (checkCollision(character, item)) {
            collectWaterItem(i);
        } else if (item.x + item.width < 0) {
            waterItems.splice(i, 1);
        }
    }

    if (score >= WINNING_SCORE) {
        winGame();
        startSplashEffect();
        return;
    }

    factTimer += deltaTime;
    if (factTimer >= FACT_DISPLAY_TIME) {
        currentFactIndex = (currentFactIndex + 1) % awarenessFacts.length;
        if (factsTicker) factsTicker.textContent = awarenessFacts[currentFactIndex];
        factTimer = 0;
    }

    drawSplashEffect();
    updateSplashEffect(dt);

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Game Control Functions ---
function initGame() {
    score = 0;
    currentLevel = levelSelect ? levelSelect.value : 'easy';
    GAME_SPEED = LEVELS[currentLevel].speed;
    character = new Character();
    obstacles = [];
    waterItems = [];
    fallingDroplets = [];
    groundSegments = [];
    lastObstacleTime = performance.now();
    lastWaterItemTime = performance.now();
    currentFactIndex = 0;
    factTimer = 0;
    factsTicker.textContent = awarenessFacts[currentFactIndex];
    updateJerryCan();
    generateNewGroundSegment();
    generateNewGroundSegment();
    milestoneShown = false;
    hideMilestonePopup();
}

function closeAllModals() {
    if (helpModal) helpModal.classList.remove('active');
    if (scoreCardModal) scoreCardModal.classList.remove('active');
    if (winModal) winModal.classList.remove('active');
}

function startGame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    initGame();
    closeAllModals();
    if (startScreen) startScreen.classList.remove('active');
    if (gameOverScreen) gameOverScreen.classList.remove('active');
    // winScreen removed
    gameRunning = true;
    gamePaused = false;
    isPaused = false;
    if (pauseResumeButton) pauseResumeButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
    lastFrameTime = performance.now();
    resetTimer();
    startTimer();
    playLevelMusic(currentLevel);
    animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame(reason = "obstacle") {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    stopAllMusic();
    finalScoreText.textContent = `You collected ${score} liters of water.`;
    gameOverFact.textContent = awarenessFacts[Math.floor(Math.random() * awarenessFacts.length)];
    if (gameOverScreen) gameOverScreen.classList.add('active');
    stopTimer();
}

function winGame() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    stopAllMusic();
    if (sounds.win) {
        sounds.win.currentTime = 0;
        sounds.win.play();
    }
    closeAllModals();
    if (winModal) winModal.classList.add('active');
    stopTimer();
    saveBestTime(elapsedTime);
    saveTopTime(elapsedTime);
    startSplashEffect();
    finalScoreText.textContent = `You collected ${score} liters of water in ${elapsedTime.toFixed(2)} seconds!`;    
}

// --- Modal Close Logic ---
function addModalCloseEvents(modal, closeBtn) {
    if (!modal || !closeBtn) return;
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
    document.addEventListener('keydown', (e) => {
        if (modal.classList.contains('active') && (e.key === 'Escape' || e.key === 'Esc')) {
            modal.classList.remove('active');
        }
    });
}
addModalCloseEvents(helpModal, closeHelpModal);
addModalCloseEvents(scoreCardModal, closeScoreCardModal);
addModalCloseEvents(winModal, closeWinModal);

// --- Win Modal Buttons Logic ---
if (winRestartButton) {
    winRestartButton.addEventListener('click', startGame);
}
if (winLearnMoreButton) {
    winLearnMoreButton.addEventListener('click', () => {
        window.open('https://www.charitywater.org/', '_blank');
    });
}
if (closeWinModal && winModal) {
    closeWinModal.addEventListener('click', () => {
        winModal.classList.remove('active');
    });
    winModal.addEventListener('click', (e) => {
        if (e.target === winModal) winModal.classList.remove('active');
    });
    document.addEventListener('keydown', (e) => {
        if (winModal.classList.contains('active') && (e.key === 'Escape' || e.key === 'Esc')) {
            winModal.classList.remove('active');
        }
    });
}

// --- Milestone Popup State ---
let milestoneShown = false;

function showMilestonePopup() {
    const popup = document.getElementById('milestone-popup');
    if (popup) {
        popup.classList.add('active');
        // Hide after 5 seconds (5000 ms)
        setTimeout(() => {
            popup.classList.remove('active');
        }, 5000);
    }
}

function hideMilestonePopup() {
    const popup = document.getElementById('milestone-popup');
    if (popup) popup.classList.remove('active');
}

const closeMilestonePopupBtn = document.getElementById('closeMilestonePopup');
if (closeMilestonePopupBtn) {
    closeMilestonePopupBtn.onclick = hideMilestonePopup;
}

// Optional: close on overlay click or Escape key
const milestonePopup = document.getElementById('milestone-popup');
if (milestonePopup) {
    milestonePopup.addEventListener('click', (e) => {
        if (e.target === milestonePopup) hideMilestonePopup();
    });
    document.addEventListener('keydown', (e) => {
        if (milestonePopup.classList.contains('active') && (e.key === 'Escape' || e.key === 'Esc')) {
            hideMilestonePopup();
        }
    });
}

// --- UI Updates ---
function updateJerryCan() {
    const fillPercentage = Math.min(1, score / WINNING_SCORE);
    jerrycanFill.style.height = `${fillPercentage * 100}%`;
    scoreText.textContent = `${score} L`;
    updateGameSpeed();

    if (!milestoneShown && score >= 50) {
        milestoneShown = true;
        showMilestonePopup();
    }
}

function getGameSpeedForScore(score) {
    let base = LEVELS[currentLevel].speed;
    if (score <= 20) return base;
    if (score <= 40) return base + 2;
    if (score <= 60) return base + 4;
    if (score <= 80) return base + 6;
    return base + 8;
}

function updateGameSpeed() {
    GAME_SPEED = getGameSpeedForScore(score);
}

// --- Responsive Canvas ---
function resizeGame() {
    const container = document.getElementById('game-container');
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
resizeGame();
window.addEventListener('resize', () => {
    resizeGame();
    groundSegments = [];
    generateNewGroundSegment();
    generateNewGroundSegment();
});

// --- Pause/Resume Logic ---
if (pauseResumeButton) {
    pauseResumeButton.addEventListener('click', () => {
        if (!gameRunning) return;
        isPaused = !isPaused;
        gamePaused = isPaused;
        playSound(sounds.pause);
        if (isPaused) {
            pauseResumeButton.innerHTML = '<i class="fa-solid fa-play"></i> Resume';
            for (const music of Object.values(backgroundMusic)) music.pause();
        } else {
            pauseResumeButton.innerHTML = '<i class="fa-solid fa-pause"></i> Pause';
            if (backgroundMusic[currentLevel]) backgroundMusic[currentLevel].play();
            lastFrameTime = performance.now();
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    });
}

// --- Keyboard Controls ---
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameRunning && !gamePaused) {
            character.jump();
        }
        e.preventDefault();
    } else if (e.code === 'KeyP') {
        if (pauseResumeButton) pauseResumeButton.click();
        e.preventDefault();
    }
});

// --- Other UI Event Listeners ---
if (startButton) startButton.addEventListener('click', startGame);
if (restartButton) restartButton.addEventListener('click', startGame);
if (winRestartButton) winRestartButton.addEventListener('click', startGame);

if (learnMoreButton) {
    learnMoreButton.addEventListener('click', () => {
        window.open('https://www.charitywater.org/', '_blank');
    });
}
if (winLearnMoreButton) {
    winLearnMoreButton.addEventListener('click', () => {
        window.open('https://www.charitywater.org/', '_blank');
    });
}

if (resetButton) {
    resetButton.addEventListener('click', () => {
        playSound(sounds.reset);
        gameRunning = false;
        gamePaused = false;
        cancelAnimationFrame(animationFrameId);
        if (startScreen) startScreen.classList.add('active');
        if (gameOverScreen) gameOverScreen.classList.remove('active');
        closeAllModals();
        resetTimer();
        updateJerryCan();
    });
}

if (helpButton && helpModal) {
    helpButton.addEventListener('click', () => {
        playSound(sounds.help);
        helpModal.classList.add('active');
    });
}

// --- Score Card Modal Logic ---
function saveTopTime(time) {
    let topTimes = JSON.parse(localStorage.getItem('waterRunnerTopTimes') || '[]');
    topTimes.push(time);
    topTimes = topTimes.filter(t => !isNaN(t));
    topTimes.sort((a, b) => a - b);
    topTimes = topTimes.slice(0, 5);
    localStorage.setItem('waterRunnerTopTimes', JSON.stringify(topTimes));
}

function loadTopTimes() {
    let topTimes = JSON.parse(localStorage.getItem('waterRunnerTopTimes') || '[]');
    return topTimes.filter(t => !isNaN(t));
}

function updateScoreCardList() {
    const topTimes = loadTopTimes();
    scoreCardList.innerHTML = '';
    if (topTimes.length === 0) {
        scoreCardList.innerHTML = '<li>No times yet. Finish a run to record your time!</li>';
    } else {
        topTimes.forEach((t, i) => {
            const li = document.createElement('li');
            li.textContent = `#${i + 1}: ${t.toFixed(2)}s`;
            scoreCardList.appendChild(li);
        });
    }
}

if (scoreCardButton && scoreCardModal && closeScoreCardModal) {
    scoreCardButton.addEventListener('click', () => {
        playSound(sounds.scoreCard);
        updateScoreCardList();
        scoreCardModal.classList.add('active');
    });
}
