export class PortfolioAudio {
  private context?: AudioContext;
  private ambience?: OscillatorNode;
  private gain?: GainNode;

  async toggle(enabled: boolean) {
    if (!enabled) { this.stop(); return; }
    this.context ??= new AudioContext();
    await this.context.resume();
    if (this.ambience) return;
    this.gain = this.context.createGain();
    this.gain.gain.value = 0.018;
    this.ambience = this.context.createOscillator();
    this.ambience.type = 'sine';
    this.ambience.frequency.value = 82.4;
    this.ambience.connect(this.gain).connect(this.context.destination);
    this.ambience.start();
  }

  playDoor() {
    if (!this.context || !this.ambience) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(392, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(587, this.context.currentTime + 0.18);
    gain.gain.setValueAtTime(0.045, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.45);
    oscillator.connect(gain).connect(this.context.destination); oscillator.start(); oscillator.stop(this.context.currentTime + 0.46);
  }

  dispose() { this.stop(); this.context?.close(); this.context = undefined; }
  private stop() { this.ambience?.stop(); this.ambience = undefined; this.gain?.disconnect(); this.gain = undefined; }
}
