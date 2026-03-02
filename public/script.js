const API_BASE = ''; // пусто, так как на одном домене

// Состояние приложения
let currentUser = null;

// Элементы DOM
const homeBtn = document.getElementById('homeBtn');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userGreeting = document.getElementById('userGreeting');
const leaderPanel = document.getElementById('leaderPanel');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close');

// Функции для работы с модальным окном
function openModal(html) {
    modalBody.innerHTML = html;
    modal.style.display = 'block';
}

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
};

// Загрузка данных при старте
async function fetchUser() {
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
            currentUser = await res.json();
            updateUI();
        } else {
            currentUser = null;
            updateUI();
        }
    } catch {
        currentUser = null;
        updateUI();
    }
}

function updateUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        userGreeting.style.display = 'inline';
        userGreeting.textContent = `Привет, ${currentUser.username}`;
        if (currentUser.role === 'leader') {
            leaderPanel.style.display = 'block';
            loadLeaderTeams();
        } else {
            leaderPanel.style.display = 'none';
        }
    } else {
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        userGreeting.style.display = 'none';
        leaderPanel.style.display = 'none';
    }
}

// Загрузка рейтинга команд
async function loadTeams() {
    const res = await fetch('/api/teams');
    const teams = await res.json();
    const container = document.getElementById('teamsList');
    container.innerHTML = teams.map(team => `
        <div class="team-card">
            <img src="${team.avatar_url || 'https://via.placeholder.com/80?text=Team'}" alt="${team.name}">
            <h3>${team.name}</h3>
            <div class="rating">${team.rating}</div>
            <div class="leader">Лидер: ${team.leader_name || 'неизвестен'}</div>
            <div class="team-actions">
                <button onclick="viewTeam(${team.id})">Состав</button>
                <button onclick="viewTeamMatches(${team.id})">Матчи</button>
            </div>
        </div>
    `).join('');
}

// Загрузка последних матчей
async function loadMatches() {
    const res = await fetch('/api/matches');
    const matches = await res.json();
    const container = document.getElementById('matchesList');
    container.innerHTML = matches.map(m => `
        <div class="match-item">
            <div class="match-teams">${m.team1_name} vs ${m.team2_name}</div>
            <div class="match-score ${m.winner_id ? (m.winner_id === m.team1_id ? 'winner' : 'loser') : ''}">${m.score1} : ${m.score2}</div>
            <div>${new Date(m.match_date).toLocaleString()}</div>
        </div>
    `).join('');
}

// Показать состав команды
window.viewTeam = async (teamId) => {
    const res = await fetch(`/api/teams/${teamId}/members`);
    const members = await res.json();
    const html = `
        <h3>Состав команды</h3>
        <ul>${members.map(m => `<li>${m.username} (${m.role})</li>`).join('')}</ul>
        <button onclick="closeModal()">Закрыть</button>
    `;
    openModal(html);
};

// Показать матчи команды
window.viewTeamMatches = async (teamId) => {
    const res = await fetch(`/api/teams/${teamId}/matches`);
    const matches = await res.json();
    const html = `
        <h3>Матчи команды</h3>
        ${matches.map(m => `
            <div>${m.team1_name} ${m.score1}:${m.score2} ${m.team2_name} (${new Date(m.match_date).toLocaleDateString()})</div>
        `).join('')}
        <button onclick="closeModal()">Закрыть</button>
    `;
    openModal(html);
};

// Форма регистрации
registerBtn.onclick = () => {
    let generatedCode = '';
    openModal(`
        <h2>Регистрация</h2>
        <form id="registerForm">
            <input type="text" id="regUsername" placeholder="Имя пользователя" required>
            <input type="password" id="regPassword" placeholder="Пароль" required>
            <div id="codeSection" style="display:none;">
                <p>Код подтверждения: <strong id="displayCode"></strong></p>
                <input type="text" id="regCode" placeholder="Введите код" required>
            </div>
            <button type="button" id="getCodeBtn">Получить код</button>
            <button type="submit" id="registerSubmitBtn" style="display:none;">Зарегистрироваться</button>
            <div id="regError" class="error"></div>
        </form>
    `);

    document.getElementById('getCodeBtn').onclick = async () => {
        const username = document.getElementById('regUsername').value;
        if (!username) return showError('regError', 'Введите имя');
        try {
            const res = await fetch('/api/auth/get-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                generatedCode = data.code;
                document.getElementById('displayCode').textContent = generatedCode;
                document.getElementById('codeSection').style.display = 'block';
                document.getElementById('getCodeBtn').style.display = 'none';
                document.getElementById('registerSubmitBtn').style.display = 'block';
            } else {
                showError('regError', data.error);
            }
        } catch {
            showError('regError', 'Ошибка соединения');
        }
    };

    document.getElementById('registerForm').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;
        const code = document.getElementById('regCode').value;

        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, code }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data.user;
            updateUI();
            modal.style.display = 'none';
            loadTeams();
            loadMatches();
        } else {
            showError('regError', data.error);
        }
    };
};

// Форма входа
loginBtn.onclick = () => {
    openModal(`
        <h2>Вход</h2>
        <form id="loginForm">
            <input type="text" id="loginUsername" placeholder="Имя пользователя" required>
            <input type="password" id="loginPassword" placeholder="Пароль" required>
            <button type="submit">Войти</button>
            <div id="loginError" class="error"></div>
        </form>
    `);

    document.getElementById('loginForm').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            updateUI();
            modal.style.display = 'none';
            loadTeams();
            loadMatches();
        } else {
            showError('loginError', data.error);
        }
    };
};

// Выход
logoutBtn.onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    currentUser = null;
    updateUI();
    loadTeams();
    loadMatches();
};

// Создание команды (только лидер)
document.getElementById('createTeamBtn')?.addEventListener('click', () => {
    openModal(`
        <h2>Создать команду</h2>
        <form id="createTeamForm">
            <input type="text" id="teamName" placeholder="Название команды" required>
            <input type="url" id="teamAvatar" placeholder="URL аватара (необязательно)">
            <button type="submit">Создать</button>
            <div id="teamError" class="error"></div>
        </form>
    `);

    document.getElementById('createTeamForm').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('teamName').value;
        const avatar_url = document.getElementById('teamAvatar').value;

        const res = await fetch('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, avatar_url }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            modal.style.display = 'none';
            loadTeams();
            loadLeaderTeams();
        } else {
            showError('teamError', data.error);
        }
    };
});

// Создание матча (только лидер)
document.getElementById('createMatchBtn')?.addEventListener('click', async () => {
    // Загрузим список команд для выбора
    const teamsRes = await fetch('/api/teams');
    const teams = await teamsRes.json();

    openModal(`
        <h2>Создать матч</h2>
        <form id="createMatchForm">
            <select id="team1" required>
                <option value="">Команда 1</option>
                ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
            <select id="team2" required>
                <option value="">Команда 2</option>
                ${teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
            <input type="number" id="score1" placeholder="Счет команды 1" required>
            <input type="number" id="score2" placeholder="Счет команды 2" required>
            <button type="submit">Создать</button>
            <div id="matchError" class="error"></div>
        </form>
    `);

    document.getElementById('createMatchForm').onsubmit = async (e) => {
        e.preventDefault();
        const team1_id = document.getElementById('team1').value;
        const team2_id = document.getElementById('team2').value;
        const score1 = parseInt(document.getElementById('score1').value);
        const score2 = parseInt(document.getElementById('score2').value);

        if (team1_id === team2_id) {
            return showError('matchError', 'Выберите разные команды');
        }

        const res = await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team1_id, team2_id, score1, score2 }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            modal.style.display = 'none';
            loadTeams();
            loadMatches();
        } else {
            showError('matchError', data.error);
        }
    };
});

// Загрузка команд, где лидером является текущий пользователь (для управления)
async function loadLeaderTeams() {
    if (!currentUser || currentUser.role !== 'leader') return;
    const res = await fetch('/api/teams');
    const allTeams = await res.json();
    const myTeams = allTeams.filter(t => t.leader_id === currentUser.id);
    const container = document.getElementById('myTeams');
    container.innerHTML = '<h3>Мои команды</h3>' + myTeams.map(t => `
        <div>
            <span>${t.name} (рейтинг: ${t.rating})</span>
            <button onclick="showAddMemberForm(${t.id})">Добавить игрока</button>
            <button onclick="showChangeAvatarForm(${t.id})">Сменить аватар</button>
        </div>
    `).join('');
}

// Форма добавления игрока
window.showAddMemberForm = (teamId) => {
    openModal(`
        <h2>Добавить игрока</h2>
        <form id="addMemberForm">
            <input type="text" id="memberUsername" placeholder="Имя пользователя" required>
            <button type="submit">Добавить</button>
            <div id="addError" class="error"></div>
        </form>
    `);

    document.getElementById('addMemberForm').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('memberUsername').value;
        const res = await fetch(`/api/teams/${teamId}/add-member`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            alert('Игрок добавлен');
            modal.style.display = 'none';
        } else {
            showError('addError', data.error);
        }
    };
};

// Форма смены аватара
window.showChangeAvatarForm = (teamId) => {
    openModal(`
        <h2>Сменить аватар команды</h2>
        <form id="changeAvatarForm">
            <input type="url" id="newAvatarUrl" placeholder="URL нового аватара" required>
            <button type="submit">Сохранить</button>
            <div id="avatarError" class="error"></div>
        </form>
    `);

    document.getElementById('changeAvatarForm').onsubmit = async (e) => {
        e.preventDefault();
        const avatar_url = document.getElementById('newAvatarUrl').value;
        const res = await fetch(`/api/teams/${teamId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar_url }),
            credentials: 'include'
        });
        const data = await res.json();
        if (res.ok) {
            alert('Аватар обновлён');
            modal.style.display = 'none';
            loadTeams();
        } else {
            showError('avatarError', data.error);
        }
    };
};

// Вспомогательная функция
function showError(elementId, message) {
    document.getElementById(elementId).textContent = message;
}

// Инициализация
homeBtn.onclick = () => {
    loadTeams();
    loadMatches();
};

fetchUser().then(() => {
    loadTeams();
    loadMatches();
});