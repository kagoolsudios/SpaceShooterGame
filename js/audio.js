(function attachAudio(global) {
	'use strict';

	function createAudioController() {
		let audioContext = null;

		function ensureAudioContext() {
			if (!audioContext) {
				const AudioCtx = window.AudioContext || window.webkitAudioContext;
				if (!AudioCtx) return;
				audioContext = new AudioCtx();
			}
			if (audioContext.state === 'suspended') {
				audioContext.resume();
			}
		}

		function playSound(frequency, duration, type, volumeMultiplier, sweep = 0) {
			if (!audioContext) return;
			const oscillator = audioContext.createOscillator();
			const gainNode = audioContext.createGain();
			const now = audioContext.currentTime;

			oscillator.connect(gainNode);
			gainNode.connect(audioContext.destination);
			oscillator.type = type || 'sine';
			oscillator.frequency.setValueAtTime(frequency, now);
			if (sweep !== 0) {
				oscillator.frequency.exponentialRampToValueAtTime(
					Math.max(20, frequency + sweep),
					now + duration
				);
			}

			gainNode.gain.setValueAtTime((volumeMultiplier || 0.2) * 0.3, now);
			gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

			oscillator.start(now);
			oscillator.stop(now + duration);
		}

		return {
			ensureAudioContext,
			playSound
		};
	}

	global.SpaceShooterAudio = Object.freeze({
		createAudioController
	});
})(window);
