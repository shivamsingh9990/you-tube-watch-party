import { io } from "socket.io-client";

import { API_URL } from "../config/api";

const socket = io(API_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

export default socket;
