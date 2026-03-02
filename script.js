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
            updateUserMenu();
        }
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
    }
}

// Обновление меню пользователя
function updateUserMenu() {
    if (currentUser) {
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
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    updateUserMenu();
    loadPage('ranking');
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

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        document.getElementById('authModalTitle').textContent = 'Вход';
    } else {
        registerTab.classList.add('active');
        loginTab.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        document.getElementById('authModalTitle').textContent = 'Регистрация';
    }
}

// Генерация кода подтверждения
function generateCode() {
    currentCode = Math.floor(100000 + Math.random() * 900000).toString();
    document.getElementById('registerCode').value = currentCode;
    alert(`Ваш код подтверждения: ${currentCode}`);
}

// Вход
async function login() {
    const username = document.getElementById('loginUsername').value;
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
            await checkAuth();
            loadPage('ranking');
        } else {
            showError('authError', data.error);
        }
    } catch (error) {
        showError('authError', 'Ошибка соединения');
    }
}

// Регистрация
async function register() {
    const username = document.getElementById('registerUsername').value;
    const password = document.getElementById('registerPassword').value;
    const code = document.getElementById('registerCode').value;

    if (!username || !password || !code) {
        showError('authError', 'Заполните все поля');
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
            await checkAuth();
            loadPage('ranking');
        } else {
            showError('authError', data.error);
        }
    } catch (error) {
        showError('authError', 'Ошибка соединения');
    }
}

// Показать ошибку
function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.classList.add('show');
}

// Загрузка страницы
async function loadPage(page) {
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

        teams.forEach((team, index) => {
            html += `
                <div class="team-card" onclick="showTeam(${team.id})">
                    <div class="team-header">
                        <img src="${team.avatar || 'default-team.png'}" alt="${team.name}" class="team-avatar">
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

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        mainContent.innerHTML = '<p>Ошибка загрузки рейтинга</p>';
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

        teams.forEach(team => {
            html += `
                <div class="team-card" onclick="showTeam(${team.id})">
                    <div class="team-header">
                        <img src="${team.avatar || 'default-team.png'}" alt="${team.name}" class="team-avatar">
                        <div class="team-info">
                            <h3>${team.name}</h3>
                            <div class="team-rating">${team.rating} очков</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        mainContent.innerHTML = '<p>Ошибка загрузки команд</p>';
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

        matches.forEach(match => {
            const matchDate = new Date(match.match_date).toLocaleString();
            html += `
                <div class="match-card">
                    <div class="match-teams">
                        <div class="match-team ${match.winner_id === match.team1_id ? 'winner' : ''}">
                            <img src="${match.team1_avatar || 'default-team.png'}" alt="${match.team1_name}" class="match-team-avatar">
                            <span>${match.team1_name}</span>
                        </div>
                        <div class="match-score">${match.team1_score} : ${match.team2_score}</div>
                        <div class="match-team ${match.winner_id === match.team2_id ? 'winner' : ''}">
                            <img src="${match.team2_avatar || 'default-team.png'}" alt="${match.team2_name}" class="match-team-avatar">
                            <span>${match.team2_name}</span>
                        </div>
                    </div>
                    <div class="match-date">${matchDate}</div>
                </div>
            `;
        });

        html += '</div>';
        mainContent.innerHTML = html;
    } catch (error) {
        mainContent.innerHTML = '<p>Ошибка загрузки матчей</p>';
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
                    <img src="${team.avatar || 'default-team.png'}" alt="${team.name}" class="team-page-avatar">
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
                        ${currentUser?.role === 'leader' && currentUser?.username === team.leader_name ? `
                            <div class="leader-actions" style="margin-top: 1rem;">
                                <button class="leader-btn" onclick="showAddPlayerModal(${team.id})">+ Добавить игрока</button>
                                <button class="leader-btn" onclick="showUploadAvatar(${team.id})">📷 Сменить аватар</button>
                            </div>
                        ` : ''}
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
                        <img src="${member.avatar || 'default-avatar.png'}" alt="${member.username}" class="member-avatar">
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
                const matchDate = new Date(match.match_date).toLocaleString();
                html += `
                    <div class="match-card">
                        <div class="match-teams">
                            <div class="match-team ${match.winner_id === match.team1_id ? 'winner' : ''}">
                                <img src="${match.team1_avatar || 'default-team.png'}" alt="${match.team1_name}" class="match-team-avatar">
                                <span>${match.team1_name}</span>
                            </div>
                            <div class="match-score">${match.team1_score} : ${match.team2_score}</div>
                            <div class="match-team ${match.winner_id === match.team2_id ? 'winner' : ''}">
                                <img src="${match.team2_avatar || 'default-team.png'}" alt="${match.team2_name}" class="match-team-avatar">
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
        mainContent.innerHTML = '<p>Ошибка загрузки команды</p>';
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
    const name = document.getElementById('teamName').value;

    if (!name) {
        showError('createTeamError', 'Введите название команды');
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
        } else {
            showError('createTeamError', data.error);
        }
    } catch (error) {
        showError('createTeamError', 'Ошибка создания команды');
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
    const username = document.getElementById('playerUsername').value;
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
        } else {
            showError('addPlayerError', data.error);
        }
    } catch (error) {
        showError('addPlayerError', 'Ошибка добавления игрока');
    }
}

// Показать модалку создания матча
async function showCreateMatchModal() {
    // Загружаем список команд для выбора
    try {
        const response = await fetch('/api/teams');
        const teams = await response.json();

        const team1Select = document.getElementById('matchTeam1');
        const team2Select = document.getElementById('matchTeam2');

        team1Select.innerHTML = '<option value="">Выберите команду 1</option>';
        team2Select.innerHTML = '<option value="">Выберите команду 2</option>';

        teams.forEach(team => {
            team1Select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
            team2Select.innerHTML += `<option value="${team.id}">${team.name}</option>`;
        });

        document.getElementById('team1Score').value = '0';
        document.getElementById('team2Score').value = '0';
        document.getElementById('createMatchError').classList.remove('show');
        showModal(createMatchModal);
    } catch (error) {
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
        } else {
            showError('createMatchError', data.error);
        }
    } catch (error) {
        showError('createMatchError', 'Ошибка создания матча');
    }
}

// Загрузка аватара команды
function showUploadAvatar(teamId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const response = await fetch(`/api/teams/${teamId}/avatar`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showTeam(teamId);
            } else {
                alert(data.error || 'Ошибка загрузки аватара');
            }
        } catch (error) {
            alert('Ошибка загрузки аватара');
        }
    };

    input.click();
}