// Ensure the script runs after the DOM is fully loaded
window.onload = function() {
    // --- Canvas Setup ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let animationFrameId; // To store the requestAnimationFrame ID

    // --- Game State Variables ---
    const GAME_STATES = {
        MAIN_MENU: 'mainMenu',
        GAMEPLAY: 'gameplay',
        PAUSED: 'paused',
        GAME_OVER: 'gameOver',
        GAME_WIN: 'gameWin',
        SETTINGS: 'settings'
    };
    let currentGameState = GAME_STATES.MAIN_MENU;
    let lastTimestamp = 0; // For delta time calculation
    const targetFPS = 60;
    const frameInterval = 1000 / targetFPS;

    // --- Game Elements (Instances) ---
    let player;
    let obstacles = [];
    let waterDroplets = [];
    let rollingDrums = []; // New obstacle type
    let scoreBar;
    let gravity = 0.5; // Controls jump height and fall speed
    let gameSpeed = 1; // Base speed for obstacles, increases over time
    const initialGameSpeed = 1;
    let waterCollectedCount = 0; // Count droplets to increase speed
    const dropletsPerSpeedIncrease = 10; // Increase speed every X droplets

    // --- UI Elements ---
    const mainMenuScreen = document.getElementById('mainMenu');
    const playButton = document.getElementById('playButton');
    const settingsButton = document.getElementById('settingsButton');
    const leaderboardsButton = document.getElementById('leaderboardsButton');

    const pauseMenuScreen = document.getElementById('pauseMenu');
    const resumeButton = document.getElementById('resumeButton');
    const restartPauseButton = document.getElementById('restartPauseButton');
    const mainMenuPauseButton = document.getElementById('mainMenuPauseButton');

    const gameOverWinScreen = document.getElementById('gameOverWinScreen');
    const resultText = document.getElementById('resultText');
    const finalScoreText = document.getElementById('finalScoreText');
    const playAgainButton = document.getElementById('playAgainButton');
    const mainMenuGameOverButton = document.getElementById('mainMenuGameOverButton');
    const charityLink = document.getElementById('charityLink');

    const settingsScreen = document.getElementById('settingsScreen');
    const musicVolumeSlider = document.getElementById('musicVolume');
    const sfxVolumeSlider = document.getElementById('sfxVolume');
    const vibrationToggle = document.getElementById('vibrationToggle');
    const backSettingsButton = document.getElementById('backSettingsButton');

    // --- Charity: Water Brand Colors (Hex values) ---
    const CHARITY_BLUE = '#2E9DF7'; // Water Blue
    const CHARITY_YELLOW = '#FFC907'; // Jerry Can Yellow
    const CHARITY_DARK_GRAY = '#231F20'; // Text/Accent
    const CHARITY_TEAL = '#8BD1CB'; // Secondary
    const CHARITY_GREEN = '#4FCB53'; // Secondary
    const CHARITY_ORANGE = '#FF902A'; // Secondary
    const CHARITY_RED = '#F5402C'; // Secondary

    // --- Game Settings (can be controlled by settings screen later) ---
    let settings = {
        musicVolume: 0.5, // 0.0 to 1.0
        sfxVolume: 0.75, // 0.0 to 1.0
        vibrationEnabled: true
    };

    // Placeholder for charity facts rotation
    const charityFacts = [
        "Every 90 seconds, a child dies from a water-related disease.",
        "Over 700 million people live without clean water.",
        "Clean water empowers women, improves health, and boosts economies.",
        "charity: water brings clean and safe drinking water to people in developing countries.",
        "100% of public donations fund water projects.",
        "Support charity: water and transform lives with clean water."
    ];
    let currentFactIndex = 0;
    let factDisplayTimer = 0;
    const factDisplayDuration = 5000; // 5 seconds per fact

    // --- Game Object Classes ---

    /**
     * Player Class: Handles player drawing, movement, and jump logic.
     */
    class Player {
        constructor(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.velocityY = 0;
            this.isJumping = false;
            this.groundY = canvas.height * 0.75 - this.height; // Ground level for player
        }

        draw() {
            ctx.fillStyle = CHARITY_GREEN; // Player color (from secondary charity colors)
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Placeholder for text label
            ctx.fillStyle = CHARITY_DARK_GRAY;
            ctx.font = `${0.02 * canvas.width}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText('Player', this.x + this.width / 2, this.y + this.height + 15);
        }

        update(deltaTime) {
            // Apply gravity if not on the ground
            if (this.y < this.groundY) {
                this.velocityY += gravity * deltaTime;
                this.y += this.velocityY * deltaTime;
            } else {
                this.y = this.groundY; // Snap to ground
                this.velocityY = 0;
                this.isJumping = false;
            }
        }

        jump() {
            if (!this.isJumping) {
                this.velocityY = -canvas.height * 0.025; // Jump strength (adjusted for canvas size)
                this.isJumping = true;
                // Play jump sound (if implemented)
                // playSound('jump');
            }
        }

        // Method to get collision bounds
        getBounds() {
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };
        }
    }

    /**
     * Obstacle Class: Base class for moving obstacles.
     */
    class Obstacle {
        constructor(x, y, width, height, color) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.color = color;
            this.baseSpeed = 0.5; // Base speed relative to canvas width
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = CHARITY_DARK_GRAY;
            ctx.font = `${0.02 * canvas.width}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText('Obstacle', this.x + this.width / 2, this.y + this.height + 15);
        }

        update(deltaTime, currentSpeed) {
            this.x -= (this.baseSpeed * canvas.width * currentSpeed) * deltaTime;
        }

        isOffscreen() {
            return this.x + this.width < 0;
        }

        getBounds() {
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };
        }
    }

    /**
     * RollingDrum Class: Specific obstacle type.
     */
    class RollingDrum extends Obstacle {
        constructor(x, y, width, height) {
            super(x, y, width, height, CHARITY_BLUE); // Use charity blue for drum
            this.rotation = 0;
            this.rotationSpeed = 0.1; // Adjust as needed for visual rolling effect
        }

        draw() {
            ctx.save(); // Save current canvas state
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2); // Move origin to center of drum
            ctx.rotate(this.rotation); // Apply rotation
            ctx.fillStyle = this.color;
            ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height); // Draw rectangle from new origin
            ctx.strokeStyle = CHARITY_DARK_GRAY;
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width / 2, -this.height / 2, this.width, this.height);
            // Add bands for drum visual
            ctx.beginPath();
            ctx.moveTo(-this.width / 2, -this.height / 4);
            ctx.lineTo(this.width / 2, -this.height / 4);
            ctx.moveTo(-this.width / 2, this.height / 4);
            ctx.lineTo(this.width / 2, this.height / 4);
            ctx.stroke();

            ctx.restore(); // Restore canvas state

            ctx.fillStyle = CHARITY_DARK_GRAY;
            ctx.font = `${0.02 * canvas.width}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText('Drum', this.x + this.width / 2, this.y + this.height + 15);
        }

        update(deltaTime, currentSpeed) {
            super.update(deltaTime, currentSpeed); // Update position
            this.rotation += this.rotationSpeed * deltaTime; // Update rotation
        }
    }


    /**
     * WaterDroplet Class: Collectible item.
     */
    class WaterDroplet {
        constructor(x, y, radius) {
            this.x = x;
            this.y = y;
            this.radius = radius;
            this.color = CHARITY_BLUE; // Use charity blue for water droplets
            this.baseSpeed = 0.5; // Base speed relative to canvas width
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            // Placeholder for text label
            ctx.fillStyle = CHARITY_DARK_GRAY;
            ctx.font = `${0.02 * canvas.width}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText('Droplet', this.x, this.y + this.radius + 15);
        }

        update(deltaTime, currentSpeed) {
            this.x -= (this.baseSpeed * canvas.width * currentSpeed) * deltaTime;
        }

        isOffscreen() {
            return this.x + this.radius < 0;
        }

        getBounds() {
            return {
                x: this.x - this.radius,
                y: this.y - this.radius,
                width: this.radius * 2,
                height: this.radius * 2
            };
        }
    }

    /**
     * ScoreBar Class: Visual score indicator that fills to win.
     */
    class ScoreBar {
        constructor(x, y, width, height, maxScore) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.maxScore = maxScore; // Number of droplets to fill the bar
            this.currentScore = 0;
            this.fillColor = CHARITY_YELLOW; // Use charity yellow for the fill
            this.emptyColor = '#333'; // Darker color for the empty part
            this.outlineColor = CHARITY_DARK_GRAY;
            this.padding = 5; // Padding inside the bar for the fill
        }

        draw() {
            // Draw empty bar background
            ctx.fillStyle = this.emptyColor;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            // Draw filled portion
            const fillWidth = (this.currentScore / this.maxScore) * this.width;
            ctx.fillStyle = this.fillColor;
            ctx.fillRect(this.x, this.y, fillWidth, this.height);

            // Draw outline
            ctx.strokeStyle = this.outlineColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);

            // Draw text label
            ctx.fillStyle = CHARITY_DARK_GRAY;
            ctx.font = `${0.02 * canvas.width}px Inter`;
            ctx.textAlign = 'left';
            ctx.fillText('Score Bar', this.x, this.y - 10);
        }

        addScore(amount) {
            this.currentScore = Math.min(this.currentScore + amount, this.maxScore);
        }

        isFilled() {
            return this.currentScore >= this.maxScore;
        }

        reset() {
            this.currentScore = 0;
        }
    }

    /**
     * Ground Class: Draws the running path.
     */
    class Ground {
        constructor(y, height) {
            this.y = y;
            this.height = height;
            this.color = '#8B4513'; // Brown color for ground
            this.detailColor = '#A0522D'; // Slightly lighter brown for lines
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.fillRect(0, this.y, canvas.width, this.height);

            // Add simple diagonal lines for detail
            ctx.strokeStyle = this.detailColor;
            ctx.lineWidth = 2;
            for (let i = 0; i < canvas.width; i += canvas.width * 0.05) { // Adjust spacing based on canvas width
                ctx.beginPath();
                ctx.moveTo(i, this.y);
                ctx.lineTo(i + (canvas.width * 0.02), this.y + this.height); // Adjust line length
                ctx.stroke();
            }
        }
    }

    // --- Collision Detection ---
    function checkCollision(obj1, obj2) {
        const b1 = obj1.getBounds();
        const b2 = obj2.getBounds();

        return b1.x < b2.x + b2.width &&
               b1.x + b1.width > b2.x &&
               b1.y < b2.y + b2.height &&
               b1.y + b1.height > b2.y;
    }

    // --- Game Initialization ---
    function initializeGame() {
        // Calculate dynamic sizes based on canvas dimensions
        const playerWidth = canvas.width * 0.05;
        const playerHeight = canvas.height * 0.15;
        const groundHeight = canvas.height * 0.25; // 25% of canvas height
        const groundY = canvas.height - groundHeight;

        player = new Player(canvas.width * 0.1, groundY - playerHeight, playerWidth, playerHeight);
        player.groundY = groundY - playerHeight; // Set player's ground level
        ground = new Ground(groundY, groundHeight);

        const scoreBarWidth = canvas.width * 0.2;
        const scoreBarHeight = canvas.height * 0.03;
        scoreBar = new ScoreBar(
            canvas.width * 0.05, // X position
            canvas.height * 0.05, // Y position
            scoreBarWidth,
            scoreBarHeight,
            20 // Max droplets to fill the bar
        );

        obstacles = [];
        waterDroplets = [];
        rollingDrums = [];
        gameSpeed = initialGameSpeed;
        waterCollectedCount = 0;
        scoreBar.reset();
        currentFactIndex = 0; // Reset fact display
        factDisplayTimer = 0;

        // Reset settings related state
        settings.musicVolume = musicVolumeSlider.value / 100;
        settings.sfxVolume = sfxVolumeSlider.value / 100;
        settings.vibrationEnabled = vibrationToggle.checked;
        // console.log("Game initialized with settings:", settings); // For debugging
    }

    // --- Game Update Loop ---
    let lastObstacleTime = 0;
    const minObstacleInterval = 1000; // milliseconds
    const maxObstacleInterval = 2000;

    let lastDropletTime = 0;
    const minDropletInterval = 500;
    const maxDropletInterval = 1500;

    let lastDrumTime = 0;
    const minDrumInterval = 3000; // Drums are rarer
    const maxDrumInterval = 6000;


    function update(deltaTime) {
        // Update player
        player.update(deltaTime);

        // Generate obstacles and droplets
        if (performance.now() - lastObstacleTime > Math.random() * (maxObstacleInterval - minObstacleInterval) + minObstacleInterval) {
            const obstacleWidth = canvas.width * 0.04;
            const obstacleHeight = canvas.height * 0.1;
            obstacles.push(new Obstacle(canvas.width, player.groundY - obstacleHeight, obstacleWidth, obstacleHeight, CHARITY_RED));
            lastObstacleTime = performance.now();
        }
        if (performance.now() - lastDropletTime > Math.random() * (maxDropletInterval - minDropletInterval) + minDropletInterval) {
            const dropletRadius = canvas.width * 0.015;
            // Droplets can appear at varying heights, considering max jump
            const minY = player.groundY - player.height - (canvas.height * 0.1); // Min height above player
            const maxY = player.groundY - player.height - (canvas.height * 0.25); // Max jump height
            waterDroplets.push(new WaterDroplet(canvas.width, Math.random() * (minY - maxY) + maxY, dropletRadius));
            lastDropletTime = performance.now();
        }

        // Generate rolling drums
        if (performance.now() - lastDrumTime > Math.random() * (maxDrumInterval - minDrumInterval) + minDrumInterval) {
            const drumSize = canvas.width * 0.06;
            rollingDrums.push(new RollingDrum(canvas.width, player.groundY - drumSize, drumSize, drumSize));
            lastDrumTime = performance.now();
        }


        // Update and filter obstacles
        obstacles = obstacles.filter(obstacle => {
            obstacle.update(deltaTime, gameSpeed);
            if (checkCollision(player, obstacle)) {
                endGame(false); // Player loses
                return false; // Remove obstacle on collision
            }
            return !obstacle.isOffscreen();
        });

        // Update and filter water droplets
        waterDroplets = waterDroplets.filter(droplet => {
            droplet.update(deltaTime, gameSpeed);
            if (checkCollision(player, droplet)) {
                scoreBar.addScore(1);
                waterCollectedCount++;
                // Increase game speed every X droplets
                if (waterCollectedCount % dropletsPerSpeedIncrease === 0 && gameSpeed < 3) { // Cap speed increase
                    gameSpeed += 0.2; // Increment speed
                    // playSound('speed_up'); // Implied sound
                }
                // playSound('collect'); // Implied sound
                return false; // Remove droplet on collection
            }
            return !droplet.isOffscreen();
        });

        // Update and filter rolling drums
        rollingDrums = rollingDrums.filter(drum => {
            drum.update(deltaTime, gameSpeed);
            if (checkCollision(player, drum)) {
                endGame(false); // Player loses
                return false; // Remove drum on collision
            }
            return !drum.isOffscreen();
        });


        // Check win condition
        if (scoreBar.isFilled()) {
            endGame(true); // Player wins
        }

        // Update charity facts display
        factDisplayTimer += deltaTime;
        if (factDisplayTimer >= factDisplayDuration) {
            currentFactIndex = (currentFactIndex + 1) % charityFacts.length;
            factDisplayTimer = 0;
        }
    }

    // --- Game Drawing Loop ---
    let ground; // Declare ground here as well

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

        // Draw ground first
        ground.draw();

        // Draw game entities
        player.draw();
        obstacles.forEach(obstacle => obstacle.draw());
        waterDroplets.forEach(droplet => droplet.draw());
        rollingDrums.forEach(drum => drum.draw());


        // Draw score bar (always on top)
        scoreBar.draw();

        // Draw UI text (score, pause icon placeholder)
        ctx.fillStyle = CHARITY_DARK_GRAY;
        ctx.font = `${0.03 * canvas.width}px Inter Bold`;
        ctx.textAlign = 'right';
        ctx.fillText('WATER RUNNER', canvas.width - (canvas.width * 0.05), canvas.height * 0.08);

        // Draw pause button placeholder (actual button is HTML)
        ctx.fillStyle = CHARITY_DARK_GRAY;
        ctx.font = `${0.03 * canvas.width}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText('||', canvas.width * 0.95, canvas.height * 0.08); // Simple pause icon


        // Draw charity fact (bottom bar)
        const factBarHeight = canvas.height * 0.1; // 10% of canvas height
        const factBarY = canvas.height - factBarHeight;
        ctx.fillStyle = CHARITY_BLUE; // Use charity blue for the fact bar
        ctx.fillRect(0, factBarY, canvas.width, factBarHeight);
        ctx.fillStyle = 'white'; // White text for contrast
        ctx.font = `${0.02 * canvas.width}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(charityFacts[currentFactIndex], canvas.width / 2, factBarY + factBarHeight / 2 + 5); // Center text vertically
    }

    // --- Game Loop (main animation frame) ---
    function gameLoop(timestamp) {
        const deltaTime = (timestamp - lastTimestamp) / frameInterval; // Delta time for frame-rate independence
        lastTimestamp = timestamp;

        if (currentGameState === GAME_STATES.GAMEPLAY) {
            update(deltaTime);
            draw();
        } else if (currentGameState === GAME_STATES.PAUSED) {
            // Only draw when paused, don't update game logic
            draw();
        }
        // No drawing for main menu, game over, settings as HTML overlays handle it

        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- Game State Management ---
    function showScreen(screenId) {
        const screens = [mainMenuScreen, pauseMenuScreen, gameOverWinScreen, settingsScreen];
        screens.forEach(screen => {
            if (screen.id === screenId) {
                screen.style.display = 'flex'; // Show as flex container
            } else {
                screen.style.display = 'none'; // Hide others
            }
        });
    }

    function startGame() {
        currentGameState = GAME_STATES.GAMEPLAY;
        initializeGame();
        showScreen(''); // Hide all overlays
        if (!animationFrameId) {
             lastTimestamp = performance.now(); // Reset timestamp for fresh start
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    function pauseGame() {
        currentGameState = GAME_STATES.PAUSED;
        showScreen('pauseMenu');
    }

    function resumeGame() {
        currentGameState = GAME_STATES.GAMEPLAY;
        showScreen('');
    }

    function endGame(hasWon) {
        currentGameState = hasWon ? GAME_STATES.GAME_WIN : GAME_STATES.GAME_OVER;
        cancelAnimationFrame(animationFrameId); // Stop game loop
        animationFrameId = null;

        if (hasWon) {
            resultText.textContent = "VICTORY!";
            finalScoreText.textContent = `Score Bar Filled!`;
            charityLink.style.display = 'inline-block'; // Show link on win
            // playSound('win'); // Implied sound
        } else {
            resultText.textContent = "GAME OVER";
            finalScoreText.textContent = `You hit an obstacle. Try again!`;
            charityLink.style.display = 'none'; // Hide link on lose, or show for general impact
            // playSound('lose'); // Implied sound
        }
        showScreen('gameOverWinScreen');
    }

    function resetGame() {
        // This function will be called by PLAY AGAIN or RESTART buttons
        startGame(); // Re-initialize and start
    }

    function showMainMenu() {
        currentGameState = GAME_STATES.MAIN_MENU;
        cancelAnimationFrame(animationFrameId); // Stop game loop if running
        animationFrameId = null;
        showScreen('mainMenu');
    }

    function showSettings() {
        currentGameState = GAME_STATES.SETTINGS;
        showScreen('settingsScreen');
        // If coming from gameplay/pause, keep the game running in background but paused
        // If coming from main menu, no game running, so state remains settings
    }

    function backFromSettings() {
        // Determine where to go back based on previous state if tracked,
        // otherwise default to main menu or resume if game was already running
        if (player && currentGameState !== GAME_STATES.MAIN_MENU) { // If game was playing/paused before settings
            resumeGame(); // Go back to game (unpause)
        } else {
            showMainMenu(); // Go back to main menu
        }
    }

    // --- Event Listeners ---

    // Game Control Listeners
    canvas.addEventListener('click', () => {
        if (currentGameState === GAME_STATES.GAMEPLAY) {
            player.jump();
        }
    });

    // Pause functionality (Clicking score bar or a dedicated small area)
    // For simplicity, let's use the actual HTML pause button
    // The canvas itself will not have a clickable pause 'icon' in this setup.
    // Instead, the user clicks the HTML pause button if we add one in gameplay overlay,
    // or they rely on the pause menu buttons directly.

    // Menu Button Listeners
    playButton.addEventListener('click', startGame);
    settingsButton.addEventListener('click', showSettings);
    // leaderboardsButton.addEventListener('click', () => alert('Leaderboards Coming Soon!')); // Placeholder

    resumeButton.addEventListener('click', resumeGame);
    restartPauseButton.addEventListener('click', resetGame);
    mainMenuPauseButton.addEventListener('click', showMainMenu);

    playAgainButton.addEventListener('click', resetGame);
    mainMenuGameOverButton.addEventListener('click', showMainMenu);

    backSettingsButton.addEventListener('click', backFromSettings);

    // Initial settings values
    musicVolumeSlider.value = settings.musicVolume * 100;
    sfxVolumeSlider.value = settings.sfxVolume * 100;
    vibrationToggle.checked = settings.vibrationEnabled;

    // Settings change listeners
    musicVolumeSlider.addEventListener('input', (e) => {
        settings.musicVolume = e.target.value / 100;
        // console.log('Music Volume:', settings.musicVolume); // For debugging
        // Implement actual music volume change here
    });
    sfxVolumeSlider.addEventListener('input', (e) => {
        settings.sfxVolume = e.target.value / 100;
        // console.log('SFX Volume:', settings.sfxVolume); // For debugging
        // Implement actual SFX volume change here
    });
    vibrationToggle.addEventListener('change', (e) => {
        settings.vibrationEnabled = e.target.checked;
        // console.log('Vibration Enabled:', settings.vibrationEnabled); // For debugging
        // Implement actual vibration toggle here
    });


    // --- Responsive Canvas Handling ---
    function resizeCanvas() {
        const gameContainer = document.getElementById('game-container');
        // Set canvas dimensions to match its parent container
        canvas.width = gameContainer.clientWidth;
        canvas.height = gameContainer.clientHeight;

        // Re-initialize game elements with new sizes if in gameplay
        // This handles resizing during play, but a full re-init might be too jarring.
        // For simple elements like player/ground/score bar, re-calculate positions and sizes.
        if (player) {
            const playerWidth = canvas.width * 0.05;
            const playerHeight = canvas.height * 0.15;
            const groundHeight = canvas.height * 0.25;
            const groundY = canvas.height - groundHeight;

            player.width = playerWidth;
            player.height = playerHeight;
            player.x = canvas.width * 0.1;
            player.groundY = groundY - player.height;
            player.y = Math.min(player.y, player.groundY); // Prevent player from jumping high if canvas shrinks rapidly

            ground.y = groundY;
            ground.height = groundHeight;

            const scoreBarWidth = canvas.width * 0.2;
            const scoreBarHeight = canvas.height * 0.03;
            scoreBar.x = canvas.width * 0.05;
            scoreBar.y = canvas.height * 0.05;
            scoreBar.width = scoreBarWidth;
            scoreBar.height = scoreBarHeight;
        }

        // Re-draw immediately after resize
        if (currentGameState === GAME_STATES.GAMEPLAY || currentGameState === GAME_STATES.PAUSED) {
            draw();
        }
    }

    // Call resize on load and when window resizes
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial state: Show main menu
    showMainMenu();
};
