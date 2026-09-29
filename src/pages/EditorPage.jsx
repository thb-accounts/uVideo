import { useEffect, useMemo, useRef, useState } from 'react'

const ratios = {
  video: { label: 'Video · 16:9', width: 1280, height: 720 },
  blink: { label: 'Blink · 9:16', width: 720, height: 1280 },
  square: { label: 'Square · 1:1', width: 1080, height: 1080 },
}

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}

export default function EditorPage() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [file, setFile] = useState(null)
  const [source, setSource] = useState('')
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [ratio, setRatio] = useState('video')
  const [overlay, setOverlay] = useState('')
  const [volume, setVolume] = useState(1)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')

  useEffect(() => () => { if (source) URL.revokeObjectURL(source) }, [source])
  const selection = useMemo(() => Math.max(0, end - start), [end, start])

  function chooseFile(nextFile) {
    if (!nextFile?.type?.startsWith('video/')) return
    if (source) URL.revokeObjectURL(source)
    setFile(nextFile)
    setSource(URL.createObjectURL(nextFile))
    setDuration(0); setStart(0); setEnd(0); setMessage('')
  }

  function loaded() {
    const value = Number(videoRef.current?.duration || 0)
    setDuration(value); setEnd(value)
  }

  function seek(value) {
    const next = Number(value)
    if (videoRef.current) videoRef.current.currentTime = next
  }

  async function exportVideo() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !file || selection <= 0) return
    if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
      setMessage('This browser cannot export edited video yet. Try current Chrome or Edge.')
      return
    }

    setExporting(true); setProgress(0); setMessage('')
    const { width, height } = ratios[ratio]
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    const canvasStream = canvas.captureStream(30)
    const audioStream = typeof video.captureStream === 'function' ? video.captureStream() : null
    if (audioStream && volume > 0) audioStream.getAudioTracks().forEach(track => canvasStream.addTrack(track))

    const mime = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type => MediaRecorder.isTypeSupported(type)) || ''
    const recorder = new MediaRecorder(canvasStream, mime ? { mimeType: mime } : undefined)
    const chunks = []
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data) }

    const finished = new Promise(resolve => { recorder.onstop = resolve })
    video.pause(); video.currentTime = start; video.volume = volume
    await new Promise(resolve => {
      const ready = () => { video.removeEventListener('seeked', ready); resolve() }
      video.addEventListener('seeked', ready)
      if (Math.abs(video.currentTime - start) < 0.05) ready()
    })

    const draw = () => {
      if (!exporting && recorder.state === 'inactive') return
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height)
      const scale = Math.min(width / video.videoWidth, height / video.videoHeight)
      const w = video.videoWidth * scale, h = video.videoHeight * scale
      ctx.drawImage(video, (width-w)/2, (height-h)/2, w, h)
      if (overlay.trim()) {
        ctx.font = `600 ${Math.max(28, Math.round(width/24))}px system-ui, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.fillStyle = 'rgba(0,0,0,.55)'
        const metrics = ctx.measureText(overlay)
        ctx.fillRect(width/2-metrics.width/2-20, height-120, metrics.width+40, 70)
        ctx.fillStyle = '#fff'; ctx.fillText(overlay, width/2, height-135)
      }
      setProgress(Math.min(1, (video.currentTime-start)/selection))
      if (video.currentTime >= end || video.ended) { video.pause(); if(recorder.state!=='inactive') recorder.stop(); return }
      requestAnimationFrame(draw)
    }

    recorder.start(500)
    await video.play()
    requestAnimationFrame(draw)
    await finished

    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${file.name.replace(/\.[^.]+$/, '')}-mplace-edit.webm`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExporting(false); setProgress(1); setMessage('Export complete. Upload the file through MPlace Create whenever you are ready.')
  }

  return <div className="min-h-[calc(100dvh-4rem)] bg-[#f8f9fa] text-[#202124]">
    <canvas ref={canvasRef} className="hidden" />
    <div className="border-b border-[#dadce0] bg-white px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div><p className="text-xs font-medium uppercase tracking-[.14em] text-[#1f6f4a]">MPlace Editor</p><h1 className="text-xl font-medium">Create locally. Export to your device.</h1></div>
        <label className="cursor-pointer rounded-full bg-[#1f6f4a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#185c3d]">Import video<input type="file" accept="video/*" className="hidden" onChange={e=>chooseFile(e.target.files?.[0])}/></label>
      </div>
    </div>

    {!source ? <div className="mx-auto grid max-w-3xl place-items-center px-5 py-24 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e7f3ec] text-3xl">✂</div><h2 className="mt-5 text-2xl font-medium">Start a new edit</h2><p className="mt-2 text-sm leading-6 text-[#5f6368]">Your source video stays on this device. MPlace Editor does not publish it or upload it to your account.</p></div></div> :
    <div className="mx-auto grid max-w-7xl gap-5 p-5 sm:p-8 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0">
        <div className="grid min-h-[420px] place-items-center overflow-hidden rounded-2xl bg-[#111] p-4">
          <video ref={videoRef} src={source} onLoadedMetadata={loaded} controls className={`max-h-[65dvh] max-w-full ${ratio==='blink'?'aspect-[9/16]':ratio==='square'?'aspect-square':'aspect-video'} object-contain`} />
        </div>
        <div className="mt-4 rounded-2xl border border-[#dadce0] bg-white p-5">
          <div className="flex items-center justify-between"><h2 className="font-medium">Trim</h2><span className="text-xs text-[#5f6368]">{formatTime(selection)} selected</span></div>
          <label className="mt-4 block text-xs text-[#5f6368]">Start · {formatTime(start)}<input className="mt-2 w-full accent-[#1f6f4a]" type="range" min="0" max={duration||1} step=".1" value={start} onChange={e=>{const v=Math.min(Number(e.target.value),end-.1);setStart(v);seek(v)}}/></label>
          <label className="mt-3 block text-xs text-[#5f6368]">End · {formatTime(end)}<input className="mt-2 w-full accent-[#1f6f4a]" type="range" min="0" max={duration||1} step=".1" value={end} onChange={e=>{const v=Math.max(Number(e.target.value),start+.1);setEnd(v);seek(v)}}/></label>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-[#dadce0] bg-white p-5"><h2 className="font-medium">Format</h2><div className="mt-3 grid gap-2">{Object.entries(ratios).map(([key,value])=><button key={key} onClick={()=>setRatio(key)} className={`rounded-xl border px-3 py-2.5 text-left text-sm ${ratio===key?'border-[#1f6f4a] bg-[#e7f3ec] text-[#185c3d]':'border-[#dadce0] hover:bg-[#f8f9fa]'}`}>{value.label}</button>)}</div></div>
        <div className="rounded-2xl border border-[#dadce0] bg-white p-5"><h2 className="font-medium">Text</h2><input value={overlay} onChange={e=>setOverlay(e.target.value)} maxLength={80} placeholder="Add text to the video" className="mt-3 w-full rounded-xl border border-[#dadce0] px-3 py-2.5 text-sm outline-none focus:border-[#1f6f4a]"/></div>
        <div className="rounded-2xl border border-[#dadce0] bg-white p-5"><div className="flex justify-between"><h2 className="font-medium">Audio</h2><span className="text-xs text-[#5f6368]">{Math.round(volume*100)}%</span></div><input className="mt-3 w-full accent-[#1f6f4a]" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>{const v=Number(e.target.value);setVolume(v);if(videoRef.current)videoRef.current.volume=v}}/></div>
        <button disabled={exporting||selection<=0} onClick={exportVideo} className="w-full rounded-full bg-[#1f6f4a] px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{exporting?`Exporting · ${Math.round(progress*100)}%`:'Export to device'}</button>
        {message&&<p className="rounded-xl bg-[#e7f3ec] p-3 text-xs leading-5 text-[#185c3d]">{message}</p>}
        <p className="text-xs leading-5 text-[#5f6368]">Export currently uses WebM for a completely local browser workflow. Nothing is sent to MPlace.</p>
      </aside>
    </div>}
  </div>
}
