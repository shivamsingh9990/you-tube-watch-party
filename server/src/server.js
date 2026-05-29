const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");

const roomSocket = require("./sockets/roomSocket");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  roomSocket(io, socket);

  socket.on("disconnect", () => {
    console.log("User Disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
