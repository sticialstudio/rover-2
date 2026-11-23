import { useEffect, useRef, useState } from 'react'
import { Blockly, countBlocks, programCpp, programJs, theme, toolbox } from '../blocks/blocks'
import { editor } from '../blocks/editor'
import { MISSION_BY_ID, saveProgram, savedProgram, useMissions } from '../missions/missions'
import { sim } from '../sim/sim'

export default function BlocksView({ dark }: { dark: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const showCode = useMissions((s) => s.showCode)
  const missionId = useMissions((s) => s.id)
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState(false)

  // create the workspace once
  useEffect(() => {
    if (!host.current) return
    const m = MISSION_BY_ID[useMissions.getState().id]
    const ws = Blockly.inject(host.current, {
      toolbox: toolbox(m.toolbox),
      theme: theme(dark),
      renderer: 'zelos',
      // icons and sounds ship with the site (public/blockly-media), not from Google's servers
      media: `${import.meta.env.BASE_URL}blockly-media/`,
      trashcan: true,
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.4 },
      grid: { spacing: 24, length: 2, colour: dark ? '#2e251d' : '#e8dcc8', snap: true },
      move: { scrollbars: true, drag: true, wheel: false },
    })
    wsRef.current = ws
    let highlighted: string | null = null
    editor.api = {
      js: () => programJs(ws),
      cpp: () => programCpp(ws, MISSION_BY_ID[useMissions.getState().id].title),
      count: () => countBlocks(ws),
      save: () => Blockly.serialization.workspaces.save(ws),
      load: (json) => {
        ws.clear()
        if (json) Blockly.serialization.workspaces.load(json as object, ws)
        // centred if it fits; a program wider or taller than the editor shows its top-left ("when started")
        const box = ws.getBlocksBoundingBox()
        const view = ws.getMetricsManager().getViewMetrics(true)
        if (box.right - box.left > view.width - 40 || box.bottom - box.top > view.height - 40) ws.scrollBoundsIntoView(box, 20)
        else ws.scrollCenter()
      },
      highlight: (id) => {
        if (id === highlighted) return
        highlighted = id
        ws.highlightBlock(id)
      },
      setToolbox: (types) => ws.updateToolbox(toolbox(types)),
    }
    editor.api.load(savedProgram(m.id))

    // save as you build, and keep the C++ view up to date
    let timer = 0
    const onChange = (e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return
      clearTimeout(timer)
      timer = window.setTimeout(() => {
        saveProgram(useMissions.getState().id, Blockly.serialization.workspaces.save(ws))
        if (useMissions.getState().showCode) setCode(editor.api!.cpp())
        editor.changed()
      }, 250)
    }
    ws.addChangeListener(onChange)

    // light up the running block
    let raf = 0
    const loop = () => {
      if (useMissions.getState().status === 'running') editor.api?.highlight(sim.node)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => Blockly.svgResize(ws))
    ro.observe(host.current)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      clearTimeout(timer)
      saveProgram(useMissions.getState().id, Blockly.serialization.workspaces.save(ws))
      editor.api = null
      ws.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    wsRef.current?.setTheme(theme(dark))
  }, [dark])

  // the C++ view: refresh when opened or when the mission changes
  useEffect(() => {
    if (showCode && editor.api) setCode(editor.api.cpp())
  }, [showCode, missionId])

  // the code pane changes the editor's width
  useEffect(() => {
    if (wsRef.current) requestAnimationFrame(() => wsRef.current && Blockly.svgResize(wsRef.current))
  }, [showCode])

  const fileName = `rover_${missionId.replace(/-/g, '_')}`
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.ino`
    a.click()
    URL.revokeObjectURL(url)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={'blocks-pane' + (showCode ? ' with-code' : '')}>
      <div className="blocks-host" ref={host} />
      {showCode && (
        <div className="blocks-code">
          <div className="blocks-code-bar">
            <b>{fileName}.ino</b>
            <span>Arduino C++ for the real rover</span>
            <button className="btn small" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn small" onClick={download}>
              Download .ino
            </button>
          </div>
          <pre>
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
