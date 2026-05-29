function getInitials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarHue(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

import MeetingLinkShare from "./MeetingLinkShare";

function ParticipantsSidebar({
  roomId,
  users,
  currentUsername,
  isCurrentUserHost,
  onAssignRole,
  onRemoveParticipant,
  playing,
  latency,
  hostTime,
  syncOffset,
  connectionStatus = "connected",
}) {
  const host = users.find((u) => u.role === "host");
  const participantCount = users.length;

  const handleMakeHost = (targetSocketId, targetName) => {
    const ok = window.confirm(
      `Make ${targetName} the host? They will control playback.`,
    );
    if (ok) onAssignRole(targetSocketId, "host");
  };

  const handleRemove = (targetSocketId, targetName) => {
    const ok = window.confirm(
      `Remove ${targetName} from the room? They will be disconnected.`,
    );
    if (ok) onRemoveParticipant(targetSocketId);
  };

  return (
    <aside className="participants-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon" aria-hidden="true">
            ▶
          </span>
          <div>
            <p className="sidebar-brand-title">Watch Party</p>
            <p className="sidebar-room-id">Room {roomId}</p>
          </div>
        </div>
        <MeetingLinkShare roomId={roomId} variant="sidebar" />
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-head">
          <h2 className="sidebar-section-title">Participants</h2>
          <span className="sidebar-count-badge">{participantCount}</span>
        </div>

        <ul className="participant-list">
          {users.length === 0 ? (
            <li className="participant-empty">Waiting for people to join…</li>
          ) : (
            users.map((user) => {
              const isYou = user.username === currentUsername;
              const isHostUser = user.role === "host";
              const hue = avatarHue(user.username);
              const canManage =
                isCurrentUserHost &&
                !isYou &&
                (onAssignRole || onRemoveParticipant);

              return (
                <li
                  key={user.socketId}
                  className={`participant-card${isYou ? " participant-card--you" : ""}`}
                >
                  <div
                    className="participant-avatar"
                    style={{ "--avatar-hue": hue }}
                    aria-hidden="true"
                  >
                    {getInitials(user.username)}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {user.username}
                      {isYou && <span className="participant-you-tag">You</span>}
                    </span>
                    <span className="participant-meta">
                      <span className="participant-status-dot" />
                      {isHostUser ? "Hosting" : "Watching"}
                    </span>
                  </div>
                  <div className="participant-actions">
                    {isHostUser ? (
                      <span className="role-badge role-badge--host">Host</span>
                    ) : (
                      <span className="role-badge role-badge--guest">Viewer</span>
                    )}
                    {canManage && !isHostUser && (
                      <div className="role-manage-btns">
                        {onAssignRole && (
                          <button
                            type="button"
                            className="role-action-btn role-action-btn--promote"
                            title={`Make ${user.username} the host`}
                            onClick={() =>
                              handleMakeHost(user.socketId, user.username)
                            }
                          >
                            Make host
                          </button>
                        )}
                        {onRemoveParticipant && (
                          <button
                            type="button"
                            className="role-action-btn role-action-btn--remove"
                            title={`Remove ${user.username} from the room`}
                            onClick={() =>
                              handleRemove(user.socketId, user.username)
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {isCurrentUserHost && users.length > 1 && (
          <p className="sidebar-host-hint">
            You control playback. Use <strong>Make host</strong> to pass control,
            or <strong>Remove</strong> to kick someone from the room.
          </p>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-status">
          {connectionStatus === "reconnecting" && (
            <span className="status-pill status-pill--warn">
              Reconnecting…
            </span>
          )}
          <span className={`status-pill${playing ? " status-pill--live" : ""}`}>
            {playing ? "Playing" : "Paused"}
          </span>
          {host && (
            <span className="sidebar-host-label">
              Led by <strong>{host.username}</strong>
            </span>
          )}
        </div>
        <details className="sync-details">
          <summary>Sync details</summary>
          <dl className="sync-stats">
            <div>
              <dt>Latency</dt>
              <dd>{latency !== null ? `${Math.round(latency)} ms` : "…"}</dd>
            </div>
            <div>
              <dt>Host time</dt>
              <dd>{hostTime.toFixed(1)}s</dd>
            </div>
            <div>
              <dt>Offset</dt>
              <dd>{syncOffset.toFixed(2)}s</dd>
            </div>
          </dl>
        </details>
      </div>
    </aside>
  );
}

export default ParticipantsSidebar;
