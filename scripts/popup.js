// Form Saver Pro v4.0 - Popup Script
// Дашборд, папки, правила, аудит, мастер-пароль

document.addEventListener('DOMContentLoaded', async () => {
  // Элементы
  const themeToggle = document.getElementById('themeToggle');
  const lockBtn = document.getElementById('lockBtn');
  const formsList = document.getElementById('formsList');
  const searchInput = document.getElementById('searchInput');
  const filterTags = document.getElementById('filterTags');
  const sortSelect = document.getElementById('sortSelect');
  const folderFilter = document.getElementById('folderFilter');
  const clearAllBtn = document.getElementById('clearAll');
  const exportBtn = document.getElementById('exportData');
  const importFile = document.getElementById('importFile');
  const saveSettingsBtn = document.getElementById('saveSettings');

  // Дашборд элементы
  const dashTotalForms = document.getElementById('dashTotalForms');
  const dashTotalFolders = document.getElementById('dashTotalFolders');
  const dashTotalSaved = document.getElementById('dashTotalSaved');
  const dashTotalRestored = document.getElementById('dashTotalRestored');
  const activityChart = document.getElementById('activityChart');
  const topFoldersList = document.getElementById('topFoldersList');
  const fieldTypesList = document.getElementById('fieldTypesList');

  // Папки
  const newFolderName = document.getElementById('newFolderName');
  const createFolderBtn = document.getElementById('createFolder');
  const foldersList = document.getElementById('foldersList');

  // Правила
  const createRuleBtn = document.getElementById('createRule');
  const rulesList = document.getElementById('rulesList');

  // Настройки
  const masterPasswordEnabled = document.getElementById('masterPasswordEnabled');
  const masterPassword = document.getElementById('masterPassword');
  const enableEncryption = document.getElementById('enableEncryption');
  const encryptionPassword = document.getElementById('encryptionPassword');
  const enableNotifications = document.getElementById('enableNotifications');
  const enableSync = document.getElementById('enableSync');
  const autoCleanup = document.getElementById('autoCleanup');
  const enableClickFill = document.getElementById('enableClickFill');
  const enableSmartFields = document.getElementById('enableSmartFields');
  const darkTheme = document.getElementById('darkTheme');

  // Модальные окна
  const noteModal = document.getElementById('noteModal');
  const versionsModal = document.getElementById('versionsModal');
  const colorModal = document.getElementById('colorModal');
  const ruleModal = document.getElementById('ruleModal');
  const auditModal = document.getElementById('auditModal');
  const lockModal = document.getElementById('lockModal');

  let allForms = {};
  let allFolders = {};
  let allRules = {};
  let currentSettings = {};
  let activeFilter = null;
  let currentFormId = null;
  let editingRuleId = null;

  // === ПРОВЕРКА БЛОКИРОВКИ ===
  async function checkLock() {
    const response = await browser.runtime.sendMessage({ action: 'quickUnlock' });
    if (response?.locked) {
      lockModal.classList.add('active');
      lockBtn.style.display = 'block';
    }
  }

  // === ТЁМНАЯ ТЕМА ===
  async function loadTheme() {
    const settings = await browser.runtime.sendMessage({ action: 'getSettings' });
    if (settings.settings?.darkTheme) {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeToggle.textContent = '☀️';
    }
  }

  themeToggle.addEventListener('click', async () => {
    const isDark = document.body.classList.contains('dark-theme');
    document.body.classList.toggle('dark-theme');
    document.body.classList.toggle('light-theme');
    themeToggle.textContent = isDark ? '🌙' : '☀️';
    await browser.runtime.sendMessage({ action: 'updateSettings', settings: { darkTheme: !isDark } });
  });

  // === БЛОКИРОВКА ===
  lockBtn.addEventListener('click', async () => {
    await browser.storage.local.set({ sessionLocked: true });
    lockModal.classList.add('active');
  });

  document.getElementById('unlockBtn').addEventListener('click', async () => {
    const password = document.getElementById('unlockPassword').value;
    const response = await browser.runtime.sendMessage({ action: 'unlockSession', password });
    
    if (response.success) {
      lockModal.classList.remove('active');
      document.getElementById('unlockPassword').value = '';
      document.getElementById('unlockError').textContent = '';
    } else {
      document.getElementById('unlockError').textContent = 'Неверный пароль';
    }
  });

  // === ВКЛАДКИ ===
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
      
      if (btn.dataset.tab === 'dashboard') loadDashboard();
      if (btn.dataset.tab === 'folders') loadFolders();
      if (btn.dataset.tab === 'rules') loadRules();
    });
  });

  // === БЫСТРЫЕ ДЕЙСТВИЯ ===
  document.getElementById('qaSmartFill').addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    await browser.tabs.sendMessage(tab.id, { action: 'smartFill' });
  });

  document.getElementById('qaExport').addEventListener('click', doExport);
  
  document.getElementById('qaAudit').addEventListener('click', async () => {
    const response = await browser.runtime.sendMessage({ action: 'getSecurityAudit' });
    const audit = response.audit || [];
    
    if (audit.length === 0) {
      document.getElementById('auditList').innerHTML = '<div class="empty">Нет записей</div>';
    } else {
      document.getElementById('auditList').innerHTML = audit.map(item => `
        <div class="audit-item">
          <span>${getAuditActionLabel(item.action)}</span>
          <span class="audit-time">${formatDate(item.timestamp)}</span>
        </div>
      `).join('');
    }
    
    auditModal.classList.add('active');
  });

  document.getElementById('qaSettings').addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('[data-tab="settings"]').classList.add('active');
    document.getElementById('settings-tab').classList.add('active');
  });

  function getAuditActionLabel(action) {
    const labels = {
      form_saved: '💾 Форма сохранена',
      form_deleted: '🗑️ Форма удалена',
      form_restored: '🔄 Форма восстановлена',
      version_restored: '📚 Версия восстановлена',
      session_unlocked: '🔓 Сессия разблокирована',
      failed_unlock_attempt: '❌ Неверная попытка',
      master_password_set: '🔐 Мастер-пароль установлен',
      all_forms_cleared: '🗑️ Все формы удалены',
      smart_fill: '🧠 Умное заполнение'
    };
    return labels[action] || action;
  }

  // === ДАШБОРД ===
  async function loadDashboard() {
    const response = await browser.runtime.sendMessage({ action: 'getDashboardData' });
    const dashboard = response.dashboard || {};

    dashTotalForms.textContent = dashboard.totalForms || 0;
    dashTotalFolders.textContent = dashboard.totalFolders || 0;
    dashTotalSaved.textContent = dashboard.totalSaved || 0;
    dashTotalRestored.textContent = dashboard.totalRestored || 0;

    // График активности
    if (dashboard.formsByDay && Object.keys(dashboard.formsByDay).length > 0) {
      const maxVal = Math.max(...Object.values(dashboard.formsByDay), 1);
      activityChart.innerHTML = Object.entries(dashboard.formsByDay).map(([day, count]) => {
        const height = (count / maxVal) * 100;
        return `
          <div class="chart-bar" style="height: ${height}%">
            <span class="chart-value">${count}</span>
            <span class="chart-label">${day}</span>
          </div>
        `;
      }).join('');
    } else {
      activityChart.innerHTML = '<div class="empty">Нет данных</div>';
    }

    // Топ папок
    if (dashboard.folderStats && dashboard.folderStats.length > 0) {
      topFoldersList.innerHTML = dashboard.folderStats.map(f => `
        <div class="folder-stat-item">
          <span>📁 ${f.name}</span>
          <span class="folder-stat-count">${f.count}</span>
        </div>
      `).join('');
    } else {
      topFoldersList.innerHTML = '<div class="empty">Нет папок</div>';
    }

    // Типы полей
    if (dashboard.fieldTypes && Object.keys(dashboard.fieldTypes).length > 0) {
      fieldTypesList.innerHTML = Object.entries(dashboard.fieldTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([type, count]) => `
          <div class="field-type-item">
            <span>${getTypeEmoji(type)} ${type}</span>
            <span class="field-type-count">${count}</span>
          </div>
        `).join('');
    } else {
      fieldTypesList.innerHTML = '<div class="empty">Нет данных</div>';
    }
  }

  function getTypeEmoji(type) {
    const emojis = {
      email: '📧', phone: '📱', name: '👤', address: '🏠',
      city: '🏙️', zip: '📮', card_number: '💳', date: '📅',
      website: '🌐', username: '👤', text: '📝'
    };
    return emojis[type] || emojis.text;
  }

  // === ЗАГРУЗКА ФОРМ ===
  async function loadForms() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getAllForms' });
      allForms = response.forms || {};
      
      renderForms(allForms);
      
      // Заполняем фильтр папок
      const folders = await browser.runtime.sendMessage({ action: 'getFolders' });
      allFolders = folders.folders || {};
      
      folderFilter.innerHTML = '<option value="">Все папки</option>' +
        Object.entries(allFolders).map(([id, f]) => 
          `<option value="${id}">${f.name}</option>`
        ).join('');
      
    } catch (error) {
      console.error('Error loading forms:', error);
      formsList.innerHTML = '<div class="empty">Ошибка загрузки</div>';
    }
  }

  function renderForms(forms, searchFilter = '', tagFilter = null, folderId = null) {
    const formIds = Object.keys(forms);
    if (formIds.length === 0) {
      formsList.innerHTML = '<div class="empty">Нет сохранённых форм</div>';
      return;
    }

    let filteredIds = formIds.filter(id => {
      const form = forms[id];
      const matchSearch = !searchFilter || 
        form.url.toLowerCase().includes(searchFilter.toLowerCase()) ||
        form.title.toLowerCase().includes(searchFilter.toLowerCase());
      const matchTag = !tagFilter || (form.tags && form.tags.includes(tagFilter));
      const matchFolder = !folderId || form.folderId === folderId;
      return matchSearch && matchTag && matchFolder;
    });

    if (filteredIds.length === 0) {
      formsList.innerHTML = '<div class="empty">Ничего не найдено</div>';
      return;
    }

    filteredIds.sort((a, b) => forms[b].timestamp - forms[a].timestamp);

    formsList.innerHTML = filteredIds.map(formId => {
      const form = forms[formId];
      const domain = getDomain(form.url);
      const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      const colorClass = form.colorLabel ? `color-${form.colorLabel}` : '';
      const isFavorite = form.isFavorite ? '⭐' : '';

      return `
        <div class="form-item ${colorClass}" data-form-id="${formId}">
          <div class="form-header">
            <div class="form-site">
              <img src="${favicon}" class="favicon" onerror="this.style.display='none'">
              ${escapeHtml(domain)} ${isFavorite}
            </div>
            <span class="form-date">${formatDate(form.timestamp)}</span>
          </div>
          <div class="form-title">${escapeHtml(form.title)}</div>
          <div class="form-actions">
            <button class="btn btn-primary btn-small btn-restore" data-form-id="${formId}">Восстановить</button>
            <button class="btn btn-icon btn-versions" data-form-id="${formId}">📚</button>
            <button class="btn btn-icon btn-note" data-form-id="${formId}">📝</button>
            <button class="btn btn-icon btn-color" data-form-id="${formId}">🎨</button>
            <button class="btn btn-danger btn-small btn-delete" data-form-id="${formId}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    attachFormEventListeners();
  }

  function attachFormEventListeners() {
    document.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const formId = e.target.dataset.formId;
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        await browser.tabs.sendMessage(tab.id, {
          action: 'restoreForm',
          formId,
          data: allForms[formId]
        });
      });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('Удалить?')) return;
        await browser.runtime.sendMessage({ action: 'deleteForm', formId: e.target.dataset.formId });
        delete allForms[e.target.dataset.formId];
        loadForms();
      });
    });

    document.querySelectorAll('.btn-versions').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const formId = e.target.dataset.formId;
        const response = await browser.runtime.sendMessage({ action: 'getFormVersions', formId });
        const versions = response.versions || [];
        
        document.getElementById('versionsList').innerHTML = versions.map((v, i) => `
          <div class="version-item">
            <span>Версия ${v.versionNumber || i + 1}</span>
            <button class="btn btn-small btn-restore-version" data-index="${i}">Восстановить</button>
          </div>
        `).join('');
        
        versionsModal.classList.add('active');
        
        document.querySelectorAll('.btn-restore-version').forEach(b => {
          b.addEventListener('click', async (ev) => {
            await browser.runtime.sendMessage({ 
              action: 'restoreVersion', 
              formId, 
              versionIndex: parseInt(ev.target.dataset.index) 
            });
            versionsModal.classList.remove('active');
            loadForms();
          });
        });
      });
    });

    document.querySelectorAll('.btn-note').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        currentFormId = e.target.dataset.formId;
        const response = await browser.runtime.sendMessage({ action: 'getFormNote', formId: currentFormId });
        document.getElementById('noteText').value = response.note || '';
        noteModal.classList.add('active');
      });
    });

    document.querySelectorAll('.btn-color').forEach(btn => {
      btn.addEventListener('click', () => {
        colorModal.classList.add('active');
      });
    });
  }

  // === ПАПКИ ===
  async function loadFolders() {
    const response = await browser.runtime.sendMessage({ action: 'getFolders' });
    allFolders = response.folders || {};
    
    foldersList.innerHTML = Object.entries(allFolders).map(([id, f]) => `
      <div class="folder-item">
        <span class="folder-name">📁 ${f.name}</span>
        <span class="folder-count">${f.formIds?.length || 0} форм</span>
        <button class="btn btn-danger btn-small btn-delete-folder" data-folder-id="${id}">✕</button>
      </div>
    `).join('');

    foldersList.querySelectorAll('.btn-delete-folder').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('Удалить папку?')) return;
        await browser.runtime.sendMessage({ action: 'deleteFolder', folderId: e.target.dataset.folderId });
        loadFolders();
      });
    });
  }

  createFolderBtn.addEventListener('click', async () => {
    const name = newFolderName.value.trim();
    if (!name) return;
    
    await browser.runtime.sendMessage({ action: 'saveFolder', folder: { name } });
    newFolderName.value = '';
    loadFolders();
  });

  // === ПРАВИЛА ===
  async function loadRules() {
    const response = await browser.runtime.sendMessage({ action: 'getRules' });
    allRules = response.rules || {};
    
    rulesList.innerHTML = Object.entries(allRules).map(([id, r]) => `
      <div class="rule-item">
        <span class="rule-name">${r.name}</span>
        <span class="rule-url">${r.urlPattern || '*'}</span>
        <span class="rule-status">${r.enabled ? '✅' : '❌'}</span>
        <button class="btn btn-small btn-edit-rule" data-rule-id="${id}">✏️</button>
        <button class="btn btn-danger btn-small btn-delete-rule" data-rule-id="${id}">✕</button>
      </div>
    `).join('');

    rulesList.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        await browser.runtime.sendMessage({ action: 'deleteRule', ruleId: e.target.dataset.ruleId });
        loadRules();
      });
    });
  }

  createRuleBtn.addEventListener('click', () => {
    editingRuleId = null;
    document.getElementById('ruleName').value = '';
    document.getElementById('ruleUrl').value = '';
    document.getElementById('ruleFormId').value = '';
    document.getElementById('ruleEnabled').checked = true;
    ruleModal.classList.add('active');
  });

  // === НАСТРОЙКИ ===
  async function loadSettings() {
    const response = await browser.runtime.sendMessage({ action: 'getSettings' });
    currentSettings = response.settings;

    masterPasswordEnabled.checked = currentSettings.masterPasswordEnabled;
    enableEncryption.checked = currentSettings.enableEncryption;
    enableNotifications.checked = currentSettings.enableNotifications;
    enableSync.checked = currentSettings.enableSync;
    autoCleanup.checked = currentSettings.autoCleanup;
    enableClickFill.checked = currentSettings.enableClickFill;
    enableSmartFields.checked = currentSettings.enableSmartFields;
    darkTheme.checked = currentSettings.darkTheme;

    document.getElementById('masterPasswordBox').style.display = 
      currentSettings.masterPasswordEnabled ? 'flex' : 'none';
    document.getElementById('encryptionPasswordBox').style.display = 
      currentSettings.enableEncryption ? 'flex' : 'none';
  }

  masterPasswordEnabled.addEventListener('change', () => {
    document.getElementById('masterPasswordBox').style.display = 
      masterPasswordEnabled.checked ? 'flex' : 'none';
  });

  enableEncryption.addEventListener('change', () => {
    document.getElementById('encryptionPasswordBox').style.display = 
      enableEncryption.checked ? 'flex' : 'none';
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      masterPasswordEnabled: masterPasswordEnabled.checked,
      masterPassword: masterPassword.value,
      enableEncryption: enableEncryption.checked,
      encryptionPassword: encryptionPassword.value,
      enableNotifications: enableNotifications.checked,
      enableSync: enableSync.checked,
      autoCleanup: autoCleanup.checked,
      enableClickFill: enableClickFill.checked,
      enableSmartFields: enableSmartFields.checked,
      darkTheme: darkTheme.checked
    };

    await browser.runtime.sendMessage({ action: 'updateSettings', settings: newSettings });
    alert('Настройки сохранены!');
  });

  // === ЭКСПОРТ/ИМПОРТ ===
  async function doExport() {
    const response = await browser.runtime.sendMessage({ action: 'exportData' });
    const dataStr = JSON.stringify(response.data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-saver-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Удалить ВСЕ формы?')) return;
    await browser.runtime.sendMessage({ action: 'clearAllForms' });
    loadForms();
  });

  exportBtn.addEventListener('click', doExport);

  importFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await browser.runtime.sendMessage({ action: 'importData', data });
      alert('Импортировано!');
      loadForms();
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
    e.target.value = '';
  });

  // === ВСПОМОГАТЕЛЬНЫЕ ===
  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return url; }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин.`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч.`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  // === МОДАЛЬНЫЕ ОКНА ===
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    });
  });

  document.getElementById('saveNote').addEventListener('click', async () => {
    await browser.runtime.sendMessage({ 
      action: 'saveFormNote', 
      formId: currentFormId, 
      note: document.getElementById('noteText').value 
    });
    noteModal.classList.remove('active');
  });

  // === ИНИЦИАЛИЗАЦИЯ ===
  checkLock();
  loadTheme();
  loadDashboard();
  loadForms();
  loadSettings();
});
