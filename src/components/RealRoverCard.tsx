import { useState } from 'react'
import { editor } from '../blocks/editor'
import { PROGRAMS } from '../data/programs'
import { connectBle, connectDemo, connectSerial, disconnect, support, useLink } from '../link/link'
import { MISSION_BY_ID, useMissions } from '../missions/missions'
import { sim } from '../sim/sim'
import { useStore } from '../store'

/** Save the current program as an Arduino sketch. */
function downloadIno(id: string) {
  const code = editor.api?.cpp()
  if (!code) return
  const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `rover_${id.replace(/-/g, '_')}.ino`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Two ways onto the real rover: upload the program as a sketch (it then runs on its own), or run it
 * live from this page over the USB cable or Bluetooth (the rover runs rover_link.ino and does what the
 * page says; its sensors drive the program).
 */
export function RealRoverCard() {
  const [open, setOpen] = useState(false)
  const [way, setWay] = useState<'upload' | 'live'>('upload')
  const { id, status, live, liveNote, runLive, stop } = useMissions()
  const link = useLink()
  const setMode = useStore((s) => s.setMode)
  const setProgram = useStore((s) => s.setProgram)
  const connected = link.status === 'connected'
  const fresh = link.telemetry && performance.now() - link.telemetry.at < 1500 ? link.telemetry : null
  const openLinkSketch = () => {
    setMode('code')
    setProgram(PROGRAMS.findIndex((p) => p.id === 'link'))
  }

  return (
    <div className="real-card">
      <button className="real-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>Put it on the real rover</span>
        <i>{open ? '−' : '+'}</i>
      </button>
      {open && (
        <>
          <div className="seg real-ways" role="tablist">
            <button className={way === 'upload' ? 'on' : ''} onClick={() => setWay('upload')}>
              Upload the program
            </button>
            <button className={way === 'live' ? 'on' : ''} onClick={() => setWay('live')}>
              Run it live
            </button>
          </div>

          {way === 'upload' ? (
            <>
              <p className="real-note">The rover runs your program on its own, no computer needed. Best for line following and anything fast.</p>
              <ol className="real-steps">
                <li>
                  Install the <b>Arduino IDE</b>, and in its Library Manager the <b>Adafruit Motor Shield library</b> (V1).
                </li>
                <li>
                  <button className="btn small" onClick={() => downloadIno(id)}>
                    Download {`rover_${id.replace(/-/g, '_')}.ino`}
                  </button>{' '}
                  and open it. Let the IDE put it in a folder of the same name.
                </li>
                <li>
                  Plug in the USB cable. Choose <b>Arduino Uno</b> and its port, then <b>Upload</b>.
                </li>
                <li>Unplug, put the rover on the floor (on a black line for line missions) and switch on. It starts after 2 seconds.</li>
              </ol>
              <p className="real-note">
                Real floors, tape and batteries are not the simulator: if the rover overshoots, lower the speeds or shorten the times.
              </p>
            </>
          ) : (
            <>
              <p className="real-note">
                Your program runs on this page and drives the rover over the cable or Bluetooth, using the rover’s real sensors. Needs{' '}
                <button className="linkish" onClick={openLinkSketch}>
                  rover_link.ino
                </button>{' '}
                on the rover (upload it once). There is a short delay, so keep speeds gentle.
              </p>
              {!connected ? (
                <div className="real-connect">
                  {support.serial && (
                    <button className="btn small" onClick={() => void connectSerial()} disabled={link.status === 'connecting'}>
                      USB / Bluetooth serial
                    </button>
                  )}
                  {support.ble && (
                    <button className="btn small" onClick={() => void connectBle()} disabled={link.status === 'connecting'}>
                      Bluetooth LE
                    </button>
                  )}
                  {import.meta.env.DEV && (
                    <button className="btn small" onClick={() => connectDemo(() => ({ ...sim.raw, at: 0 }))}>
                      Pretend rover
                    </button>
                  )}
                  {!support.serial && !support.ble && <p className="real-note warn">Connecting needs Chrome or Edge.</p>}
                  {link.error && <p className="real-note warn">{link.error}</p>}
                </div>
              ) : (
                <>
                  <div className="real-status">
                    <span className="dot" />
                    {link.device}
                    <span className="real-tel">
                      {fresh ? `${fresh.cm >= 999 ? '—' : fresh.cm + ' cm'} · IR ${fresh.irL ? '●' : '○'}${fresh.irR ? '●' : '○'}` : 'waiting for readings…'}
                    </span>
                    <button className="linkish" onClick={() => void disconnect()}>
                      Disconnect
                    </button>
                  </div>
                  {live && status === 'running' ? (
                    <button className="btn primary real-run stop" onClick={stop}>
                      ■ Stop the rover
                    </button>
                  ) : (
                    <button className="btn primary real-run" onClick={() => void runLive()}>
                      ▶ Run “{MISSION_BY_ID[id].title}” on the rover
                    </button>
                  )}
                  <p className="real-note">Try it with the wheels off the ground first. The rover stops by itself if the link drops.</p>
                </>
              )}
              {liveNote && <p className="real-note live-note">{liveNote}</p>}
            </>
          )}
        </>
      )}
    </div>
  )
}
