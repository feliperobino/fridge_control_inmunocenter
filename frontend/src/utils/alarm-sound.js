let audioContext = null;
let intervalId = null;

export async function enableAlarmSound() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextConstructor) {
    throw new Error('Web Audio API no disponible');
  }

  audioContext ||= new AudioContextConstructor();

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

function playTone(frequency, startTime, duration) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const endTime = startTime + duration;

  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(0.12, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, endTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function playAlarmPattern() {
  if (!audioContext) return;

  const startTime = audioContext.currentTime;
  playTone(880, startTime, 0.28);
  playTone(660, startTime + 0.32, 0.28);
  playTone(880, startTime + 0.64, 0.28);
}

export function startAlarmSound() {
  if (!audioContext || intervalId) return;

  playAlarmPattern();
  intervalId = window.setInterval(playAlarmPattern, 1500);
}

export function stopAlarmSound() {
  if (!intervalId) return;

  window.clearInterval(intervalId);
  intervalId = null;
}
