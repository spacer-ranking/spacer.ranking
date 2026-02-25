const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище данных
let teams = [];
let matches = [];
let news = [];
let users = [];

let nextTeamId = 1;
let nextMatchId = 1;
let nextNewsId = 1;

function broadcastUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update' }));
        }
    });
}

// ---------- КОМАНДЫ ----------
app.get('/teams', (req, res) => res.json(teams));

app.post('/teams', (req, res) => {
    const { name, rating } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    
    const newTeam = {
        id: nextTeamId++,
        name,
        rating: parseInt(rating) || 0,
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

app.put('/teams/:id/players/:name', (req, res) => {
    const teamId = parseInt(req.params.id);
    const oldName = decodeURIComponent(req.params.name);
    const team = teams.find(t => t.id === teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    
    const playerIndex = team.players.findIndex(p => p.name === oldName);
    if (playerIndex === -1) return res.status(404).json({ error: 'Player not found' });
    
    const { name, role } = req.body;
    team.players[playerIndex] = { name, role };
    broadcastUpdate();
    res.json(team);
});

app.delete('/teams/:id/players/:name', (req, res) => {
    const teamId = parseInt(req.params.id);
    const playerName = decodeURIComponent(req.params.name);
    const team = teams.find(t => t.id === teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    
    team.players = team.players.filter(p => p.name !== playerName);
    broadcastUpdate();
    res.status(204).end();
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
    
    // Обновление рейтингов
    const winnerTeam = teams.find(t => t.name === winner);
    if (winnerTeam) winnerTeam.rating += 10;
    
    const loser = winner === team1 ? team2 : team1;
    const loserTeam = teams.find(t => t.name === loser);
    if (loserTeam && loserTeam.rating > 0) loserTeam.rating -= 5;
    
    broadcastUpdate();
    res.status(201).json(match);
});

app.delete('/matches/:id', (req, res) => {
    const id = parseInt(req.params.id);
    matches = matches.filter(m => m.id !== id);
    broadcastUpdate();
    res.status(204).end();
});

// ---------- НОВОСТИ ----------
app.get('/news', (req, res) => res.json(news));

app.post('/news', (req, res) => {
    const { title, text } = req.body;
    if (!title || !text) return res.status(400).json({ error: 'Missing fields' });
    
    const newsItem = {
        id: nextNewsId++,
        title,
        text,
        date: new Date().toLocaleDateString('ru-RU')
    };
    news.push(newsItem);
    broadcastUpdate();
    res.status(201).json(newsItem);
});

app.put('/news/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const newsItem = news.find(n => n.id === id);
    if (!newsItem) return res.status(404).json({ error: 'News not found' });
    
    const { title, text } = req.body;
    newsItem.title = title || newsItem.title;
    newsItem.text = text || newsItem.text;
    broadcastUpdate();
    res.json(newsItem);
});

app.delete('/news/:id', (req, res) => {
    const id = parseInt(req.params.id);
    news = news.filter(n => n.id !== id);
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

// ---------- ЗАПУСК ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Удаление команды
app.delete('/teams/:id', (req, res) => {
    const id = parseInt(req.params.id);
    teams = teams.filter(t => t.id !== id);
    broadcastUpdate();
    res.status(204).end();
});
// server.js (дополнить)
app.post('/register', (req, res) => {
    const { name, pass } = req.body;
    if (users.find(u => u.name === name)) {
        return res.status(400).json({ error: 'Имя уже занято' });
    }
    const role = name === 'Quantum' ? 'Лидер' : 'Игрок';
    const newUser = { name, pass, role };
    users.push(newUser);
    res.status(201).json({ name, role });
});

app.post('/login', (req, res) => {
    const { name, pass } = req.body;
    const user = users.find(u => u.name === name && u.pass === pass);
    if (!user) {
        return res.status(401).json({ error: 'Неверное имя или пароль' });
    }
    res.json({ name: user.name, role: user.role });
});

app.delete('/teams/:id', (req, res) => {
    const id = parseInt(req.params.id);
    teams = teams.filter(t => t.id !== id);
    broadcastUpdate();
    res.status(204).end();
});
// Проверка существования пользователя
app.post('/check-user', (req, res) => {
    const { name } = req.body;
    const user = users.find(u => u.name === name);
    res.json({ exists: !!user });
});
