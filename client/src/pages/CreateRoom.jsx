import { useState } from "react";
import { useNavigate } from "react-router-dom";

import MeetingLinkShare from "../components/MeetingLinkShare";

function CreateRoom() {
  const navigate = useNavigate();
  const [createdRoomId, setCreatedRoomId] = useState(null);
  const [loading, setLoading] = useState(false);

  const createRoom = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/rooms/create-room",
        {
          method: "POST",
        },
      );

      const data = await response.json();
      setCreatedRoomId(data.roomId);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const enterRoom = () => {
    if (createdRoomId) {
      navigate(`/room/${createdRoomId}`);
    }
  };

  return (
    <div className="create-room-page">
      <div className="room-join-card">
        <h1>Create a watch party</h1>

        {!createdRoomId ? (
          <>
            <p className="join-room-lead">
              Start a room and share the meeting link with friends.
            </p>
            <button
              type="button"
              className="room-btn room-btn--primary join-room-btn"
              onClick={createRoom}
              disabled={loading}
            >
              {loading ? "Creating…" : "Create room"}
            </button>
          </>
        ) : (
          <>
            <p className="join-room-lead">
              Your room is ready. Copy the link below and send it to participants.
            </p>
            <span className="room-code">Room {createdRoomId}</span>
            <MeetingLinkShare roomId={createdRoomId} variant="join" />
            <button
              type="button"
              className="room-btn room-btn--primary join-room-btn"
              onClick={enterRoom}
            >
              Enter as host
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateRoom;
