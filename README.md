# ROVER 2.0 Build Guide (web)

An interactive 3D build guide for the ROVER 2.0 kit:
- **Explore**: 3D viewer, click-to-inspect parts, exploded view
- **Assemble**: a step-by-step manual in the style of the printed ROVER 1.0 guide: 12 chapters, each opening with the
  finished sub-assembly and its parts, then ~70 small steps (one or two parts each). Every step has a parts box (pictures
  rendered from the model, with counts), red arrows showing how each part goes in, and "turn it over" views for locks
  underneath. Sub-assemblies (top half, IR pods, ultrasonic face) are built beside the rover, then moved into place. Every
  wire is drawn along its real route as it is laid (`#assemble/3`)
- **Wire**: every connection traced on the 3D rover, with a pin diagram and Arduino pin map (`#wire/2`)
- **Code**: 5 Arduino sketches with flowcharts linked to the code and the 3D parts (`#code/3`)
- **Missions**: block coding (Blockly) with 17 missions and 3 sensor lessons in 5 chapters (first moves, speed & timing,
  ultrasonic, line sensors, put it together) plus a sandbox: build a program from ROVER blocks, run it on the 3D rover, earn up to 3 stars, and get the same program as an Arduino sketch (`.ino`) for the real rover (`#missions/stop-at-wall`)
- **Drive**: a simulator room where the 3D rover runs the same logic as the sketches: drive it yourself, obstacle avoider, line follower (`#drive/line`)
- **Real rover** (Drive tab): drive the real rover from the page over Web Serial (HC-05/HC-06 paired as a COM port, or USB) or Web Bluetooth (BLE modules), with live sensor readings (`#drive/real`). Needs Chrome or Edge, and the rover running `rover_link.ino`.

## Run it

```bash
cd web
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # static site in web/dist (deployable to Vercel/Netlify)
```

> The C: drive on this PC is full. Point npm's cache and temp at G: before installing:
> `set npm_config_cache=G:\CLAUDE_WORK\ROVER_2.0\.npm-cache` and `set TEMP=G:\CLAUDE_WORK\ROVER_2.0\.tmp`

## Update the 3D model after editing the .blend

```bash
# 1. export grouped parts (the .blend itself is never modified)
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b ROVER_2.0.blend --python tools/export_web.py -- .tmp/rover_raw.glb
# 2. compress for the web (keeps the part groups)
tools/node_modules/.bin/gltf-transform optimize .tmp/rover_raw.glb web/public/models/rover.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --join false --instance false --palette false --simplify-error 0.0005
```

Every Blender object is mapped to a part id in `tools/export_web.py` (`part_of`): modules, wires (`BézierCurve*`), connector
housings (`pins*`), wheels and locks by name; wooden panels by collection. New objects need a rule there. Wires and housings are
always exported as their own pieces, even if parented in Blender. Each wire's two ends are found from its open tube rims; in the
exploded view it stretches between the pieces named in `src/data/wiring.ts` (`anchor` / `boardPiece`, default: the shield).
`tools/inspect_wires.py`, `tools/inspect_collections.py` and `tools/inspect_routes.py` print what the .blend contains (read-only). If a part's
name, description, specs or exploded-view motion changes, update `web/src/data/parts.ts`.

If a wire's path changes, regenerate where the wires pass through the deck and motor walls, and which stretch
runs under the deck (the Assemble tab lays wires in stages: the channel stretch before the deck goes on, up
through the deck's front opening, and to the shield last):

```bash
"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b ROVER_2.0.blend --python tools/export_routes.py -- web/src/data/wireRoutes.ts
```

In `src/data/steps.ts`, a step's `wires` lists the wires it lays: `upTo: 'deck front opening'` stops there,
`from: UNDER_DECK` starts at the channel and leaves the sensor end loose, and a later step listing the wire again
lays more of it (the step that lists it with neither finishes it); `upTo: UNDER_DECK` stops just under the top plate.
`seeThrough` lists panels drawn see-through so wires underneath show. Connector housings follow their wire end.
Sub-assemblies are listed in `SUBASSEMBLIES` with the offset they are drawn at while being built. Steps marked
`sub: ['top']` (or `['top', 'ultrasonic']`, offsets add up) build one: what they add is drawn moved aside until the step
marked `place: 'top'` moves it into place.

Manual-style fields: `chapter: 'Title'` starts a chapter; `cover: true` is its opening page (adds nothing; the panel shows
a picture of what the chapter builds and all its parts). `from: 'left'` (or `approach: { piece: 'below' }`) sets where
parts come from (default: above; locks and wheels work it out from the model). `flip: true` looks from underneath and
shows "Turn it over"; in a sub-assembly it shows that sub-assembly on its own. The parts box is generated from the pieces
each step adds (`src/components/thumbs.ts`), so `need` only lists tools.

## Where things live

| File | What it does |
| --- | --- |
| `src/data/parts.ts` | Part catalogue: names, descriptions, specs, pins, explode settings |
| `src/data/steps.ts` | Assembly guide: step text, which pieces each step adds, camera angle |
| `src/components/StepsPanel.tsx` | Step card, chapter cover, parts box, instructions, chapter list |
| `src/components/thumbs.ts` | Part pictures for the parts box (offscreen renders of pieces, grouped into "×N") |
| `src/data/wiring.ts` | Wiring guide: which wire goes where, Arduino pin choices, wire colours, camera angle |
| `src/components/WirePanel.tsx` | Wire diagram, wire readout, connection list, pin map |
| `src/sketches/*.ino` | The Arduino programs (real files; all compile for the UNO with the AFMotor library) |
| `src/data/programs.ts` | Program titles, flowcharts (each box points at its lines of code), try-it steps |
| `src/components/CodeView.tsx` | Code viewer: highlighting, copy, download |
| `src/components/CodePanel.tsx` | Program card, flowchart, upload guide, pins card |
| `src/sim/sim.ts` | Simulator: the world (room, boxes, tape lines, goal zones; `setWorld`), sensors, collisions, the three programs' logic, and block programs (`program` mode) |
| `src/blocks/blocks.ts` | ROVER blocks, the toolbox, and two code generators: JavaScript for the simulator, Arduino C++ for the rover |
| `src/blocks/runner.ts` | Runs a block program in the simulator (a generator: one action per wait or loop pass, like `delay()`/`loop()`) |
| `src/blocks/editor.ts` | Handle to the block editor, so nothing else imports Blockly (it loads only with the Missions tab) |
| `src/missions/pack.ts` | The missions: world, allowed blocks, goal check, stars, hints |
| `src/missions/lessons.ts` | The sensor lessons' pages: text, block pictures, "Show me" programs, "your turn" tasks |
| `src/components/LessonGuide.tsx` | A lesson's pages in the mission card (pictures load with the block editor) |
| `src/missions/missions.ts` | Running and checking a mission, chapters, saved progress (`resetProgress`) |
| `src/components/BlocksView.tsx` | The Blockly workspace, running-block highlight, Arduino code view and `.ino` download |
| `src/components/MissionsPanel.tsx` | Mission card: goal, stars, Run/Stop/Reset, speed, camera, live sensor readings, result, hints, mission list |
| `src/sim/drivetrain.ts` | 4WD skid-steer physics: four TT motors (per side), L293D drop, gearbox friction, tyre slip, sideways scrub, contact impulses |
| `src/components/DriveScene.tsx` | 3D room, sensor beam and IR spots; measures the rover's sensor positions from the model |
| `src/components/DrivePanel.tsx` | Mode picker, tuning sliders, live flowchart, HUD, D-pad, keyboard |
| `src/components/RealPanel.tsx` | Real rover: connect buttons, telemetry, message log, setup steps |
| `src/link/link.ts` | Web Serial / Web Bluetooth link: sends letters (repeated every 150 ms while held), parses `T,cm,irL,irR` |
| `src/components/RoverModel.tsx` | Loads the GLB, groups parts, exploded view, highlight and isolate |
| `src/components/Viewer.tsx` | Canvas, lighting, grid, camera controls |
| `src/components/PartsPanel.tsx` | Overview, part details and parts list |
| `src/store.ts` | Shared UI state (selection, explode, toggles) |

## Check the sketches compile

The Arduino IDE ships `arduino-cli`. With the "Adafruit Motor Shield library" (V1) installed:

```bash
arduino-cli compile --fqbn arduino:avr:uno path/to/motor_test   # folder containing motor_test.ino
```

## Missions (block coding)

A mission in `src/missions/pack.ts` has a `world()` (floor size, `boxes`, black `tapes`, coloured `zones`, start
pose; called for every run, so sensor missions can move things and timing alone can't win), a `toolbox` (block types,
or `'all'`), a `check()` that makes the check for one run (it may keep its own state, e.g. a lap counter) and is called every
simulation step with the time, bumps, distance, how long the rover has been still, and which zones it has entered and in
what order (return `{ pass, score? }`, `{ fail }` or `null`), a `timeLimit`, `hints`, and `stars` (the first is passing;
`score` lets stars judge things like arrival time). Every mission was test-solved with a block program (most score 3
stars); re-check after changing worlds or the physics. Note the 4WD rover turns sharply only by spinning (one side
backwards): one side stopped makes a very wide curve. Progress and each mission's program are saved in the browser (`localStorage`).

**Lessons** are missions with a `lesson` (pages in `src/missions/lessons.ts`): three short guided tutorials that come
before the missions that need them ("How far away?" for the ultrasonic, "Look and decide" for `forever` and
`if … else`, "See the line" for the IR sensors). A page has text (`**bold**` for block and category names), an optional
picture of blocks (drawn by Blockly in a hidden workspace, `src/blocks/picture.ts`), "Show me" to load a whole program,
"your turn" tasks that tick themselves off as the program changes (`src/missions/program.ts` reads the saved JSON), and
readings to point at. Lessons have no number in the list, and each later mission in the chapter links back to its lesson.
The Sensors category also holds ready-made sensor questions ("Ready to use": `wait until distance < 20`, `if distance < 30
… else`, and the same for the IR sensors) whenever the mission allows the blocks they are made of.

New blocks go in `src/blocks/blocks.ts`: a JSON definition, a toolbox entry, and one function for each generator.
The Arduino generator writes everything into `setup()` (a `forever` block is `while (true)`), with the same pins,
library and helpers as the sketches in `src/sketches`. Blockly's icons are served from `public/blockly-media`.
In dev builds, `__missions`, `__editor`, `__resetProgress` and `__forget(...ids)` (clear just those missions' stars and
programs, e.g. after testing) are on `window` (e.g. `__editor.api.cpp()`). With
`__editor.api.load(json)`, `__missions.getState().run()` and `__stepSim(1/240)` in a loop, a mission runs instantly.
The panel's "Reset progress" clears stars and saved programs on that computer.

## Simulator notes

In dev builds the simulator is on `window.__sim` (`__stepSim`, `__resetSim` too), so you can run it headless from the console,
e.g. to check the line follower stays on the tape. 1 scene unit = 10 cm.

## Real rover protocol (rover_link.ino)

- Page → rover: one ASCII letter per command, same as `bluetooth_remote.ino` (`F B L R G I H J S`, `0`–`9` speed, `q`).
  While a direction is held the page repeats it every 150 ms; the sketch stops after 1 s of silence.
- Block programs (Missions tab, "Run it live") send `M<left>,<right>` and a new line instead (each side -255..255),
  repeated every 150 ms while the motors run. `?` asks the version: a sketch that understands `M` answers
  `ROVER 2.0 link v2` (the page checks this before a live run). Older sketches ignore both.
- Rover → page: `T,<cm>,<irLeft 0|1>,<irRight 0|1>` ten times a second; any other line shows in the Messages log.
- Serial: 9600 baud. BLE: service `FFE0` / characteristic `FFE1` (HM-10 style) or the Nordic UART service.
- In dev builds, `__linkDemo()` in the console (Drive tab), or the "Pretend rover" button (Missions tab), connects a
  pretend rover that echoes the simulator's own sensor readings (`sim.raw`) to test the UI.

## Block programs on the real rover

Two ways, in the Missions tab under "Put it on the real rover":

- **Upload the program**: the Arduino C++ from the blocks (`programCpp` in `src/blocks/blocks.ts`) is downloaded as an
  `.ino` with the upload steps at the top. The rover then runs it on its own: best for anything fast (line following).
- **Run it live**: the rover runs `rover_link.ino`; the program runs in the page (same runner as the simulator, real
  time), the rover's telemetry replaces the simulated sensors (`sim.sensorOverride`), and every motor change is sent as
  `M<left>,<right>`. The 3D twin shows what the program commands. The run stops if the link drops or no readings arrive
  for 1.5 s (and the sketch's own failsafe stops the motors after 1 s of silence). Mission goals are not checked in
  live runs. The link adds a delay (about 0.1–0.2 s), so the rover reacts a little later than in the simulator.

## Drivetrain model (src/sim/drivetrain.ts)

Per side (two motors, two wheels, same PWM): motor torque `2 x (stall x V/6 - k x spin)` with V = duty x (7.4 V - 2.4 V L293D drop),
gearbox stiction (low PWM does nothing), tyre force `grip x weight x tanh(slip / 3 cm/s)`. The body gets both sides' forces;
turning must overcome sideways scrub of all four tyres (55% of forward grip, less while a tyre is spinning). Runs at ~1 kHz.
Measured in the sim: full PWM ~50 cm/s at ~140 RPM, wheels start at PWM ~40, spin on the spot ~300 deg/s at full PWM.
