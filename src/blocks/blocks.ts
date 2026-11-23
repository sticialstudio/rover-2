// ROVER blocks for the Missions tab: definitions, the toolbox, and two code generators:
//   - JavaScript for the simulator (runner.ts runs it as a generator, one action per wait / loop pass)
//   - Arduino C++ that runs on the real rover (same library, pins and helpers as src/sketches)

import * as Blockly from 'blockly'
import { javascriptGenerator, Order as JS } from 'blockly/javascript'

// ---------------------------------------------------------------- colours (match the site)
export const COLOURS = {
  start: '#c48a45',
  motion: '#d8392b',
  time: '#d99a1e',
  sensors: '#2f9e6e',
  control: '#3b7fc4',
  logic: '#5b6fb3',
  maths: '#7a5bb3',
  variables: '#a0527a',
}

/** Blockly themes that match the site, light and dark. */
export function theme(dark: boolean) {
  return Blockly.Theme.defineTheme(dark ? 'rover-dark' : 'rover-light', {
    name: dark ? 'rover-dark' : 'rover-light',
    base: Blockly.Themes.Classic,
    componentStyles: dark
      ? {
          workspaceBackgroundColour: '#1c1712',
          toolboxBackgroundColour: '#211a14',
          toolboxForegroundColour: '#f3eadc',
          flyoutBackgroundColour: '#2a2119',
          flyoutForegroundColour: '#f3eadc',
          flyoutOpacity: 0.96,
          scrollbarColour: '#5a4836',
          insertionMarkerColour: '#ffffff',
          insertionMarkerOpacity: 0.3,
          cursorColour: '#ff5a43',
        }
      : {
          workspaceBackgroundColour: '#fbf6ee',
          toolboxBackgroundColour: '#fffaf2',
          toolboxForegroundColour: '#2a2019',
          flyoutBackgroundColour: '#f1e8da',
          flyoutForegroundColour: '#2a2019',
          flyoutOpacity: 0.96,
          scrollbarColour: '#d8c9b0',
        },
    fontStyle: { family: 'Inter, system-ui, sans-serif', weight: '600', size: 11 },
    startHats: true,
  })
}

// ---------------------------------------------------------------- blocks
const speed = (name: string) => ({ type: 'input_value', name, check: 'Number' })

Blockly.common.defineBlocksWithJsonArray([
  {
    type: 'rover_start',
    message0: 'when started',
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    colour: COLOURS.start,
    tooltip: 'Your program starts here (setup() on the Arduino).',
    hat: 'cap',
  },
  {
    type: 'rover_forever',
    message0: 'forever',
    message1: '%1',
    args1: [{ type: 'input_statement', name: 'DO' }],
    previousStatement: null,
    colour: COLOURS.control,
    tooltip: 'Repeat these blocks for ever (like loop() on the Arduino).',
  },
  {
    type: 'rover_drive',
    message0: 'drive %1 at speed %2',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['forward', 'fwd'], ['backward', 'back']] },
      speed('SPEED'),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Both sides at the same speed (0-255). The motors keep going until you change them.',
  },
  {
    type: 'rover_spin',
    message0: 'spin %1 at speed %2',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['left', 'left'], ['right', 'right']] },
      speed('SPEED'),
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Turn on the spot: one side forwards, the other backwards.',
  },
  {
    type: 'rover_motors',
    message0: 'set motors left %1 right %2',
    args0: [speed('LEFT'), speed('RIGHT')],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Each side on its own, -255 (backwards) to 255 (forwards).',
  },
  {
    type: 'rover_stop',
    message0: 'stop',
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Motors off.',
  },
  {
    type: 'rover_drive_for',
    message0: 'drive %1 at speed %2 for %3 seconds',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['forward', 'fwd'], ['backward', 'back']] },
      speed('SPEED'),
      { type: 'input_value', name: 'SECS', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Drive, wait, then stop.',
  },
  {
    type: 'rover_spin_for',
    message0: 'spin %1 at speed %2 for %3 seconds',
    args0: [
      { type: 'field_dropdown', name: 'DIR', options: [['left', 'left'], ['right', 'right']] },
      speed('SPEED'),
      { type: 'input_value', name: 'SECS', check: 'Number' },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.motion,
    tooltip: 'Spin, wait, then stop.',
  },
  {
    type: 'rover_wait',
    message0: 'wait %1 seconds',
    args0: [{ type: 'input_value', name: 'SECS', check: 'Number' }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.time,
    tooltip: 'Keep doing what the motors are doing for this long (delay() on the Arduino).',
  },
  {
    type: 'rover_wait_until',
    message0: 'wait until %1',
    args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }],
    previousStatement: null,
    nextStatement: null,
    colour: COLOURS.time,
    tooltip: 'Keep going until this is true.',
  },
  {
    type: 'rover_distance',
    message0: 'distance (cm)',
    output: 'Number',
    colour: COLOURS.sensors,
    tooltip: 'What the ultrasonic sensor measures straight ahead. 999 = nothing within 4 m.',
  },
  {
    type: 'rover_line',
    message0: '%1 IR sensor sees the line',
    args0: [{ type: 'field_dropdown', name: 'SIDE', options: [['left', 'left'], ['right', 'right']] }],
    output: 'Boolean',
    colour: COLOURS.sensors,
    tooltip: 'True while that IR sensor is over the black tape.',
  },
  {
    type: 'rover_timer',
    message0: 'seconds since start',
    output: 'Number',
    colour: COLOURS.sensors,
    tooltip: 'Time since the program started.',
  },
])

// ---------------------------------------------------------------- toolbox
const num = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } })
interface ToolboxEntry {
  category: string
  json: object
  /** block types the mission must allow for this entry to show */
  needs: string[]
  /** a ready-made combination (shown under its own label) */
  ready?: boolean
}
const TOOLBOX_BLOCKS: ToolboxEntry[] = []
function add(category: string, type: string, inputs?: Record<string, unknown>, fields?: Record<string, unknown>) {
  TOOLBOX_BLOCKS.push({ category, needs: [type], json: { kind: 'block', type, ...(inputs ? { inputs } : {}), ...(fields ? { fields } : {}) } })
}
/** A ready-made sensor question, so the reporter blocks don't have to be found and fitted by hand. */
function ready(category: string, needs: string[], json: object) {
  TOOLBOX_BLOCKS.push({ category, needs, ready: true, json: { kind: 'block', ...json } })
}
const distanceLess = (cm: number) => ({
  block: { type: 'logic_compare', fields: { OP: 'LT' }, inputs: { A: { block: { type: 'rover_distance' } }, B: num(cm) } },
})
const lineSeen = (side: 'left' | 'right') => ({ block: { type: 'rover_line', fields: { SIDE: side } } })
add('Start', 'rover_start')
add('Motion', 'rover_drive_for', { SPEED: num(170), SECS: num(1) })
add('Motion', 'rover_spin_for', { SPEED: num(170), SECS: num(0.5) })
add('Motion', 'rover_drive', { SPEED: num(170) })
add('Motion', 'rover_spin', { SPEED: num(170) })
add('Motion', 'rover_motors', { LEFT: num(170), RIGHT: num(170) })
add('Motion', 'rover_stop')
add('Time', 'rover_wait', { SECS: num(1) })
add('Time', 'rover_wait_until')
add('Sensors', 'rover_distance')
add('Sensors', 'rover_line')
add('Sensors', 'rover_timer')
add('Control', 'rover_forever')
add('Control', 'controls_repeat_ext', { TIMES: num(4) })
add('Control', 'controls_if')
add('Control', 'controls_whileUntil')
add('Logic', 'logic_compare')
add('Logic', 'logic_operation')
add('Logic', 'logic_negate')
add('Logic', 'logic_boolean')
add('Maths', 'math_number', undefined, { NUM: 0 })
add('Maths', 'math_arithmetic', { A: num(1), B: num(1) })
ready('Sensors', ['rover_wait_until', 'logic_compare', 'rover_distance'], { type: 'rover_wait_until', inputs: { COND: distanceLess(20) } })
ready('Sensors', ['controls_if', 'logic_compare', 'rover_distance'], { type: 'controls_if', extraState: { hasElse: true }, inputs: { IF0: distanceLess(30) } })
ready('Sensors', ['rover_wait_until', 'logic_operation', 'rover_line'], {
  type: 'rover_wait_until',
  inputs: { COND: { block: { type: 'logic_operation', fields: { OP: 'OR' }, inputs: { A: lineSeen('left'), B: lineSeen('right') } } } },
})
ready('Sensors', ['controls_if', 'rover_line'], { type: 'controls_if', extraState: { hasElse: true }, inputs: { IF0: lineSeen('left') } })

const CATEGORY_COLOURS: Record<string, string> = {
  Start: COLOURS.start,
  Motion: COLOURS.motion,
  Time: COLOURS.time,
  Sensors: COLOURS.sensors,
  Control: COLOURS.control,
  Logic: COLOURS.logic,
  Maths: COLOURS.maths,
}

/** A toolbox with only these block types ('all' = every block, plus variables). */
export function toolbox(types: string[] | 'all') {
  const want = (t: string) => types === 'all' || types.includes(t)
  const contents: object[] = Object.keys(CATEGORY_COLOURS).flatMap((cat) => {
    const here = TOOLBOX_BLOCKS.filter((b) => b.category === cat && b.needs.every(want))
    const plain = here.filter((b) => !b.ready).map((b) => b.json)
    const made = here.filter((b) => b.ready).map((b) => b.json)
    const blocks = made.length ? [...plain, { kind: 'label', text: 'Ready to use' }, ...made] : plain
    return blocks.length ? [{ kind: 'category', name: cat, colour: CATEGORY_COLOURS[cat], contents: blocks }] : []
  })
  if (types === 'all' || types.includes('variables')) contents.push({ kind: 'category', name: 'Variables', colour: COLOURS.variables, custom: 'VARIABLE' })
  return { kind: 'categoryToolbox', contents } as Blockly.utils.toolbox.ToolboxDefinition
}

// ---------------------------------------------------------------- JavaScript (simulator)
const js = javascriptGenerator
js.STATEMENT_PREFIX = 'rover.at(%1);\n'
js.INFINITE_LOOP_TRAP = 'yield rover.tick(%1);\n'
js.addReservedWords('rover,main')

// just what the block functions use, so they fit both generators
type Gen = Pick<Blockly.CodeGenerator, 'statementToCode' | 'valueToCode' | 'addLoopTrap' | 'getVariableName' | 'nameDB_'>
const sign = (b: Blockly.Block) => (b.getFieldValue('DIR') === 'back' ? '-' : '')
const spinSigns = (b: Blockly.Block) => (b.getFieldValue('DIR') === 'left' ? ['-', ''] : ['', '-'])

js.forBlock['rover_start'] = (b: Blockly.Block, g: Gen) => g.statementToCode(b, 'DO')
js.forBlock['rover_forever'] = (b: Blockly.Block, g: Gen) => {
  const body = g.addLoopTrap(g.statementToCode(b, 'DO'), b)
  return `while (true) {\n${body}}\n`
}
js.forBlock['rover_drive'] = (b: Blockly.Block, g: Gen) => {
  const s = g.valueToCode(b, 'SPEED', JS.NONE) || '0'
  return `rover.motors(${sign(b)}(${s}), ${sign(b)}(${s}));\n`
}
js.forBlock['rover_spin'] = (b: Blockly.Block, g: Gen) => {
  const s = g.valueToCode(b, 'SPEED', JS.NONE) || '0'
  const [l, r] = spinSigns(b)
  return `rover.motors(${l}(${s}), ${r}(${s}));\n`
}
js.forBlock['rover_motors'] = (b: Blockly.Block, g: Gen) =>
  `rover.motors(${g.valueToCode(b, 'LEFT', JS.NONE) || '0'}, ${g.valueToCode(b, 'RIGHT', JS.NONE) || '0'});\n`
js.forBlock['rover_stop'] = () => 'rover.motors(0, 0);\n'
js.forBlock['rover_drive_for'] = (b: Blockly.Block, g: Gen) => {
  const s = g.valueToCode(b, 'SPEED', JS.NONE) || '0'
  const t = g.valueToCode(b, 'SECS', JS.NONE) || '0'
  return `rover.motors(${sign(b)}(${s}), ${sign(b)}(${s}));\nyield rover.wait(${t});\nrover.motors(0, 0);\n`
}
js.forBlock['rover_spin_for'] = (b: Blockly.Block, g: Gen) => {
  const s = g.valueToCode(b, 'SPEED', JS.NONE) || '0'
  const t = g.valueToCode(b, 'SECS', JS.NONE) || '0'
  const [l, r] = spinSigns(b)
  return `rover.motors(${l}(${s}), ${r}(${s}));\nyield rover.wait(${t});\nrover.motors(0, 0);\n`
}
js.forBlock['rover_wait'] = (b: Blockly.Block, g: Gen) => `yield rover.wait(${g.valueToCode(b, 'SECS', JS.NONE) || '0'});\n`
js.forBlock['rover_wait_until'] = (b: Blockly.Block, g: Gen) =>
  `while (!(${g.valueToCode(b, 'COND', JS.NONE) || 'false'})) {\n  yield rover.tick(${JSON.stringify(b.id)});\n}\n`
js.forBlock['rover_distance'] = () => ['rover.distance()', JS.FUNCTION_CALL]
js.forBlock['rover_line'] = (b: Blockly.Block) => [`rover.line(${JSON.stringify(b.getFieldValue('SIDE'))})`, JS.FUNCTION_CALL]
js.forBlock['rover_timer'] = () => ['rover.seconds()', JS.FUNCTION_CALL]

/** The program under "when started", as the body of a generator function. */
export function programJs(ws: Blockly.Workspace) {
  js.init(ws)
  const start = ws.getTopBlocks(true).find((b) => b.type === 'rover_start' && b.isEnabled())
  const code = start ? (js.blockToCode(start) as string) : ''
  return js.finish(code)
}

// ---------------------------------------------------------------- Arduino C++ (real rover)
const cpp = new Blockly.CodeGenerator('Arduino')
const O = { ATOMIC: 0, CALL: 2, UNARY: 3, MUL: 5, ADD: 6, REL: 8, EQ: 9, AND: 13, OR: 14, NONE: 99 }
cpp.INDENT = '  '
cpp.addReservedWords(
  'setup,loop,drive,setSide,readDistanceCm,onLine,startMs,delay,millis,pow,int,long,float,bool,true,false,if,else,while,for,return,frontLeft,rearLeft,rearRight,frontRight,TRIG_PIN,ECHO_PIN,IR_LEFT,IR_RIGHT,LINE',
)
cpp.init = function (ws: Blockly.Workspace) {
  if (!this.nameDB_) this.nameDB_ = new Blockly.Names(this.RESERVED_WORDS_)
  else this.nameDB_.reset()
  this.nameDB_.setVariableMap(ws.getVariableMap())
  this.nameDB_.populateVariables(ws)
  this.isInitialized = true
}
cpp.scrub_ = function (block: Blockly.Block, code: string, thisOnly?: boolean) {
  const next = block.nextConnection?.targetBlock()
  return code + (next && !thisOnly ? this.blockToCode(next) : '')
}
cpp.scrubNakedValue = (line: string) => `${line};\n`

const cv = (g: Gen, b: Blockly.Block, name: string, order: number, fallback = '0') => g.valueToCode(b, name, order) || fallback
/** seconds -> a delay() argument: a whole number when it can be */
const ms = (secs: string) => (/^-?\d+(\.\d+)?$/.test(secs) ? String(Math.round(parseFloat(secs) * 1000)) : `(unsigned long)((${secs}) * 1000)`)

cpp.forBlock['rover_start'] = (b: Blockly.Block, g: Gen) => g.statementToCode(b, 'DO')
cpp.forBlock['rover_forever'] = (b: Blockly.Block, g: Gen) => `while (true) {\n${g.statementToCode(b, 'DO')}}\n`
cpp.forBlock['rover_drive'] = (b: Blockly.Block, g: Gen) => {
  const s = cv(g, b, 'SPEED', O.UNARY)
  return `drive(${sign(b)}${s}, ${sign(b)}${s});\n`
}
cpp.forBlock['rover_spin'] = (b: Blockly.Block, g: Gen) => {
  const s = cv(g, b, 'SPEED', O.UNARY)
  const [l, r] = spinSigns(b)
  return `drive(${l}${s}, ${r}${s});\n`
}
cpp.forBlock['rover_motors'] = (b: Blockly.Block, g: Gen) => `drive(${cv(g, b, 'LEFT', O.NONE)}, ${cv(g, b, 'RIGHT', O.NONE)});\n`
cpp.forBlock['rover_stop'] = () => 'drive(0, 0);\n'
cpp.forBlock['rover_drive_for'] = (b: Blockly.Block, g: Gen) => {
  const s = cv(g, b, 'SPEED', O.UNARY)
  return `drive(${sign(b)}${s}, ${sign(b)}${s});\ndelay(${ms(cv(g, b, 'SECS', O.NONE))});\ndrive(0, 0);\n`
}
cpp.forBlock['rover_spin_for'] = (b: Blockly.Block, g: Gen) => {
  const s = cv(g, b, 'SPEED', O.UNARY)
  const [l, r] = spinSigns(b)
  return `drive(${l}${s}, ${r}${s});\ndelay(${ms(cv(g, b, 'SECS', O.NONE))});\ndrive(0, 0);\n`
}
cpp.forBlock['rover_wait'] = (b: Blockly.Block, g: Gen) => `delay(${ms(cv(g, b, 'SECS', O.NONE))});\n`
cpp.forBlock['rover_wait_until'] = (b: Blockly.Block, g: Gen) => `while (!(${cv(g, b, 'COND', O.NONE, 'false')})) {\n  delay(5);\n}\n`
cpp.forBlock['rover_distance'] = () => ['readDistanceCm()', O.CALL]
cpp.forBlock['rover_line'] = (b: Blockly.Block) => [`onLine(${b.getFieldValue('SIDE') === 'left' ? 'IR_LEFT' : 'IR_RIGHT'})`, O.CALL]
cpp.forBlock['rover_timer'] = () => ['((millis() - startMs) / 1000.0)', O.ATOMIC]

// standard blocks
cpp.forBlock['controls_repeat_ext'] = (b: Blockly.Block, g: Gen) => {
  const times = cv(g, b, 'TIMES', O.REL)
  const i = g.nameDB_!.getDistinctName('count', Blockly.Names.NameType.VARIABLE)
  return `for (int ${i} = 0; ${i} < ${times}; ${i}++) {\n${g.statementToCode(b, 'DO')}}\n`
}
cpp.forBlock['controls_whileUntil'] = (b: Blockly.Block, g: Gen) => {
  const until = b.getFieldValue('MODE') === 'UNTIL'
  const cond = cv(g, b, 'BOOL', until ? O.UNARY : O.NONE, 'false')
  return `while (${until ? `!${cond}` : cond}) {\n${g.statementToCode(b, 'DO')}}\n`
}
cpp.forBlock['controls_if'] = (b: Blockly.Block, g: Gen) => {
  let code = ''
  let n = 0
  while (b.getInput('IF' + n)) {
    const cond = cv(g, b, 'IF' + n, O.NONE, 'false')
    code += `${n ? ' else ' : ''}if (${cond}) {\n${g.statementToCode(b, 'DO' + n)}}`
    n++
  }
  if (b.getInput('ELSE')) code += ` else {\n${g.statementToCode(b, 'ELSE')}}`
  return code + '\n'
}
const CMP: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' }
cpp.forBlock['logic_compare'] = (b: Blockly.Block, g: Gen) => {
  const op = CMP[b.getFieldValue('OP')]
  const order = op === '==' || op === '!=' ? O.EQ : O.REL
  return [`${cv(g, b, 'A', order)} ${op} ${cv(g, b, 'B', order)}`, order]
}
cpp.forBlock['logic_operation'] = (b: Blockly.Block, g: Gen) => {
  const and = b.getFieldValue('OP') === 'AND'
  const order = and ? O.AND : O.OR
  return [`${cv(g, b, 'A', order, 'false')} ${and ? '&&' : '||'} ${cv(g, b, 'B', order, 'false')}`, order]
}
cpp.forBlock['logic_negate'] = (b: Blockly.Block, g: Gen) => [`!${cv(g, b, 'BOOL', O.UNARY, 'true')}`, O.UNARY]
cpp.forBlock['logic_boolean'] = (b: Blockly.Block) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOMIC]
cpp.forBlock['math_number'] = (b: Blockly.Block) => {
  const n = Number(b.getFieldValue('NUM'))
  return [String(n), n < 0 ? O.UNARY : O.ATOMIC]
}
const ARITH: Record<string, [string, number]> = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MUL], DIVIDE: ['/', O.MUL] }
cpp.forBlock['math_arithmetic'] = (b: Blockly.Block, g: Gen) => {
  const op = b.getFieldValue('OP')
  if (op === 'POWER') return [`pow(${cv(g, b, 'A', O.NONE)}, ${cv(g, b, 'B', O.NONE)})`, O.CALL]
  const [sym, order] = ARITH[op]
  return [`${cv(g, b, 'A', order)} ${sym} ${cv(g, b, 'B', order + 0.5)}`, order]
}
cpp.forBlock['variables_get'] = (b: Blockly.Block, g: Gen) => [g.getVariableName(b.getFieldValue('VAR')), O.ATOMIC]
cpp.forBlock['variables_set'] = (b: Blockly.Block, g: Gen) => `${g.getVariableName(b.getFieldValue('VAR'))} = ${cv(g, b, 'VALUE', O.NONE)};\n`
cpp.forBlock['math_change'] = (b: Blockly.Block, g: Gen) => `${g.getVariableName(b.getFieldValue('VAR'))} += ${cv(g, b, 'DELTA', O.NONE)};\n`

/** The whole program as an Arduino sketch for the real rover. */
export function programCpp(ws: Blockly.Workspace, title: string) {
  cpp.init(ws)
  const start = ws.getTopBlocks(true).find((b) => b.type === 'rover_start' && b.isEnabled())
  const body = start ? (cpp.blockToCode(start) as string) : ''
  const vars = Blockly.Variables.allUsedVarModels(ws).map((v) => cpp.getVariableName(v.getId()))
  const indented = body
    .split('\n')
    .map((l) => (l ? '  ' + l.replace(/^ {2}/, '') : l))
    .join('\n')
  return `// ROVER 2.0 - ${title}
// Made with blocks in the ROVER 2.0 guide (Missions tab).
//
// To put it on the rover:
//   1. Arduino IDE > Library Manager: install "Adafruit Motor Shield library" (V1).
//   2. Open this file (let the IDE put it in a folder with the same name).
//   3. Tools > Board: "Arduino Uno", Tools > Port: the rover's port. Click Upload.
//   4. Unplug, put the rover down and switch on. Your program starts after 2 seconds.

#include <AFMotor.h>

AF_DCMotor frontLeft(1);   // M1
AF_DCMotor rearLeft(2);    // M2
AF_DCMotor rearRight(3);   // M3
AF_DCMotor frontRight(4);  // M4

const int TRIG_PIN = A0;
const int ECHO_PIN = A1;
const int IR_LEFT  = A2;
const int IR_RIGHT = A3;
const int LINE = HIGH;     // most IR modules read HIGH over a dark line
${vars.length ? `\n${vars.map((v) => `float ${v} = 0;`).join('\n')}\n` : ''}
unsigned long startMs = 0;

// Run both motors on one side. speed: -255 (backwards) to 255 (forwards).
void setSide(AF_DCMotor &a, AF_DCMotor &b, int speed) {
  speed = constrain(speed, -255, 255);
  uint8_t dir = speed > 0 ? FORWARD : (speed < 0 ? BACKWARD : RELEASE);
  a.setSpeed(abs(speed));
  b.setSpeed(abs(speed));
  a.run(dir);
  b.run(dir);
}

void drive(int left, int right) {
  setSide(frontLeft, rearLeft, left);
  setSide(frontRight, rearRight, right);
}

long readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 30000);
  if (us == 0) return 999;
  return us / 58;
}

bool onLine(int pin) {
  return digitalRead(pin) == LINE;
}

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(IR_LEFT, INPUT);
  pinMode(IR_RIGHT, INPUT);
  drive(0, 0);
  delay(2000);             // 2 seconds to put the rover down (the simulator skips this)
  startMs = millis();

  // ---- your blocks ----
${indented.trimEnd()}
}

void loop() {
  // everything happens in setup(): "forever" blocks are while (true) loops
}
`
}

/** Blocks the student placed (number blocks inside other blocks don't count). */
export function countBlocks(ws: Blockly.Workspace) {
  return ws.getAllBlocks(false).filter((b) => !b.isShadow() && b.isEnabled()).length
}

export { Blockly }
