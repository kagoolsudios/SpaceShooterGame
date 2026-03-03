(function attachStorage(global) {
	'use strict';

	function loadHighScore(storageKey) {
		try {
			const value = Number(window.localStorage.getItem(storageKey));
			return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
		} catch {
			return 0;
		}
	}

	function saveHighScore(storageKey, value) {
		try {
			window.localStorage.setItem(storageKey, String(Math.max(0, Math.floor(value))));
		} catch {
			// Ignore storage failures in privacy-restricted contexts.
		}
	}

	global.SpaceShooterStorage = Object.freeze({
		loadHighScore,
		saveHighScore
	});
})(window);
