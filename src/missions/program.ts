// Reading a saved block program (Blockly's JSON), so lessons can tick off "your turn" tasks as the
// student builds, without loading Blockly into the panel.

export interface BlockJson {
  type: string
  id?: string
  enabled?: boolean
  fields?: Record<string, unknown>
  extraState?: Record<string, unknown>
  inputs?: Record<string, { block?: BlockJson; shadow?: BlockJson }>
  next?: { block?: BlockJson }
  x?: number
  y?: number
}

const live = (b?: BlockJson) => (b && b.enabled !== false ? b : undefined)

/** b, and the blocks clipped under it, in order */
export function stack(b?: BlockJson): BlockJson[] {
  const out: BlockJson[] = []
  for (let x = live(b); x; x = live(x.next?.block)) out.push(x)
  return out
}

/** the blocks in one of b's slots ("DO", "ELSE", …) */
export const slot = (b: BlockJson | undefined, name: string) => stack(b?.inputs?.[name]?.block)

/** the value plugged into one of b's holes ("COND", "IF0", …) */
export const hole = (b: BlockJson | undefined, name: string) => live(b?.inputs?.[name]?.block)

/** every block inside b (b too), through its slots, holes and the blocks under it */
export function within(b?: BlockJson): BlockJson[] {
  const out: BlockJson[] = []
  const visit = (x?: BlockJson) => {
    if (!live(x)) return
    out.push(x!)
    for (const i of Object.values(x!.inputs ?? {})) visit(i.block)
    visit(x!.next?.block)
  }
  visit(b)
  return out
}

/** is a block of one of these types anywhere inside b? */
export const uses = (b: BlockJson | undefined, ...types: string[]) => within(b).some((x) => types.includes(x.type))

/** the blocks under "when started" */
export function mainStack(saved: object | null | undefined): BlockJson[] {
  const tops = ((saved as { blocks?: { blocks?: BlockJson[] } } | null)?.blocks?.blocks ?? []) as BlockJson[]
  const start = tops.find((b) => b.type === 'rover_start' && b.enabled !== false)
  return slot(start, 'DO')
}

/** where the first block matching `test` comes in a stack, after position `from` (-1: not there) */
export function indexAfter(list: BlockJson[], from: number, test: (b: BlockJson) => boolean) {
  if (from < 0) return -1
  for (let i = from + 1; i < list.length; i++) if (test(list[i])) return i
  return -1
}
