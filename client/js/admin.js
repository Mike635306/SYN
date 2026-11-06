const sessionToken = localStorage.getItem('synapse_session_token');
const usersList = document.getElementById('users-list');
const usersCount = document.getElementById('users-count');
const statusElement = document.getElementById('admin-status');
const searchInput = document.getElementById('user-search');
let users = [];

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${sessionToken || ''}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер вернул некорректный ответ.');
  }
  if (!response.ok) {
    const error = new Error(data.error || `Ошибка запроса (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
};

const setStatus = (message) => {
  statusElement.textContent = message;
};

const renderUsers = () => {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const filteredUsers = users.filter((user) =>
    [user.name, user.login, user.id, user.phone]
      .some((value) => String(value || '').toLocaleLowerCase().includes(query))
  );

  usersCount.textContent = `${filteredUsers.length} из ${users.length} аккаунтов`;
  usersList.replaceChildren();
  if (!filteredUsers.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Пользователи не найдены.';
    usersList.append(empty);
    return;
  }

  for (const user of filteredUsers) {
    const card = document.createElement('article');
    card.className = 'user-card';

    const info = document.createElement('div');
    info.className = 'user-info';

    const name = document.createElement('p');
    name.className = 'user-name';
    name.textContent = user.name || 'Без имени';

    const meta = document.createElement('p');
    meta.className = 'user-meta';
    meta.textContent = [user.login, user.phone, `ID: ${user.id}`].filter(Boolean).join(' · ');

    const state = document.createElement('span');
    state.className = `user-state${user.isBanned ? ' banned' : ''}`;
    state.textContent = user.isBanned ? 'Заблокирован' : 'Активен';
    info.append(name, meta, state);

    const button = document.createElement('button');
    button.className = `ban-button${user.isBanned ? ' unban' : ''}`;
    button.type = 'button';
    button.dataset.userId = user.id;
    button.dataset.banned = String(user.isBanned);
    button.textContent = user.isBanned ? 'Разблокировать' : 'Заблокировать';

    card.append(info, button);
    usersList.append(card);
  }
};

const loadUsers = async () => {
  const result = await request('/admin/users');
  users = Array.isArray(result.users) ? result.users : [];
  renderUsers();
};

searchInput.addEventListener('input', renderUsers);

usersList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-user-id]');
  if (!button || button.disabled) return;
  const banned = button.dataset.banned !== 'true';
  if (banned && !window.confirm('Заблокировать этот аккаунт?')) return;

  button.disabled = true;
  setStatus('');
  try {
    await request(`/admin/users/${encodeURIComponent(button.dataset.userId)}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned }),
    });
    await loadUsers();
    setStatus(banned ? 'Аккаунт заблокирован.' : 'Аккаунт разблокирован.');
  } catch (error) {
    setStatus(error.message || 'Не удалось изменить состояние аккаунта.');
    button.disabled = false;
  }
});

const initializeAdminPanel = async () => {
  if (!sessionToken) {
    window.location.replace('/login.html');
    return;
  }
  try {
    await loadUsers();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('/login.html');
      return;
    }
    setStatus(error.status === 403 || error.status === 503
      ? error.message
      : error.message || 'Не удалось загрузить список аккаунтов.');
    usersCount.textContent = 'Доступ не подтверждён';
  }
};

initializeAdminPanel();
