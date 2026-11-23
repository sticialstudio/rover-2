// The block editor's handle, filled in by BlocksView once Blockly has loaded. Everything else (the
// missions panel, the mission runner) talks to the editor through here, so it never imports Blockly
// itself and the ~1 MB editor only loads with the Missions tab.

export interface EditorApi {
  /** the program as JavaScript for the simulator (a generator body) */
  js(): string
  /** the program as an Arduino sketch */
  cpp(): string
  /** blocks used (shadow number blocks don't count) */
  count(): number
  /** the program as JSON (for saving) */
  save(): object
  /** load a saved program or a starter */
  load(json: object | null): void
  /** light up the block that is running (null: none) */
  highlight(id: string | null): void
  /** which block types the toolbox shows ('all' = everything) */
  setToolbox(types: string[] | 'all'): void
}

let version = 0
const listeners = new Set<() => void>()

export const editor = {
  api: null as EditorApi | null,
  /** the program has changed (called a moment after the last edit): lessons tick off their tasks */
  changed() {
    version++
    listeners.forEach((l) => l())
  },
  subscribe(l: () => void) {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  },
  version: () => version,
}
