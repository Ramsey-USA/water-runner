// --- Game Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
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

const scoreJerrycan = document.getElementById('score-jerrycan');
const jerrycanFill = document.getElementById('jerrycan-fill');
const scoreText = document.getElementById('score-text');
const factsTicker = document.getElementById('facts-ticker');

// Game State Variables
let gameRunning = false;
let gamePaused = false;
let score = 0;
let character;
let obstacles = [];
let waterItems = [];
let animationFrameId; // To control game loop

// Game Constants
const GRAVITY = 0.5;
const JUMP_STRENGTH = -12;
const GAME_SPEED = 4; // Overall scrolling speed
const WINNING_SCORE = 100; // Liters of water to win

const OBSTACLE_SPAWN_INTERVAL_MIN = 800; // ms
const OBSTACLE_SPAWN_INTERVAL_MAX = 1800; // ms
const WATER_ITEM_SPAWN_INTERVAL_MIN = 500; // ms
const WATER_ITEM_SPAWN_INTERVAL_MAX = 1200; // ms

let lastObstacleTime = 0;
let lastWaterItemTime = 0;

// Awareness Facts
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
const FACT_DISPLAY_TIME = 8000; // ms

// --- Charity: Water Colors ---
const COLORS = {
    BLUE: '#2E86DE',
    YELLOW: '#FFB300',
    WHITE: '#FFFFFF',
    DARK_GRAY: '#333333',
    LIGHT_BLUE_BG: '#E0F2F7',
    GROUND: '#8B4513' // Sienna for ground
};

// --- Terrain / Rows Logic ---
// We'll manage ground segments. Each segment has a startX, endX, and height.
// The character's y position will snap to the current ground segment.
let groundSegments = [];
const MIN_GROUND_HEIGHT = 50; // Minimum height from canvas bottom
const MAX_GROUND_HEIGHT = 150; // Max height from canvas bottom
const GROUND_SEGMENT_WIDTH_MIN = 200;
const GROUND_SEGMENT_WIDTH_MAX = 500;
const MAX_TERRAIN_DIFFERENCE = 70; // Max difference in height between segments

let currentGroundHeight = MIN_GROUND_HEIGHT; // Initial ground height

function generateNewGroundSegment() {
    const lastSegment = groundSegments.length > 0 ? groundSegments[groundSegments.length - 1] : null;
    const startX = lastSegment ? lastSegment.endX : 0;
    const width = Math.random() * (GROUND_SEGMENT_WIDTH_MAX - GROUND_SEGMENT_WIDTH_MIN) + GROUND_SEGMENT_WIDTH_MIN;
    const endX = startX + width;

    // Calculate new height, ensuring it's within limits and not too drastic
    let newHeight;
    if (lastSegment) {
        const minH = Math.max(MIN_GROUND_HEIGHT, lastSegment.height - MAX_TERRAIN_DIFFERENCE);
        const maxH = Math.min(MAX_GROUND_HEIGHT, lastSegment.height + MAX_TERRAIN_DIFFERENCE);
        newHeight = Math.random() * (maxH - minH) + minH;
    } else {
        newHeight = MIN_GROUND_HEIGHT;
    }

    groundSegments.push({
        startX: startX,
        endX: endX,
        height: newHeight // Height from canvas bottom
    });
}

function updateGroundSegments() {
    // Remove off-screen segments
    groundSegments = groundSegments.filter(segment => segment.endX > 0);

    // Shift segments to the left
    groundSegments.forEach(segment => {
        segment.startX -= GAME_SPEED;
        segment.endX -= GAME_SPEED;
    });

    // Add new segments if needed
    if (groundSegments.length === 0 || groundSegments[groundSegments.length - 1].endX < canvas.width + 100) { // +100 for buffering
        generateNewGroundSegment();
    }
}

function getCurrentGroundHeight(xPos) {
    for (const segment of groundSegments) {
        if (xPos >= segment.startX && xPos < segment.endX) {
            return segment.height;
        }
    }
    // If character is not on a segment (e.g., falling in a gap or off-screen)
    return -Infinity; // Represents falling
}

// --- Game Objects ---

// Character object
function Character() {
    this.x = 80;
    this.y = canvas.height - MIN_GROUND_HEIGHT - 60; // Initial Y based on min ground
    this.width = 40;
    this.height = 60;
    this.velocityY = 0;
    this.isJumping = false;
    this.groundY = canvas.height - MIN_GROUND_HEIGHT; // The Y position of the ground beneath character's feet

    this.draw = function() {
        ctx.fillStyle = COLORS.BLUE; // Placeholder character color
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Add more details or use image:
        // ctx.drawImage(characterImage, this.x, this.y, this.width, this.height);
    };

    this.update = function() {
        this.velocityY += GRAVITY;
        this.y += this.velocityY;

        // Get the ground height at the character's current X position
        this.groundY = canvas.height - getCurrentGroundHeight(this.x + this.width / 2);

        // Collision with ground
        if (this.y + this.height >= this.groundY) {
            this.y = this.groundY - this.height;
            this.isJumping = false;
            this.velocityY = 0;
        }

        // Death condition: falling too far below visible ground or being pushed off-screen left
        if (this.y > canvas.height + 50 || this.x < -this.width) { // 50px tolerance for falling
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

// Obstacle object (e.g., contaminated puddles, sharp rocks)
function Obstacle(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.isHit = false; // To prevent multiple hits from one obstacle

    this.draw = function() {
        ctx.fillStyle = COLORS.DARK_GRAY; // Placeholder obstacle color
        ctx.fillRect(this.x, this.y, this.width, this.height);
        // Use image:
        // ctx.drawImage(obstacleImage, this.x, this.y, this.width, this.height);
    };

    this.update = function() {
        this.x -= GAME_SPEED;
    };
}

// Water Item object (e.g., clean water drops, jerrycans)
function WaterItem(x, y, width, height, value) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.value = value || 1; // Default to 1 liter

    this.draw = function() {
        ctx.fillStyle = COLORS.BLUE; // Placeholder water droplet color
        ctx.beginPath();
        ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
        ctx.fill();
        // Use image:
        // ctx.drawImage(waterDropletImage, this.x, this.y, this.width, this.height);
    };

    this.update = function() {
        this.x -= GAME_SPEED;
    };
}

// Collision detection (AABB - Axis-Aligned Bounding Box)
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
           obj1.x + obj1.width > obj2.x &&
           obj1.y < obj2.y + obj2.height &&
           obj1.y + obj1.height > obj2.y;
}

// --- Game Loop and Management ---
let lastFrameTime = 0;

function gameLoop(currentTime) {
    if (!gameRunning || gamePaused) {
        animationFrameId = requestAnimationFrame(gameLoop); // Keep requesting to unpause
        return;
    }

    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = COLORS.LIGHT_BLUE_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Ground
    ctx.fillStyle = COLORS.GROUND;
    groundSegments.forEach(segment => {
        ctx.fillRect(segment.startX, canvas.height - segment.height, segment.endX - segment.startX, segment.height);
    });
    updateGroundSegments();

    // Update and draw character
    character.update();
    character.draw();

    // Generate Obstacles
    if (currentTime - lastObstacleTime > Math.random() * (OBSTACLE_SPAWN_INTERVAL_MAX - OBSTACLE_SPAWN_INTERVAL_MIN) + OBSTACLE_SPAWN_INTERVAL_MIN) {
        const obstacleWidth = Math.random() * (40 - 20) + 20;
        const obstacleHeight = Math.random() * (50 - 30) + 30;
        const spawnX = canvas.width;
        // Spawn on current ground height at spawnX
        const groundAtSpawnX = getCurrentGroundHeight(spawnX);
        if (groundAtSpawnX !== -Infinity) { // Only spawn if there's ground
            obstacles.push(new Obstacle(spawnX, canvas.height - groundAtSpawnX - obstacleHeight, obstacleWidth, obstacleHeight));
            lastObstacleTime = currentTime;
        }
    }

    // Generate Water Items
    if (currentTime - lastWaterItemTime > Math.random() * (WATER_ITEM_SPAWN_INTERVAL_MAX - WATER_ITEM_SPAWN_INTERVAL_MIN) + WATER_ITEM_SPAWN_INTERVAL_MIN) {
        const itemSize = 25;
        const spawnX = canvas.width;
        // Spawn slightly above ground or floating
        const groundAtSpawnX = getCurrentGroundHeight(spawnX);
        if (groundAtSpawnX !== -Infinity) {
            const spawnY = canvas.height - groundAtSpawnX - itemSize - (Math.random() * 50 + 20); // Random height above ground
            waterItems.push(new WaterItem(spawnX, spawnY, itemSize, itemSize, Math.round(Math.random() * 2) + 1)); // Collect 1-3 liters
            lastWaterItemTime = currentTime;
        }
    }

    // Update and draw obstacles
    obstacles.forEach((obstacle, index) => {
        obstacle.update();
        obstacle.draw();
        if (!obstacle.isHit && checkCollision(character, obstacle)) {
            score = Math.max(0, score - 5); // Lose 5 points, but not below 0
            updateJerryCan();
            obstacle.isHit = true; // Mark as hit to prevent repeated penalties
            // Optionally, add a visual cue for hit (e.g., character flash)
        }
        // Remove off-screen obstacles or already hit ones
        if (obstacle.x + obstacle.width < 0) {
            obstacles.splice(index, 1);
        }
    });

    // Update and draw water items
    waterItems.forEach((item, index) => {
        item.update();
        item.draw();
        if (checkCollision(character, item)) {
            score += item.value;
            updateJerryCan();
            waterItems.splice(index, 1); // Remove collected item
        }
        // Remove off-screen items
        if (item.x + item.width < 0) {
            waterItems.splice(index, 1);
        }
    });

    // Check Win Condition
    if (score >= WINNING_SCORE) {
        winGame();
        return; // Stop game loop immediately
    }

    // Update awareness facts ticker
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
    lastObstacleTime = performance.now(); // Reset timers
    lastWaterItemTime = performance.now();
    currentFactIndex = 0;
    factTimer = 0;
    factsTicker.textContent = awarenessFacts[currentFactIndex];
    updateJerryCan();
    generateNewGroundSegment(); // Ensure initial ground
    generateNewGroundSegment(); // Ensure enough ground initially
}

function startGame() {
    initGame();
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    winScreen.classList.remove('active');
    gameRunning = true;
    gamePaused = false;
    pauseResumeButton.textContent = "Pause";
    lastFrameTime = performance.now(); // Initialize lastFrameTime
    animationFrameId = requestAnimationFrame(gameLoop);
}

function endGame(reason = "obstacle") {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId); // Stop the loop

    finalScoreText.textContent = `You collected ${score} liters of water.`;
    // Select a random awareness fact for the game over screen
    gameOverFact.textContent = awarenessFacts[Math.floor(Math.random() * awarenessFacts.length)];
    gameOverScreen.classList.add('active');
}

function winGame() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId); // Stop the loop

    winScreen.classList.add('active');
    // Optionally trigger a visual celebration effect
    console.log("Game Won! Celebration time!");
}

function togglePauseResume() {
    if (!gameRunning) return; // Can't pause if game isn't running
    
    gamePaused = !gamePaused;
    if (gamePaused) {
        pauseResumeButton.textContent = "Resume";
        // Optionally show a "PAUSED" overlay
    } else {
        pauseResumeButton.textContent = "Pause";
        lastFrameTime = performance.now(); // Reset time to prevent jump after resuming
        animationFrameId = requestAnimationFrame(gameLoop); // Restart loop
    }
}

// --- UI Updates ---
function updateJerryCan() {
    const fillPercentage = Math.min(1, score / WINNING_SCORE); // Cap at 100%
    jerrycanFill.style.height = `${fillPercentage * 100}%`;
    scoreText.textContent = `${score} L`;
}

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
    if (e.code === 'KeyP') { // 'P' key for pause/resume
        togglePauseResume();
    }
});

// Initialize game on load
window.onload = () => {
    startScreen.classList.add('active');
    // Ensure jerrycan is in position but empty before game starts
    updateJerryCan();
};
// Ensure the canvas is responsive
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Reinitialize ground segments to fit new canvas size
    groundSegments = [];
    generateNewGroundSegment();
    generateNewGroundSegment(); // Ensure enough ground initially
});
