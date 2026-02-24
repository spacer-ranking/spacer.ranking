const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000; // Render задаёт порт через переменную окружения

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Путь к файлу с данными
const DATA_FILE = path.join(__dirname, 'data.json');

// Функция чтения данных (если файла нет, создаём с начальными данными)
function readData() {
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        // Начальные данные (можно изменить)
        const defaultData = [
            {
                name: 'AVANGAR',
                rating: 18400,
                players: [
                    { name: 'Sh1ro', role: 'Снайпер' },
                    { name: 'Ax1Le', role: 'Рифлер' },
                    { name: 'Hobbit', role: 'Капитан' },
                    { name: 'Interz', role: 'Саппорт' },
                    { name: 'n0rb3r7', role: 'Рифлер' }
                ]
            },
            {
                name: 'NAVI',
                rating: 17250,
                players: [
                    { name: 's1mple', role: 'Снайпер' },
                    { name: 'b1t', role: 'Рифлер' },
                    { name: 'Aleksib', role: 'IGL' },
                    { name: 'iM', role: 'Рифлер' },
                    { name: 'jL', role: 'Опорник' }
                ]
            },
            {
                name: 'Virtus.pro',
                rating: 16320,
                players: [
                    { name: 'Jame', role: 'Снайпер' },
                    { name: 'FL1T', role: 'Рифлер' },
                    { name: 'fame', role: 'Рифлер' },
                    { name: 'n0rb3r7', role: 'Рифлер' },
                    { name: 'KaiR0N-', role: 'Саппорт' }
                ]
            },
            {
                name: 'Team Spirit',
                rating: 15980,
                players: [
                    { name: 'chopper', role: 'Капитан' },
                    { name: 'zont1x', role: 'Рифлер' },
                    { name: 'donk', role: 'Рифлер' },
                    { name: 'sh1ro', role: 'Снайпер' },
                    { name: 'magixx', role: 'Саппорт' }
                ]
            },
            {
                name: 'forZe',
                rating: 14750,
                players: [
                    { name: 'shalfey', role: 'Капитан' },
                    { name: 'Krad', role: 'Рифлер' },
                    { name: 'ganny', role: 'Снайпер' },
                    { name: 'tmv', role: 'Саппорт' },
                    { name: 'zorte', role: 'Рифлер' }
                ]
            }
        ];
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
}

// Функция записи данных
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Маршрут для получения данных
app.get('/data', (req, res) => {
    const data = readData();
    res.json(data);
});

// Маршрут для обновления данных (POST)
app.post('/data', (req, res) => {
    const newData = req.body;
    if (!Array.isArray(newData)) {
        return res.status(400).json({ error: 'Данные должны быть массивом' });
    }
    writeData(newData);
    broadcastData(newData); // отправляем всем клиентам
    res.json({ status: 'ok' });
});

// Запускаем HTTP-сервер
const server = app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});

// Создаём WebSocket-сервер
const wss = new WebSocket.Server({ server });

// Рассылка данных всем подключённым клиентам
function broadcastData(data) {
    const message = JSON.stringify({ type: 'update', data });
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Обработка подключений WebSocket
wss.on('connection', (ws) => {
    console.log('Новый клиент подключился');
    ws.on('close', () => console.log('Клиент отключился'));
});