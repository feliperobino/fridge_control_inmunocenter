let audioContext = null;
let intervalId = null;

export async function enableAlarmSound() {
  audioContext ||= new AudioContext();

  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

function playBeep() {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const endTime = audioContext.currentTime + 0.22;

  oscillator.type = 'square';
  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.08, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, endTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(endTime);
}

export function startAlarmSound() {
  if (!audioContext || intervalId) return;

  playBeep();
  intervalId = window.setInterval(playBeep, 1800);
}

export function stopAlarmSound() {
  if (!intervalId) return;

  window.clearInterval(intervalId);
  intervalId = null;
}
