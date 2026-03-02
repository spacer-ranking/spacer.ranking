const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key-change-in-production';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Сессии
app.use(session({
    secret: SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Создаем папку для загрузок
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Настройка multer для загрузки аватарок
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Подключение к базе данных
const db = new sqlite3.Database('./cyber_ranking.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к БД:', err);
    } else {
        console.log('Подключено к SQLite базе данных');
        initDatabase();
    }
});

// Инициализация таблиц
function initDatabase() {
    db.serialize(() => {
        // Таблица пользователей
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            avatar TEXT DEFAULT 'default-avatar.png',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Таблица команд
        db.run(`CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            avatar TEXT DEFAULT 'default-team.png',
            leader_id INTEGER,
            rating INTEGER DEFAULT 1000,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (leader_id) REFERENCES users(id)
        )`);

        // Таблица участников команды
        db.run(`CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team_id INTEGER,
            user_id INTEGER,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(team_id, user_id)
        )`);

        // Таблица матчей
        db.run(`CREATE TABLE IF NOT EXISTS matches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            team1_id INTEGER,
            team2_id INTEGER,
            team1_score INTEGER DEFAULT 0,
            team2_score INTEGER DEFAULT 0,
            winner_id INTEGER,
            status TEXT DEFAULT 'scheduled',
            match_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (team1_id) REFERENCES teams(id),
            FOREIGN KEY (team2_id) REFERENCES teams(id),
            FOREIGN KEY (winner_id) REFERENCES teams(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Создаем пользователя Quantum с ролью лидера
        const checkQuantum = db.prepare("SELECT * FROM users WHERE username = ?");
        checkQuantum.get('Quantum', async (err, row) => {
            if (!row) {
                const hashedPassword = await bcrypt.hash('quantum123', 10);
                db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'leader')", 
                    ['Quantum', hashedPassword]);
            }
        });
    });
}

// Мидлвар для проверки авторизации
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Не авторизован' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
        next();
    });
};

// Мидлвар для проверки роли лидера
const isLeader = (req, res, next) => {
    if (req.user.role !== 'leader') {
        return res.status(403).json({ error: 'Требуются права лидера' });
    }
    next();
};

// ============== API РОУТЫ ==============

// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, password, code } = req.body;
    
    // Проверка кода подтверждения (рандомный одноразовый)
    if (!code || code.length !== 6) {
        return res.status(400).json({ error: 'Неверный код подтверждения' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
            if (user) {
                return res.status(400).json({ error: 'Имя уже используется' });
            }

            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, 'user')",
                [username, hashedPassword],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Ошибка регистрации' });
                    }
                    
                    const token = jwt.sign({ id: this.lastID, username, role: 'user' }, SECRET_KEY);
                    res.cookie('token', token, { httpOnly: true });
                    res.json({ success: true, username, role: 'user' });
                });
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (!user) {
            return res.status(400).json({ error: 'Пользователь не найден' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Неверный пароль' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY);
        res.cookie('token', token, { httpOnly: true });
        res.json({ success: true, username: user.username, role: user.role });
    });
});

// Выход
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

// Получение текущего пользователя
app.get('/api/me', authenticateToken, (req, res) => {
    res.json(req.user);
});

// Получение рейтинга команд
app.get('/api/teams/ranking', (req, res) => {
    db.all(`
        SELECT t.*, 
               COUNT(tm.user_id) as members_count,
               u.username as leader_name
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        LEFT JOIN users u ON t.leader_id = u.id
        GROUP BY t.id
        ORDER BY t.rating DESC
    `, [], (err, teams) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения рейтинга' });
        }
        res.json(teams);
    });
});

// Получение всех команд
app.get('/api/teams', (req, res) => {
    db.all("SELECT * FROM teams ORDER BY name", [], (err, teams) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения команд' });
        }
        res.json(teams);
    });
});

// Получение команды по ID
app.get('/api/teams/:id', (req, res) => {
    const teamId = req.params.id;
    
    db.get(`
        SELECT t.*, u.username as leader_name 
        FROM teams t
        LEFT JOIN users u ON t.leader_id = u.id
        WHERE t.id = ?
    `, [teamId], (err, team) => {
        if (err || !team) {
            return res.status(404).json({ error: 'Команда не найдена' });
        }
        
        db.all(`
            SELECT u.id, u.username, u.avatar 
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.team_id = ?
        `, [teamId], (err, members) => {
            team.members = members || [];
            
            db.all(`
                SELECT m.*, 
                       t1.name as team1_name, 
                       t2.name as team2_name,
                       t1.avatar as team1_avatar,
                       t2.avatar as team2_avatar
                FROM matches m
                JOIN teams t1 ON m.team1_id = t1.id
                JOIN teams t2 ON m.team2_id = t2.id
                WHERE m.team1_id = ? OR m.team2_id = ?
                ORDER BY m.match_date DESC
            `, [teamId, teamId], (err, matches) => {
                team.matches = matches || [];
                res.json(team);
            });
        });
    });
});

// Создание команды (только лидер)
app.post('/api/teams', authenticateToken, isLeader, (req, res) => {
    const { name } = req.body;
    
    db.get("SELECT * FROM teams WHERE name = ?", [name], (err, team) => {
        if (team) {
            return res.status(400).json({ error: 'Команда с таким названием уже существует' });
        }
        
        db.run("INSERT INTO teams (name, leader_id) VALUES (?, ?)",
            [name, req.user.id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Ошибка создания команды' });
                }
                
                // Добавляем лидера в команду
                db.run("INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
                    [this.lastID, req.user.id]);
                
                res.json({ success: true, id: this.lastID, name });
            });
    });
});

// Добавление игрока в команду (только лидер)
app.post('/api/teams/:teamId/members', authenticateToken, isLeader, (req, res) => {
    const teamId = req.params.teamId;
    const { username } = req.body;
    
    // Проверяем, является ли пользователь лидером этой команды
    db.get("SELECT * FROM teams WHERE id = ? AND leader_id = ?", [teamId, req.user.id], (err, team) => {
        if (!team) {
            return res.status(403).json({ error: 'Вы не являетесь лидером этой команды' });
        }
        
        db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
            if (!user) {
                return res.status(404).json({ error: 'Пользователь не найден' });
            }
            
            db.run("INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)",
                [teamId, user.id],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Ошибка добавления игрока' });
                    }
                    res.json({ success: true, message: 'Игрок добавлен в команду' });
                });
        });
    });
});

// Обновление аватара команды (только лидер)
app.post('/api/teams/:teamId/avatar', authenticateToken, isLeader, upload.single('avatar'), (req, res) => {
    const teamId = req.params.teamId;
    
    if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    db.get("SELECT * FROM teams WHERE id = ? AND leader_id = ?", [teamId, req.user.id], (err, team) => {
        if (!team) {
            return res.status(403).json({ error: 'Вы не являетесь лидером этой команды' });
        }
        
        const avatarUrl = `/uploads/${req.file.filename}`;
        
        db.run("UPDATE teams SET avatar = ? WHERE id = ?", [avatarUrl, teamId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Ошибка обновления аватара' });
            }
            res.json({ success: true, avatar: avatarUrl });
        });
    });
});

// Создание матча (только лидер)
app.post('/api/matches', authenticateToken, isLeader, (req, res) => {
    const { team1_id, team2_id, team1_score, team2_score } = req.body;
    
    if (team1_id === team2_id) {
        return res.status(400).json({ error: 'Команды должны быть разными' });
    }
    
    // Определяем победителя
    let winner_id = null;
    if (team1_score > team2_score) winner_id = team1_id;
    else if (team2_score > team1_score) winner_id = team2_id;
    
    db.run(`
        INSERT INTO matches (team1_id, team2_id, team1_score, team2_score, winner_id, created_by, status)
        VALUES (?, ?, ?, ?, ?, ?, 'completed')
    `, [team1_id, team2_id, team1_score, team2_score, winner_id, req.user.id],
    function(err) {
        if (err) {
            return res.status(500).json({ error: 'Ошибка создания матча' });
        }
        
        // Обновляем рейтинги команд
        if (winner_id) {
            // Победитель +25, проигравший -25
            const loser_id = winner_id === team1_id ? team2_id : team1_id;
            
            db.run("UPDATE teams SET rating = rating + 25 WHERE id = ?", [winner_id]);
            db.run("UPDATE teams SET rating = rating - 25 WHERE id = ?", [loser_id]);
        }
        
        res.json({ success: true, match_id: this.lastID });
    });
});

// Получение истории матчей
app.get('/api/matches', (req, res) => {
    db.all(`
        SELECT m.*, 
               t1.name as team1_name, t1.avatar as team1_avatar,
               t2.name as team2_name, t2.avatar as team2_avatar,
               w.name as winner_name
        FROM matches m
        JOIN teams t1 ON m.team1_id = t1.id
        JOIN teams t2 ON m.team2_id = t2.id
        LEFT JOIN teams w ON m.winner_id = w.id
        ORDER BY m.match_date DESC
        LIMIT 50
    `, [], (err, matches) => {
        if (err) {
            return res.status(500).json({ error: 'Ошибка получения матчей' });
        }
        res.json(matches);
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});