const AUTH = {
  username: 'admin',
  password: 'admin123',
  key: 'issue-tracker-auth',
  sessionKey: 'issue-tracker-auth-session'
};

const el = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  passwordInput: document.getElementById('password'),
  togglePasswordBtn: document.getElementById('toggle-password'),
  logoutBtn: document.getElementById('logout-btn')
};

const showApp = () => {
  el.loginView.classList.add('hidden');
  el.appView.classList.remove('hidden');
};

const showLogin = () => {
  localStorage.removeItem(AUTH.key);
  sessionStorage.removeItem(AUTH.sessionKey);
  el.appView.classList.add('hidden');
  el.loginView.classList.remove('hidden');

  if (el.passwordInput && el.togglePasswordBtn) {
    el.passwordInput.type = 'password';
    el.togglePasswordBtn.textContent = 'Show';
    el.togglePasswordBtn.setAttribute('aria-label', 'Show password');
    el.togglePasswordBtn.setAttribute('aria-pressed', 'false');
  }
};

const togglePasswordVisibility = () => {
  if (!el.passwordInput || !el.togglePasswordBtn) return;

  const isHidden = el.passwordInput.type === 'password';
  el.passwordInput.type = isHidden ? 'text' : 'password';
  el.togglePasswordBtn.textContent = isHidden ? 'Hide' : 'Show';
  el.togglePasswordBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  el.togglePasswordBtn.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
};

const handleLogin = (event) => {
  event.preventDefault();
  const form = new FormData(el.loginForm);
  const username = String(form.get('username') || '').trim();
  const password = String(form.get('password') || '').trim();
  const rememberMe = form.get('remember') === 'on';

  if (username === AUTH.username && password === AUTH.password) {
    if (rememberMe) {
      localStorage.setItem(AUTH.key, 'true');
      sessionStorage.removeItem(AUTH.sessionKey);
    } else {
      sessionStorage.setItem(AUTH.sessionKey, 'true');
      localStorage.removeItem(AUTH.key);
    }

    el.loginError.textContent = '';
    showApp();
    return;
  }

  el.loginError.textContent = 'Invalid credentials. Use admin / admin123.';
};

const bindEvents = () => {
  el.loginForm.addEventListener('submit', handleLogin);

  if (el.togglePasswordBtn) {
    el.togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
  }

  el.logoutBtn.addEventListener('click', showLogin);
};

const init = () => {
  bindEvents();

  const isAuthenticated =
    localStorage.getItem(AUTH.key) === 'true' ||
    sessionStorage.getItem(AUTH.sessionKey) === 'true';

  if (isAuthenticated) {
    showApp();
  }
};

init();
