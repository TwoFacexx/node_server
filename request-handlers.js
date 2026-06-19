/*
* Este ficheiro gere as rotas do servidor de descoberta Node.js.
* Responsável pelo catálogo global de salas (matchmaking) e persistência de perfil.
*/
const mysql = require('mysql2');
const rooms = {}; 

// Limpeza automática: remove salas inativas há mais de 30 minutos
setInterval(() => {
    const now = Date.now();
    for (const code in rooms) {
        if (now - rooms[code].createdAt > 1000 * 60 * 30) {
            console.log(`Auto-deleting stale room: ${code}`);
            delete rooms[code];
        }
    }
}, 1000 * 60 * 5);

// --- FUNÇÕES DE TESTE / ANALYTICS ---

function getData(req, res) {
    res.send(JSON.stringify({ _playerDataInfoArray: [] })); // Limpo para o exemplo
}

function postData(req, res) {
    console.log('Received data:', req.body);
    res.send('Data received successfully');
}

function getDataFromDatabase(req, res) {
    const connection = mysql.createConnection({
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: { rejectUnauthorized: false }
    });
    connection.connect();

    const sql = `
        SELECT  p.player_id              AS id,
                p.name                   AS name,
                COALESCE(SUM(r.rounds_won), 0) AS rounds_won
        FROM        player p
        LEFT JOIN   result r ON r.player_id = p.player_id
        GROUP BY    p.player_id, p.name
        ORDER BY    rounds_won DESC`;

    connection.query(sql, function (error, rows) {
        if (error) {
            console.error('Error fetching leaderboard:', error);
            res.status(500).send('Error');
        } else {
            res.send(JSON.stringify({ _playerDataInfoArray: rows }));
        }
    });
    connection.end();
}

// --- FUNÇÕES DE LÓGICA DE PERFIL (NOVAS!) ---

function savePlayerPreferences(req, res) {
    const { playerId, characterId, cosmeticId } = req.body;
    
    const connection = mysql.createConnection({
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: { rejectUnauthorized: false }
    });
    connection.connect();

    // Tenta inserir, se já existir o player_id, atualiza (UPSERT)
    // Nota: supõe que criaste a tabela preferences com player_id como UNIQUE ou PK
    const sql = `
        INSERT INTO preferences (player_id, character_id, cosmetic_id)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            character_id = VALUES(character_id),
            cosmetic_id = VALUES(cosmetic_id)`;

    connection.query(sql, [playerId, characterId, cosmeticId], function (error) {
        if (error) {
            console.error('Erro ao salvar preferências:', error);
            res.status(500).send(error);
        } else {
            console.log(`Preferências salvas para o player ${playerId}`);
            res.send('Saved');
        }
    });
    connection.end();
}

function getPlayerPreferences(req, res) {
    const playerId = req.params.playerId;
    
    const connection = mysql.createConnection({
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: { rejectUnauthorized: false }
    });
    connection.connect();

    connection.query('SELECT * FROM preferences WHERE player_id = ?', [playerId], function (error, rows) {
        if (error) {
            console.error('Erro ao buscar preferências:', error);
            res.status(500).send('Error');
        } else {
            // Retorna o primeiro resultado ou um objeto vazio
            res.send(JSON.stringify(rows[0] || {}));
        }
    });
    connection.end();
}

// --- LÓGICA DE MATCHMAKING (SALAS) ---

function generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function createRoom(req, res) {
    const { ip, port, name, isPublic, maxPlayers } = req.body;
    if (!ip || !port) return res.status(400).send('Missing ip or port');
    let code;
    do { code = generateCode(); } while (rooms[code]);
    rooms[code] = { ip, port, name: name || `Sala ${code}`, isPublic: isPublic === true || isPublic === "true", maxPlayers: parseInt(maxPlayers) || 4, currentPlayers: 1, createdAt: Date.now() };
    res.json({ code });
}

function getPublicRooms(req, res) {
    const publicList = Object.keys(rooms).map(code => ({ code, ...rooms[code] })).filter(room => room.isPublic === true && room.currentPlayers < room.maxPlayers);
    res.json(publicList);
}

function joinRoom(req, res) {
    const { code } = req.params;
    const room = rooms[code];
    if (!room) return res.status(404).send('Room not found');
    res.json(room);
}

function updateRoom(req, res) {
    const { code } = req.params;
    const { currentPlayers } = req.body;
    if (!rooms[code]) return res.status(404).send('Room not found');
    if (currentPlayers !== undefined) {
        rooms[code].currentPlayers = parseInt(currentPlayers);
        rooms[code].createdAt = Date.now();
    }
    res.json({ ok: true });
}

function deleteRoom(req, res) {
    const { code } = req.params;
    if (rooms[code]) delete rooms[code];
    res.json({ ok: true });
}

module.exports = {
    getData, postData, getDataFromDatabase,
    savePlayerPreferences, getPlayerPreferences,
    createRoom, joinRoom, deleteRoom, getPublicRooms, updateRoom
};