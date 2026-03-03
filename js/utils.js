(function attachUtils(global) {
	'use strict';

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function intersects(a, b) {
		return (
			a.x < b.x + b.width &&
			a.x + a.width > b.x &&
			a.y < b.y + b.height &&
			a.y + a.height > b.y
		);
	}

	global.SpaceShooterUtils = Object.freeze({
		clamp,
		intersects
	});
})(window);
