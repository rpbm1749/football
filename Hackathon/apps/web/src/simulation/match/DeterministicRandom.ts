/**
 * Small deterministic pseudo-random number generator for simulation setup.
 */
export class DeterministicRandom {
  private state: number;

  /**
   * Creates a deterministic generator.
   *
   * @param seed Unsigned 32-bit seed.
   */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /**
   * Returns the next deterministic floating-point value in [0, 1).
   *
   * @returns Deterministic pseudo-random value.
   */
  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  /**
   * Returns a deterministic integer inside an inclusive range.
   *
   * @param min Inclusive lower bound.
   * @param max Inclusive upper bound.
   * @returns Deterministic integer in the requested range.
   */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
