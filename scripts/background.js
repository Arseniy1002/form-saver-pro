// Form Saver Pro v5.0 - Background Script
// Поиск, дубликаты, CSV экспорт, темы, напоминания

const CONFIG = {
  AUTO_CLEANUP_INTERVAL: 24 * 60 * 60 * 1000,
  MAX_AGE_DAYS: 30,
  MAX_VERSIONS_PER_FORM: 10,
  MAX_HISTORY_ITEMS: 100,
  MAX_FIELD_VALUES: 50,
  SESSION_TIMEOUT: 30 * 60 * 1000
};

// === ИНИЦИАЛИЗАЦИЯ ===
browser.runtime.onInstalled.addListener(async (details) => {
  console.log('Form Saver Pro v5 installed:', details.reason);
  
  const result = await browser.storage.local.get(null);
  
  if (!result.savedForms) await browser.storage.local.set({ savedForms: {} });
  if (!result.formVersions) await browser.storage.local.set({ formVersions: {} });
  if (!result.formNotes) await browser.storage.local.set({ formNotes: {} });
  if (!result.favorites) await browser.storage.local.set({ favorites: {} });
  if (!result.colorLabels) await browser.storage.local.set({ colorLabels: {} });
  if (!result.changeHistory) await browser.storage.local.set({ changeHistory: [] });
  if (!result.fieldValues) await browser.storage.local.set({ fieldValues: {} });
  if (!result.folders) await browser.storage.local.set({ folders: {} });
  if (!result.rules) await browser.storage.local.set({ rules: {} });
  if (!result.smartFields) await browser.storage.local.set({ smartFields: {} });
  if (!result.securityAudit) await browser.storage.local.set({ securityAudit: [] });
  if (!result.dashboardData) await browser.storage.local.set({ dashboardData: {} });
  if (!result.reminders) await browser.storage.local.set({ reminders: {} });
  if (!result.customThemes) await browser.storage.local.set({ customThemes: {} });
  
  if (!result.settings) {
    await browser.storage.local.set({
      settings: {
        enableNotifications: true,
        enableSync: false,
        enableEncryption: false,
        encryptionPassword: '',
        masterPassword: '',
        masterPasswordEnabled: false,
        autoSaveDelay: 500,
        autoCleanup: true,
        maxForms: 100,
        darkTheme: false,
        enableClickFill: true,
        maxFieldValues: 50,
        enableSmartFields: true,
        enableRules: true,
        sessionTimeout: 30,
        language: 'ru',
        customColors: {}
      }
    });
  }
  
  if (!result.statistics) {
    await browser.storage.local.set({
      statistics: {
        totalSaved: 0,
        totalRestored: 0,
        totalDeleted: 0,
        lastSaveDate: null,
        lastRestoreDate: null,
        mostUsedSites: {},
        timeSpentOnForms: 0,
        formsByDay: {},
        fieldTypes: {},
        duplicatesFound: 0,
        duplicatesRemoved: 0
      }
    });
  }
  
  if (!result.tags) await browser.storage.local.set({ tags: {} });
  if (!result.lastActivity) await browser.storage.local.set({ lastActivity: Date.now() });

  await createContextMenus();
  setupAlarms();
  
  // Показывем уведомление об обновлении
  if (details.reason === 'update') {
    await showNotification('Form Saver Pro обновлён до v5.0! 🎉', 'success');
  }
});

// === СИГНАЛЫ ===
function setupAlarms() {
  browser.alarms.create('cleanup', { periodInMinutes: 1440 });
  browser.alarms.create('sessionCheck', { periodInMinutes: 5 });
  browser.alarms.create('reminders', { periodInMinutes: 60 });
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'cleanup') await cleanupOldForms();
  else if (alarm.name === 'sessionCheck') await checkSessionTimeout();
  else if (alarm.name === 'reminders') await checkReminders();
});

// === НАПОМИНАНИЯ ===
async function checkReminders() {
  const settings = await getSettings();
  if (!settings.enableNotifications) return;
  
  const reminders = await browser.storage.local.get('reminders');
  const now = Date.now();
  
  for (const [id, reminder] of Object.entries(reminders.reminders || {})) {
    if (reminder.enabled && reminder.time <= now) {
      await showNotification(`📝 Напоминание: ${reminder.title}`, 'info');
      
      if (reminder.repeat === 'once') {
        delete reminders.reminders[id];
        await browser.storage.local.set({ reminders: reminders.reminders });
      } else if (reminder.repeat === 'daily') {
        reminder.time += 24 * 60 * 60 * 1000;
        await browser.storage.local.set({ reminders });
      }
    }
  }
}

// === ПРОВЕРКА СЕССИИ ===
async function checkSessionTimeout() {
  const settings = await getSettings();
  if (!settings.masterPasswordEnabled) return;
  
  const now = Date.now();
  const lastActivity = await getLastActivity();
  
  if (now - lastActivity > settings.sessionTimeout * 60 * 1000) {
    await browser.storage.local.set({ sessionLocked: true });
  }
}

async function updateLastActivity() {
  await browser.storage.local.set({ lastActivity: Date.now() });
}

async function getLastActivity() {
  const result = await browser.storage.local.get('lastActivity');
  return result.lastActivity || Date.now();
}

// === КОНТЕКСТНОЕ МЕНЮ ===
async function createContextMenus() {
  await browser.contextMenus.removeAll().catch(() => {});
  
  browser.contextMenus.create({ id: 'form-saver-save', title: '💾 Сохранить форму', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-restore', title: '🔄 Восстановить', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-smart-fill', title: '🧠 Умное заполнение', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-find-duplicates', title: '🔍 Найти дубликаты', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-favorite', title: '⭐ В избранное', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-separator', type: 'separator', contexts: ['editable'] });
  browser.contextMenus.create({ id: 'form-saver-manage', title: '📋 Управление', contexts: ['editable'] });
}

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case 'form-saver-save':
      await browser.tabs.sendMessage(tab.id, { action: 'saveCurrentForm' });
      break;
    case 'form-saver-restore':
      await restoreLastForm(tab);
      break;
    case 'form-saver-smart-fill':
      await smartFillTab(tab);
      break;
    case 'form-saver-find-duplicates':
      await findDuplicatesTab(tab);
      break;
    case 'form-saver-favorite':
      await toggleFavoriteForTab(tab);
      break;
    case 'form-saver-manage':
      browser.action.openPopup();
      break;
  }
});

async function findDuplicatesTab(tab) {
  try {
    const duplicates = await findDuplicateForms();
    await browser.tabs.sendMessage(tab.id, {
      action: 'showDuplicates',
      duplicates
    });
  } catch (error) {
    await showNotification('Ошибка поиска дубликатов', 'error');
  }
}

// === ГОРЯЧИЕ КЛАВИШИ ===
browser.commands.onCommand.addListener(async (command) => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  
  switch (command) {
    case 'restore-last-form': await restoreLastForm(tab); break;
    case 'save-current-form': await browser.tabs.sendMessage(tab.id, { action: 'saveCurrentForm' }); break;
    case 'quick-fill': await smartFillTab(tab); break;
    case '_execute_action': browser.action.openPopup(); break;
  }
});

async function restoreLastForm(tab) {
  if (await isSessionLocked()) return;
  
  try {
    const result = await browser.storage.local.get('savedForms');
    const savedForms = result.savedForms || {};
    const formIds = Object.keys(savedForms);
    
    if (formIds.length === 0) {
      await showNotification('Нет сохранённых форм', 'info');
      return;
    }
    
    formIds.sort((a, b) => savedForms[b].timestamp - savedForms[a].timestamp);
    const lastForm = savedForms[formIds[0]];
    
    await browser.tabs.sendMessage(tab.id, { action: 'restoreForm', formId: formIds[0], data: lastForm });
    await updateStatistics('restored', lastForm.url);
    await addToSecurityAudit('form_restored', formIds[0]);
  } catch (error) {
    await showNotification('Не удалось восстановить форму', 'error');
  }
}

async function smartFillTab(tab) {
  if (await isSessionLocked()) return;
  
  try {
    const smartFields = await browser.storage.local.get('smartFields');
    await browser.tabs.sendMessage(tab.id, { action: 'smartFill', smartFields: smartFields.smartFields || {} });
    await addToSecurityAudit('smart_fill', tab.url);
  } catch (error) {
    await showNotification('Не удалось заполнить форму', 'error');
  }
}

async function toggleFavoriteForTab(tab) {
  if (await isSessionLocked()) return;
  
  const favorites = await getFavorites();
  const url = tab.url;
  
  if (favorites[url]) {
    delete favorites[url];
    await showNotification('Удалено из избранного', 'info');
  } else {
    favorites[url] = { url, title: tab.title, timestamp: Date.now() };
    await showNotification('Добавлено в избранное', 'success');
  }
  
  await browser.storage.local.set({ favorites });
  await updateLastActivity();
}

async function isSessionLocked() {
  const settings = await getSettings();
  if (!settings.masterPasswordEnabled) return false;
  const result = await browser.storage.local.get('sessionLocked');
  return result.sessionLocked === true;
}

// === ШИФРОВАНИЕ ===
const Crypto = {
  async generateKey(password) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    const keyData = await crypto.subtle.exportKey('raw', key);
    return { key, salt: Array.from(salt), keyData: Array.from(keyData) };
  },
  
  async encrypt(data, password) {
    const { key, salt } = await this.generateKey(password);
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data)));
    return { salt, iv: Array.from(iv), data: Array.from(new Uint8Array(encrypted)) };
  },
  
  async decrypt(encryptedData, password) {
    const encoder = new TextEncoder();
    const { salt, iv, data } = encryptedData;
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(data));
    return JSON.parse(new TextDecoder().decode(decrypted));
  },
  
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(password));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

// === V5.0: ПОИСК ДУБЛИКАТОВ ===
async function findDuplicateForms() {
  const savedForms = await getSavedForms();
  const duplicates = [];
  const processed = new Map();
  
  for (const [formId, form] of Object.entries(savedForms)) {
    const signature = JSON.stringify({
      url: form.url,
      fieldKeys: Object.keys(form.fields || {}).sort()
    });
    
    if (processed.has(signature)) {
      duplicates.push({
        id1: processed.get(signature),
        id2: formId,
        form1: savedForms[processed.get(formId)],
        form2: form,
        similarity: calculateSimilarity(savedForms[processed.get(signature)], form)
      });
    } else {
      processed.set(signature, formId);
    }
  }
  
  return duplicates;
}

function calculateSimilarity(form1, form2) {
  const fields1 = form1.fields || {};
  const fields2 = form2.fields || {};
  const allKeys = new Set([...Object.keys(fields1), ...Object.keys(fields2)]);
  
  let matches = 0;
  for (const key of allKeys) {
    if (fields1[key] === fields2[key]) matches++;
  }
  
  return Math.round((matches / allKeys.size) * 100);
}

async function removeDuplicateForm(formId) {
  await handleDeleteForm(formId);
  const stats = await getStatistics();
  stats.duplicatesRemoved = (stats.duplicatesRemoved || 0) + 1;
  await browser.storage.local.set({ statistics: stats });
}

// === V5.0: ЭКСПОРТ CSV ===
async function exportToCSV() {
  const savedForms = await getSavedForms();
  const allFieldNames = new Set();
  
  // Собираем все имена полей
  Object.values(savedForms).forEach(form => {
    Object.keys(form.fields || {}).forEach(key => allFieldNames.add(key));
  });
  
  const headers = ['ID', 'URL', 'Title', 'Timestamp', ...Array.from(allFieldNames)];
  const rows = [headers.join(',')];
  
  Object.entries(savedForms).forEach(([id, form]) => {
    const row = [
      id,
      `"${form.url}"`,
      `"${form.title.replace(/"/g, '""')}"`,
      new Date(form.timestamp).toISOString(),
      ...Array.from(allFieldNames).map(key => {
        const value = form.fields?.[key] ?? '';
        return `"${String(value).replace(/"/g, '""')}"`;
      })
    ];
    rows.push(row.join(','));
  });
  
  return rows.join('\n');
}

// === V5.0: КАСТОМНЫЕ ТЕМЫ ===
async function getCustomThemes() {
  const result = await browser.storage.local.get('customThemes');
  return result.customThemes || {};
}

async function saveCustomTheme(theme) {
  const themes = await getCustomThemes();
  const id = theme.id || 'theme_' + Date.now();
  themes[id] = { ...theme, id, createdAt: Date.now() };
  await browser.storage.local.set({ customThemes: themes });
}

async function deleteCustomTheme(themeId) {
  const themes = await getCustomThemes();
  delete themes[themeId];
  await browser.storage.local.set({ customThemes: themes });
}

// === ОБРАБОТКА СООБЩЕНИЙ ===
browser.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  try {
    if (await isSessionLocked() && message.action !== 'unlockSession') {
      sendResponse({ error: 'Session locked', locked: true });
      return true;
    }
    
    switch (message.action) {
      case 'saveForm': await handleSaveForm(message.formId, message.data); sendResponse({ success: true }); break;
      case 'getFormData': sendResponse({ data: await handleGetFormData(message.formId) }); break;
      case 'getAllForms': sendResponse({ forms: await handleGetAllForms() }); break;
      case 'deleteForm': await handleDeleteForm(message.formId); sendResponse({ success: true }); break;
      case 'clearAllForms': await handleClearAllForms(); sendResponse({ success: true }); break;
      case 'exportData': sendResponse({ data: await handleExportData() }); break;
      case 'exportCSV': sendResponse({ csv: await exportToCSV() }); break;
      case 'importData': await handleImportData(message.data); sendResponse({ success: true }); break;
      case 'getStatistics': sendResponse({ statistics: await getStatistics() }); break;
      case 'getSettings': sendResponse({ settings: await getSettings() }); break;
      case 'updateSettings': await handleUpdateSettings(message.settings); sendResponse({ success: true }); break;
      case 'addTag': await handleAddTag(message.formId, message.tag); sendResponse({ success: true }); break;
      case 'removeTag': await handleRemoveTag(message.formId, message.tag); sendResponse({ success: true }); break;
      case 'getTags': sendResponse({ tags: await getTags() }); break;
      case 'decryptData': sendResponse({ data: await Crypto.decrypt(message.encryptedData, message.password) }); break;
      case 'encryptData': sendResponse({ data: await Crypto.encrypt(message.data, message.password) }); break;
      
      // v3.0
      case 'getFormVersions': sendResponse({ versions: await getFormVersions(message.formId) }); break;
      case 'restoreVersion': await handleRestoreVersion(message.formId, message.versionIndex); sendResponse({ success: true }); break;
      case 'getFormNote': sendResponse({ note: await getFormNote(message.formId) }); break;
      case 'saveFormNote': await handleSaveFormNote(message.formId, message.note); sendResponse({ success: true }); break;
      case 'toggleFavorite': await handleToggleFavorite(message.formId, message.data); sendResponse({ success: true }); break;
      case 'getFavorites': sendResponse({ favorites: await getFavorites() }); break;
      case 'setColorLabel': await handleSetColorLabel(message.formId, message.color); sendResponse({ success: true }); break;
      case 'getColorLabels': sendResponse({ labels: await getColorLabels() }); break;
      case 'getChangeHistory': sendResponse({ history: await getChangeHistory() }); break;
      case 'saveFieldValue': await handleSaveFieldValue(message.fieldName, message.value); sendResponse({ success: true }); break;
      case 'getFieldValues': sendResponse({ values: await getFieldValues(message.fieldName) }); break;
      case 'getTemplates': sendResponse({ templates: await getTemplates() }); break;
      case 'saveTemplate': await handleSaveTemplate(message.template); sendResponse({ success: true }); break;
      case 'deleteTemplate': await handleDeleteTemplate(message.templateId); sendResponse({ success: true }); break;
      
      // v4.0
      case 'unlockSession': sendResponse({ success: await handleUnlockSession(message.password) }); break;
      case 'detectFieldType': sendResponse({ type: detectFieldType(message.fieldName, message.fieldLabel) }); break;
      case 'getSmartFields': sendResponse({ smartFields: await getSmartFields() }); break;
      case 'saveSmartField': await handleSaveSmartField(message.fieldName, message.type, message.value); sendResponse({ success: true }); break;
      case 'getFolders': sendResponse({ folders: await getFolders() }); break;
      case 'saveFolder': await handleSaveFolder(message.folder); sendResponse({ success: true }); break;
      case 'deleteFolder': await handleDeleteFolder(message.folderId); sendResponse({ success: true }); break;
      case 'moveFormToFolder': await handleMoveFormToFolder(message.formId, message.folderId); sendResponse({ success: true }); break;
      case 'getRules': sendResponse({ rules: await getRules() }); break;
      case 'saveRule': await handleSaveRule(message.rule); sendResponse({ success: true }); break;
      case 'deleteRule': await handleDeleteRule(message.ruleId); sendResponse({ success: true }); break;
      case 'getDashboardData': sendResponse({ dashboard: await getDashboardData() }); break;
      case 'getSecurityAudit': sendResponse({ audit: await getSecurityAudit() }); break;
      case 'compareVersions': sendResponse({ comparison: await compareVersions(message.formId, message.v1, message.v2) }); break;
      case 'quickUnlock': sendResponse({ locked: await isSessionLocked() }); break;
      
      // v5.0
      case 'findDuplicates': sendResponse({ duplicates: await findDuplicateForms() }); break;
      case 'removeDuplicate': await removeDuplicateForm(message.formId); sendResponse({ success: true }); break;
      case 'searchForms': sendResponse({ results: await searchForms(message.query) }); break;
      case 'getCustomThemes': sendResponse({ themes: await getCustomThemes() }); break;
      case 'saveCustomTheme': await saveCustomTheme(message.theme); sendResponse({ success: true }); break;
      case 'deleteCustomTheme': await deleteCustomTheme(message.themeId); sendResponse({ success: true }); break;
      case 'saveReminder': await handleSaveReminder(message.reminder); sendResponse({ success: true }); break;
      case 'deleteReminder': await handleDeleteReminder(message.reminderId); sendResponse({ success: true }); break;
      case 'getReminders': sendResponse({ reminders: await getReminders() }); break;
      case 'createScreenshot': sendResponse({ screenshot: await createFormScreenshot(message.formId) }); break;
      
      default: sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  return true;
});

// === V5.0: ПОИСК ПО ФОРМАМ ===
async function searchForms(query) {
  if (!query || query.trim().length === 0) return [];
  
  const savedForms = await getSavedForms();
  const queryLower = query.toLowerCase();
  const results = [];
  
  for (const [formId, form] of Object.entries(savedForms)) {
    let score = 0;
    const matches = [];
    
    // Поиск по URL
    if (form.url.toLowerCase().includes(queryLower)) {
      score += 10;
      matches.push('URL');
    }
    
    // Поиск по названию
    if (form.title.toLowerCase().includes(queryLower)) {
      score += 15;
      matches.push('Название');
    }
    
    // Поиск по полям
    for (const [key, value] of Object.entries(form.fields || {})) {
      const valueStr = String(value).toLowerCase();
      if (valueStr.includes(queryLower)) {
        score += 5;
        matches.push(`Поле: ${key}`);
      }
    }
    
    // Поиск по заметкам
    const notes = await getFormNote(formId);
    if (notes && notes.toLowerCase().includes(queryLower)) {
      score += 8;
      matches.push('Заметка');
    }
    
    if (score > 0) {
      results.push({ formId, form, score, matches });
    }
  }
  
  return results.sort((a, b) => b.score - a.score);
}

// === V5.0: СКРИНШОТ ФОРМЫ ===
async function createFormScreenshot(formId) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  try {
    const screenshot = await browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 80 });
    // Сохраняем скриншот
    const screenshots = await browser.storage.local.get('formScreenshots');
    screenshots.formScreenshots = screenshots.formScreenshots || {};
    screenshots.formScreenshots[formId] = {
      data: screenshot,
      timestamp: Date.now()
    };
    await browser.storage.local.set({ screenshots });
    return screenshot;
  } catch (error) {
    console.error('Screenshot error:', error);
    return null;
  }
}

// === V5.0: НАПОМИНАНИЯ ===
async function handleSaveReminder(reminder) {
  const reminders = await browser.storage.local.get('reminders');
  const id = reminder.id || 'reminder_' + Date.now();
  reminders.reminders = reminders.reminders || {};
  reminders.reminders[id] = { ...reminder, id, createdAt: Date.now() };
  await browser.storage.local.set({ reminders });
}

async function handleDeleteReminder(reminderId) {
  const reminders = await browser.storage.local.get('reminders');
  if (reminders.reminders) {
    delete reminders.reminders[reminderId];
    await browser.storage.local.set({ reminders });
  }
}

async function getReminders() {
  const result = await browser.storage.local.get('reminders');
  return result.reminders || {};
}

// === ОБРАБОТЧИКИ ===
async function handleSaveForm(formId, data) {
  const settings = await getSettings();
  let savedForms = await getSavedForms();
  
  if (settings.enableSmartFields) {
    for (const [fieldName, value] of Object.entries(data.fields)) {
      const type = detectFieldType(fieldName);
      if (type !== 'text' && value) await handleSaveSmartField(fieldName, type, value);
    }
  }
  
  if (settings.enableEncryption && settings.encryptionPassword) {
    data.encrypted = true;
    data.fields = await Crypto.encrypt(data.fields, settings.encryptionPassword);
  }
  
  if (savedForms[formId]) await saveFormVersion(formId, savedForms[formId]);
  
  savedForms[formId] = { ...data, version: (savedForms[formId]?.version || 0) + 1 };
  
  const formIds = Object.keys(savedForms);
  if (formIds.length > settings.maxForms) {
    formIds.sort((a, b) => savedForms[a].timestamp - savedForms[b].timestamp);
    delete savedForms[formIds[0]];
  }
  
  await browser.storage.local.set({ savedForms });
  if (settings.enableSync) await browser.storage.sync.set({ savedForms }).catch(() => {});
  
  await updateStatistics('saved', data.url);
  await addToChangeHistory('saved', formId, data);
  await addToSecurityAudit('form_saved', formId);
  await updateLastActivity();
  
  if (settings.enableNotifications) await showNotification('Форма сохранена', 'success');
}

async function handleGetFormData(formId) {
  const settings = await getSettings();
  const savedForms = await getSavedForms();
  let data = savedForms[formId];
  if (!data) return null;
  if (data.encrypted && settings.encryptionPassword) {
    data.fields = await Crypto.decrypt(data.fields, settings.encryptionPassword);
  }
  return data;
}

async function handleGetAllForms() {
  const settings = await getSettings();
  const savedForms = await getSavedForms();
  const tags = await getTags();
  const favorites = await getFavorites();
  const colorLabels = await getColorLabels();
  const notes = await browser.storage.local.get('formNotes');
  const folders = await getFolders();
  const screenshots = await browser.storage.local.get('formScreenshots');
  
  const formFolders = {};
  for (const [folderId, folder] of Object.entries(folders)) {
    for (const formId of folder.formIds) formFolders[formId] = folderId;
  }
  
  for (const formId in savedForms) {
    if (savedForms[formId].encrypted && settings.encryptionPassword) {
      savedForms[formId].fields = await Crypto.decrypt(savedForms[formId].fields, settings.encryptionPassword);
    }
    savedForms[formId].tags = tags[formId] || [];
    savedForms[formId].isFavorite = !!favorites[savedForms[formId].url];
    savedForms[formId].colorLabel = colorLabels[formId] || null;
    savedForms[formId].note = notes.formNotes?.[formId] || '';
    savedForms[formId].folderId = formFolders[formId] || null;
    savedForms[formId].hasScreenshot = !!screenshots.formScreenshots?.[formId];
  }
  
  return savedForms;
}

async function handleDeleteForm(formId) {
  const savedForms = await getSavedForms();
  delete savedForms[formId];
  await browser.storage.local.set({ savedForms });
  
  const tags = await getTags();
  delete tags[formId];
  await browser.storage.local.set({ tags });
  
  await updateStatistics('deleted');
  await addToChangeHistory('deleted', formId);
  await addToSecurityAudit('form_deleted', formId);
}

async function handleClearAllForms() {
  await browser.storage.local.set({ savedForms: {}, tags: {}, formNotes: {}, favorites: {}, colorLabels: {}, formVersions: {}, changeHistory: [] });
  await updateStatistics('cleared');
  await addToSecurityAudit('all_forms_cleared');
}

async function handleExportData() {
  const savedForms = await getSavedForms();
  const tags = await getTags();
  const statistics = await getStatistics();
  const templates = await getTemplates();
  const fieldValues = await browser.storage.local.get('fieldValues');
  const folders = await getFolders();
  const rules = await getRules();
  const smartFields = await getSmartFields();
  
  return { version: 5, exportDate: Date.now(), forms: savedForms, tags, statistics, templates, fieldValues: fieldValues.fieldValues || {}, folders, rules, smartFields };
}

async function handleImportData(data) {
  if (!data.version || !data.forms) throw new Error('Неверный формат');
  const currentForms = await getSavedForms();
  await browser.storage.local.set({ savedForms: { ...currentForms, ...data.forms } });
  if (data.tags) {
    const currentTags = await getTags();
    await browser.storage.local.set({ tags: { ...currentTags, ...data.tags } });
  }
  if (data.folders) {
    const currentFolders = await getFolders();
    await browser.storage.local.set({ folders: { ...currentFolders, ...data.folders } });
  }
  if (data.smartFields) {
    const currentSmartFields = await getSmartFields();
    await browser.storage.local.set({ smartFields: { ...currentSmartFields, ...data.smartFields } });
  }
}

async function handleUpdateSettings(newSettings) {
  const currentSettings = await getSettings();
  if (newSettings.masterPassword) {
    newSettings.masterPassword = await Crypto.hashPassword(newSettings.masterPassword);
    newSettings.masterPasswordEnabled = true;
    await browser.storage.local.set({ sessionLocked: false });
    await addToSecurityAudit('master_password_set');
  }
  await browser.storage.local.set({ settings: { ...currentSettings, ...newSettings } });
  await createContextMenus();
}

async function handleAddTag(formId, tag) {
  const tags = await getTags();
  if (!tags[formId]) tags[formId] = [];
  if (!tags[formId].includes(tag)) {
    tags[formId].push(tag);
    await browser.storage.local.set({ tags });
    await addToChangeHistory('tag_added', formId, { tag });
  }
}

async function handleRemoveTag(formId, tag) {
  const tags = await getTags();
  if (tags[formId]) {
    tags[formId] = tags[formId].filter(t => t !== tag);
    await browser.storage.local.set({ tags });
  }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
async function getSavedForms() { const r = await browser.storage.local.get('savedForms'); return r.savedForms || {}; }
async function getSettings() { const r = await browser.storage.local.get('settings'); return r.settings || {}; }
async function getTags() { const r = await browser.storage.local.get('tags'); return r.tags || {}; }
async function getFavorites() { const r = await browser.storage.local.get('favorites'); return r.favorites || {}; }
async function getColorLabels() { const r = await browser.storage.local.get('colorLabels'); return r.colorLabels || {}; }
async function getStatistics() { const r = await browser.storage.local.get('statistics'); return r.statistics || {}; }
async function getTemplates() { const r = await browser.storage.local.get('templates'); return r.templates || {}; }
async function getChangeHistory() { const r = await browser.storage.local.get('changeHistory'); return r.changeHistory || []; }
async function getFormVersions(formId) { const r = await browser.storage.local.get('formVersions'); return r.formVersions?.[formId] || []; }
async function getFormNote(formId) { const r = await browser.storage.local.get('formNotes'); return r.formNotes?.[formId] || ''; }
async function getFieldValues(fieldName) { const r = await browser.storage.local.get('fieldValues'); return r.fieldValues?.[fieldName] || []; }
async function getSmartFields() { const r = await browser.storage.local.get('smartFields'); return r.smartFields || {}; }
async function getFolders() { const r = await browser.storage.local.get('folders'); return r.folders || {}; }
async function getRules() { const r = await browser.storage.local.get('rules'); return r.rules || {}; }
async function getSecurityAudit() { const r = await browser.storage.local.get('securityAudit'); return r.securityAudit || []; }

async function updateStatistics(action, url = null) {
  const stats = await getStatistics();
  switch (action) {
    case 'saved': stats.totalSaved++; stats.lastSaveDate = Date.now();
      if (url) { try { const d = new URL(url).hostname; stats.mostUsedSites[d] = (stats.mostUsedSites[d] || 0) + 1; } catch {} }
      break;
    case 'restored': stats.totalRestored++; stats.lastRestoreDate = Date.now(); break;
    case 'deleted': stats.totalDeleted++; break;
    case 'cleared': stats.totalDeleted += Object.keys(await getSavedForms()).length; break;
  }
  await browser.storage.local.set({ statistics: stats });
}

async function showNotification(message, type = 'info') {
  await browser.notifications.create({ type: 'basic', iconUrl: browser.runtime.getURL('icons/icon-48.png'), title: 'Form Saver Pro', message });
}

async function cleanupOldForms() {
  try {
    const settings = await getSettings();
    if (!settings.autoCleanup) return;
    const savedForms = await getSavedForms();
    const now = Date.now();
    const maxAge = (settings.maxAgeDays || 30) * 24 * 60 * 60 * 1000;
    let cleaned = false;
    Object.keys(savedForms).forEach(formId => {
      if (now - savedForms[formId].timestamp > maxAge) { delete savedForms[formId]; cleaned = true; }
    });
    if (cleaned) await browser.storage.local.set({ savedForms });
  } catch (error) { console.error('Cleanup error:', error); }
}

async function saveFormVersion(formId, formData) {
  const versions = await getFormVersions(formId);
  versions.push({ ...formData, savedAt: Date.now(), versionNumber: versions.length + 1 });
  if (versions.length > CONFIG.MAX_VERSIONS_PER_FORM) versions.shift();
  await browser.storage.local.set({ formVersions: { [formId]: versions } });
}

async function handleRestoreVersion(formId, versionIndex) {
  const versions = await getFormVersions(formId);
  const version = versions[versionIndex];
  if (!version) return;
  const savedForms = await getSavedForms();
  savedForms[formId] = { ...version, timestamp: Date.now() };
  await browser.storage.local.set({ savedForms });
  await addToChangeHistory('version_restored', formId, { versionIndex });
  await addToSecurityAudit('version_restored', formId);
}

async function handleSaveFormNote(formId, note) {
  const r = await browser.storage.local.get('formNotes');
  const notes = r.formNotes || {};
  notes[formId] = note;
  await browser.storage.local.set({ formNotes: notes });
  await addToChangeHistory('note_updated', formId);
}

async function handleToggleFavorite(formId, formData) {
  const favorites = await getFavorites();
  const url = formData?.url;
  if (!url) return;
  if (favorites[url]) delete favorites[url]; else favorites[url] = { url, title: formData.title, timestamp: Date.now() };
  await browser.storage.local.set({ favorites });
}

async function handleSetColorLabel(formId, color) {
  const labels = await getColorLabels();
  if (!color) delete labels[formId]; else labels[formId] = color;
  await browser.storage.local.set({ colorLabels: labels });
  await addToChangeHistory('color_changed', formId, { color });
}

async function handleSaveFieldValue(fieldName, value) {
  const r = await browser.storage.local.get('fieldValues');
  const fv = r.fieldValues || {};
  if (!fv[fieldName]) fv[fieldName] = [];
  const values = fv[fieldName];
  if (!values.includes(value)) { values.unshift(value); const s = await getSettings(); if (values.length > s.maxFieldValues) values.pop(); }
  await browser.storage.local.set({ fieldValues: fv });
}

async function handleSaveTemplate(template) {
  const t = await getTemplates();
  const id = 'template_' + Date.now();
  t[id] = { ...template, id, createdAt: Date.now() };
  await browser.storage.local.set({ templates: t });
}

async function handleDeleteTemplate(templateId) {
  const t = await getTemplates();
  delete t[templateId];
  await browser.storage.local.set({ templates: t });
}

async function handleUnlockSession(password) {
  const settings = await getSettings();
  if (!settings.masterPasswordEnabled) return true;
  const hashedInput = await Crypto.hashPassword(password);
  if (hashedInput === settings.masterPassword) {
    await browser.storage.local.set({ sessionLocked: false });
    await updateLastActivity();
    await addToSecurityAudit('session_unlocked');
    return true;
  }
  await addToSecurityAudit('failed_unlock_attempt');
  return false;
}

async function handleSaveSmartField(fieldName, type, value) {
  const sf = await getSmartFields();
  if (!sf[fieldName]) sf[fieldName] = { type, values: [] };
  if (value && !sf[fieldName].values.includes(value)) { sf[fieldName].values.unshift(value); const s = await getSettings(); if (sf[fieldName].values.length > s.maxFieldValues) sf[fieldName].values.pop(); }
  await browser.storage.local.set({ smartFields: sf });
  const stats = await getStatistics();
  stats.fieldTypes = stats.fieldTypes || {};
  stats.fieldTypes[type] = (stats.fieldTypes[type] || 0) + 1;
  await browser.storage.local.set({ statistics: stats });
}

async function handleSaveFolder(folder) {
  const f = await getFolders();
  const id = folder.id || 'folder_' + Date.now();
  f[id] = { ...folder, id, createdAt: folder.createdAt || Date.now(), formIds: folder.formIds || [] };
  await browser.storage.local.set({ folders: f });
  await addToChangeHistory('folder_created', id, { name: folder.name });
}

async function handleDeleteFolder(folderId) {
  const f = await getFolders();
  delete f[folderId];
  await browser.storage.local.set({ folders: f });
  await addToChangeHistory('folder_deleted', folderId);
}

async function handleMoveFormToFolder(formId, folderId) {
  const f = await getFolders();
  for (const folder of Object.values(f)) folder.formIds = folder.formIds.filter(id => id !== formId);
  if (folderId && f[folderId]) f[folderId].formIds.push(formId);
  await browser.storage.local.set({ folders: f });
}

async function handleSaveRule(rule) {
  const r = await getRules();
  const id = rule.id || 'rule_' + Date.now();
  r[id] = { ...rule, id, createdAt: rule.createdAt || Date.now(), enabled: rule.enabled !== false };
  await browser.storage.local.set({ rules: r });
}

async function handleDeleteRule(ruleId) {
  const r = await getRules();
  delete r[ruleId];
  await browser.storage.local.set({ rules: r });
}

async function getDashboardData() {
  const stats = await getStatistics();
  const savedForms = await getSavedForms();
  const folders = await getFolders();
  const formsByDay = {};
  const now = Date.now();
  for (let i = 6; i >= 0; i--) { const d = new Date(now - i * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU'); formsByDay[d] = 0; }
  Object.values(savedForms).forEach(form => { const d = new Date(form.timestamp).toLocaleDateString('ru-RU'); if (formsByDay[d] !== undefined) formsByDay[d]++; });
  const folderStats = Object.values(folders).map(f => ({ id: f.id, name: f.name, count: f.formIds.length })).sort((a, b) => b.count - a.count).slice(0, 5);
  return { totalForms: Object.keys(savedForms).length, totalFolders: Object.keys(folders).length, totalSaved: stats.totalSaved, totalRestored: stats.totalRestored, formsByDay, folderStats, fieldTypes: stats.fieldTypes || {}, timeSpentOnForms: stats.timeSpentOnForms || 0 };
}

async function compareVersions(formId, v1Index, v2Index) {
  const versions = await getFormVersions(formId);
  const v1 = versions[v1Index], v2 = versions[v2Index];
  if (!v1 || !v2) return { added: [], removed: [], changed: [] };
  const f1 = v1.fields || {}, f2 = v2.fields || {};
  const added = [], removed = [], changed = [];
  for (const k of Object.keys(f2)) { if (!f1[k]) added.push({ field: k, value: f2[k] }); else if (f1[k] !== f2[k]) changed.push({ field: k, old: f1[k], new: f2[k] }); }
  for (const k of Object.keys(f1)) { if (!f2[k]) removed.push({ field: k, value: f1[k] }); }
  return { added, removed, changed };
}

function detectFieldType(fieldName, fieldLabel = '') {
  const combined = `${fieldName} ${fieldLabel}`;
  const patterns = { email: /email|mail/i, phone: /phone|tel|mobile/i, name: /name/i, first_name: /first|given/i, last_name: /last|family|surname/i, address: /address|street/i, city: /city|town/i, zip: /zip|postal/i, card_number: /card.*number|credit/i, card_expiry: /expir|valid/i, card_cvv: /cvv|cvc|security/i, date: /date|birth|dob/i, website: /website|url/i, username: /user|login/i, password: /password|pass|pwd/i };
  for (const [type, pattern] of Object.entries(patterns)) { if (pattern.test(combined)) return type; }
  return 'text';
}

async function addToChangeHistory(action, formId, data = null) {
  const h = await getChangeHistory();
  h.unshift({ action, formId, data, timestamp: Date.now() });
  if (h.length > CONFIG.MAX_HISTORY_ITEMS) h.pop();
  await browser.storage.local.set({ changeHistory: h });
}

async function addToSecurityAudit(action, data = null) {
  const a = await getSecurityAudit();
  a.unshift({ action, data, timestamp: Date.now(), userAgent: navigator.userAgent });
  if (a.length > CONFIG.MAX_HISTORY_ITEMS) a.pop();
  await browser.storage.local.set({ securityAudit: a });
}
