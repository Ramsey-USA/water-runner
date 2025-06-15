// --- Game Setup & Constants ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Preload Images ---
const images = {
    groundTexture: 'images/ground_texture.png',
    thornyBush: 'images/thorny_bush.png',
    obstaclePipe: 'images/obstacle_pipe.png',
    obstacleSeagull: 'images/obstacle_seagull.png',
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
const winScreen = document.getElementById('win-screen');
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

// --- Game State Variables ---
let gameRunning = false;
let gamePaused = false;
let score = 0;
let character;
let obstacles = [];
let waterItems = [];
let animationFrameId;
let lastFrameTime = 0;

// --- Game Constants ---
const GRAVITY = 0.5;
const JUMP_STRENGTH = -12;
let GAME_SPEED = 7; // Start at 7
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
    BLUE: '#2E86DE',
    YELLOW: '#FFB300',
    WHITE: '#FFFFFF',
    DARK_GRAY: '#333333',
    LIGHT_BLUE_BG: '#E0F2F7',
    GROUND: '#8B4513'
};

// --- Terrain / Rows Logic ---
let groundSegments = [];
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
        }
    };
}

function Obstacle(x, y, width, height, type) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isHit = false;
    this.type = type; // 'bush', 'pipe', 'seagull'

    this.draw = function() {
        if (this.type === 'bush' && loadedImages.thornyBush.complete && loadedImages.thornyBush.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.thornyBush, this.x, this.y, this.width, this.height);
        } else if (this.type === 'pipe' && loadedImages.obstaclePipe.complete && loadedImages.obstaclePipe.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.obstaclePipe, this.x, this.y, this.width, this.height);
        } else if (this.type === 'seagull' && loadedImages.obstacleSeagull.complete && loadedImages.obstacleSeagull.naturalWidth !== 0) {
            ctx.drawImage(loadedImages.obstacleSeagull, this.x, this.y, this.width, this.height);
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
    this.type = type; // 'drop' or 'barrel'
    this.value = (type === 'barrel') ? 5 : 1; // Jerry can: +5, Droplet: +1

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

// --- Game Loop ---
function gameLoop(currentTime) {
    if (!gameRunning || gamePaused) return;

    // Calculate delta time (dt)
    const deltaTime = currentTime - lastFrameTime || 16.67;
    lastFrameTime = currentTime;
    const dt = deltaTime / 16.67; // 1 at 60fps

    // Draw background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.LIGHT_BLUE_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw and update ground
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

    // Character
    character.update(dt);
    character.draw();

    // Obstacles
    if (currentTime - lastObstacleTime > Math.random() * (OBSTACLE_SPAWN_INTERVAL_MAX - OBSTACLE_SPAWN_INTERVAL_MIN) + OBSTACLE_SPAWN_INTERVAL_MIN) {
        const obstacleWidth = Math.random() * (40 - 20) + 20;
        const obstacleHeight = Math.random() * (50 - 30) + 30;
        const spawnX = canvas.width;
        const groundAtSpawnX = getCurrentGroundHeight(spawnX);
        if (groundAtSpawnX !== -Infinity) {
            let type, y;
            const rand = Math.random();
            if (rand < 0.4) {
                type = 'bush';
                y = canvas.height - groundAtSpawnX - obstacleHeight;
            } else if (rand < 0.8) {
                type = 'pipe';
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

    // Water Items
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

    // Update/draw obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.update(dt);
        obstacle.draw();
        if (!obstacle.isHit && checkCollision(character, obstacle)) {
            score = Math.max(0, score - 3); // Obstacles: -3
            updateJerryCan();
            obstacle.isHit = true;
        }
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Update/draw water items
    for (let i = waterItems.length - 1; i >= 0; i--) {
        const item = waterItems[i];
        item.update(dt);
        item.draw();
        if (checkCollision(character, item)) {
            score = Math.max(0, score + item.value); // Use item.value (+1 or +5)
            updateJerryCan();
            waterItems.splice(i, 1);
        } else if (item.x + item.width < 0) {
            waterItems.splice(i, 1);
        }
    }

    // Win Condition
    if (score >= WINNING_SCORE) {
        winGame();
        return;
    }

    // Awareness facts ticker
    factTimer += deltaTime;
    if (factTimer >= FACT_DISPLAY_TIME) {
        currentFactIndex = (currentFactIndex + 1) % awarenessFacts.length;
        factsTicker.textContent = awarenessFacts[currentFactIndex];
        factTimer = 0;
    }

    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Game Control Functions ---
function initGame() {
    score = 0;
    character = new Character();
    obstacles = [];
    waterItems = [];
    groundSegments = [];
    lastObstacleTime = performance.now();
    lastWaterItemTime = performance.now();
    currentFactIndex = 0;
    factTimer = 0;
    factsTicker.textContent = awarenessFacts[currentFactIndex];
    updateJerryCan();
    generateNewGroundSegment();
    generateNewGroundSegment();
}

function startGame() {
    initGame();
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    winScreen.classList.remove('active');
    gameRunning = true;
    gamePaused = false;
    pauseResumeButton.textContent = "Pause";
    lastFrameTime = performance.now();
    animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame(reason = "obstacle") {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    finalScoreText.textContent = `You collected ${score} liters of water.`;
    gameOverFact.textContent = awarenessFacts[Math.floor(Math.random() * awarenessFacts.length)];
    gameOverScreen.classList.add('active');
}

function winGame() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    winScreen.classList.add('active');
}

function togglePauseResume() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        pauseResumeButton.textContent = "Resume";
    } else {
        pauseResumeButton.textContent = "Pause";
        lastFrameTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function getGameSpeedForScore(score) {
    if (score <= 20) return 7;
    if (score <= 40) return 9;
    if (score <= 60) return 11;
    if (score <= 80) return 13;
    return 15;
}

function updateGameSpeed() {
    GAME_SPEED = getGameSpeedForScore(score);
}

// --- UI Updates ---
function updateJerryCan() {
    const fillPercentage = Math.min(1, score / WINNING_SCORE);
    jerrycanFill.style.height = `${fillPercentage * 100}%`;
    scoreText.textContent = `${score} L`;
    updateGameSpeed();
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

// --- Event Listeners ---
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
winRestartButton.addEventListener('click', startGame);

learnMoreButton.addEventListener('click', () => {
    window.open('https://www.charitywater.org/', '_blank');
});
winLearnMoreButton.addEventListener('click', () => {
    window.open('https://www.charitywater.org/', '_blank');
});

pauseResumeButton.addEventListener('click', togglePauseResume);

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameRunning && !gamePaused) {
        character.jump();
    }
    if (e.code === 'KeyP') {
        togglePauseResume();
    }
});

// --- Initialization ---
window.onload = () => {
    startScreen.classList.add('active');
    updateJerryCan();
};
