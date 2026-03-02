require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const { sequelize } = require('./models');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка подключения к БД для сессий
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Сессии
app.use(session({
  store: new pgSession({
    pool: pgPool,
    tableName: 'session' // создаст таблицу session автоматически
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 дней
}));

// Подключение маршрутов
const authRoutes = require('./routes/auth');
const teamsRoutes = require('./routes/teams');
const matchesRoutes = require('./routes/matches');

app.use('/', authRoutes);
app.use('/teams', teamsRoutes);
app.use('/matches', matchesRoutes);

// Главная страница - рейтинг команд
app.get('/', async (req, res) => {
  const { Team } = require('./models');
  try {
    const teams = await Team.findAll({ order: [['rating', 'DESC']] });
    res.render('index', { user: req.session.user, teams });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Запуск сервера и синхронизация БД
sequelize.sync({ alter: true }).then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => console.error('DB sync error:', err));