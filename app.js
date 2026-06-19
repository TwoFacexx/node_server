require('dotenv').config();
const express = require('express');
const config = require('./config/config.json');
const app = express();
const requesthandlers = require('./request-handlers.js');

app.use(express.json());

// Rotas Base / Analytics
app.get('/get-data', requesthandlers.getData);
app.get('/get-data-db', requesthandlers.getDataFromDatabase);
app.post('/post-data', requesthandlers.postData);

// Rotas de Perfil (NOVAS!)
app.post('/player-preferences', requesthandlers.savePlayerPreferences);
app.get('/player-preferences/:playerId', requesthandlers.getPlayerPreferences);

// Rotas de Matchmaking
app.post('/create-room', requesthandlers.createRoom);
app.get('/join-room/:code', requesthandlers.joinRoom);
app.get('/public-rooms', requesthandlers.getPublicRooms);
app.post('/update-room/:code', requesthandlers.updateRoom);
app.delete('/delete-room/:code', requesthandlers.deleteRoom);

const PORT = process.env.PORT || config.server.port;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});