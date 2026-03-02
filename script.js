// Глобальные переменные
let currentUser = null;
let currentCode = null;

// DOM элементы
const mainContent = document.getElementById('mainContent');
const userMenu = document.getElementById('userMenu');
const authModal = document.getElementById('authModal');
const createTeamModal = document.getElementById('createTeamModal');
const addPlayerModal = document.getElementById('addPlayerModal');
const createMatchModal = document.getElementById('createMatchModal');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('Page loaded');
    checkAuth();
    setupEventListeners();
    loadPage('ranking');
});

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            currentUser = await response.json();
            console.log('Current user:', currentUser);
        } else {
            currentUser = null;
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        currentUser = null;
    }
    updateUserMenu();
}

// Обновление меню пользователя
function updateUserMenu() {
    if (currentUser && currentUser.username) {
        userMenu.innerHTML = `
            <div class="user-info">
                <span class="username">${currentUser.username}</span>
                ${currentUser.role === 'leader' ? '<span class="leader-badge">ЛИДЕР</span>' : ''}
                <button class="logout-btn" id="logoutBtn">×</button>
            </div>
        `;
        document.getElementById('logoutBtn').addEventListener('click', logout);
    } else {
        userMenu.innerHTML = '<button class="login-btn" id="showLoginBtn">Войти</button>';
        document.getElementById('showLoginBtn').addEventListener('click', () => showModal(authModal));
    }
}

// Выход
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        currentUser = null;
        updateUserMenu();
        loadPage('ranking');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-links a').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            loadPage(link.dataset.page);
        });
    });

    // Модальные окна
    document.getElementById('closeAuthModal').addEventListener('click', () => hideModal(authModal));
    document.getElementById('closeCreateTeamModal').addEventListener('click', () => hideModal(createTeamModal));
    document.getElementById('closeAddPlayerModal').addEventListener('click', () => hideModal(addPlayerModal));
    document.getElementById('closeCreateMatchModal').addEventListener('click', () => hideModal(createMatchModal));

    // Табы авторизации
    document.getElementById('loginTab').addEventListener('click', () => switchAuthTab('login'));
    document.getElementById('registerTab').addEventListener('click', () => switchAuthTab('register'));

    // Генерация кода
    document.getElementById('generateCode').addEventListener('click', generateCode);

    // Отправка форм
    document.getElementById('loginSubmit').addEventListener('click', login);
    document.getElementById('registerSubmit').addEventListener('click', register);
    document.getElementById('createTeamSubmit').addEventListener('click', createTeam);
    document.getElementById('addPlayerSubmit').addEventListener('click', addPlayerToTeam);
    document.getElementById('createMatchSubmit').addEventListener('click', createMatch);

    // Закрытие по клику вне модалки
    window.addEventListener('click', (e) => {
        if (e.target === authModal) hideModal(authModal);
        if (e.target === createTeamModal) hideModal(createTeamModal);
        if (e.target === addPlayerModal) hideModal(addPlayerModal);
        if (e.target === createMatchModal) hideModal(createMatchModal);
    });
}

// Показать модальное окно
function showModal(modal) {
    modal.classList.add('active');
}

// Скрыть модальное окно
function hideModal(modal) {
    modal.classList.remove('active');
    document.getElementById('authError').classList.remove('show');
}

// Переключение табов авторизации
function switchAuthTab(tab) {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authModalTitle = document.getElementById('authModalTitle');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        authModalTitle.textContent = 'Вход';
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        authModalTitle.textContent = 'Регистрация';
    }
}

// Генерация кода подтверждения
function generateCode() {
    currentCode = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('registerCode').value = currentCode;
    alert(`Ваш код подтверждения: ${currentCode}\n(Сохраните его, он одноразовый)`);
}

// Вход
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showError('authError', 'Заполните все поля');
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            hideModal(authModal);
            // Очищаем поля
            document.getElementById('loginUsername').value = '';
            document.getElementById('loginPassword').value = '';
            // Обновляем пользователя
            await checkAuth();
            loadPage('ranking');
        } else {
            showError('authError', data.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('authError', 'Ошибка соединения с сервером');
    }
}

// Регистрация
async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const code = document.getElementById('registerCode').value.trim();

    if (!username || !password || !code) {
        showError('authError', 'Заполните все поля');
        return;
    }

    if (username.length < 3) {
        showError('authError', 'Имя должно быть не менее 3 символов');
        return;
    }

    if (password.length < 4) {
        showError('authError', 'Пароль должен быть не менее 4 символов');
        return;
    }

    if (code.length !== 6 || isNaN(code)) {
        showError('authError', 'Код должен быть 6-значным числом');
        return;
    }

    if (code !== currentCode) {
        showError('authError', 'Неверный код подтверждения');
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, code })
        });

        const data = await response.json();

        if (response.ok) {
            hideModal(authModal);
            // Очищаем поля
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerCode').value = '';
            currentCode = null;
            // Обновляем пользователя
            await checkAuth();
            loadPage('ranking');
            alert('Регистрация успешна! Добро пожаловать!');
        } else {
            showError('authError', data.error || 'Ошибка регистрации');
        }
    } catch (error) {
        console.error('Register error:', error);
        showError('authError', 'Ошибка соединения с сервером');
    }
}

// Показать ошибку
function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, 3000);
}

// Загрузка страницы
async function loadPage(page) {
    console.log('Loading page:', page);
    switch (page) {
        case 'ranking':
            await loadRanking();
            break;
        case 'teams':
            await loadTeams();
            break;
        case 'matches':
            await loadMatches();
            break;
    }
}

// Загрузка рейтинга
async function loadRanking() {
    try {
        const response = await fetch('/api/teams/ranking');
        const teams = await response.json();

        let html = `
            <div class="section-header">
                <h2>Рейтинг команд</h2>
                ${currentUser?.role === 'leader' ? `
                    <div class="leader-actions">
                        <button class="leader-btn" onclick="showCreateTeamModal()">+ Создать команду</button>
                        <button class="leader-btn" onclick="showCreateMatchModal()">+ Создать матч</button>
                    </div>
                ` : ''}
            </div>
            <div class="ranking-grid">
        `;

        if (teams && teams.length > 0) {
            teams.forEach((team, index) => {
                html += `
                    <div class="team-card" onclick="showTeam(${team.id})">
                        <div class="team-header">
                            <img src="${team.avatar || '/default-team.png'}" alt="${team.name}" class="team-avatar" onerror="this.src='/default-team.png'">
                            <div class="team-info">
                                <h3>#${index + 1} ${team.name}</h3>
                                <div class="team-rating">${team.rating} очков</div>
                            </div>
                        </div>
                        <div class="team-stats">
                            <span>👥 ${team.members_count || 0} игроков</span>
                            <span>📊 ${team.matches_count || 0} матчей</span>
                        </div>
                        <div class="team-leader">👑 Лидер: ${team.leader_name || 'Неизвестно'}</div>
                    </div>
                `;
            });
        } else {
            html += '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Нет команд для отображения</p>';
        }

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        console.error('Load ranking error:', error);
        mainContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #ff4655;">Ошибка загрузки рейтинга</p>';
    }
}

// Загрузка списка команд
async function loadTeams() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();

        let html = `
            <div class="section-header">
                <h2>Все команды</h2>
                ${currentUser?.role === 'leader' ? `
                    <div class="leader-actions">
                        <button class="leader-btn" onclick="showCreateTeamModal()">+ Создать команду</button>
                    </div>
                ` : ''}
            </div>
            <div class="ranking-grid">
        `;

        if (teams && teams.length > 0) {
            teams.forEach(team => {
                html += `
                    <div class="team-card" onclick="showTeam(${team.id})">
                        <div class="team-header">
                            <img src="${team.avatar || '/default-team.png'}" alt="${team.name}" class="team-avatar" onerror="this.src='/default-team.png'">
                            <div class="team-info">
                                <h3>${team.name}</h3>
                                <div class="team-rating">${team.rating} очков</div>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html += '<p style="grid-column: 1/-1; text-align: center; padding: 2rem;">Нет команд для отображения</p>';
        }

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        console.error('Load teams error:', error);
        mainContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #ff4655;">Ошибка загрузки команд</p>';
    }
}

// Загрузка матчей
async function loadMatches() {
    try {
        const response = await fetch('/api/matches');
        const matches = await response.json();

        let html = `
            <div class="section-header">
                <h2>История матчей</h2>
                ${currentUser?.role === 'leader' ? `
                    <div class="leader-actions">
                        <button class="leader-btn" onclick="showCreateMatchModal()">+ Создать матч</button>
                    </div>
                ` : ''}
            </div>
            <div class="matches-list">
        `;

        if (matches && matches.length > 0) {
            matches.forEach(match => {
                const matchDate = new Date(match.match_date).toLocaleString('ru-RU');
                html += `
                    <div class="match-card">
                        <div class="match-teams">
                            <div class="match-team ${match.winner_id === match.team1_id ? 'winner' : ''}">
                                <img src="${match.team1_avatar || '/default-team.png'}" alt="${match.team1_name}" class="match-team-avatar" onerror="this.src='/default-team.png'">
                                <span>${match.team1_name}</span>
                            </div>
                            <div class="match-score">${match.team1_score} : ${match.team2_score}</div>
                            <div class="match-team ${match.winner_id === match.team2_id ? 'winner' : ''}">
                                <img src="${match.team2_avatar || '/default-team.png'}" alt="${match.team2_name}" class="match-team-avatar" onerror="this.src='/default-team.png'">
                                <span>${match.team2_name}</span>
                            </div>
                        </div>
                        <div class="match-date">${matchDate}</div>
                    </div>
                `;
            });
        } else {
            html += '<p style="text-align: center; padding: 2rem;">Нет матчей для отображения</p>';
        }

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        console.error('Load matches error:', error);
        mainContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #ff4655;">Ошибка загрузки матчей</p>';
    }
}

// Показать команду
async function showTeam(teamId) {
    try {
        const response = await fetch(`/api/teams/${teamId}`);
        const team = await response.json();

        let html = `
            <div class="team-page">
                <div class="team-page-header">
                    <img src="${team.avatar || '/default-team.png'}" alt="${team.name}" class="team-page-avatar" onerror="this.src='/default-team.png'">
                    <div class="team-page-info">
                        <h1>${team.name}</h1>
                        <div class="team-page-rating">${team.rating} очков</div>
                        <div class="team-page-meta">
                            <div class="meta-item">
                                <span class="meta-label">Лидер</span>
                                <span class="meta-value">${team.leader_name || 'Неизвестно'}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Участников</span>
                                <span class="meta-value">${team.members?.length || 0}</span>
                            </div>
                            <div class="meta-item">
                                <span class="meta-label">Матчей</span>
                                <span class="meta-value">${team.matches?.length || 0}</span>
                            </div>
                        </div>
        `;

        if (currentUser?.role === 'leader' && currentUser?.username === team.leader_name) {
            html += `
                <div class="leader-actions" style="margin-top: 1rem;">
                    <button class="leader-btn" onclick="showAddPlayerModal(${team.id})">+ Добавить игрока</button>
                </div>
            `;
        }

        html += `
                    </div>
                </div>

                <div class="team-members">
                    <h3>Участники команды</h3>
                    <div class="members-grid">
        `;

        if (team.members && team.members.length > 0) {
            team.members.forEach(member => {
                html += `
                    <div class="member-card">
                        <img src="${member.avatar || '/default-avatar.png'}" alt="${member.username}" class="member-avatar" onerror="this.src='/default-avatar.png'">
                        <span class="member-name">${member.username}</span>
                        ${member.username === team.leader_name ? '<span class="leader-tag">👑</span>' : ''}
                    </div>
                `;
            });
        } else {
            html += '<p>Нет участников</p>';
        }

        html += `
                    </div>
                </div>

                <div class="team-matches">
                    <h3>История матчей</h3>
                    <div class="matches-list">
        `;

        if (team.matches && team.matches.length > 0) {
            team.matches.forEach(match => {
                const matchDate = new Date(match.match_date).toLocaleString('ru-RU');
                html += `
                    <div class="match-card">
                        <div class="match-teams">
                            <div class="match-team ${match.winner_id === match.team1_id ? 'winner' : ''}">
                                <img src="${match.team1_avatar || '/default-team.png'}" alt="${match.team1_name}" class="match-team-avatar" onerror="this.src='/default-team.png'">
                                <span>${match.team1_name}</span>
                            </div>
                            <div class="match-score">${match.team1_score} : ${match.team2_score}</div>
                            <div class="match-team ${match.winner_id === match.team2_id ? 'winner' : ''}">
                                <img src="${match.team2_avatar || '/default-team.png'}" alt="${match.team2_name}" class="match-team-avatar" onerror="this.src='/default-team.png'">
                                <span>${match.team2_name}</span>
                            </div>
                        </div>
                        <div class="match-date">${matchDate}</div>
                    </div>
                `;
            });
        } else {
            html += '<p>Нет матчей</p>';
        }

        html += `
                    </div>
                </div>
            </div>
        `;

        mainContent.innerHTML = html;
    } catch (error) {
        console.error('Show team error:', error);
        mainContent.innerHTML = '<p style="text-align: center; padding: 2rem; color: #ff4655;">Ошибка загрузки команды</p>';
    }
}

// Показать модалку создания команды
function showCreateTeamModal() {
    document.getElementById('teamName').value = '';
    document.getElementById('createTeamError').classList.remove('show');
    showModal(createTeamModal);
}

// Создание команды
async function createTeam() {
    const name = document.getElementById('teamName').value.trim();

    if (!name) {
        showError('createTeamError', 'Введите название команды');
        return;
    }

    if (name.length < 2) {
        showError('createTeamError', 'Название должно быть не менее 2 символов');
        return;
    }

    try {
        const response = await fetch('/api/teams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (response.ok) {
            hideModal(createTeamModal);
            loadPage('teams');
            alert('Команда успешно создана!');
        } else {
            showError('createTeamError', data.error || 'Ошибка создания команды');
        }
    } catch (error) {
        console.error('Create team error:', error);
        showError('createTeamError', 'Ошибка соединения с сервером');
    }
}

// Показать модалку добавления игрока
function showAddPlayerModal(teamId) {
    document.getElementById('playerUsername').value = '';
    document.getElementById('addPlayerTeamId').value = teamId;
    document.getElementById('addPlayerError').classList.remove('show');
    showModal(addPlayerModal);
}

// Добавление игрока в команду
async function addPlayerToTeam() {
    const username = document.getElementById('playerUsername').value.trim();
    const teamId = document.getElementById('addPlayerTeamId').value;

    if (!username) {
        showError('addPlayerError', 'Введите имя игрока');
        return;
    }

    try {
        const response = await fetch(`/api/teams/${teamId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();

        if (response.ok) {
            hideModal(addPlayerModal);
            showTeam(teamId);
            alert('Игрок добавлен в команду!');
        } else {
            showError('addPlayerError', data.error || 'Ошибка добавления игрока');
        }
    } catch (error) {
        console.error('Add player error:', error);
        showError('addPlayerError', 'Ошибка соединения с сервером');
    }
}

// Показать модалку создания матча
async function showCreateMatchModal() {
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();

        const team1Select = document.getElementById('matchTeam1');
        const team2Select = document.getElementById('matchTeam2');

        team1Select.innerHTML = '<option value="">Выберите команду 1</option>';
        team2Select.innerHTML = '<option value="">Выберите команду 2</option>';

        if (teams && teams.length > 0) {
            teams.forEach(team => {
                team1Select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
                team2Select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
            });
        }

        document.getElementById('team1Score').value = '0';
        document.getElementById('team2Score').value = '0';
        document.getElementById('createMatchError').classList.remove('show');
        showModal(createMatchModal);
    } catch (error) {
        console.error('Show create match error:', error);
        alert('Ошибка загрузки команд');
    }
}

// Создание матча
async function createMatch() {
    const team1_id = document.getElementById('matchTeam1').value;
    const team2_id = document.getElementById('matchTeam2').value;
    const team1_score = parseInt(document.getElementById('team1Score').value) || 0;
    const team2_score = parseInt(document.getElementById('team2Score').value) || 0;

    if (!team1_id || !team2_id) {
        showError('createMatchError', 'Выберите обе команды');
        return;
    }

    if (team1_id === team2_id) {
        showError('createMatchError', 'Команды должны быть разными');
        return;
    }

    try {
        const response = await fetch('/api/matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ team1_id, team2_id, team1_score, team2_score })
        });

        const data = await response.json();

        if (response.ok) {
            hideModal(createMatchModal);
            loadPage('matches');
            alert('Матч успешно создан!');
        } else {
            showError('createMatchError', data.error || 'Ошибка создания матча');
        }
    } catch (error) {
        console.error('Create match error:', error);
        showError('createMatchError', 'Ошибка соединения с сервером');
    }
}

// Сделать функции глобальными для onclick
window.showTeam = showTeam;
window.showCreateTeamModal = showCreateTeamModal;
window.showCreateMatchModal = showCreateMatchModal;
window.showAddPlayerModal = showAddPlayerModal;