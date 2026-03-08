const API = {
  allIssues: 'https://phi-lab-server.vercel.app/api/v1/lab/issues',
  singleIssue: 'https://phi-lab-server.vercel.app/api/v1/lab/issue/',
  searchIssue: 'https://phi-lab-server.vercel.app/api/v1/lab/issues/search?q='
};

const AUTH = {
  username: 'admin',
  password: 'admin123',
  key: 'issue-tracker-auth',
  sessionKey: 'issue-tracker-auth-session'
};

const state = {
  issues: [],
  currentTab: 'all',
  searchText: '',
  hadSearch: false,
  searchDebounceId: null,
  activeFetchToken: 0,
  uiLoadingTimer: null
};

const TAB_ACTIVE_CLASSES = ['text-white', 'border-transparent', 'bg-gradient-to-r', 'from-[#4f16f2]', 'to-[#6129f7]'];
const TAB_INACTIVE_CLASSES = ['text-[#334155]', 'border-[#d4dbe8]', 'bg-white'];

const el = {
  loginView: document.getElementById('login-view'),
  appView: document.getElementById('app-view'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  passwordInput: document.getElementById('password'),
  togglePasswordBtn: document.getElementById('toggle-password'),
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  keywordSuggestions: document.getElementById('keyword-suggestions'),
  logoutBtn: document.getElementById('logout-btn'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  loading: document.getElementById('loading'),
  issuesGrid: document.getElementById('issues-grid'),
  errorText: document.getElementById('error-text'),
  issueCount: document.getElementById('issue-count'),
  issueModal: document.getElementById('issue-modal'),
  closeModal: document.getElementById('close-modal'),
  modalContent: document.getElementById('modal-content')
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

const formatModalDate = (rawDate) => {
  if (!rawDate) return 'N/A';
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return String(rawDate);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
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
    labels: issue.labels ?? issue.label ?? issue.category ?? issue.tags ?? 'general',
    createdAt: issue.createdAt ?? issue.created_at ?? issue.date ?? null
  };
};

const getCardPriorityClass = (priority) => {
  if (priority === 'high') return 'bg-[#fee2e2] text-[#ef4444]';
  if (priority === 'medium') return 'bg-[#fef3c7] text-[#d97706]';
  return 'bg-[#e5e7eb] text-[#94a3b8]';
};

const getModalPriorityClass = (priority) => {
  if (priority === 'high') return 'bg-[#ef4444] text-white';
  if (priority === 'medium') return 'bg-[#fef3c7] text-[#d97706]';
  return 'bg-[#e2e8f0] text-[#64748b]';
};

const getIssueLabels = (issue) => {
  const source = issue.labels ?? 'general';

  if (Array.isArray(source)) {
    return source.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(source)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const createCard = (issue) => {
  const card = document.createElement('article');
  const topBorder = issue.status === 'closed' ? 'border-t-[#a855f7]' : 'border-t-[#13b981]';
  const statusDot = issue.status === 'closed' ? 'bg-[#a855f7]' : 'bg-[#13b981]';

  card.className = `issue-card bg-white border border-[#d6deea] border-t-4 ${topBorder} rounded-[8px] overflow-hidden cursor-pointer`;
  card.dataset.id = issue.id;

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

  card.addEventListener('click', () => openIssueModal(issue.id, issue));
  return card;
};

const renderCounts = (issues) => {
  const open = issues.filter((issue) => issue.status === 'open').length;
  const closed = issues.filter((issue) => issue.status === 'closed').length;

  let activeCount = issues.length;
  if (state.currentTab === 'open') activeCount = open;
  if (state.currentTab === 'closed') activeCount = closed;

  el.issueCount.textContent = String(activeCount);
};

const getFilteredIssues = () => {
  if (state.currentTab === 'all') return state.issues;
  return state.issues.filter((issue) => issue.status === state.currentTab);
};

const renderIssues = () => {
  const list = getFilteredIssues();
  el.issuesGrid.innerHTML = '';

  if (!list.length) {
    el.issuesGrid.innerHTML =
      '<div class="empty-state p-5 text-center text-[#64748b] bg-white border border-[#dfe3ea] rounded-[10px]">No issues found for this selection.</div>';
    return;
  }

  list.forEach((issue) => {
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

const applyTabButtonStyle = (btn, active) => {
  TAB_ACTIVE_CLASSES.forEach((className) => btn.classList.toggle(className, active));
  TAB_INACTIVE_CLASSES.forEach((className) => btn.classList.toggle(className, !active));
  btn.classList.toggle('active', active);
};

const setActiveTab = (tabName) => {
  state.currentTab = tabName;

  el.tabBtns.forEach((btn) => {
    applyTabButtonStyle(btn, btn.dataset.tab === tabName);
  });
};

const renderTabWithLoading = () => {
  clearTimeout(state.uiLoadingTimer);
  setError('');
  setLoading(true);

  state.uiLoadingTimer = setTimeout(() => {
    renderCounts(state.issues);
    renderIssues();
    setLoading(false);
  }, 220);
};

const getRelevantKeywords = (issues, query) => {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return [];

  const unique = new Set();

  issues.forEach((issue) => {
    const title = String(issue.title || '').trim();
    const desc = String(issue.description || '').trim();

    if (title.toLowerCase().includes(normalizedQuery)) {
      unique.add(title);
    }

    getIssueLabels(issue).forEach((label) => {
      const cleaned = String(label).trim();
      if (cleaned.toLowerCase().includes(normalizedQuery)) {
        unique.add(cleaned);
      }
    });

    desc
      .split(/\s+/)
      .map((word) => word.replace(/[^a-zA-Z0-9_-]/g, '').trim())
      .filter(Boolean)
      .forEach((word) => {
        if (word.toLowerCase().includes(normalizedQuery) && word.length > 2) {
          unique.add(word);
        }
      });
  });

  return Array.from(unique).slice(0, 6);
};

const renderKeywordSuggestions = (keywords = []) => {
  if (!state.searchText || !keywords.length) {
    el.keywordSuggestions.classList.add('hidden');
    el.keywordSuggestions.classList.remove('flex');
    el.keywordSuggestions.innerHTML = '';
    return;
  }

  el.keywordSuggestions.classList.remove('hidden');
  el.keywordSuggestions.classList.add('flex');
  el.keywordSuggestions.innerHTML = '';

  const title = document.createElement('span');
  title.className = 'text-[14px] text-[#475569] font-semibold';
  title.textContent = 'Related keywords:';
  el.keywordSuggestions.appendChild(title);

  keywords.forEach((keyword) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className =
      'keyword-chip border border-[#ccd5e3] rounded-full bg-[#f8faff] text-[#1e293b] text-[12px] font-semibold px-[10px] py-[6px] cursor-pointer hover:border-[#b8c4d8] hover:bg-[#eef4ff] transition-colors';
    chip.dataset.keyword = keyword;
    chip.textContent = keyword;
    el.keywordSuggestions.appendChild(chip);
  });
};

const fetchIssues = async (options = {}) => {
  const { forceAll = false } = options;

  clearTimeout(state.uiLoadingTimer);
  setLoading(true);
  setError('');

  const token = ++state.activeFetchToken;

  try {
    const shouldSearch = state.searchText && !forceAll;
    const endpoint = shouldSearch
      ? `${API.searchIssue}${encodeURIComponent(state.searchText)}`
      : API.allIssues;

    const response = await fetch(endpoint);

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

    if (shouldSearch) {
      renderKeywordSuggestions(getRelevantKeywords(state.issues, state.searchText));
    } else {
      renderKeywordSuggestions([]);
    }
  } catch {
    if (token !== state.activeFetchToken) {
      return;
    }

    setError('Failed to load issues. Please try again.');
    el.issuesGrid.innerHTML =
      '<div class="empty-state p-5 text-center text-[#64748b] bg-white border border-[#dfe3ea] rounded-[10px]">Could not fetch issue data.</div>';
    renderCounts([]);
    renderKeywordSuggestions([]);
  } finally {
    if (token === state.activeFetchToken) {
      setLoading(false);
    }
  }
};

const renderModal = (issue) => {
  const statusText = issue.status === 'closed' ? 'Closed' : 'Opened';
  const statusPillClass = issue.status === 'closed' ? 'bg-[#a855f7]' : 'bg-[#10b981]';

  el.modalContent.innerHTML = `
    <h3 class="modal-title m-0 text-[44px] leading-[1.2] text-[#1f2937]">${escapeHtml(issue.title)}</h3>

    <div class="mt-[10px] flex items-center flex-wrap gap-2">
      <span class="rounded-full px-[10px] py-1 text-[13px] leading-none font-semibold text-white ${statusPillClass}">${escapeHtml(statusText)}</span>
      <span class="text-[#64748b] text-[16px]">•</span>
      <span class="text-[#64748b] text-[16px]">Opened by ${escapeHtml(issue.author)}</span>
      <span class="text-[#64748b] text-[16px]">•</span>
      <span class="text-[#64748b] text-[16px]">${escapeHtml(formatModalDate(issue.createdAt))}</span>
    </div>

    <div class="mt-[22px] flex flex-wrap gap-2">
      <span class="inline-flex items-center gap-1 px-[10px] py-1 rounded-full border border-[#fecaca] bg-[#fee2e2] text-[#ef4444] text-[12px] font-semibold uppercase tracking-[0.01em] leading-none">BUG</span>
      <span class="inline-flex items-center gap-1 px-[10px] py-1 rounded-full border border-[#fcd34d] bg-[#fef3c7] text-[#d97706] text-[12px] font-semibold uppercase tracking-[0.01em] leading-none">HELP WANTED</span>
    </div>

    <p class="mt-6 mb-0 text-[#64748b] text-[15px] leading-[1.5]">${escapeHtml(issue.description)}</p>

    <div class="modal-info-box mt-6 p-[14px_16px] rounded-[10px] bg-[#f1f5f9] grid grid-cols-2 gap-5">
      <div>
        <p class="m-0 text-[#64748b] text-[16px]">Assignee:</p>
        <p class="mt-[6px] mb-0 text-[#1f2937] text-[18px] font-bold">${escapeHtml(issue.author)}</p>
      </div>
      <div>
        <p class="m-0 text-[#64748b] text-[16px]">Priority:</p>
        <p class="mt-[6px] mb-0"><span class="inline-flex items-center justify-center rounded-full uppercase tracking-[0.02em] px-[14px] py-[5px] min-w-[74px] text-[12px] font-bold leading-none ${getModalPriorityClass(
          issue.priority
        )}">${escapeHtml(issue.priority)}</span></p>
      </div>
    </div>
  `;
};

const openIssueModal = async (id, fallbackIssue) => {
  try {
    el.modalContent.innerHTML =
      '<div class="min-h-[180px] grid place-items-center gap-2 text-[#64748b]"><div class="relative inline-flex h-12 w-12 items-center justify-center"><span class="loading loading-ring loading-xl text-[#4f16f2]"></span><span class="absolute h-2.5 w-2.5 rounded-full bg-[#4f16f2]/70 animate-pulse"></span></div><p>Loading issue details...</p></div>';
    el.issueModal.showModal();

    const response = await fetch(`${API.singleIssue}${id}`);

    if (!response.ok) {
      throw new Error('Could not fetch single issue.');
    }

    const payload = await response.json();
    const raw = payload?.data ?? payload?.issue ?? payload;
    const issue = normalizeIssue(raw, id);

    renderModal(issue);
  } catch {
    renderModal(fallbackIssue);
  }
};

const runSearchNow = () => {
  clearTimeout(state.searchDebounceId);

  const query = el.searchInput.value.trim();

  if (!query) {
    state.searchText = '';
    renderKeywordSuggestions([]);

    if (state.hadSearch) {
      location.reload();
      return;
    }

    fetchIssues({ forceAll: true });
    return;
  }

  state.hadSearch = true;
  state.searchText = query;
  fetchIssues();
};

const handleLiveSearch = () => {
  clearTimeout(state.searchDebounceId);

  const query = el.searchInput.value.trim();

  if (!query) {
    state.searchText = '';
    renderKeywordSuggestions([]);

    if (state.hadSearch) {
      location.reload();
      return;
    }

    fetchIssues({ forceAll: true });
    return;
  }

  state.hadSearch = true;

  state.searchDebounceId = setTimeout(() => {
    state.searchText = query;
    fetchIssues();
  }, 350);
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

  el.searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    runSearchNow();
  });

  el.searchInput.addEventListener('input', handleLiveSearch);

  el.searchInput.addEventListener('search', () => {
    if (!el.searchInput.value.trim() && state.hadSearch) {
      location.reload();
    }
  });

  el.keywordSuggestions.addEventListener('click', (event) => {
    const chip = event.target.closest('.keyword-chip');
    if (!chip) return;

    const keyword = chip.dataset.keyword || '';
    el.searchInput.value = keyword;
    state.hadSearch = true;
    state.searchText = keyword;
    fetchIssues();
  });

  el.tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveTab(btn.dataset.tab);
      renderTabWithLoading();
    });
  });

  el.closeModal.addEventListener('click', () => {
    el.issueModal.close();
  });

  el.issueModal.addEventListener('click', (event) => {
    const rect = el.issueModal.getBoundingClientRect();
    const clickedInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (!clickedInDialog) {
      el.issueModal.close();
    }
  });
};

const init = () => {
  bindEvents();
  setActiveTab(state.currentTab);

  const isAuthenticated =
    localStorage.getItem(AUTH.key) === 'true' ||
    sessionStorage.getItem(AUTH.sessionKey) === 'true';

  if (isAuthenticated) {
    showApp();
    fetchIssues();
  }
};

init();
