"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const handlers_1 = require("./socket/handlers");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 8080;
// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../../client/dist')));
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../../client/dist/index.html'));
    });
}
(0, handlers_1.setupSocketHandlers)(io);
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
