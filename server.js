const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище данных
let teams = [];                // теперь пустой
let matches = [];
let users = [];
let nextTeamId = 1;
let nextMatchId = 1;

// WebSocket рассылка
function broadcastUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update' }));
        }
    });
}

// ---------- КОМАНДЫ ----------
app.get('/data', (req, res) => res.json(teams));

app.post('/teams', (req, res) => {
    const { name, rating = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    // Проверка уникальности имени
    if (teams.find(t => t.name === name)) {
        return res.status(400).json({ error: 'Team already exists' });
    }
    const newTeam = {
        id: nextTeamId++,
        name,
        rating: parseInt(rating),
        players: []
    };
    teams.push(newTeam);
    broadcastUpdate();
    res.status(201).json(newTeam);
});

app.post('/teams/:id/players', (req, res) => {
    const teamId = parseInt(req.params.id);
    const team = teams.find(t => t.id === teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    const { name, role } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Name and role required' });
    team.players.push({ name, role });
    broadcastUpdate();
    res.status(201).json(team);
});

// ---------- МАТЧИ ----------
app.get('/matches', (req, res) => res.json(matches));

app.post('/matches', (req, res) => {
    const { team1, team2, score, winner } = req.body;
    if (!team1 || !team2 || !score || !winner) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    const match = {
        id: nextMatchId++,
        team1,
        team2,
        score,
        winner
    };
    matches.push(match);

    // Обновление рейтингов команд
    const winnerTeam = teams.find(t => t.name === winner);
    if (winnerTeam) {
        winnerTeam.rating += 5; // победитель +5
    }
    const loser = winner === team1 ? team2 : team1;
    const loserTeam = teams.find(t => t.name === loser);
    if (loserTeam) {
        loserTeam.rating -= 2; // проигравший -2 (чтобы рейтинг не уходил в минус, можно сделать 0)
        if (loserTeam.rating < 0) loserTeam.rating = 0;
    }

    broadcastUpdate();
    res.status(201).json(match);
});

app.delete('/matches/:id', (req, res) => {
    const id = parseInt(req.params.id);
    matches = matches.filter(m => m.id !== id);
    // При удалении матча рейтинги не откатываем (для простоты)
    broadcastUpdate();
    res.status(204).end();
});

// ---------- ПОЛЬЗОВАТЕЛИ ----------
app.post('/register', (req, res) => {
    const { name, pass } = req.body;
    if (users.find(u => u.name === name)) {
        return res.status(400).json({ error: 'Name exists' });
    }
    const role = name === 'Quantum' ? 'Лидер' : 'Игрок';
    const newUser = { name, pass, role };
    users.push(newUser);
    res.status(201).json({ name, role });
});

app.post('/login', (req, res) => {
    const { name, pass } = req.body;
    const user = users.find(u => u.name === name && u.pass === pass);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ name: user.name, role: user.role });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
