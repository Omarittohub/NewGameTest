import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { setupSocketHandlers } from './socket/handlers';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 8080;

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../../client/dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    });
}

setupSocketHandlers(io);

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
