'use strict';

if (
	!window.SpaceShooterConfig ||
	!window.SpaceShooterStorage ||
	!window.SpaceShooterAudio ||
	!window.SpaceShooterUtils
) {
	throw new Error('Space Shooter scripts did not load in the expected order.');
}

const {
	GAME_CONFIG,
	POWERUP_ICONS,
	POWERUP_LABELS,
	STATE,
	STORAGE_KEY
} = window.SpaceShooterConfig;
const { loadHighScore, saveHighScore } = window.SpaceShooterStorage;
const { createAudioController } = window.SpaceShooterAudio;
const { clamp, intersects } = window.SpaceShooterUtils;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const multiplierEl = document.getElementById('multiplier');
const highScoreEl = document.getElementById('highScore');
const powerupIndicatorEl = document.getElementById('powerupIndicator');
const waveBannerEl = document.getElementById('waveBanner');
const startScreenEl = document.getElementById('startScreen');
const pauseScreenEl = document.getElementById('pauseScreen');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const startButtonEl = document.getElementById('startButton');
const restartButtonEl = document.getElementById('restartButton');

const { ensureAudioContext, playSound } = createAudioController();

let rafId = 0;
let bannerTimeoutId = 0;

const keys = Object.create(null);
const enemies = [];
const particles = [];
const powerups = [];
const particlePool = [];
const stars = createStars();

const player = {
x: canvas.width / 2 - 22,
y: canvas.height - 90,
width: 44,
height: 44,
baseSpeed: 340,
health: 100,
maxHealth: 100,
bullets: [],
fireCooldown: 0,
powerup: null,
powerupTimer: 0,
shield: false,
invulnerabilityTimer: 0
};

const game = {
state: STATE.MENU,
score: 0,
highScore: loadHighScore(STORAGE_KEY),
wave: 1,
waveState: null,
spawnTimer: 0,
comboCount: 0,
comboTimer: 0,
multiplier: 1,
screenShakeTime: 0,
screenShakeStrength: 0,
hitFlash: 0,
lastFrameTime: 0
};

const backgroundGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
backgroundGradient.addColorStop(0, '#040817');
backgroundGradient.addColorStop(0.5, '#081425');
backgroundGradient.addColorStop(1, '#040713');

const nebulas = [
{ x: 170, y: 120, radius: 170, color: 'rgba(32, 100, 200, 0.14)' },
{ x: 760, y: 260, radius: 210, color: 'rgba(110, 30, 130, 0.14)' },
{ x: 460, y: 530, radius: 240, color: 'rgba(20, 140, 150, 0.1)' }
];

		class Particle {
			constructor() {
				this.reset(0, 0, '#fff', 1, 1);
			}

			reset(x, y, color, sizeScale, speedScale) {
				const angle = Math.random() * Math.PI * 2;
				const speed = (70 + Math.random() * 260) * speedScale;
				this.x = x;
				this.y = y;
				this.vx = Math.cos(angle) * speed;
				this.vy = Math.sin(angle) * speed;
				this.life = 0.4 + Math.random() * 0.55;
				this.maxLife = this.life;
				this.size = (1.8 + Math.random() * 3.5) * sizeScale;
				this.color = color;
			}

			update(dt) {
				this.x += this.vx * dt;
				this.y += this.vy * dt;
				this.vy += 220 * dt;
				this.life -= dt;
			}

			draw() {
				if (this.life <= 0) return;
				ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
				ctx.fillStyle = this.color;
				ctx.fillRect(this.x, this.y, this.size, this.size);
				ctx.globalAlpha = 1;
			}
		}

		class Enemy {
			constructor(type, waveNumber) {
				this.type = type;
				this.bullets = [];
				this.time = 0;
				this.waveNumber = waveNumber;

				if (type === 'basic') {
					this.width = 40;
					this.height = 40;
					this.speed = 90 + Math.random() * 35 + waveNumber * 2;
					this.health = 1 + (waveNumber >= 9 ? 1 : 0);
					this.points = 14;
					this.color = '#ff5e67';
					this.shootInterval = Math.max(0.95, 1.75 - waveNumber * 0.04);
					this.phase = Math.random() * Math.PI * 2;
				} else if (type === 'fast') {
					this.width = 32;
					this.height = 32;
					this.speed = 165 + Math.random() * 40 + waveNumber * 2;
					this.health = 1;
					this.points = 24;
					this.color = '#ffe46b';
					this.shootInterval = Math.max(0.7, 1.35 - waveNumber * 0.03);
					this.waveAmplitude = 100 + Math.random() * 40;
					this.phase = Math.random() * Math.PI * 2;
				} else if (type === 'tank') {
					this.width = 60;
					this.height = 60;
					this.speed = 56 + waveNumber * 1.4;
					this.health = 6 + Math.floor(waveNumber / 4);
					this.points = 70;
					this.color = '#d073ff';
					this.shootInterval = Math.max(0.75, 1.3 - waveNumber * 0.02);
					this.phase = Math.random() * Math.PI * 2;
				} else {
					this.width = 124;
					this.height = 124;
					this.speed = 76 + waveNumber * 2;
					this.health = 100 + waveNumber * 15;
					this.points = 550 + waveNumber * 35;
					this.color = '#ff9a4a';
					this.shootInterval = 0.55;
					this.vx = 150;
				}

				this.maxHealth = this.health;
				this.shootCooldown = this.shootInterval * (0.5 + Math.random() * 0.7);
				this.x = type === 'boss'
					? canvas.width / 2 - this.width / 2
					: Math.random() * (canvas.width - this.width);
				this.y = type === 'boss' ? -this.height - 20 : -this.height - Math.random() * 120;
			}

			update(dt) {
				this.time += dt;

				if (this.type === 'boss') {
					if (this.y < 62) {
						this.y += 62 * dt;
					} else {
						this.x += this.vx * dt;
						if (this.x <= 12 || this.x >= canvas.width - this.width - 12) {
							this.vx *= -1;
						}
					}
				} else if (this.type === 'fast') {
					this.y += this.speed * dt;
					this.x += Math.sin(this.time * 7 + this.phase) * this.waveAmplitude * dt;
					this.x = clamp(this.x, 0, canvas.width - this.width);
				} else if (this.type === 'tank') {
					this.y += this.speed * dt;
					this.x += Math.sin(this.time * 2.2 + this.phase) * 45 * dt;
					this.x = clamp(this.x, 0, canvas.width - this.width);
				} else {
					this.y += this.speed * dt;
					this.x += Math.sin(this.time * 2.8 + this.phase) * 30 * dt;
					this.x = clamp(this.x, 0, canvas.width - this.width);
				}

				this.shootCooldown -= dt;
				if (this.shootCooldown <= 0 && this.y > -8 && this.y < canvas.height - 40) {
					this.shoot();
					this.shootCooldown = this.shootInterval * (0.8 + Math.random() * 0.35);
				}

				for (let index = this.bullets.length - 1; index >= 0; index--) {
					const bullet = this.bullets[index];
					bullet.x += bullet.vx * dt;
					bullet.y += bullet.vy * dt;
					if (
						bullet.y < -40 ||
						bullet.y > canvas.height + 50 ||
						bullet.x < -50 ||
						bullet.x > canvas.width + 50
					) {
						this.bullets.splice(index, 1);
					}
				}
			}

			shoot() {
				if (this.type === 'basic') {
					spawnEnemyBullet(this, Math.PI / 2, 270, 10);
					playSound(170, 0.08, 'square', 0.08);
					return;
				}

				if (this.type === 'fast') {
					const angle = angleToPlayer(this.x + this.width / 2, this.y + this.height / 2);
					spawnEnemyBullet(this, angle, 320, 11);
					playSound(210, 0.07, 'triangle', 0.06);
					return;
				}

				if (this.type === 'tank') {
					const centerAngle = Math.PI / 2;
					spawnEnemyBullet(this, centerAngle - 0.25, 260, 12);
					spawnEnemyBullet(this, centerAngle, 280, 14);
					spawnEnemyBullet(this, centerAngle + 0.25, 260, 12);
					playSound(145, 0.11, 'square', 0.1);
					return;
				}

				const targetAngle = angleToPlayer(this.x + this.width / 2, this.y + this.height / 2);
				for (let i = -2; i <= 2; i++) {
					spawnEnemyBullet(this, targetAngle + i * 0.14, 305, 14);
				}
				if (Math.random() < 0.34) {
					for (let j = 0; j < 8; j++) {
						const ringAngle = (Math.PI * 2 * j) / 8;
						spawnEnemyBullet(this, ringAngle, 210, 11);
					}
				}
				playSound(120, 0.15, 'sawtooth', 0.15);
			}

			draw() {
				for (let index = 0; index < this.bullets.length; index++) {
					const bullet = this.bullets[index];
					ctx.fillStyle = this.color;
					ctx.shadowBlur = 12;
					ctx.shadowColor = this.color;
					ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
				}
				ctx.shadowBlur = 0;

				ctx.save();
				ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

				const radius = this.width / 2;
				const gradient = ctx.createRadialGradient(0, 0, 5, 0, 0, radius);
				gradient.addColorStop(0, this.color);
				gradient.addColorStop(1, '#050505');
				ctx.fillStyle = gradient;

				ctx.beginPath();
				if (this.type === 'tank') {
					ctx.moveTo(0, -radius);
					ctx.lineTo(radius, -4);
					ctx.lineTo(radius * 0.65, radius);
					ctx.lineTo(-radius * 0.65, radius);
					ctx.lineTo(-radius, -4);
				} else if (this.type === 'boss') {
					ctx.moveTo(0, -radius);
					ctx.lineTo(radius, -radius * 0.15);
					ctx.lineTo(radius * 0.8, radius * 0.8);
					ctx.lineTo(0, radius);
					ctx.lineTo(-radius * 0.8, radius * 0.8);
					ctx.lineTo(-radius, -radius * 0.15);
				} else {
					ctx.moveTo(0, -radius);
					ctx.lineTo(radius, radius * 0.65);
					ctx.lineTo(0, radius * 0.35);
					ctx.lineTo(-radius, radius * 0.65);
				}
				ctx.closePath();
				ctx.fill();
				ctx.lineWidth = this.type === 'boss' ? 3 : 2;
				ctx.strokeStyle = this.color;
				ctx.stroke();
				ctx.restore();

				if (this.maxHealth > 1) {
					const barWidth = this.width;
					const barHeight = 5;
					const hp = Math.max(0, this.health / this.maxHealth);
					ctx.fillStyle = '#291015';
					ctx.fillRect(this.x, this.y - 11, barWidth, barHeight);
					ctx.fillStyle = hp > 0.5 ? '#7dff86' : '#ff9f4a';
					ctx.fillRect(this.x, this.y - 11, barWidth * hp, barHeight);
				}
			}
		}

		class Powerup {
			constructor(x, y) {
				this.x = x;
				this.y = y;
				this.width = 30;
				this.height = 30;
				this.speed = 125;
				this.rotation = Math.random() * Math.PI * 2;
				this.time = 0;

				const roll = Math.random();
				if (roll < 0.26) this.type = 'rapidfire';
				else if (roll < 0.48) this.type = 'shield';
				else if (roll < 0.7) this.type = 'spread';
				else this.type = 'health';

				this.colors = {
					rapidfire: '#63f8ff',
					shield: '#6f9fff',
					spread: '#ea81ff',
					health: '#7cff7f'
				};
			}

			update(dt) {
				this.time += dt;
				this.y += this.speed * dt;
				this.x += Math.sin(this.time * 4) * 24 * dt;
				this.rotation += 2.4 * dt;
			}

			draw() {
				ctx.save();
				ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
				ctx.rotate(this.rotation);
				ctx.shadowBlur = 20;
				ctx.shadowColor = this.colors[this.type];
				ctx.fillStyle = this.colors[this.type];
				ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
				ctx.shadowBlur = 0;
				ctx.restore();

				ctx.fillStyle = '#001015';
				ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(POWERUP_ICONS[this.type], this.x + this.width / 2, this.y + this.height / 2);
			}
		}

		function createStars() {
			const output = [];
			for (let i = 0; i < 170; i++) {
				const layer = i % 3;
				output.push({
					x: Math.random() * canvas.width,
					y: Math.random() * canvas.height,
					size: 0.8 + layer * 0.6 + Math.random() * 0.45,
					speed: 22 + layer * 32 + Math.random() * 24,
					alpha: 0.25 + layer * 0.2 + Math.random() * 0.24
				});
			}
			return output;
		}

		function angleToPlayer(fromX, fromY) {
			const targetX = player.x + player.width / 2;
			const targetY = player.y + player.height / 2;
			return Math.atan2(targetY - fromY, targetX - fromX);
		}

		function spawnEnemyBullet(enemy, angle, speed, height) {
			const width = 5;
			enemy.bullets.push({
				x: enemy.x + enemy.width / 2 - width / 2,
				y: enemy.y + enemy.height / 2,
				width,
				height,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed
			});
		}

		function createParticle(x, y, color, sizeScale = 1, speedScale = 1) {
			const particle = particlePool.pop() || new Particle();
			particle.reset(x, y, color, sizeScale, speedScale);
			particles.push(particle);
		}

		function createParticles(x, y, color, count, sizeScale = 1, speedScale = 1) {
			for (let i = 0; i < count; i++) {
				createParticle(x, y, color, sizeScale, speedScale);
			}
		}

		function addScreenShake(strength, duration) {
			game.screenShakeStrength = Math.max(game.screenShakeStrength, strength);
			game.screenShakeTime = Math.max(game.screenShakeTime, duration);
		}

		function createWaveState(waveNumber) {
			const bossWave = waveNumber % 5 === 0;
			const regularEnemies = 6 + waveNumber * 2;
			return {
				number: waveNumber,
				bossWave,
				totalToSpawn: regularEnemies + (bossWave ? 1 : 0),
				spawned: 0,
				defeated: 0,
				bossSpawned: false
			};
		}

		function startWave(waveNumber) {
			game.wave = waveNumber;
			game.waveState = createWaveState(waveNumber);
			game.spawnTimer = 0.65;
			const bannerText = game.waveState.bossWave
				? `WAVE ${waveNumber} - BOSS`
				: `WAVE ${waveNumber}`;
			showBanner(bannerText, 1600);
			playSound(450, 0.12, 'triangle', 0.22, 130);
			player.health = Math.min(player.maxHealth, player.health + 6 + Math.floor(waveNumber / 2));
		}

		function showBanner(text, durationMs) {
			waveBannerEl.textContent = text;
			waveBannerEl.classList.add('visible');
			if (bannerTimeoutId) {
				clearTimeout(bannerTimeoutId);
			}
			bannerTimeoutId = setTimeout(() => {
				waveBannerEl.classList.remove('visible');
			}, durationMs || 1400);
		}

		function getEnemyCap() {
			return GAME_CONFIG.baseEnemyCap + Math.min(9, Math.floor(game.wave / 2));
		}

		function getSpawnInterval() {
			return Math.max(
				GAME_CONFIG.minSpawnInterval,
				GAME_CONFIG.baseSpawnInterval - game.wave * 0.055
			);
		}

		function pickEnemyType(waveNumber) {
			const tankChance = Math.min(0.32, Math.max(0, (waveNumber - 3) * 0.032));
			const fastChance = Math.min(0.48, 0.18 + waveNumber * 0.022);
			const roll = Math.random();
			if (roll < tankChance) return 'tank';
			if (roll < tankChance + fastChance) return 'fast';
			return 'basic';
		}

		function spawnEnemyForWave() {
			const waveState = game.waveState;
			if (!waveState || waveState.spawned >= waveState.totalToSpawn) return;
			if (enemies.length >= getEnemyCap()) return;

			let type;
			if (waveState.bossWave && !waveState.bossSpawned && waveState.spawned >= waveState.totalToSpawn - 1) {
				type = 'boss';
				waveState.bossSpawned = true;
				showBanner('BOSS ENGAGED', 900);
			} else {
				type = pickEnemyType(waveState.number);
			}

			enemies.push(new Enemy(type, waveState.number));
			waveState.spawned++;
		}

		function resetCombo() {
			game.comboCount = 0;
			game.comboTimer = 0;
			game.multiplier = 1;
		}

		function registerKill() {
			game.comboCount += 1;
			game.comboTimer = GAME_CONFIG.comboWindow;
			const tier = Math.floor(game.comboCount / 5);
			game.multiplier = Math.min(3, 1 + tier * 0.25);
		}

		function updateCombo(dt) {
			if (game.comboTimer <= 0) return;
			game.comboTimer -= dt;
			if (game.comboTimer <= 0) {
				resetCombo();
			}
		}

		function awardEnemyKill(enemy) {
			const gained = Math.round(enemy.points * game.multiplier);
			game.score += gained;
			registerKill();
			if (Math.random() < getPowerupDropChance(enemy.type)) {
				powerups.push(new Powerup(enemy.x + enemy.width / 2 - 15, enemy.y + enemy.height / 2 - 15));
			}
		}

		function getPowerupDropChance(enemyType) {
			if (enemyType === 'boss') return 0.85;
			return Math.min(0.23, 0.11 + game.wave * 0.006);
		}

		function applyPlayerDamage(amount) {
			if (player.shield) {
				player.powerupTimer = Math.max(0, player.powerupTimer - 0.85);
				addScreenShake(4, 0.12);
				playSound(390, 0.07, 'triangle', 0.09, -80);
				if (player.powerupTimer <= 0) {
					player.shield = false;
					player.powerup = null;
				}
				return;
			}
			if (player.invulnerabilityTimer > 0) return;

			player.health -= amount;
			player.invulnerabilityTimer = GAME_CONFIG.playerInvulnerability;
			game.hitFlash = Math.max(game.hitFlash, 0.6);
			addScreenShake(9, 0.2);
			playSound(95, 0.24, 'sawtooth', 0.28);

			if (player.health <= 0) {
				player.health = 0;
				gameOver();
			}
		}

		function applyPowerup(powerupType) {
			if (powerupType === 'health') {
				player.health = Math.min(player.maxHealth, player.health + 32);
			} else {
				player.powerup = powerupType;
				player.powerupTimer = GAME_CONFIG.powerupDuration;
				player.shield = powerupType === 'shield';
			}
			playSound(610, 0.16, 'sine', 0.26, 90);
		}

		function shoot() {
			if (game.state !== STATE.PLAYING) return;
			const bulletX = player.x + player.width / 2 - 2;
			const bulletY = player.y - 9;
			if (player.powerup === 'spread') {
				player.bullets.push(
					{ x: bulletX, y: bulletY, width: 4, height: 14, vx: -170, vy: -560, damage: 1 },
					{ x: bulletX, y: bulletY, width: 4, height: 14, vx: 0, vy: -610, damage: 1 },
					{ x: bulletX, y: bulletY, width: 4, height: 14, vx: 170, vy: -560, damage: 1 }
				);
			} else {
				player.bullets.push({
					x: bulletX,
					y: bulletY,
					width: 4,
					height: 14,
					vx: 0,
					vy: -620,
					damage: 1
				});
			}
			playSound(750, 0.08, 'square', 0.12, -160);
		}

		function updatePlayer(dt) {
			let xAxis = 0;
			let yAxis = 0;
			if (keys.ArrowLeft || keys.a || keys.A) xAxis -= 1;
			if (keys.ArrowRight || keys.d || keys.D) xAxis += 1;
			if (keys.ArrowUp || keys.w || keys.W) yAxis -= 1;
			if (keys.ArrowDown || keys.s || keys.S) yAxis += 1;

			if (xAxis !== 0 && yAxis !== 0) {
				const normalizer = Math.SQRT1_2;
				xAxis *= normalizer;
				yAxis *= normalizer;
			}

			const speedBoost = player.powerup === 'rapidfire' ? 1.08 : 1;
			player.x += xAxis * player.baseSpeed * speedBoost * dt;
			player.y += yAxis * player.baseSpeed * speedBoost * dt;
			player.x = clamp(player.x, 0, canvas.width - player.width);
			player.y = clamp(player.y, 0, canvas.height - player.height);

			player.fireCooldown = Math.max(0, player.fireCooldown - dt);
			if ((keys[' '] || keys.Spacebar || keys.Space) && player.fireCooldown <= 0) {
				shoot();
				player.fireCooldown = player.powerup === 'rapidfire'
					? GAME_CONFIG.rapidFireCooldown
					: GAME_CONFIG.baseFireCooldown;
			}

			for (let index = player.bullets.length - 1; index >= 0; index--) {
				const bullet = player.bullets[index];
				bullet.x += bullet.vx * dt;
				bullet.y += bullet.vy * dt;
				if (
					bullet.y < -30 ||
					bullet.x < -30 ||
					bullet.x > canvas.width + 30
				) {
					player.bullets.splice(index, 1);
				}
			}

			if (player.powerupTimer > 0) {
				player.powerupTimer = Math.max(0, player.powerupTimer - dt);
				if (player.powerupTimer <= 0) {
					player.powerup = null;
					player.shield = false;
				}
			}

			if (player.invulnerabilityTimer > 0) {
				player.invulnerabilityTimer = Math.max(0, player.invulnerabilityTimer - dt);
			}
		}

		function updateStars(dt) {
			for (let index = 0; index < stars.length; index++) {
				const star = stars[index];
				star.y += star.speed * dt;
				if (star.y > canvas.height + 1) {
					star.y = -2;
					star.x = Math.random() * canvas.width;
				}
			}
		}

		function updateEnemies(dt) {
			for (let index = enemies.length - 1; index >= 0; index--) {
				const enemy = enemies[index];
				enemy.update(dt);

				if (enemy.type !== 'boss' && enemy.y > canvas.height + 80) {
					enemies.splice(index, 1);
					if (game.waveState) game.waveState.defeated++;
					applyPlayerDamage(enemy.type === 'tank' ? 14 : 8);
					createParticles(enemy.x + enemy.width / 2, canvas.height - 10, '#ffb082', 16, 1, 0.8);
					resetCombo();
				}
			}
		}

		function updatePowerups(dt) {
			for (let index = powerups.length - 1; index >= 0; index--) {
				const powerup = powerups[index];
				powerup.update(dt);
				if (powerup.y > canvas.height + 40) {
					powerups.splice(index, 1);
				}
			}
		}

		function updateParticles(dt) {
			for (let index = particles.length - 1; index >= 0; index--) {
				const particle = particles[index];
				particle.update(dt);
				if (particle.life <= 0) {
					particles.splice(index, 1);
					particlePool.push(particle);
				}
			}
		}

		function handleCollisions() {
			for (let bulletIndex = player.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
				const bullet = player.bullets[bulletIndex];
				let didHit = false;

				for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
					const enemy = enemies[enemyIndex];
					if (!intersects(bullet, enemy)) continue;

					enemy.health -= bullet.damage;
					didHit = true;
					createParticles(bullet.x, bullet.y, enemy.color, 5, 0.8, 0.9);

					if (enemy.health <= 0) {
						const centerX = enemy.x + enemy.width / 2;
						const centerY = enemy.y + enemy.height / 2;
						createParticles(centerX, centerY, enemy.color, enemy.type === 'boss' ? 70 : 24, 1.2, 1.2);
						awardEnemyKill(enemy);
						enemies.splice(enemyIndex, 1);
						if (game.waveState) game.waveState.defeated++;
						addScreenShake(enemy.type === 'boss' ? 14 : 6, enemy.type === 'boss' ? 0.28 : 0.16);
						playSound(enemy.type === 'boss' ? 90 : 205, enemy.type === 'boss' ? 0.3 : 0.14, 'sawtooth', 0.24);
					} else {
						playSound(320, 0.06, 'square', 0.08);
					}
					break;
				}

				if (didHit) {
					player.bullets.splice(bulletIndex, 1);
				}
			}

			for (let enemyIndex = 0; enemyIndex < enemies.length; enemyIndex++) {
				const enemy = enemies[enemyIndex];
				for (let bulletIndex = enemy.bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
					const bullet = enemy.bullets[bulletIndex];
					if (!intersects(bullet, player)) continue;
					enemy.bullets.splice(bulletIndex, 1);
					createParticles(bullet.x, bullet.y, '#8eeaff', 12, 1, 1);
					applyPlayerDamage(enemy.type === 'boss' ? 15 : 11);
				}
			}

			for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
				const enemy = enemies[enemyIndex];
				if (!intersects(enemy, player)) continue;

				if (enemy.type === 'boss') {
					applyPlayerDamage(22);
					enemy.health -= 3;
					addScreenShake(11, 0.2);
					if (enemy.health <= 0) {
						const centerX = enemy.x + enemy.width / 2;
						const centerY = enemy.y + enemy.height / 2;
						createParticles(centerX, centerY, enemy.color, 70, 1.2, 1.2);
						awardEnemyKill(enemy);
						enemies.splice(enemyIndex, 1);
						if (game.waveState) game.waveState.defeated++;
						playSound(90, 0.3, 'sawtooth', 0.24);
					}
				} else {
					applyPlayerDamage(enemy.type === 'tank' ? 26 : 18);
					createParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, 24, 1.2, 1.1);
					enemies.splice(enemyIndex, 1);
					if (game.waveState) game.waveState.defeated++;
				}
			}

			for (let index = powerups.length - 1; index >= 0; index--) {
				const powerup = powerups[index];
				if (!intersects(powerup, player)) continue;
				applyPowerup(powerup.type);
				powerups.splice(index, 1);
			}
		}

		function updateWaveProgression() {
			const waveState = game.waveState;
			if (!waveState) return;

			if (
				waveState.spawned >= waveState.totalToSpawn &&
				waveState.defeated >= waveState.totalToSpawn &&
				enemies.length === 0
			) {
				const clearBonus = 80 + game.wave * 34;
				game.score += clearBonus;
				showBanner(`WAVE ${game.wave} CLEAR +${clearBonus}`, 1200);
				playSound(530, 0.2, 'triangle', 0.25, 170);
				startWave(game.wave + 1);
			}
		}

		function updateSpawning(dt) {
			if (!game.waveState) return;
			game.spawnTimer -= dt;
			if (game.spawnTimer > 0) return;
			spawnEnemyForWave();
			game.spawnTimer = getSpawnInterval() * (0.85 + Math.random() * 0.3);
		}

		function updateEffects(dt) {
			if (game.screenShakeTime > 0) {
				game.screenShakeTime = Math.max(0, game.screenShakeTime - dt);
			}
			if (game.hitFlash > 0) {
				game.hitFlash = Math.max(0, game.hitFlash - dt * 2.5);
			}
		}

		function updateHud() {
			scoreEl.textContent = `Score: ${game.score}`;
			healthEl.textContent = `Health: ${Math.max(0, Math.floor(player.health))}`;
			highScoreEl.textContent = `High Score: ${game.highScore}`;
			const comboSuffix = game.comboCount >= 2 ? ` (Combo ${game.comboCount})` : '';
			multiplierEl.textContent = `Multiplier: x${game.multiplier.toFixed(2)}${comboSuffix}`;

			if (player.powerupTimer > 0 && player.powerup) {
				const timeLeft = Math.ceil(player.powerupTimer);
				powerupIndicatorEl.textContent = `${POWERUP_LABELS[player.powerup]}: ${timeLeft}s`;
			} else {
				powerupIndicatorEl.textContent = '';
			}
		}

		function drawBackground() {
			ctx.fillStyle = backgroundGradient;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			for (let index = 0; index < nebulas.length; index++) {
				const nebula = nebulas[index];
				const gradient = ctx.createRadialGradient(
					nebula.x,
					nebula.y,
					20,
					nebula.x,
					nebula.y,
					nebula.radius
				);
				gradient.addColorStop(0, nebula.color);
				gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
				ctx.fill();
			}
		}

		function drawStars() {
			for (let index = 0; index < stars.length; index++) {
				const star = stars[index];
				ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
				ctx.fillRect(star.x, star.y, star.size, star.size);
			}
		}

		function drawPowerups() {
			for (let index = 0; index < powerups.length; index++) {
				powerups[index].draw();
			}
		}

		function drawEnemies() {
			for (let index = 0; index < enemies.length; index++) {
				enemies[index].draw();
			}
		}

		function drawPlayer() {
			for (let index = 0; index < player.bullets.length; index++) {
				const bullet = player.bullets[index];
				ctx.fillStyle = '#79f5ff';
				ctx.shadowBlur = 12;
				ctx.shadowColor = '#79f5ff';
				ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
			}
			ctx.shadowBlur = 0;

			if (player.invulnerabilityTimer > 0 && Math.floor(player.invulnerabilityTimer * 18) % 2 === 0) {
				return;
			}

			ctx.save();
			ctx.translate(player.x + player.width / 2, player.y + player.height / 2);

			if (player.shield) {
				ctx.strokeStyle = 'rgba(109, 164, 255, 0.65)';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(0, 0, player.width / 2 + 12, 0, Math.PI * 2);
				ctx.stroke();
			}

			const gradient = ctx.createLinearGradient(0, -player.height / 2, 0, player.height / 2);
			gradient.addColorStop(0, '#88fdff');
			gradient.addColorStop(0.55, '#2cb8df');
			gradient.addColorStop(1, '#0e5686');
			ctx.fillStyle = gradient;

			ctx.beginPath();
			ctx.moveTo(0, -player.height / 2);
			ctx.lineTo(player.width / 2, player.height / 2);
			ctx.lineTo(player.width / 4, player.height / 4);
			ctx.lineTo(-player.width / 4, player.height / 4);
			ctx.lineTo(-player.width / 2, player.height / 2);
			ctx.closePath();
			ctx.fill();

			ctx.strokeStyle = '#8ff7ff';
			ctx.lineWidth = 2;
			ctx.stroke();

			const thrusterAlpha = 0.45 + Math.random() * 0.45;
			ctx.fillStyle = `rgba(122, 244, 255, ${thrusterAlpha})`;
			ctx.fillRect(-5, player.height / 4, 10, 17);

			ctx.restore();
		}

		function drawParticles() {
			for (let index = 0; index < particles.length; index++) {
				particles[index].draw();
			}
		}

		function render() {
			let shakeX = 0;
			let shakeY = 0;
			if (game.screenShakeTime > 0) {
				const strength = game.screenShakeStrength * (game.screenShakeTime + 0.08);
				shakeX = (Math.random() - 0.5) * strength;
				shakeY = (Math.random() - 0.5) * strength;
			}

			ctx.save();
			ctx.translate(shakeX, shakeY);
			drawBackground();
			drawStars();
			drawPowerups();
			drawEnemies();
			drawPlayer();
			drawParticles();
			ctx.restore();

			if (game.hitFlash > 0) {
				ctx.fillStyle = `rgba(255, 70, 70, ${Math.min(0.24, game.hitFlash * 0.25)})`;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
			}
		}

		function update(dt) {
			updateStars(dt);
			updatePlayer(dt);
			updateSpawning(dt);
			updateEnemies(dt);
			updatePowerups(dt);
			updateParticles(dt);
			handleCollisions();
			updateCombo(dt);
			updateWaveProgression();
			updateEffects(dt);
		}

		function hideAllOverlays() {
			startScreenEl.classList.remove('visible');
			pauseScreenEl.classList.remove('visible');
			gameOverEl.classList.remove('visible');
		}

		function clearEntityCollections() {
			enemies.length = 0;
			particles.length = 0;
			powerups.length = 0;
			player.bullets.length = 0;
			particlePool.length = 0;
		}

		function resetPlayerState() {
			player.x = canvas.width / 2 - player.width / 2;
			player.y = canvas.height - 90;
			player.health = player.maxHealth;
			player.fireCooldown = 0;
			player.powerup = null;
			player.powerupTimer = 0;
			player.shield = false;
			player.invulnerabilityTimer = 0;
		}

		function startGame() {
			ensureAudioContext();
			hideAllOverlays();
			clearEntityCollections();
			resetPlayerState();
			resetCombo();

			game.state = STATE.PLAYING;
			game.score = 0;
			game.wave = 1;
			game.spawnTimer = 0.6;
			game.screenShakeStrength = 0;
			game.screenShakeTime = 0;
			game.hitFlash = 0;
			startWave(1);

			Object.keys(keys).forEach((key) => {
				keys[key] = false;
			});

			updateHud();
			render();

			cancelAnimationFrame(rafId);
			game.lastFrameTime = performance.now();
			rafId = requestAnimationFrame(gameLoop);
		}

		function gameOver() {
			if (game.state === STATE.OVER) return;
			game.state = STATE.OVER;
			cancelAnimationFrame(rafId);

				if (game.score > game.highScore) {
					game.highScore = game.score;
					saveHighScore(STORAGE_KEY, game.highScore);
				}

			finalScoreEl.textContent = `Final Score: ${game.score}  |  Best: ${game.highScore}`;
			gameOverEl.classList.add('visible');
			playSound(60, 0.65, 'sawtooth', 0.32);
			updateHud();
		}

		function restartGame() {
			gameOverEl.classList.remove('visible');
			startGame();
		}

		function togglePause() {
			if (game.state === STATE.PLAYING) {
				game.state = STATE.PAUSED;
				pauseScreenEl.classList.add('visible');
				return;
			}
			if (game.state === STATE.PAUSED) {
				game.state = STATE.PLAYING;
				pauseScreenEl.classList.remove('visible');
				game.lastFrameTime = performance.now();
			}
		}

		function gameLoop(timestamp) {
			if (game.state === STATE.OVER || game.state === STATE.MENU) return;
			rafId = requestAnimationFrame(gameLoop);
			if (game.state !== STATE.PLAYING) {
				game.lastFrameTime = timestamp;
				return;
			}

			const dt = Math.min(
				GAME_CONFIG.maxDt,
				Math.max(0, (timestamp - game.lastFrameTime) / 1000)
			);
			game.lastFrameTime = timestamp;

			update(dt);
			render();
			updateHud();
		}

		window.addEventListener('keydown', (event) => {
			ensureAudioContext();
			keys[event.key] = true;

			if (event.key === ' ') {
				event.preventDefault();
			}

			if ((event.key === 'p' || event.key === 'P') && !event.repeat) {
				togglePause();
			}

			if (event.key === 'Enter' && !event.repeat) {
				if (game.state === STATE.MENU || game.state === STATE.OVER) {
					startGame();
				} else if (game.state === STATE.PAUSED) {
					togglePause();
				}
			}
		});

		window.addEventListener('keyup', (event) => {
			keys[event.key] = false;
		});

		if (startButtonEl) {
			startButtonEl.addEventListener('click', startGame);
		}
		if (restartButtonEl) {
			restartButtonEl.addEventListener('click', restartGame);
		}

		updateHud();
		drawBackground();
		drawStars();
