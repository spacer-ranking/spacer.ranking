const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'cybersport-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Настройка multer для загрузки аватарок
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Инициализация базы данных
let db;
(async () => {
    db = await open({
        filename: 'cybersport.db',
        driver: sqlite3.Database
    });

    // Создание таблиц
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            avatar TEXT DEFAULT 'default-team.png',
            rating INTEGER DEFAULT 1000,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            user_id INTEGER,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(team_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1_id INTEGER,
            team2_id INTEGER,
            team1_score INTEGER,
            team2_score INTEGER,
            winner_id INTEGER,
            created_by INTEGER,
            match_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team1_id) REFERENCES teams(id),
            FOREIGN KEY (team2_id) REFERENCES teams(id),
            FOREIGN KEY (winner_id) REFERENCES teams(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            code TEXT,
            expires_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    // Создание тестового лидера Quantum
    const quantumUser = await db.get('SELECT * FROM users WHERE username = ?', 'Quantum');
    if (!quantumUser) {
        const hashedPassword = await bcrypt.hash('quantum123', 10);
        await db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            ['Quantum', hashedPassword, 'leader']
        );
    }

    console.log('Database initialized');
})();

// Middleware для проверки авторизации
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const requireLeader = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const user = await db.get('SELECT role FROM users WHERE id = ?', req.session.userId);
    if (user.role !== 'leader') {
        return res.status(403).json({ error: 'Forbidden - Leader only' });
    }
    next();
};

// Генерация случайного кода подтверждения
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// API Routes
app.post('/api/register', async (req, res) => {
    const { username, password, code } = req.body;
    
    try {
        // Проверка существования имени
        const existingUser = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Проверка кода подтверждения
        const validCode = await db.get(
            'SELECT * FROM sessions WHERE code = ? AND expires_at > datetime("now")',
            code
        );
        
        if (!validCode) {
            return res.status(400).json({ error: 'Invalid or expired code' });
        }

        // Удаление использованного кода
        await db.run('DELETE FROM sessions WHERE code = ?', code);

        // Хеширование пароля и создание пользователя
        const hashedPassword = await bcrypt.hash(password, 10);
        const role = username === 'Quantum' ? 'leader' : 'user';
        
        const result = await db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role]
        );

        req.session.userId = result.lastID;
        req.session.username = username;
        req.session.role = role;

        res.json({ success: true, user: { id: result.lastID, username, role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const user = await db.get('SELECT * FROM users WHERE username = ?', username);
        if (!user) {
            return res.status(400).json({ error: 'User not found' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Invalid password' });
        }

        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;

        res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/verification-code', async (req, res) => {
    const code = generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Код действует 10 минут

    await db.run(
        'INSERT INTO sessions (code, expires_at) VALUES (?, ?)',
        [code, expiresAt.toISOString()]
    );

    res.json({ code });
});

// Teams API
app.get('/api/teams', async (req, res) => {
    try {
        const teams = await db.all(`
            SELECT t.*, 
                   COUNT(tm.user_id) as members_count,
                   u.username as created_by_name
            FROM teams t
            LEFT JOIN team_members tm ON t.id = tm.team_id
            LEFT JOIN users u ON t.created_by = u.id
            GROUP BY t.id
            ORDER BY t.rating DESC
        `);
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/teams', requireLeader, async (req, res) => {
    const { name } = req.body;
    
    try {
        // Проверка уникальности имени команды
        const existingTeam = await db.get('SELECT * FROM teams WHERE name = ?', name);
        if (existingTeam) {
            return res.status(400).json({ error: 'Team name already exists' });
        }

        const result = await db.run(
            'INSERT INTO teams (name, created_by) VALUES (?, ?)',
            [name, req.session.userId]
        );

        // Добавляем создателя как участника команды
        await db.run(
            'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)',
            [result.lastID, req.session.userId]
        );

        res.json({ success: true, teamId: result.lastID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/teams/:teamId/members', requireLeader, async (req, res) => {
    const { teamId } = req.params;
    const { username } = req.body;
    
    try {
        // Проверка существования пользователя
        const user = await db.get('SELECT id FROM users WHERE username = ?', username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Проверка, не состоит ли уже в команде
        const existing = await db.get(
            'SELECT * FROM team_members WHERE team_id = ? AND user_id = ?',
            [teamId, user.id]
        );
        if (existing) {
            return res.status(400).json({ error: 'User already in team' });
        }

        await db.run(
            'INSERT INTO team_members (team_id, user_id) VALUES (?, ?)',
            [teamId, user.id]
        );

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/teams/:teamId/avatar', requireLeader, upload.single('avatar'), async (req, res) => {
    const { teamId } = req.params;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        await db.run(
            'UPDATE teams SET avatar = ? WHERE id = ?',
            [req.file.filename, teamId]
        );
        res.json({ success: true, filename: req.file.filename });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Matches API
app.get('/api/matches', async (req, res) => {
    try {
        const matches = await db.all(`
            SELECT m.*,
                   t1.name as team1_name,
                   t2.name as team2_name,
                   t1.avatar as team1_avatar,
                   t2.avatar as team2_avatar,
                   w.name as winner_name,
                   u.username as created_by_name
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN teams w ON m.winner_id = w.id
            LEFT JOIN users u ON m.created_by = u.id
            ORDER BY m.match_date DESC
        `);
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/teams/:teamId/matches', async (req, res) => {
    const { teamId } = req.params;
    
    try {
        const matches = await db.all(`
            SELECT m.*,
                   t1.name as team1_name,
                   t2.name as team2_name,
                   t1.avatar as team1_avatar,
                   t2.avatar as team2_avatar,
                   w.name as winner_name
            FROM matches m
            JOIN teams t1 ON m.team1_id = t1.id
            JOIN teams t2 ON m.team2_id = t2.id
            LEFT JOIN teams w ON m.winner_id = w.id
            WHERE m.team1_id = ? OR m.team2_id = ?
            ORDER BY m.match_date DESC
        `, [teamId, teamId]);
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/matches', requireLeader, async (req, res) => {
    const { team1_id, team2_id, team1_score, team2_score } = req.body;
    
    try {
        // Определение победителя
        let winner_id = null;
        if (team1_score > team2_score) winner_id = team1_id;
        else if (team2_score > team1_score) winner_id = team2_id;

        // Сохранение матча
        const result = await db.run(
            `INSERT INTO matches (team1_id, team2_id, team1_score, team2_score, winner_id, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [team1_id, team2_id, team1_score, team2_score, winner_id, req.session.userId]
        );

        // Обновление рейтингов
        if (winner_id) {
            // Победитель получает +25 очков, проигравший -25
            await db.run('UPDATE teams SET rating = rating + 25 WHERE id = ?', winner_id);
            const loser_id = winner_id === team1_id ? team2_id : team1_id;
            await db.run('UPDATE teams SET rating = rating - 25 WHERE id = ?', loser_id);
        }

        res.json({ success: true, matchId: result.lastID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User API
app.get('/api/user', requireAuth, (req, res) => {
    res.json({
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role
    });
});

app.get('/api/team-members/:teamId', async (req, res) => {
    const { teamId } = req.params;
    
    try {
        const members = await db.all(`
            SELECT u.id, u.username, u.role
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId]);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user-teams/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const teams = await db.all(`
            SELECT t.*
            FROM team_members tm
            JOIN teams t ON tm.team_id = t.id
            WHERE tm.user_id = ?
        `, [userId]);
        res.json(teams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});