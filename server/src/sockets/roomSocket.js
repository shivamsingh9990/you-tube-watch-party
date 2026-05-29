const rooms = require("../data/rooms");

function roomSocket(io, socket) {
  function getUser(room, socketId) {
    return room.users.find((user) => user.socketId === socketId);
  }

  function roomHasHost(room) {
    return room.users.some((user) => user.role === "host");
  }

  function promoteNewHost(room) {
    if (room.users.length === 0) return null;
    setSingleHost(room, room.users[0].socketId);
    return room.users[0];
  }

  function broadcastRoles(roomId, room) {
    io.to(roomId).emit("roles_updated", { users: room.users });
  }

  function setSingleHost(room, hostSocketId) {
    room.users.forEach((user) => {
      user.role = user.socketId === hostSocketId ? "host" : "participant";
    });
  }

  const DISCONNECT_GRACE_MS = 20000;

  function removeUserFromRoom(roomId, socketId, { notifyKicked = false } = {}) {
    const room = rooms[roomId];
    if (!room) return false;

    const index = room.users.findIndex((user) => user.socketId === socketId);
    if (index === -1) return false;

    const leavingUser = room.users[index];
    if (leavingUser.leaveTimer) {
      clearTimeout(leavingUser.leaveTimer);
      delete leavingUser.leaveTimer;
    }

    room.users.splice(index, 1);

    if (notifyKicked) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (targetSocket) {
        targetSocket.emit("removed_from_room", {
          message: "You were removed from the room by the host.",
        });
        targetSocket.leave(roomId);
        targetSocket.roomId = null;
      }
    }

    if (leavingUser.role === "host" && room.users.length > 0) {
      promoteNewHost(room);
      io.to(roomId).emit("roles_updated", { users: room.users });
    }

    io.to(roomId).emit("user_joined", { users: room.users });
    return true;
  }

  function scheduleUserRemoval(roomId, socketId) {
    const room = rooms[roomId];
    if (!room) return;

    const user = getUser(room, socketId);
    if (!user) return;

    if (user.leaveTimer) {
      clearTimeout(user.leaveTimer);
    }

    user.leaveTimer = setTimeout(() => {
      removeUserFromRoom(roomId, socketId);
    }, DISCONNECT_GRACE_MS);
  }

  socket.on("join_room", ({ roomId, username }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit("error_message", "Room not found");
      return;
    }

    const trimmedName = String(username || "").trim();
    if (!trimmedName) {
      socket.emit("error_message", "Username is required.");
      return;
    }

    socket.join(roomId);
    socket.roomId = roomId;
    socket.username = trimmedName;

    const existing = room.users.find((user) => user.username === trimmedName);

    if (existing) {
      if (existing.leaveTimer) {
        clearTimeout(existing.leaveTimer);
        delete existing.leaveTimer;
      }

      existing.socketId = socket.id;

      io.to(roomId).emit("user_joined", { users: room.users });

      socket.emit("sync_video_state", {
        videoUrl: room.videoUrl,
        playing: room.playing,
        role: existing.role,
        currentTime: room.currentTime || 0,
      });
      return;
    }

    let role = "participant";
    if (!roomHasHost(room)) {
      role = "host";
    }

    room.users.push({
      socketId: socket.id,
      username: trimmedName,
      role,
    });

    io.to(roomId).emit("user_joined", {
      users: room.users,
    });

    socket.emit("sync_video_state", {
      videoUrl: room.videoUrl,
      playing: room.playing,
      role,
      currentTime: room.currentTime || 0,
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (!roomId) return;
    scheduleUserRemoval(roomId, socket.id);
    socket.roomId = null;
  });

  // HOST REMOVES PARTICIPANT
  socket.on("remove_participant", ({ roomId, targetSocketId }) => {
    const room = rooms[roomId];
    if (!room) return;

    const actor = getUser(room, socket.id);
    if (!actor || actor.role !== "host") {
      socket.emit("error_message", "Only the host can remove participants.");
      return;
    }

    if (targetSocketId === socket.id) {
      socket.emit("error_message", "You cannot remove yourself from the room.");
      return;
    }

    const target = room.users.find((user) => user.socketId === targetSocketId);
    if (!target) {
      socket.emit("error_message", "That participant is no longer in the room.");
      return;
    }

    removeUserFromRoom(roomId, targetSocketId, { notifyKicked: true });
  });

  // HOST ASSIGNS ROLE (transfer host or demote to participant)
  socket.on("assign_role", ({ roomId, targetSocketId, role }) => {
    const room = rooms[roomId];
    if (!room) return;

    const actor = getUser(room, socket.id);
    if (!actor || actor.role !== "host") {
      socket.emit("error_message", "Only the host can assign roles.");
      return;
    }

    const target = room.users.find((user) => user.socketId === targetSocketId);
    if (!target) {
      socket.emit("error_message", "That participant is no longer in the room.");
      return;
    }

    if (role === "host") {
      setSingleHost(room, target.socketId);
      broadcastRoles(roomId, room);
      return;
    }

    if (role === "participant") {
      if (target.role !== "host") {
        target.role = "participant";
        broadcastRoles(roomId, room);
        return;
      }

      if (target.socketId === socket.id) {
        socket.emit(
          "error_message",
          "Make someone else the host before stepping down.",
        );
        return;
      }

      target.role = "participant";
      if (!roomHasHost(room)) {
        actor.role = "host";
      }
      broadcastRoles(roomId, room);
    }
  });

  // PLAY EVENT
  socket.on("play_video", ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") {
      socket.emit("error_message", "Only the host can control playback.");
      return;
    }

    room.playing = true;
    if (typeof currentTime === "number") {
      room.currentTime = currentTime;
    }

    io.to(roomId).emit("play_video", { currentTime: room.currentTime });
  });

  // PAUSE EVENT
  socket.on("pause_video", ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") {
      socket.emit("error_message", "Only the host can control playback.");
      return;
    }

    room.playing = false;
    if (typeof currentTime === "number") {
      room.currentTime = currentTime;
    }

    io.to(roomId).emit("pause_video", { currentTime: room.currentTime });
  });

  // CHANGE VIDEO EVENT
  socket.on("change_video", ({ roomId, videoUrl }) => {
    console.log("CHANGE VIDEO EVENT RECEIVED");

    const room = rooms[roomId];
    if (!room) {
      console.log("ROOM NOT FOUND");
      return;
    }

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") {
      socket.emit("error_message", "Only the host can change the video.");
      return;
    }

    room.videoUrl = videoUrl;
    room.currentTime = 0;

    console.log("EMITTING VIDEO CHANGE");

    io.to(roomId).emit("video_changed", {
      videoUrl,
      playing: room.playing,
      currentTime: room.currentTime || 0,
    });
  });

  // SEEK EVENT
  socket.on("seek_video", ({ roomId, time }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") {
      socket.emit("error_message", "Only the host can seek the video.");
      return;
    }

    room.currentTime = time;
    socket.to(roomId).emit("seek_video", { time });
  });

  // PING / PONG for latency measurement
  socket.on("ping_request", ({ ts }) => {
    socket.emit("ping_response", { ts });
  });

  // SYNC TIME (periodic host broadcast)
  socket.on("sync_time", ({ roomId, currentTime }) => {
    const room = rooms[roomId];
    if (!room) return;

    const user = getUser(room, socket.id);
    if (!user || user.role !== "host") return;

    room.currentTime = currentTime;
    // broadcast current time so participants can correct drift
    socket.to(roomId).emit("sync_time", { currentTime });
  });
}

module.exports = roomSocket;
