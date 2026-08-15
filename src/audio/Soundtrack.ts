// Trilha original sintetizada em tempo real: pop-rock tecnológico com a
// energia de uma banda de garagem dos anos 80/90, sem citar melodias ou
// gravações existentes.
export class Soundtrack {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private timer: number | null = null;
  private nextBeat = 0;
  private beat = 0;
  private active = false;

  get isPlaying(): boolean { return this.active; }

  async start(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = 0.1;
      this.output.connect(this.context.destination);
    }
    await this.context.resume();
    if (this.active) return;
    this.active = true;
    this.nextBeat = this.context.currentTime + 0.06;
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stop(): void {
    this.active = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  setVolume(value: number): void {
    if (!this.output || !this.context) return;
    this.output.gain.cancelScheduledValues(this.context.currentTime);
    this.output.gain.linearRampToValueAtTime(Math.max(0, Math.min(value, 1)) * 0.15, this.context.currentTime + 0.08);
  }

  dispose(): void { this.stop(); void this.context?.close(); this.context = null; this.output = null; }

  private schedule(): void {
    if (!this.context) return;
    while (this.nextBeat < this.context.currentTime + 0.18) {
      this.playBeat(this.nextBeat, this.beat);
      this.nextBeat += 60 / 104 / 2;
      this.beat = (this.beat + 1) % 32;
    }
  }

  private playBeat(at: number, step: number): void {
    // Progressão E menor → C → G → D: familiar, mas composta para o jogo.
    const chords = [
      [82.41, 123.47, 164.81],
      [65.41, 98, 130.81],
      [98, 146.83, 196],
      [73.42, 110, 146.83],
    ];
    const chord = chords[Math.floor(step / 8) % chords.length];
    const inBar = step % 8;

    if (inBar === 0) {
      // Camada sustentada: o lado pop e cinematográfico da faixa.
      chord.forEach((note, index) => this.tone(note * 2, at, 2.13, "triangle", 0.022, index - 1));
    }
    if (inBar % 2 === 0) this.tone(chord[0] / 2, at, 0.31, "sawtooth", 0.15, -0.25);
    if (inBar === 3 || inBar === 5 || inBar === 7) {
      this.tone(chord[(inBar + 1) % 3] * 2, at, 0.16, "square", 0.045, 0.38);
    }
    // Bateria simples: pulsa como rock, mas com textura de máquina arcade.
    if (inBar === 0 || inBar === 5) this.kick(at);
    if (inBar === 4) this.snare(at);
    if (inBar % 2 === 1) this.hat(at);
  }

  private tone(frequency: number, at: number, duration: number, shape: OscillatorType, level: number, pan: number): void {
    if (!this.context || !this.output) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const stereo = this.context.createStereoPanner();
    oscillator.type = shape;
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    stereo.pan.value = pan;
    oscillator.connect(gain).connect(stereo).connect(this.output);
    oscillator.start(at); oscillator.stop(at + duration + 0.02);
  }

  private kick(at: number): void {
    if (!this.context || !this.output) return;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.frequency.setValueAtTime(115, at); oscillator.frequency.exponentialRampToValueAtTime(48, at + 0.13);
    gain.gain.setValueAtTime(0.22, at); gain.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
    oscillator.connect(gain).connect(this.output); oscillator.start(at); oscillator.stop(at + 0.16);
  }

  private noise(at: number, duration: number, level: number, highpass: number): void {
    if (!this.context || !this.output) return;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * duration), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(); const filter = this.context.createBiquadFilter(); const gain = this.context.createGain();
    filter.type = "highpass"; filter.frequency.value = highpass;
    gain.gain.setValueAtTime(level, at); gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.buffer = buffer; source.connect(filter).connect(gain).connect(this.output); source.start(at);
  }

  private snare(at: number): void { this.noise(at, 0.11, 0.08, 1100); }
  private hat(at: number): void { this.noise(at, 0.03, 0.022, 6000); }
}
