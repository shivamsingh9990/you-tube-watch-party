const express = require("express");

const generateRoomId = require("../utils/generateRoomId");
const rooms = require("../data/rooms");

const router = express.Router();

router.post("/create-room", (req, res) => {
  const roomId = generateRoomId();

  rooms[roomId] = {
    roomId,
    users: [],
    videoUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    playing: false,
    currentTime: 0,
  };

  res.json({
    success: true,
    roomId,
    joinPath: `/room/${roomId}`,
  });
});

module.exports = router;
