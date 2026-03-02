import { useEffect, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { sendTypingEvent } from "../services/websocket";
import { uploadAttachment } from "../services/api";

const LANGUAGES = [
  { id: "python", label: "Python", icon: "Py" },
  { id: "javascript", label: "JavaScript", icon: "Js", disabled: true },
  { id: "bash", label: "Bash", icon: "Sh", disabled: true },
];

const ACCEPTED_FILES = [
  "image/*",
  "audio/*",
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
].join(",");

export default function CodeEditor({ onSend, roomName, editingMessage, onCancelEdit, replyingMessage, onCancelReply }) {
  const [text, setText] = useState("");
  const [code, setCode] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [language, setLanguage] = useState("python");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [recorderOpen, setRecorderOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [recordActionLoading, setRecordActionLoading] = useState(false);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const chunksRef = useRef([]);
  const stopActionRef = useRef("cancel");
  const recordMimeRef = useRef("audio/webm");
  const rafRef = useRef(0);
  const visualizerCanvasRef = useRef(null);
  const smoothDataRef = useRef(new Float32Array(128));
  const vizFrameRef = useRef(0);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (editingMessage) {
      setAttachments([]);
      if (editingMessage.type === "code") {
        setIsExpanded(true);
        setCode(editingMessage.content);
        setLanguage(editingMessage.language || "python");
      } else {
        setIsExpanded(false);
        setText(editingMessage.content);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setText("");
      setCode("");
      setIsExpanded(false);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingMessage) setTimeout(() => inputRef.current?.focus(), 50);
  }, [replyingMessage]);

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(() => () => cleanupRecorder(), []);

  const toggleEditor = () => {
    setIsExpanded((v) => !v);
    if (!isExpanded) setText("");
  };

  const triggerSend = async (type, content, lang = null, files = []) => {
    setSending(true);
    try {
      await onSend(type, content, lang, files);
    } finally {
      setTimeout(() => setSending(false), 450);
    }
  };

  const handleSendText = async () => {
    const content = text.trim();
    if (!content && attachments.length === 0) return;
    await triggerSend("text", content, null, attachments);
    setText("");
    setAttachments([]);
  };

  const handleSendCode = async () => {
    const content = code.trim();
    if (!content) return;
    await triggerSend("code", content, language, attachments);
    setCode("");
    setIsExpanded(false);
    setAttachments([]);
  };

  const processFiles = async (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const f of files) {
        const u = await uploadAttachment(f);
        uploaded.push(u);
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (e) {
      alert(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onFilesPicked = async (e) => {
    await processFiles(e.target.files);
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setDragActive(false);
    await processFiles(e.dataTransfer.files);
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const drawVisualizer = () => {
    const canvas = visualizerCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const centerY = H / 2;

    // Rounded bar helper
    const roundedBar = (rx, ry, rw, rh, rr) => {
      if (rh < 0.5) return;
      const cr = Math.min(rr, rw / 2, Math.abs(rh) / 2);
      ctx.beginPath();
      ctx.moveTo(rx + cr, ry);
      ctx.lineTo(rx + rw - cr, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr);
      ctx.lineTo(rx + rw, ry + rh - cr);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh);
      ctx.lineTo(rx + cr, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr);
      ctx.lineTo(rx, ry + cr);
      ctx.quadraticCurveTo(rx, ry, rx + cr, ry);
      ctx.closePath();
      ctx.fill();
    };

    ctx.clearRect(0, 0, W, H);

    vizFrameRef.current += 1;
    const time = vizFrameRef.current * 0.016;

    // Get frequency data
    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);

    // Smooth interpolation for silky frame transitions
    const smooth = smoothDataRef.current;
    const bars = 72;
    const step = Math.max(1, Math.floor(freq.length / bars));

    let avgVol = 0;
    for (let i = 0; i < bars; i++) {
      const raw = freq[i * step] / 255;
      smooth[i] = smooth[i] * 0.72 + raw * 0.28;
      avgVol += smooth[i];
    }
    avgVol /= bars;

    // ── Background radial pulse that breathes with audio energy ──
    const pulseR = W * 0.3 + avgVol * W * 0.45;
    const bgGlow = ctx.createRadialGradient(W / 2, centerY, 0, W / 2, centerY, pulseR);
    bgGlow.addColorStop(0, `rgba(124, 58, 237, ${(0.06 + avgVol * 0.15).toFixed(3)})`);
    bgGlow.addColorStop(0.5, `rgba(88, 101, 242, ${(0.03 + avgVol * 0.06).toFixed(3)})`);
    bgGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bgGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Floating particles that react to volume ──
    const particles = particlesRef.current;
    if (avgVol > 0.12 && particles.length < 45 && Math.random() < avgVol * 0.8) {
      particles.push({
        x: Math.random() * W,
        y: centerY + (Math.random() - 0.5) * H * 0.8,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.2 - Math.random() * 0.6,
        r: 0.8 + Math.random() * 2.2,
        life: 1,
        decay: 0.006 + Math.random() * 0.014,
        hue: 245 + Math.random() * 60
      });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      const pa = p.life * 0.55;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + p.life * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 85%, 72%, ${pa.toFixed(3)})`;
      ctx.shadowColor = `hsla(${p.hue}, 85%, 65%, ${(pa * 0.7).toFixed(3)})`;
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // ── Mirrored symmetric frequency bars ──
    const gap = 2.5;
    const barW = Math.max(2.2, (W - (bars - 1) * gap) / bars);
    const maxBarH = centerY - 3;

    for (let i = 0; i < bars; i++) {
      const v = smooth[i];
      const barH = Math.max(1.5, v * maxBarH);
      const x = i * (barW + gap);

      // Dynamic hue per bar with time-animated shift
      const hue = 248 + (i / bars) * 55 + Math.sin(time * 0.7 + i * 0.1) * 12;
      const sat = 78 + v * 22;
      const lum = 56 + v * 20;
      const alpha = 0.6 + v * 0.4;

      // Intensify glow on louder bars
      if (v > 0.18) {
        ctx.shadowColor = `hsla(${hue}, ${sat}%, ${lum}%, ${(v * 0.55).toFixed(3)})`;
        ctx.shadowBlur = 5 + v * 14;
      } else {
        ctx.shadowBlur = 0;
      }

      // Top half — bars extending upward from center
      const gUp = ctx.createLinearGradient(x, centerY, x, centerY - barH);
      gUp.addColorStop(0, `hsla(${hue}, ${sat}%, ${lum}%, ${alpha.toFixed(3)})`);
      gUp.addColorStop(1, `hsla(${hue + 30}, ${sat - 10}%, ${lum + 14}%, ${(alpha * 0.45).toFixed(3)})`);
      ctx.fillStyle = gUp;
      roundedBar(x, centerY - barH, barW, barH, barW / 2);

      // Bottom half — mirrored bars extending downward, slightly dimmer
      const gDn = ctx.createLinearGradient(x, centerY, x, centerY + barH);
      gDn.addColorStop(0, `hsla(${hue}, ${sat}%, ${lum}%, ${(alpha * 0.8).toFixed(3)})`);
      gDn.addColorStop(1, `hsla(${hue + 30}, ${sat - 10}%, ${lum + 14}%, ${(alpha * 0.2).toFixed(3)})`);
      ctx.fillStyle = gDn;
      roundedBar(x, centerY, barW, barH, barW / 2);
    }
    ctx.shadowBlur = 0;

    // ── Glowing center line ──
    const lineA = 0.25 + avgVol * 0.55;
    ctx.shadowColor = `rgba(167, 139, 250, ${(lineA * 0.8).toFixed(3)})`;
    ctx.shadowBlur = 10;
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0, "rgba(88,101,242,0)");
    lineGrad.addColorStop(0.12, `rgba(124,58,237,${(lineA * 0.5).toFixed(3)})`);
    lineGrad.addColorStop(0.5, `rgba(167,139,250,${lineA.toFixed(3)})`);
    lineGrad.addColorStop(0.88, `rgba(6,182,212,${(lineA * 0.5).toFixed(3)})`);
    lineGrad.addColorStop(1, "rgba(6,182,212,0)");
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, centerY - 1, W, 2);
    ctx.shadowBlur = 0;

    rafRef.current = requestAnimationFrame(drawVisualizer);
  };

  const pickRecorderMimeType = () => {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  };

  const cleanupRecorder = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    vizFrameRef.current = 0;
    smoothDataRef.current = new Float32Array(128);
    particlesRef.current = [];

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    mediaRecorderRef.current = null;
    recordMimeRef.current = "audio/webm";
    chunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
  };

  const openRecorder = async () => {
    setRecorderOpen(true);
    setRecordError("");
    setRecordActionLoading(false);
    setRecordSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickRecorderMimeType();
      recordMimeRef.current = mimeType || "audio/webm";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const action = stopActionRef.current;
        const recordedType = chunksRef.current?.[0]?.type || recordMimeRef.current || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: recordedType });
        cleanupRecorder();

        if (action !== "send" || blob.size === 0) {
          setRecorderOpen(false);
          return;
        }

        setRecordActionLoading(true);
        try {
          const ext = recordedType.includes("ogg")
            ? "ogg"
            : recordedType.includes("mp4")
              ? "m4a"
              : "webm";
          const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: recordedType });
          const att = await uploadAttachment(file);
          await triggerSend("text", "", null, [att]);
        } catch (e) {
          alert(e.message || "Voice note failed");
        } finally {
          setRecordActionLoading(false);
          setRecorderOpen(false);
        }
      };

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyserRef.current = analyser;

      recorder.start(250);
      setRecording(true);
      drawVisualizer();
    } catch {
      setRecordError("Microphone permission denied or unavailable.");
    }
  };

  const stopRecorder = (action) => {
    stopActionRef.current = action;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecorder();
      setRecorderOpen(false);
    }
  };

  const hasTextModeContent = text.trim().length > 0 || attachments.length > 0;

  return (
    <div
      className="relative"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {recorderOpen && (
        <div className="absolute left-0 right-0 bottom-full mb-3 z-[220]">
          <div className="glass-strong border border-white/[0.1] rounded-2xl p-4 shadow-2xl bg-gradient-to-br from-dc-panel/90 via-dc-surface/90 to-dc-bg/90">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="relative w-9 h-9 rounded-full bg-accent-purple/20 border border-accent-purple/30 flex items-center justify-center">
                  {recording && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-accent-purple/30 animate-ping" />
                      <span className="absolute -inset-1 rounded-full border border-accent-cyan/40" />
                    </>
                  )}
                  <MicIcon className="relative z-10 w-4 h-4 text-white" />
                </span>
                <div>
                  <span className="block text-white font-semibold text-sm">Voice Message</span>
                  <span className="block text-[11px] text-text-secondary">Live listening enabled</span>
                </div>
              </div>
              <span className="font-mono text-xs text-text-secondary">
                {String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:{String(recordSeconds % 60).padStart(2, "0")}
              </span>
            </div>

            <div className="relative rounded-xl bg-black/40 border border-white/[0.06] p-2 overflow-hidden">
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -inset-6 bg-accent-purple/25 blur-3xl opacity-50 animate-pulse-slow" />
                <div className="absolute -inset-8 bg-accent-cyan/10 blur-3xl opacity-30 animate-pulse-slow" style={{ animationDelay: "1.5s" }} />
              </div>
              <canvas ref={visualizerCanvasRef} width={620} height={100} className="relative z-10 w-full h-24 rounded-xl" />
            </div>

            {recordError && <p className="text-rose-400 text-xs mt-2">{recordError}</p>}

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => stopRecorder("cancel")}
                disabled={recordActionLoading}
                className="btn-ghost px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => stopRecorder("send")}
                disabled={!recording || recordActionLoading}
                className="btn-primary px-4 py-2 text-sm ml-auto"
              >
                {recordActionLoading ? "Sending..." : "Send Voice"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`glass rounded-2xl flex flex-col border transition-all duration-300 ${
        dragActive
          ? "border-accent-cyan shadow-[0_0_0_2px_rgba(6,182,212,0.3)]"
          : "border-white/[0.06]"
      } ${sending ? "ring-1 ring-accent-purple/35" : ""}`}>

        {(editingMessage || replyingMessage) && (
          <div className="bg-dc-panel/80 rounded-t-2xl border-b border-white/[0.08] flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2 overflow-hidden text-xs">
              {editingMessage ? (
                <>
                  <EditIcon className="w-3.5 h-3.5 text-accent-purple" />
                  <span className="text-white font-medium flex-shrink-0">Editing message</span>
                </>
              ) : (
                <>
                  <ReplyIcon className="w-3.5 h-3.5 text-accent-purple" />
                  <span className="text-white font-medium flex-shrink-0">Replying to {replyingMessage.sender}</span>
                  <span className="text-text-muted truncate ml-1">{replyingMessage.content}</span>
                </>
              )}
            </div>
            <button onClick={editingMessage ? onCancelEdit : onCancelReply} className="p-1 hover:bg-white/10 rounded-full text-text-muted hover:text-white">
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isExpanded && (
          <div className="animate-fade-in-down">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] bg-dc-panel/50">
              <div className="flex items-center gap-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.id}
                    disabled={l.disabled}
                    onClick={() => !l.disabled && setLanguage(l.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${language === l.id
                      ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
                      : l.disabled
                        ? "text-text-muted opacity-40 cursor-not-allowed"
                        : "text-text-secondary hover:text-white hover:bg-dc-hover"
                    }`}
                  >
                    {l.icon}
                  </button>
                ))}
              </div>
              <button onClick={toggleEditor} className="text-text-muted hover:text-white text-xs p-1 rounded-lg hover:bg-dc-hover">
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="border-b border-white/[0.05]">
              <Editor
                height="180px"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 13,
                  lineNumbers: "on",
                  padding: { top: 10, bottom: 10 },
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  renderLineHighlight: "gutter",
                  scrollbar: { verticalScrollbarSize: 4 },
                  overviewRulerLanes: 0,
                }}
              />
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="px-3 pt-2 flex flex-wrap gap-2 border-b border-white/[0.04]">
            {attachments.map((att, idx) => (
              <div key={`${att.url}-${idx}`} className="flex items-center gap-2 bg-white/[0.06] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs max-w-[280px]">
                <AttachmentMiniIcon className="w-3.5 h-3.5 text-accent-cyan flex-shrink-0" />
                <span className="truncate text-white/90">{att.file_name}</span>
                <button onClick={() => removeAttachment(idx)} className="text-text-muted hover:text-white" title="Remove">
                  <CloseIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {dragActive && (
          <div className="px-3 pt-2">
            <div className="rounded-xl border border-accent-cyan/45 bg-accent-cyan/10 text-accent-cyan text-xs px-3 py-2">
              Drop files to attach and send.
            </div>
          </div>
        )}

        {editingMessage && (
          <div className="px-3 pt-2 text-xs font-semibold text-accent-purple flex items-center justify-between animate-fade-in">
            <span>Editing Message</span>
            <button onClick={onCancelEdit} className="text-text-muted hover:text-white px-2 py-0.5 rounded hover:bg-dc-hover">Cancel</button>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={toggleEditor}
            title="Toggle code editor"
            className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isExpanded
              ? "bg-accent-purple/20 text-accent-purple border border-accent-purple/30"
              : "bg-dc-hover text-text-secondary hover:text-white hover:bg-dc-active"
            }`}
          >
            <CodeIcon className="w-4 h-4" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !!editingMessage}
            title="Attach files"
            className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.06] text-text-secondary hover:text-accent-cyan hover:bg-accent-cyan/10 hover:border-accent-cyan/25 active:scale-95 transition-all duration-200 disabled:opacity-35"
          >
            <PaperclipIcon className="w-4 h-4 mx-auto" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILES}
            onChange={onFilesPicked}
            className="hidden"
          />

          {!isExpanded ? (
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(e) => { setText(e.target.value); sendTypingEvent(); }}
              placeholder={dragActive ? "Drop files to upload..." : `Message #${roomName || "channel"}`}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
            />
          ) : (
            <div className="flex-1 flex items-center gap-2">
              <span className="text-xs text-text-muted font-mono">
                {language} · {code.split("\n").length} line{code.split("\n").length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isExpanded ? (
              <button
                onClick={handleSendCode}
                disabled={!code.trim() || uploading}
                className="px-3 h-8 rounded-xl bg-accent-purple hover:bg-accent-violet text-white text-xs font-semibold transition-all disabled:opacity-35"
              >
                {editingMessage ? "Save" : "Send"}
              </button>
            ) : (
              <>
                {!editingMessage && !hasTextModeContent ? (
                  <button
                    onClick={openRecorder}
                    disabled={uploading || recorderOpen}
                    title="Record voice note"
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-purple to-accent-violet text-white shadow-lg shadow-accent-purple/30 hover:shadow-accent-purple/50 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-35"
                  >
                    <MicIcon className="w-4 h-4 mx-auto" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendText}
                    disabled={uploading || (!text.trim() && attachments.length === 0)}
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-purple to-accent-violet text-white shadow-lg shadow-accent-purple/30 hover:shadow-accent-purple/50 hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-35"
                  >
                    <SendIcon className="w-4 h-4 mx-auto" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBase({ children, className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function PaperclipIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.5" strokeWidth="1.4" opacity="0.45" />
      <line x1="12" y1="8" x2="12" y2="16" strokeWidth="2" />
      <line x1="8" y1="12" x2="16" y2="12" strokeWidth="2" />
    </svg>
  );
}
function MicIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.6" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.9" />
      <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.9" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}
function SendIcon({ className }) {
  return <IconBase className={className}><path d="M3 11.8 20.2 3.5 14.1 20.5 10.8 13.2 3 11.8Z" /><path d="m10.8 13.2 9.4-9.7" /></IconBase>;
}
function CloseIcon({ className }) {
  return <IconBase className={className}><path d="M18 6 6 18M6 6l12 12" /></IconBase>;
}
function CodeIcon({ className }) {
  return <IconBase className={className}><path d="m16 18 6-6-6-6" /><path d="m8 6-6 6 6 6" /></IconBase>;
}
function ReplyIcon({ className }) {
  return <IconBase className={className}><path d="m9 17-5-5 5-5" /><path d="M4 12h10a6 6 0 0 1 6 6" /></IconBase>;
}
function EditIcon({ className }) {
  return <IconBase className={className}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></IconBase>;
}
function AttachmentMiniIcon({ className }) {
  return <IconBase className={className}><path d="M8 7h8" /><path d="M8 12h8" /><path d="M8 17h5" /><rect x="4" y="3.5" width="16" height="17" rx="2.2" /></IconBase>;
}
