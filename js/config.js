(function attachConfig(global) {
	'use strict';

	global.SpaceShooterConfig = Object.freeze({
		STORAGE_KEY: 'advanced-space-shooter-high-score-v2',
		STATE: Object.freeze({
			MENU: 'menu',
			PLAYING: 'playing',
			PAUSED: 'paused',
			OVER: 'over'
		}),
		POWERUP_LABELS: Object.freeze({
			rapidfire: 'RAPID FIRE',
			shield: 'SHIELD',
			spread: 'TRIPLE SHOT'
		}),
		POWERUP_ICONS: Object.freeze({
			rapidfire: 'R',
			shield: 'S',
			spread: 'T',
			health: '+'
		}),
		GAME_CONFIG: Object.freeze({
			maxDt: 1 / 30,
			baseFireCooldown: 0.22,
			rapidFireCooldown: 0.085,
			powerupDuration: 10,
			playerInvulnerability: 0.65,
			comboWindow: 2.7,
			baseSpawnInterval: 1.05,
			minSpawnInterval: 0.3,
			baseEnemyCap: 10
		})
	});
})(window);
