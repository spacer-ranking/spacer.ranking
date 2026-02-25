const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище данных (в памяти) — при перезапуске всё сбросится.
// Для постоянства используйте базу данных (MongoDB, PostgreSQL).
let teams = [
  { id: 1, name: 'Spacer Gaming', rating: 0.20, players: [
    { name: 'No', role: 'No' },
    { name: 'No', role: 'No' },
    { name: 'No', role: 'No' },
    { name: 'No-, role: 'No' },
    { name: 'No', role: 'No' },
  ]}
];

let matches = [];
let users = []; // { name, pass, role }

// ID для новых матчей
let nextMatchId = 1;

// WebSocket: рассылка обновлений всем клиентам
function broadcastUpdate() {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'update' }));
    }
  });
}

// API endpoints
app.get('/data', (req, res) => res.json(teams));

app.get('/matches', (req, res) => res.json(matches));

app.post('/matches', (req, res) => {
  const match = { id: nextMatchId++, ...req.body };
  matches.push(match);
  broadcastUpdate();
  res.status(201).json(match);
});

app.delete('/matches/:id', (req, res) => {
  const id = parseInt(req.params.id);
  matches = matches.filter(m => m.id !== id);
  broadcastUpdate();
  res.status(204).end();
});

// Регистрация
app.post('/register', (req, res) => {
  const { name, pass } = req.body;
  if (users.find(u => u.name === name)) {
    return res.status(400).json({ error: 'Name exists' });
  }
  const role = name === 'Quantum' ? 'Лидер' : 'Игрок';
  const newUser = { name, pass, role };
  users.push(newUser);
  res.status(201).json({ name, role }); // не возвращаем пароль
});

// Вход
app.post('/login', (req, res) => {
  const { name, pass } = req.body;
  const user = users.find(u => u.name === name && u.pass === pass);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ name: user.name, role: user.role });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
