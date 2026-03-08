const API = {
  allIssues: 'https://phi-lab-server.vercel.app/api/v1/lab/issues'
};

const AUTH = {
  username: 'admin',
  password: 'admin123',
  key: 'issue-tracker-auth',
  sessionKey: 'issue-tracker-auth-session'
};

const state = {
  issues: [],
  activeFetchToken: 0
};

const el = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  passwordInput: document.getElementById('password'),
  togglePasswordBtn: document.getElementById('toggle-password'),
  logoutBtn: document.getElementById('logout-btn'),
  loading: document.getElementById('loading'),
  issuesGrid: document.getElementById('issues-grid'),
  errorText: document.getElementById('error-text'),
  issueCount: document.getElementById('issue-count')
};

const extractData = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.issues)) return payload.issues;
  if (Array.isArray(payload?.data?.issues)) return payload.data.issues;
  return [];
};

const normalizeStatus = (status) => {
  const s = String(status || '').toLowerCase();
  return s === 'closed' ? 'closed' : 'open';
};

const formatDate = (rawDate) => {
  if (!rawDate) return 'N/A';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return String(rawDate);
  return parsed.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
};

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const normalizePriority = (priority) => {
  const p = String(priority ?? 'low').toLowerCase();
  if (p.includes('high')) return 'high';
  if (p.includes('medium') || p.includes('med')) return 'medium';
  if (p.includes('low')) return 'low';
  return 'low';
};

const normalizeIssue = (issue, index = 0) => {
  return {
    id: issue.id ?? issue._id ?? issue.issueId ?? index,
    title: issue.title ?? issue.name ?? 'Untitled Issue',
    description: issue.description ?? issue.details ?? 'No description available.',
    status: normalizeStatus(issue.status ?? issue.state),
    author: issue.author ?? issue.createdBy ?? issue.user ?? 'unknown_author',
    priority: normalizePriority(issue.priority),
    createdAt: issue.createdAt ?? issue.created_at ?? issue.date ?? null
  };
};

const getCardPriorityClass = (priority) => {
  if (priority === 'high') return 'bg-[#fee2e2] text-[#ef4444]';
  if (priority === 'medium') return 'bg-[#fef3c7] text-[#d97706]';
  return 'bg-[#e5e7eb] text-[#94a3b8]';
};

const createCard = (issue) => {
  const card = document.createElement('article');
  const topBorder = issue.status === 'closed' ? 'border-t-[#a855f7]' : 'border-t-[#13b981]';
  const statusDot = issue.status === 'closed' ? 'bg-[#a855f7]' : 'bg-[#13b981]';

  card.className = `issue-card bg-white border border-[#d6deea] border-t-4 ${topBorder} rounded-[8px] overflow-hidden`;
  card.innerHTML = `
    <div class="p-[13px_13px_12px] min-h-[268px] flex flex-col">
      <div class="flex justify-between items-center gap-[10px] mb-3">
        <span class="inline-block w-[16px] h-[16px] rounded-full ${statusDot}"></span>
        <span class="rounded-full text-[12px] font-semibold uppercase tracking-[0.02em] px-3 py-[5px] min-w-[78px] text-center leading-none ${getCardPriorityClass(
          issue.priority
        )}">${escapeHtml(issue.priority)}</span>
      </div>

      <h4 class="m-0 mb-2 text-[14px] font-bold leading-[1.35] text-[#1f2937] clamp-two min-h-[38px]">${escapeHtml(issue.title)}</h4>
      <p class="m-0 text-[#64748b] text-[13px] leading-[1.4] min-h-[38px] clamp-two">${escapeHtml(issue.description)}</p>

      <div class="mt-[11px] flex flex-nowrap gap-[6px] overflow-hidden">
        <span class="inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full border border-[#fecaca] bg-[#fee2e2] text-[#ef4444] text-[10px] font-semibold uppercase tracking-[0.01em] leading-none whitespace-nowrap">BUG</span>
        <span class="inline-flex items-center gap-1 px-[8px] py-[3px] rounded-full border border-[#fcd34d] bg-[#fef3c7] text-[#d97706] text-[10px] font-semibold uppercase tracking-[0.01em] leading-none whitespace-nowrap">HELP WANTED</span>
      </div>

      <div class="border-t border-[#e2e8f0] mt-auto pt-[9px] text-[#64748b] text-[14px] flex flex-col items-start gap-[6px] leading-none">
        <span>#${escapeHtml(issue.id)} by ${escapeHtml(issue.author)}</span>
        <span>${escapeHtml(formatDate(issue.createdAt))}</span>
      </div>
    </div>
  `;

  return card;
};

const renderCounts = (issues) => {
  el.issueCount.textContent = String(issues.length);
};

const renderIssues = () => {
  el.issuesGrid.innerHTML = '';

  if (!state.issues.length) {
    el.issuesGrid.innerHTML =
      '<div class="empty-state p-5 text-center text-[#64748b] bg-white border border-[#dfe3ea] rounded-[10px]">No issues found.</div>';
    return;
  }

  state.issues.forEach((issue) => {
    el.issuesGrid.appendChild(createCard(issue));
  });
};

const setLoading = (isLoading) => {
  el.loading.classList.toggle('hidden', !isLoading);
  el.issuesGrid.classList.toggle('hidden', isLoading);
};

const setError = (message = '') => {
  el.errorText.textContent = message;
};

const fetchIssues = async () => {
  setLoading(true);
  setError('');

  const token = ++state.activeFetchToken;

  try {
    const response = await fetch(API.allIssues);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (token !== state.activeFetchToken) {
      return;
    }

    state.issues = extractData(payload).map((issue, idx) => normalizeIssue(issue, idx + 1));
    renderCounts(state.issues);
    renderIssues();
  } catch {
    if (token !== state.activeFetchToken) {
      return;
    }

    setError('Failed to load issues. Please try again.');
    el.issuesGrid.innerHTML =
      '<div class="empty-state p-5 text-center text-[#64748b] bg-white border border-[#dfe3ea] rounded-[10px]">Could not fetch issue data.</div>';
    renderCounts([]);
  } finally {
    if (token === state.activeFetchToken) {
      setLoading(false);
    }
  }
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
    fetchIssues();
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
    fetchIssues();
  }
};

init();
