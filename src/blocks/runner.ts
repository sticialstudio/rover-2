// Runs a block program in the simulator. The blocks are turned into the body of a JavaScript generator
// function (see blocks.ts): setting the motors is instant, and every wait, and every pass round a loop,
// hands one action back to the simulator, exactly like delay() and loop() on the Arduino.

import { sim, type Action } from '../sim/sim'

/** one pass round a loop takes this long (the real loop() is even faster) */
const TICK_MS = 1000 / 240

export function compileProgram(js: string): Iterator<Action> {
  const rover = {
    left: 0,
    right: 0,
    node: null as string | null,
    /** the block about to run (for highlighting) */
    at(id: string) {
      this.node = id
    },
    motors(left: number, right: number) {
      this.left = Number(left) || 0
      this.right = Number(right) || 0
    },
    wait(seconds: number): Action {
      return { left: this.left, right: this.right, ms: Math.max(0, Number(seconds) || 0) * 1000, node: this.node }
    },
    tick(id?: string): Action {
      if (id) this.node = id
      return { left: this.left, right: this.right, ms: TICK_MS, node: this.node }
    },
    distance: () => sim.cm,
    line: (side: string) => (side === 'left' ? sim.irL : sim.irR),
    seconds: () => Math.round(sim.time * 100) / 100,
  }
  // the student's own blocks, run in their own browser
  const main = new Function('rover', `return function* main() {\n${js}\n}`)(rover) as () => Generator<Action>
  return (function* run() {
    yield* main()
    // the last motor setting still takes effect (on the Arduino the motors keep running after setup())
    yield { left: rover.left, right: rover.right, ms: 0, node: null }
  })()
}
