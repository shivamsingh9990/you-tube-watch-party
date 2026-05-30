const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");

const roomSocket = require("./sockets/roomSocket");

const server = http.createServer(app);

const corsOrigin = process.env.CLIENT_URL || "*";

const io = new Server(server, {
  cors: {
    origin: corsOrigin,
  },
});

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  roomSocket(io, socket);

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
