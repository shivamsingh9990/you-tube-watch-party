import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import socket from "../socket/socket";

import VideoPlayer from "../components/VideoPlayer";
import ParticipantsSidebar from "../components/ParticipantsSidebar";
import MeetingLinkShare from "../components/MeetingLinkShare";
import "./Room.css";

function normalizeYouTubeUrl(url) {
  try {
    if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(url)) {
      url = `https://${url}`;
    }

    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be") {
      return `https://www.youtube.com/watch?v=${parsed.pathname.slice(1)}`;
    }

    if (host.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return `https://www.youtube.com/watch?v=${parsed.pathname.split("/embed/")[1]}`;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");

  const [joined, setJoined] = useState(false);

  const [users, setUsers] = useState([]);

  const [videoUrl, setVideoUrl] = useState(
    "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  );

  const [playing, setPlaying] = useState(false);
  const [playerError, setPlayerError] = useState("");
  const [role, setRole] = useState("participant");
  const [latency, setLatency] = useState(null);
  const [syncOffset, setSyncOffset] = useState(0);
  const [hostTime, setHostTime] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("connected");
  const playerRef = useRef(null);
  const queuedSeekRef = useRef(null);
  const pingStartRef = useRef(null);
  const suppressSeekEmitRef = useRef(false);
  const lastProgressTimeRef = useRef(0);
  const isHostRef = useRef(false);
  const latencyRef = useRef(null);
  const usernameRef = useRef("");

  const applySeek = (time) => {
    if (typeof time !== "number" || Number.isNaN(time)) return;
    setHostTime(time);
    if (playerRef.current) {
      suppressSeekEmitRef.current = true;
      playerRef.current.seekTo(time);
      window.setTimeout(() => {
        suppressSeekEmitRef.current = false;
      }, 500);
    } else {
      queuedSeekRef.current = time;
    }
  };

  const broadcastSeek = (time) => {
    if (!isHostRef.current) return;
    if (suppressSeekEmitRef.current) return;
    setHostTime(time);
    socket.emit("seek_video", { roomId, time });
  };

  const sessionKey = `watchparty:${roomId}`;

  const persistSession = (name) => {
    sessionStorage.setItem(
      sessionKey,
      JSON.stringify({ username: name, joined: true }),
    );
  };

  const clearSession = () => {
    sessionStorage.removeItem(sessionKey);
  };

  const emitJoinRoom = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    socket.emit("join_room", {
      roomId,
      username: trimmed,
    });
  };

  const joinRoom = () => {
    if (!username.trim()) return;

    persistSession(username.trim());
    emitJoinRoom(username);
    setJoined(true);
  };

  const isHost = role === "host";

  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const handleAssignRole = (targetSocketId, newRole) => {
    if (!isHost) return;
    socket.emit("assign_role", {
      roomId,
      targetSocketId,
      role: newRole,
    });
  };

  const handleRemoveParticipant = (targetSocketId) => {
    if (!isHost) return;
    socket.emit("remove_participant", {
      roomId,
      targetSocketId,
    });
  };

  const syncRoleFromUsers = (userList) => {
    const me = userList.find((u) => u.username === usernameRef.current);
    if (me?.role) {
      setRole(me.role);
    }
  };

  useEffect(() => {
    latencyRef.current = latency;
  }, [latency]);

  const handlePlay = () => {
    if (!isHost) return;
    const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
    socket.emit("play_video", {
      roomId,
      currentTime,
    });
  };

  // PAUSE
  const handlePause = () => {
    if (!isHost) return;
    const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
    socket.emit("pause_video", {
      roomId,
      currentTime,
    });
  };

  // CHANGE VIDEO
  const sendPing = () => {
    const ts = Date.now();
    pingStartRef.current = ts;
    socket.emit("ping_request", { ts });
  };

  const changeVideo = () => {
    const rawUrl = prompt("Enter YouTube URL");

    if (!rawUrl) return;

    const url = rawUrl.trim();
    if (!url) return;

    const normalizedUrl = normalizeYouTubeUrl(url);
    console.log("changeVideo url=", url, "normalized=", normalizedUrl);

    if (!normalizedUrl) {
      alert("This URL is not supported. Please enter a valid YouTube URL.");
      return;
    }

    setVideoUrl(normalizedUrl);
    setPlayerError("");

    socket.emit("change_video", {
      roomId,
      videoUrl: normalizedUrl,
    });
  };

  // Restore session after refresh; re-join when socket reconnects
  useEffect(() => {
    const raw = sessionStorage.getItem(sessionKey);
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      if (!saved?.joined || !saved.username) return;

      setUsername(saved.username);
      setJoined(true);

      const tryRejoin = () => {
        if (socket.connected) {
          emitJoinRoom(saved.username);
        }
      };

      tryRejoin();
      socket.on("connect", tryRejoin);

      return () => {
        socket.off("connect", tryRejoin);
      };
    } catch {
      clearSession();
    }
  }, [roomId]);

  useEffect(() => {
    const onConnect = () => setConnectionStatus("connected");
    const onDisconnect = () => setConnectionStatus("reconnecting");

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (!socket.connected) {
      setConnectionStatus("reconnecting");
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  useEffect(() => {
    socket.on("user_joined", (data) => {
      setUsers(data.users);
      syncRoleFromUsers(data.users);
    });

    socket.on("roles_updated", (data) => {
      setUsers(data.users);
      syncRoleFromUsers(data.users);
    });

    socket.on("sync_video_state", (data) => {
      setVideoUrl(data.videoUrl);
      setPlaying(data.playing);
      if (data.role) {
        setRole(data.role);
      }
      if (typeof data.currentTime === "number") {
        applySeek(data.currentTime);
      }
    });

    socket.on("video_changed", (data) => {
      console.log("Video Changed:", data);
      setVideoUrl(data.videoUrl);
      setPlaying(data.playing);
      setPlayerError("");
      lastProgressTimeRef.current = 0;
      if (typeof data.currentTime === "number") {
        applySeek(data.currentTime);
      }
    });

    socket.on("play_video", (data) => {
      const time = data?.currentTime ?? 0;
      applySeek(time);
      setPlaying(true);
    });

    socket.on("pause_video", (data) => {
      const time = data?.currentTime ?? 0;
      applySeek(time);
      setPlaying(false);
    });

    socket.on("seek_video", (data) => {
      const time = data?.time ?? 0;
      applySeek(time);
    });

    socket.on("sync_time", (data) => {
      if (isHostRef.current) return;
      const currentTime = data?.currentTime ?? null;
      if (currentTime === null || !playerRef.current) return;
      const latencyMs = latencyRef.current ?? 0;
      const predictedHostTime = currentTime + latencyMs / 1000;
      setHostTime(predictedHostTime);
      const local = playerRef.current.getCurrentTime?.() ?? 0;
      setSyncOffset(local - predictedHostTime);
      if (Math.abs(local - predictedHostTime) > 0.7) {
        applySeek(predictedHostTime);
      }
    });

    socket.on("ping_response", (data) => {
      if (typeof data.ts !== "number") return;
      const start = pingStartRef.current;
      if (!start) return;
      const rtt = Date.now() - start;
      setLatency(rtt / 2);
      pingStartRef.current = null;
    });

    socket.on("error_message", (message) => {
      alert(message);
    });

    socket.on("removed_from_room", (data) => {
      clearSession();
      setJoined(false);
      setUsers([]);
      setRole("participant");
      alert(data?.message || "You were removed from the room.");
      navigate("/");
    });

    return () => {
      socket.off("user_joined");
      socket.off("roles_updated");

      socket.off("sync_video_state");

      socket.off("play_video");

      socket.off("pause_video");

      socket.off("video_changed");

      socket.off("error_message");
      socket.off("removed_from_room");
      socket.off("seek_video");
      socket.off("sync_time");
      socket.off("ping_response");
    };
  }, []);

  // Host periodically broadcasts current time to correct drift for participants
  useEffect(() => {
    if (!isHost) return;
    if (!playing) return;

    const id = setInterval(() => {
      const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
      socket.emit("sync_time", { roomId, currentTime });
    }, 3000);

    return () => clearInterval(id);
  }, [isHost, playing, roomId]);

  useEffect(() => {
    const id = setInterval(() => {
      sendPing();
    }, 3000);

    // first ping immediately
    sendPing();

    return () => clearInterval(id);
  }, []);

  // onReady handler: apply queued seek if present
  const handlePlayerReady = () => {
    if (queuedSeekRef.current !== null) {
      applySeek(queuedSeekRef.current);
      queuedSeekRef.current = null;
    }
    lastProgressTimeRef.current = playerRef.current?.getCurrentTime?.() ?? 0;
  };

  const handleHostSeeked = () => {
    const time = playerRef.current?.getCurrentTime?.() ?? 0;
    broadcastSeek(time);
  };

  const handleHostTimeUpdate = () => {
    if (!isHostRef.current || suppressSeekEmitRef.current) return;
    const played = playerRef.current?.getCurrentTime?.() ?? 0;
    const last = lastProgressTimeRef.current;
    lastProgressTimeRef.current = played;
    if (Math.abs(played - last) > 1.5) {
      broadcastSeek(played);
    }
  };

  const handleHostPlay = () => {
    if (!isHostRef.current) return;
    const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
    socket.emit("play_video", { roomId, currentTime });
    setPlaying(true);
  };

  const handleHostPause = () => {
    if (!isHostRef.current) return;
    const currentTime = playerRef.current?.getCurrentTime?.() ?? 0;
    socket.emit("pause_video", { roomId, currentTime });
    setPlaying(false);
  };

  const handleJoinKeyDown = (e) => {
    if (e.key === "Enter") joinRoom();
  };

  const hostUser = users.find((u) => u.role === "host");

  return (
    <div className="room-page">
      {!joined ? (
        <section className="room-join">
          <div className="room-join-card">
            <h1>Join the party</h1>
            <span className="room-code">Room {roomId}</span>
            <MeetingLinkShare roomId={roomId} variant="join" />
            <div className="room-join-form">
              <input
                className="room-input"
                type="text"
                placeholder="Your display name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleJoinKeyDown}
                autoFocus
              />
              <button
                type="button"
                className="room-btn room-btn--primary"
                onClick={joinRoom}
                disabled={!username.trim()}
              >
                Enter room
              </button>
            </div>
          </div>
        </section>
      ) : (
        <div className="room-layout">
          <ParticipantsSidebar
            roomId={roomId}
            users={users}
            currentUsername={username}
            isCurrentUserHost={isHost}
            onAssignRole={handleAssignRole}
            onRemoveParticipant={handleRemoveParticipant}
            playing={playing}
            latency={latency}
            hostTime={hostTime}
            syncOffset={syncOffset}
            connectionStatus={connectionStatus}
          />

          <main className="room-main">
            <header className="room-topbar">
              <div className="room-topbar-left">
                <h1>Now watching</h1>
                <span className="room-role-chip">
                  <span
                    className={`role-dot${isHost ? "" : " role-dot--guest"}`}
                    aria-hidden="true"
                  />
                  You are <strong>{role}</strong>
                </span>
              </div>

              {isHost && (
                <div className="room-controls">
                  <button type="button" className="room-btn" onClick={changeVideo}>
                    Change video
                  </button>
                  <button
                    type="button"
                    className="room-btn room-btn--play"
                    onClick={handlePlay}
                  >
                    Play
                  </button>
                  <button
                    type="button"
                    className="room-btn room-btn--pause"
                    onClick={handlePause}
                  >
                    Pause
                  </button>
                </div>
              )}
            </header>

            {!isHost && (
              <p className="room-notice">
                {hostUser ? (
                  <>
                    <strong>{hostUser.username}</strong> is hosting and controls playback.
                  </>
                ) : (
                  <>
                    The <strong>host</strong> controls playback. Sit back and enjoy the show.
                  </>
                )}
              </p>
            )}

            {isHost && (
              <p className="room-notice room-notice--host">
                You are the <strong>host</strong> — use the player or toolbar to control
                the video. Assign host in the sidebar to share control.
              </p>
            )}

            <div className="room-video-wrap">
              <VideoPlayer
                videoUrl={videoUrl}
                playing={playing}
                ref={playerRef}
                onReady={handlePlayerReady}
                onPlay={isHost ? handleHostPlay : undefined}
                onPause={isHost ? handleHostPause : undefined}
                onError={() => {
                  console.log("Video load error", videoUrl);
                  setPlayerError("Error loading the video. Please check the URL.");
                  setPlaying(false);
                }}
                onSeeked={isHost ? handleHostSeeked : undefined}
                onTimeUpdate={isHost ? handleHostTimeUpdate : undefined}
                controls={isHost}
                interactionLocked={!isHost}
              />
            </div>

            {playerError && <p className="room-error">{playerError}</p>}
          </main>
        </div>
      )}
    </div>
  );
}

export default Room;
