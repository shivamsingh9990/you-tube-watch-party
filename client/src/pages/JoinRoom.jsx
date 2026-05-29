import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import MeetingLinkShare from "../components/MeetingLinkShare";
import { parseRoomIdFromInput } from "../utils/meetingLink";

function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const [searchParams] = useSearchParams();

  const navigate = useNavigate();

  useEffect(() => {
    const fromQuery = searchParams.get("room") || searchParams.get("id");
    if (fromQuery) {
      setRoomId(fromQuery.trim());
    }
  }, [searchParams]);

  const joinRoom = () => {
    const id = roomId.trim();
    if (!id) return;
    navigate(`/room/${encodeURIComponent(id)}`);
  };

  const trimmedId = roomId.trim();

  return (
    <div className="join-room-page">
      <div className="room-join-card">
        <h1>Join a room</h1>
        <p className="join-room-lead">
          Paste a meeting link or enter the room code below.
        </p>

        <input
          className="room-input"
          type="text"
          placeholder="Room code or paste meeting link"
          value={roomId}
          onChange={(e) => setRoomId(parseRoomIdFromInput(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && joinRoom()}
        />

        {trimmedId && <MeetingLinkShare roomId={trimmedId} variant="join" />}

        <button
          type="button"
          className="room-btn room-btn--primary join-room-btn"
          onClick={joinRoom}
          disabled={!trimmedId}
        >
          Continue to room
        </button>
      </div>
    </div>
  );
}

export default JoinRoom;
