import { useEffect, useRef, useState, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, ScreenShare,
  MessageSquare, Users, MoreHorizontal, Sun, Moon,
  Download, Wifi, WifiOff, Clock, X
} from "lucide-react";

const MY_IDENTITY = "user-" + Math.random().toString(36).slice(2, 8);
const SHORT_ID = MY_IDENTITY.slice(-4);
const SERVER = "https://video-demo-2qvd.onrender.com";
const WS_SERVER = "wss://video-demo-2qvd.onrender.com";

const AVATAR_GRADIENTS = [
  ["#2563eb", "#1d4ed8"], ["#7c3aed", "#6d28d9"],
  ["#0891b2", "#0e7490"], ["#059669", "#047857"],
  ["#d97706", "#b45309"], ["#dc2626", "#b91c1c"], ["#db2777", "#be185d"],
];
const avatarGrad = (id) => AVATAR_GRADIENTS[id.charCodeAt(id.length - 1) % AVATAR_GRADIENTS.length];
const initials = (id) => id.slice(-4).toUpperCase().slice(0, 2);

function useCallTimer(running) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!running) return;

    setSecs(0); // ✅ reset only when starting

    const t = setInterval(() => {
      setSecs((s) => s + 1);
    }, 1000);

    return () => clearInterval(t);
  }, [running]);

  const m = Math.floor((secs % 3600) / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  const h = Math.floor(secs / 3600);

  return h ? `${h}:${m}:${s}` : `${m}:${s}`;
}

// ─── Participant tile: shows video if available, avatar fallback ───
function ParticipantTile({ id, label, isSelf, micOff, videoOff, videoRef, dark }) {
  const [g1, g2] = avatarGrad(id);
  return (
    <div style={{
      position: "relative", borderRadius: 16, overflow: "hidden",
      background: dark ? "#1e1e20" : "#e8e8ea",
      border: dark ? "1.5px solid rgba(255,255,255,0.09)" : "1.5px solid rgba(0,0,0,0.08)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: 12,
      aspectRatio: "16/9", minWidth: 0, flex: "1 1 260px", maxWidth: 460,
    }}>
      {/* VIDEO ELEMENT — always rendered, hidden when no video */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf} // prevent echo for local
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          display: videoOff ? "none" : "block",
          // mirror self view
          transform: isSelf ? "scaleX(-1)" : "none",
        }}
      />

      {/* AVATAR FALLBACK — shown when video is off */}
      {videoOff && (
        <div style={{
          width: 68, height: 68, borderRadius: "50%",
          background: `linear-gradient(135deg,${g1},${g2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 700, color: "#fff",
          boxShadow: "0 4px 18px rgba(0,0,0,0.28)",
          position: "relative", zIndex: 1,
        }}>{initials(id)}</div>
      )}

      {/* NAME BAR */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: dark ? "rgba(12,12,14,0.72)" : "rgba(255,255,255,0.80)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 12px", zIndex: 2,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600, flex: 1,
          color: dark ? "#e5e7eb" : "#1f2937",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {label}{isSelf ? " (You)" : ""}
        </span>
        {/* mic status badge */}
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: micOff ? "#dc2626" : "#16a34a",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {micOff ? <MicOff size={11} color="#fff" /> : <Mic size={11} color="#fff" />}
        </div>
        {/* video off badge */}
        {videoOff && (
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "#6b7280",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <VideoOff size={11} color="#fff" />
          </div>
        )}
      </div>
    </div>
  );
}

function CtrlBtn({ icon, label, onClick, danger, active, dark, small }) {
  const [hover, setHover] = useState(false);
  const bg = danger
    ? (hover ? "#b91c1c" : "#dc2626")
    : active
      ? (hover ? "#1d4ed8" : "#2563eb")
      : dark
        ? (hover ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)")
        : (hover ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)");
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
        background: "none", border: "none", cursor: "pointer", padding: 0
      }}>
      <div style={{
        width: small ? 40 : 48, height: small ? 40 : 48, borderRadius: "50%",
        background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background .15s, transform .1s",
        transform: hover ? "scale(1.07)" : "scale(1)",
      }}>{icon}</div>
      {label && <span style={{ fontSize: 10, fontWeight: 500, whiteSpace: "nowrap", color: dark ? "#9ca3af" : "#6b7280" }}>{label}</span>}
    </button>
  );
}

function TLine({ line, dark }) {
  const isYou = line.speaker === "You", isSys = line.speaker === "System";
  const tagBg = isYou ? (dark ? "rgba(37,99,235,0.28)" : "#dbeafe") : isSys ? (dark ? "rgba(34,197,94,0.18)" : "#dcfce7") : (dark ? "rgba(249,115,22,0.2)" : "#ffedd5");
  const tagColor = isYou ? (dark ? "#93c5fd" : "#1d4ed8") : isSys ? (dark ? "#86efac" : "#15803d") : (dark ? "#fdba74" : "#c2410c");
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "6px 0", borderBottom: dark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)" }}>
      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, flexShrink: 0, background: tagBg, color: tagColor, marginTop: 1 }}>{line.speaker}</span>
      <span style={{ fontSize: 12, color: dark ? "#d1d5db" : "#374151", flex: 1, lineHeight: 1.5 }}>{line.text}</span>
      <span style={{ fontSize: 10, color: dark ? "#4b5563" : "#9ca3af", whiteSpace: "nowrap", marginTop: 2 }}>{line.time}</span>
    </div>
  );
}

// ════════════════════════════════════════════
export default function VoiceRoom() {
  const roomRef = useRef(null);
  const audioContainerRef = useRef(null);
  const transcriptRef = useRef([]);
  const deepgramWsRef = useRef(null);
  const micStreamRef = useRef(null);
  const videoStreamRef = useRef(null);   // ← NEW: local camera stream
  const transcriptEndRef = useRef(null);
  const startTranscriptionRef = useRef(null);
  const localVideoRef = useRef(null);   // ← NEW: <video> element for self
  const screenStreamRef = useRef(null);
  const videoRefs = useRef({});

  const [isSharing, setIsSharing] = useState(false);
  const [dark, setDark] = useState(true);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);          // ← NEW
  const [showTranscript, setShowTranscript] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [statusText, setStatusText] = useState("idle");
  const [transcript, setTranscript] = useState([]);
  // remoteUsers now carries { id, videoRef } so each tile has its own <video> ref
  const [remoteUsers, setRemoteUsers] = useState([]);
  const timer = useCallTimer(started);

  const bg = dark ? "#111113" : "#f9fafb";
  const surface = dark ? "#1c1c1e" : "#ffffff";
  const surface2 = dark ? "#2c2c2e" : "#f3f4f6";
  const border = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  const textPrimary = dark ? "#f9fafb" : "#111827";
  const textMuted = dark ? "#6b7280" : "#9ca3af";


  const addLine = useCallback((speaker, msg) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const line = { speaker, text: msg, time };
    transcriptRef.current = [...transcriptRef.current, line];
    setTranscript([...transcriptRef.current]);
    setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // ── Get mic stream ──
  const getMicStream = async () => {
    if (micStreamRef.current) return micStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    micStreamRef.current = stream;
    return stream;
  };

  // ── Get camera stream ──
  const getCameraStream = async () => {
    if (videoStreamRef.current) return videoStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
      });
      videoStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error("Camera access failed:", err);
      throw err; // re-throw to handle in caller
    }
  };
  const toggleScreenShare = async () => {
    if (!isSharing) {
      await startScreenShare();
      setIsSharing(true);
    } else {
      await stopScreenShare();
      setIsSharing(false);
    }
  };
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // optional (tab audio)
      });

      screenStreamRef.current = stream;

      const videoTrack = stream.getVideoTracks()[0];

      // publish to LiveKit
      await roomRef.current.localParticipant.publishTrack(videoTrack, {
        name: "screen",
        source: Track.Source.ScreenShare,
      });

      // stop sharing when user clicks "Stop sharing"
      videoTrack.onended = () => {
        stopScreenShare();
      };

    } catch (err) {
      console.error("❌ Screen share error:", err);
    }
  };

  const stopScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;

    // unpublish screen track
    room.localParticipant.videoTrackPublications.forEach(pub => {
      if (pub.source === Track.Source.ScreenShare) {
        pub.unpublish();
      }
    });

    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
  };
  function downsampleBuffer(buf, sr, out) {
    if (out === sr) return buf;
    const ratio = sr / out, len = Math.round(buf.length / ratio);
    const res = new Float32Array(len);
    let ro = 0, rb = 0;
    while (ro < res.length) {
      const next = Math.round((ro + 1) * ratio); let acc = 0, cnt = 0;
      for (let i = rb; i < next && i < buf.length; i++) { acc += buf[i]; cnt++; }
      res[ro] = acc / cnt; ro++; rb = next;
    }
    return res;
  }

  const startTranscription = useCallback((room, stream) => {
    if (deepgramWsRef.current && (deepgramWsRef.current.readyState === WebSocket.OPEN || deepgramWsRef.current.readyState === WebSocket.CONNECTING)) return;
    const ws = new WebSocket(WS_SERVER);
    deepgramWsRef.current = ws;
    ws.onopen = () => {
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const proc = ac.createScriptProcessor(4096, 1, 1);
      src.connect(proc); proc.connect(ac.destination);
      proc.onaudioprocess = (e) => {
        const inp = e.inputBuffer.getChannelData(0);
        const ds = downsampleBuffer(inp, ac.sampleRate, 16000);
        const pcm = new Int16Array(ds.length);
        for (let i = 0; i < ds.length; i++)pcm[i] = Math.max(-1, Math.min(1, ds[i])) * 0x7fff;
        if (ws.readyState === WebSocket.OPEN) ws.send(pcm.buffer);
      };
    };
    ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "transcript" && msg.text) {
          addLine("You", msg.text);
          if (room.localParticipant && room.state === "connected") {
            const payload = JSON.stringify({ speaker: MY_IDENTITY, text: msg.text });
            await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
          }
        }
      } catch (e) { console.error("Transcription message error:", e); }
    };
    ws.onerror = () => addLine("System", "Transcription error");
    ws.onclose = (e) => {
      if (roomRef.current?.state === "connected" && e.code !== 1000)
        setTimeout(() => startTranscriptionRef.current?.(room, stream), 2000);
    };
  }, [addLine]);

  useEffect(() => { startTranscriptionRef.current = startTranscription; }, [startTranscription]);

  // ── Attach local camera to the self <video> element ──
  useEffect(() => {
    if (started && localVideoRef.current && videoStreamRef.current) {
      localVideoRef.current.srcObject = videoStreamRef.current;
    }
  }, [started]);
const getVideoRef = (identity) => {
  if (!videoRefs.current[identity]) {
    videoRefs.current[identity] = { current: null };
  }
  return videoRefs.current[identity];
};
  const startCall = async () => {
    setStarted(true); setStatusText("Connecting...");
    try {
      // Get both mic and camera simultaneously
      const [micStream, camStream] = await Promise.all([
        getMicStream(),
        getCameraStream().catch(() => null), // graceful fallback if no camera
      ]);

      // Show local video immediately
      if (camStream && localVideoRef.current) {
        localVideoRef.current.srcObject = camStream;
      }

      const res = await fetch(`${SERVER}/getToken`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_name: "room-123", participant_identity: MY_IDENTITY, participant_name: "User " + SHORT_ID }),
      });
      if (!res.ok) { const err = await res.json(); setStatusText("Error: " + err.error); setStarted(false); return; }
      const data = await res.json();

      const room = new Room({
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        videoCaptureDefaults: { resolution: { width: 1280, height: 720 } },
        adaptiveStream: true, dynacast: true,
      });
      roomRef.current = room;

      // ── Data (transcript relay) ──
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        if (!participant || participant.identity === MY_IDENTITY) return;
        try { const msg = JSON.parse(new TextDecoder().decode(payload)); if (msg.speaker && msg.text) addLine("User-" + msg.speaker.slice(-4), msg.text); } catch (e) { console.error("Data message error:", e); }
      });

      // ── Remote track subscribed: attach audio OR video ──
      room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          // audio: use invisible <audio> element
          const old = audioContainerRef.current?.querySelector(`[data-id="${participant.identity}"]`);
          if (old) old.remove();
          const el = track.attach(); el.autoPlay = true;
          el.setAttribute("data-id", participant.identity);
          el.setAttribute("playsinline", "true");
          el.muted = false; el.volume = 1.0;
          audioContainerRef.current?.appendChild(el);
          el.play().catch(() => { });
        }

      if (track.kind === Track.Kind.Video) {
  const vRef = getVideoRef(participant.identity);

  if (!vRef) return;

  const el = track.attach();

  if (vRef.current) {
    vRef.current.srcObject = el.srcObject;
  } else {
    // fallback if ref not mounted yet
    setTimeout(() => {
      if (vRef.current) {
        vRef.current.srcObject = el.srcObject;
      }
    }, 100);
  }

  setRemoteUsers(prev =>
    prev.map(u =>
      u.id === participant.identity ? { ...u, hasVideo: true } : u
    )
  );
}
      });

      room.on(RoomEvent.TrackUnsubscribed, (track, pub, participant) => {
        if (track.kind === Track.Kind.Audio) {
          track.detach();
          const el = audioContainerRef.current?.querySelector(`[data-id="${participant.identity}"]`);
          if (el) el.remove();
        }
        if (track.kind === Track.Kind.Video) {
          const vRef = getVideoRef(participant.identity);

          if (vRef?.current) vRef.current.srcObject = null;
          setRemoteUsers(prev => prev.map(u =>
            u.id === participant.identity ? { ...u, hasVideo: false } : u
          ));
        }
      });

      room.on(RoomEvent.ParticipantConnected, (p) => {
        setStatusText("Connected");

        // ✅ CREATE REF HERE (NOT IN RENDER)
        if (!videoRefs.current[p.identity]) {
  videoRefs.current[p.identity] = { current: null };
}
        setRemoteUsers(prev => [
          ...prev.filter(u => u.id !== p.identity),
          { id: p.identity, hasVideo: false }
        ]);

        addLine("System", "User-" + p.identity.slice(-4) + " joined");
      });
      room.on(RoomEvent.ParticipantDisconnected, (p) => {
        setStatusText("Waiting...");
        setRemoteUsers(prev => prev.filter(u => u.id !== p.identity));
        addLine("System", "User-" + p.identity.slice(-4) + " left");
      });
      room.on(RoomEvent.Disconnected, () => { setStatusText("Disconnected"); setStarted(false); });

      await room.connect(data.server_url, data.participant_token);

      // Publish audio track
      await room.localParticipant.publishTrack(micStream.getAudioTracks()[0], {
        name: "microphone", source: Track.Source.Microphone,
      });

      // Publish video track (if camera available)
      if (camStream) {
        await room.localParticipant.publishTrack(camStream.getVideoTracks()[0], {
          name: "camera", source: Track.Source.Camera,
        });
      } else {
        setVideoOff(true);
      }

      const rc = room.remoteParticipants.size;
      if (rc > 0) {
        setStatusText("Connected");
        const users = [];
        room.remoteParticipants.forEach(p => {
          users.push({ id: p.identity, hasVideo: false });
        });
        setRemoteUsers(users);
      } else { setStatusText("Waiting..."); }

      startTranscription(room, micStream);
    } catch (err) { setStatusText("Error: " + err.message); setStarted(false); }
  };

  // ── Toggle mic ──
  const toggleMute = () => {
    const n = !muted;
    micStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !n; });
    setMuted(n);
  };

  // ── Toggle camera ──
  const toggleVideo = async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;

    const currentlyOff = videoOff;
    const newOff = !currentlyOff;

    if (newOff) {
      // Turning video off
      videoStreamRef.current?.getVideoTracks().forEach(t => t.enabled = false);
      room.localParticipant.videoTrackPublications.forEach(pub => pub.mute());
      setVideoOff(true);
    } else {
      // Turning video on
      if (!videoStreamRef.current) {
        try {
          const stream = await getCameraStream();
          // Attach to local video
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          // Publish the track
          await room.localParticipant.publishTrack(stream.getVideoTracks()[0], {
            name: "camera", source: Track.Source.Camera,
          });
        } catch (err) {
          console.error("Failed to enable camera:", err);
          alert("Camera access denied or unavailable. Please check permissions.");
          return; // Don't change state
        }
      } else {
        // Stream exists, just enable
        videoStreamRef.current.getVideoTracks().forEach(t => t.enabled = true);
        room.localParticipant.videoTrackPublications.forEach(pub => pub.unmute());
      }
      setVideoOff(false);
    }
  };

  // ── End call ──
  const endCall = () => {
    deepgramWsRef.current?.close(1000, "Call ended"); deepgramWsRef.current = null;
    roomRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach(t => t.stop()); micStreamRef.current = null;
    videoStreamRef.current?.getTracks().forEach(t => t.stop()); videoStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setStarted(false); setStatusText("idle");
    setTranscript([]); transcriptRef.current = []; setRemoteUsers([]);
    setVideoOff(false); setMuted(false);
  };

  const downloadTranscript = () => {
    if (!transcript.length) return;
    const text = transcript.map(l => `[${l.time}] ${l.speaker}: ${l.text}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transcript-${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    return () => {
      deepgramWsRef.current?.close();
      roomRef.current?.disconnect();
      micStreamRef.current?.getTracks().forEach(t => t.stop());
      videoStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Build tile list ──
  const allTiles = [
    {
      id: MY_IDENTITY,
      label: "User-" + SHORT_ID,
      isSelf: true,
      micOff: muted,
      videoOff,
    },
    ...remoteUsers.map((u) => ({
      id: u.id,
      label: "User-" + u.id.slice(-4),
      isSelf: false,
      micOff: false,
      videoOff: !u.hasVideo,
    })),
  ];
  const totalParticipants = 1 + remoteUsers.length;
  const connected = statusText === "Connected";
  const iconColor = (active) => active ? "#fff" : (dark ? "#e5e7eb" : "#374151");

  return (
    <div style={{
      width: "100%", height: "100dvh",
      background: bg, display: "flex", flexDirection: "column",
      overflow: "hidden", fontFamily: "'Inter','Segoe UI',sans-serif", color: textPrimary,
    }}>
      <div ref={audioContainerRef} style={{ display: "none" }} />

      {/* ══ TOP BAR ══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 20px", flexShrink: 0,
        background: surface, borderBottom: `1px solid ${border}`, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg,#2563eb,#7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Video size={18} color="#fff" />
          </div>
          {/* <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.3px" }}>Weekly sync</div>
            <div style={{ fontSize: 11, color: textMuted }}>room-123 · {MY_IDENTITY}</div>
          </div> */}
        </div>

        {started && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 20,
              background: dark ? "rgba(37,99,235,0.15)" : "#dbeafe",
              border: `1px solid ${dark ? "rgba(37,99,235,0.35)" : "#bfdbfe"}`,
            }}>
              <Clock size={12} color={dark ? "#60a5fa" : "#2563eb"} />
              <span style={{ fontSize: 12, fontWeight: 600, color: dark ? "#60a5fa" : "#2563eb", fontVariantNumeric: "tabular-nums" }}>{timer}</span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
              background: connected ? (dark ? "rgba(34,197,94,0.15)" : "#dcfce7") : (dark ? "rgba(245,158,11,0.15)" : "#fef3c7"),
              border: `1px solid ${connected ? (dark ? "rgba(34,197,94,0.3)" : "#86efac") : (dark ? "rgba(245,158,11,0.3)" : "#fde68a")}`,
            }}>
              {connected ? <Wifi size={12} color={dark ? "#4ade80" : "#16a34a"} /> : <WifiOff size={12} color={dark ? "#fbbf24" : "#d97706"} />}
              <span style={{ fontSize: 12, fontWeight: 600, color: connected ? (dark ? "#4ade80" : "#16a34a") : (dark ? "#fbbf24" : "#d97706") }}>{statusText}</span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setDark(d => !d)} style={{
            width: 36, height: 36, borderRadius: 8, border: `1px solid ${border}`,
            background: surface2, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dark ? <Sun size={16} color={textMuted} /> : <Moon size={16} color={textMuted} />}
          </button>
          {started && (
            <button onClick={downloadTranscript} disabled={!transcript.length} style={{
              width: 36, height: 36, borderRadius: 8, border: `1px solid ${border}`,
              background: surface2, cursor: transcript.length ? "pointer" : "not-allowed",
              opacity: transcript.length ? 1 : 0.4,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Download size={16} color={textMuted} />
            </button>
          )}
        </div>
      </div>

      {/* ══ BODY ══ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* ── STAGE ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!started ? (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              flexDirection: "column", gap: 30, padding: 40,
            }}>
              <div style={{
                width: 96, height: 96, borderRadius: 26,
                background: "linear-gradient(135deg,#2563eb,#7c3aed)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 16px 48px rgba(37,99,235,0.38)",
              }}>
                <Video size={44} color="#fff" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1px", marginBottom: 10 }}>Ready to join?</div>
                <div style={{ fontSize: 14, color: textMuted, maxWidth: 340, lineHeight: 1.65 }}>
                  Voice + video call with live AI transcription.{" "}
                  <span style={{ fontFamily: "monospace", color: dark ? "#60a5fa" : "#2563eb" }}>{MY_IDENTITY}</span>
                </div>
              </div>
              <button onClick={startCall} style={{
                padding: "16px 64px", borderRadius: 14, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff",
                fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px",
                boxShadow: "0 6px 24px rgba(37,99,235,0.42)",
              }}>
                Join Meeting
              </button>
            </div>
          ) : (
            <div style={{
              flex: 1, display: "flex", flexWrap: "wrap",
              gap: 12, padding: 16,
              alignContent: "flex-start", overflow: "auto",
            }}>
              {allTiles.map(tile => (
                <ParticipantTile
                  key={tile.id}
                  {...tile}
                  dark={dark}
                  videoRef={
                    tile.isSelf
                      ? localVideoRef
                      : videoRefs.current[tile.id] || null
                  }
                />
              ))}
            </div>
          )}

          {/* ── CONTROL BAR ── */}
          {started && (
            <div style={{
              flexShrink: 0, background: surface,
              borderTop: `1px solid ${border}`,
              padding: "12px 28px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 100 }}>
                <Users size={14} color={textMuted} />
                <span style={{ fontSize: 12, color: textMuted, fontWeight: 500 }}>
                  {totalParticipants} participant{totalParticipants !== 1 ? "s" : ""}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {/* MIC */}
                <CtrlBtn
                  icon={muted ? <MicOff size={20} color="#fff" /> : <Mic size={20} color={iconColor(false)} />}
                  label={muted ? "Unmute" : "Mute"}
                  onClick={toggleMute} dark={dark} active={muted} danger={muted}
                />
                {/* VIDEO — now functional */}
                <CtrlBtn
                  icon={videoOff ? <VideoOff size={20} color="#fff" /> : <Video size={20} color={iconColor(false)} />}
                  label={videoOff ? "Start Video" : "Stop Video"}
                  onClick={toggleVideo} dark={dark} active={videoOff} danger={videoOff}
                />
                {/* END */}
                <CtrlBtn
                  icon={<PhoneOff size={22} color="#fff" />}
                  label="End" onClick={endCall} danger dark={dark}
                />
                <CtrlBtn
                  icon={<ScreenShare size={20} color={isSharing ? "#fff" : iconColor(false)} />}
                  label={isSharing ? "Stop Share" : "Share"}
                  onClick={toggleScreenShare}
                  dark={dark}
                  active={isSharing}
                  danger={isSharing}
                />
                <CtrlBtn
                  icon={<MoreHorizontal size={20} color={iconColor(false)} />}
                  label="More" dark={dark}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 100, justifyContent: "flex-end" }}>
                <CtrlBtn
                  icon={<MessageSquare size={17} color={iconColor(showTranscript)} />}
                  label="Chat"
                  onClick={() => setShowTranscript(t => !t)}
                  active={showTranscript} dark={dark} small
                />
                <CtrlBtn
                  icon={<Users size={17} color={iconColor(showParticipants)} />}
                  label="People"
                  onClick={() => setShowParticipants(p => !p)}
                  active={showParticipants} dark={dark} small
                />
              </div>
            </div>
          )}
        </div>

        {/* ── TRANSCRIPT PANEL ── */}
        {started && showTranscript && (
          <div style={{
            width: 320, flexShrink: 0, background: surface,
            borderLeft: `1px solid ${border}`,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={14} color={textMuted} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Live Transcript</span>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.4s infinite" }} />
              </div>
              <button onClick={() => setShowTranscript(false)} style={{
                width: 26, height: 26, borderRadius: 6, border: `1px solid ${border}`,
                background: surface2, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={13} color={textMuted} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px" }}>
              {transcript.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
                  <Mic size={30} color={textMuted} style={{ opacity: .3 }} />
                  <p style={{ fontSize: 12, color: textMuted, textAlign: "center", lineHeight: 1.6, opacity: .7 }}>Transcript appears here as you speak...</p>
                </div>
              ) : transcript.map((line, i) => <TLine key={i} line={line} dark={dark} />)}
              <div ref={transcriptEndRef} />
            </div>
            <div style={{ padding: "10px 16px", borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <button onClick={downloadTranscript} disabled={!transcript.length} style={{
                width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${border}`,
                background: surface2, cursor: transcript.length ? "pointer" : "not-allowed",
                opacity: transcript.length ? 1 : 0.4, fontSize: 12, fontWeight: 600, color: textPrimary,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Download size={13} /> Save transcript
              </button>
            </div>
          </div>
        )}

        {/* ── PARTICIPANTS PANEL ── */}
        {started && showParticipants && (
          <div style={{
            width: 260, flexShrink: 0, background: surface,
            borderLeft: `1px solid ${border}`,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 16px", borderBottom: `1px solid ${border}`, flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Users size={14} color={textMuted} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Participants ({totalParticipants})</span>
              </div>
              <button onClick={() => setShowParticipants(false)} style={{
                width: 26, height: 26, borderRadius: 6, border: `1px solid ${border}`,
                background: surface2, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <X size={13} color={textMuted} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {allTiles.map(tile => {
                const [g1, g2] = avatarGrad(tile.id);
                return (
                  <div key={tile.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 6px", borderBottom: `1px solid ${border}`,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: `linear-gradient(135deg,${g1},${g2})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff",
                    }}>{initials(tile.id)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {tile.label}{tile.isSelf ? " (You)" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: textMuted }}>
                        {tile.micOff ? "Muted" : "Active"}{tile.videoOff ? " · Cam off" : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {tile.micOff ? <MicOff size={13} color="#dc2626" /> : <Mic size={13} color="#22c55e" />}
                      {tile.videoOff ? <VideoOff size={13} color="#6b7280" /> : <Video size={13} color="#22c55e" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${dark ? "#3a3a3c" : "#d1d5db"};border-radius:4px}
      `}</style>
    </div>
  );
}