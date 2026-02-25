const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // папка с index.html

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Подключение к PostgreSQL (используйте Internal Database URL из Render)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Render автоматически добавит эту переменную
    ssl: { rejectUnauthorized: false }
});

// Инициализация таблиц (создаются, если не существуют)
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            pass TEXT NOT NULL,
            role TEXT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS teams (
            id SERIAL PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            rating FLOAT DEFAULT 0
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS players (
            id SERIAL PRIMARY KEY,
            team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            role TEXT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS matches (
            id SERIAL PRIMARY KEY,
            team1 TEXT NOT NULL,
            team2 TEXT NOT NULL,
            score TEXT NOT NULL,
            winner TEXT NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS news (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL,
            text TEXT NOT NULL,
            date TEXT NOT NULL
        )
    `);
}
initDB().catch(console.error);

// WebSocket рассылка
function broadcastUpdate() {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'update' }));
        }
    });
}

// ---------- КОМАНДЫ ----------
app.get('/teams', async (req, res) => {
    const teams = await pool.query(`
        SELECT t.*, COALESCE(json_agg(p.*) FILTER (WHERE p.id IS NOT NULL), '[]') AS players
        FROM teams t
        LEFT JOIN players p ON t.id = p.team_id
        GROUP BY t.id
    `);
    res.json(teams.rows);
});

app.post('/teams', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    try {
        const result = await pool.query(
            'INSERT INTO teams (name, rating) VALUES ($1, 0) RETURNING *',
            [name]
        );
        broadcastUpdate();
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique violation
            res.status(400).json({ error: 'Team already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.delete('/teams/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM teams WHERE id = $1', [id]);
    broadcastUpdate();
    res.status(204).end();
});

app.post('/teams/:id/players', async (req, res) => {
    const teamId = parseInt(req.params.id);
    const { name, role } = req.body;
    if (!name || !role) return res.status(400).json({ error: 'Name and role required' });
    await pool.query(
        'INSERT INTO players (team_id, name, role) VALUES ($1, $2, $3)',
        [teamId, name, role]
    );
    broadcastUpdate();
    res.status(201).json({ ok: true });
});

app.put('/teams/:id/players/:name', async (req, res) => {
    const teamId = parseInt(req.params.id);
    const oldName = decodeURIComponent(req.params.name);
    const { name, role } = req.body;
    await pool.query(
        'UPDATE players SET name = $1, role = $2 WHERE team_id = $3 AND name = $4',
        [name, role, teamId, oldName]
    );
    broadcastUpdate();
    res.json({ ok: true });
});

app.delete('/teams/:id/players/:name', async (req, res) => {
    const teamId = parseInt(req.params.id);
    const playerName = decodeURIComponent(req.params.name);
    await pool.query('DELETE FROM players WHERE team_id = $1 AND name = $2', [teamId, playerName]);
    broadcastUpdate();
    res.status(204).end();
});

// ---------- МАТЧИ ----------
app.get('/matches', async (req, res) => {
    const matches = await pool.query('SELECT * FROM matches ORDER BY id');
    res.json(matches.rows);
});

app.post('/matches', async (req, res) => {
    const { team1, team2, score, winner } = req.body;
    if (!team1 || !team2 || !score || !winner) {
        return res.status(400).json({ error: 'Missing fields' });
    }
    const result = await pool.query(
        'INSERT INTO matches (team1, team2, score, winner) VALUES ($1, $2, $3, $4) RETURNING *',
        [team1, team2, score, winner]
    );
    // Обновляем рейтинг победителя (+0.50)
    await pool.query('UPDATE teams SET rating = rating + 0.5 WHERE name = $1', [winner]);
    // У проигравшего можно отнимать (опционально)
    const loser = winner === team1 ? team2 : team1;
    await pool.query('UPDATE teams SET rating = GREATEST(rating - 0.2, 0) WHERE name = $1', [loser]);
    
    broadcastUpdate();
    res.status(201).json(result.rows[0]);
});

app.delete('/matches/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM matches WHERE id = $1', [id]);
    broadcastUpdate();
    res.status(204).end();
});

// ---------- НОВОСТИ ----------
app.get('/news', async (req, res) => {
    const news = await pool.query('SELECT * FROM news ORDER BY id DESC');
    res.json(news.rows);
});

app.post('/news', async (req, res) => {
    const { title, text } = req.body;
    if (!title || !text) return res.status(400).json({ error: 'Missing fields' });
    const date = new Date().toLocaleDateString('ru-RU');
    const result = await pool.query(
        'INSERT INTO news (title, text, date) VALUES ($1, $2, $3) RETURNING *',
        [title, text, date]
    );
    broadcastUpdate();
    res.status(201).json(result.rows[0]);
});

app.put('/news/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { title, text } = req.body;
    await pool.query(
        'UPDATE news SET title = $1, text = $2 WHERE id = $3',
        [title, text, id]
    );
    broadcastUpdate();
    res.json({ ok: true });
});

app.delete('/news/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM news WHERE id = $1', [id]);
    broadcastUpdate();
    res.status(204).end();
});

// ---------- ПОЛЬЗОВАТЕЛИ ----------
app.post('/register', async (req, res) => {
    const { name, pass } = req.body;
    try {
        const role = name === 'Quantum' ? 'Лидер' : 'Игрок';
        const result = await pool.query(
            'INSERT INTO users (name, pass, role) VALUES ($1, $2, $3) RETURNING name, role',
            [name, pass, role]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            res.status(400).json({ error: 'Name already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/login', async (req, res) => {
    const { name, pass } = req.body;
    const result = await pool.query(
        'SELECT name, role FROM users WHERE name = $1 AND pass = $2',
        [name, pass]
    );
    if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json(result.rows[0]);
});

app.post('/check-user', async (req, res) => {
    const { name } = req.body;
    const result = await pool.query('SELECT 1 FROM users WHERE name = $1', [name]);
    res.json({ exists: result.rows.length > 0 });
});

// ---------- ЗАПУСК ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
