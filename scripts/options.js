// Form Saver Pro - Options Page Script
// Управление настройками расширения

document.addEventListener('DOMContentLoaded', async () => {
  // Элементы
  const enableNotifications = document.getElementById('enableNotifications');
  const enableSync = document.getElementById('enableSync');
  const autoCleanup = document.getElementById('autoCleanup');
  const autoSaveDelay = document.getElementById('autoSaveDelay');
  const maxForms = document.getElementById('maxForms');
  const enableEncryption = document.getElementById('enableEncryption');
  const encryptionPassword = document.getElementById('encryptionPassword');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const saveStatus = document.getElementById('saveStatus');

  // Загрузка настроек
  async function loadSettings() {
    try {
      const response = await browser.runtime.sendMessage({ action: 'getSettings' });
      const settings = response.settings;

      enableNotifications.checked = settings.enableNotifications;
      enableSync.checked = settings.enableSync;
      autoCleanup.checked = settings.autoCleanup;
      autoSaveDelay.value = settings.autoSaveDelay;
      maxForms.value = settings.maxForms;
      enableEncryption.checked = settings.enableEncryption;
      encryptionPassword.value = settings.encryptionPassword || '';

      // Показываем/скрываем поле пароля
      togglePasswordField(settings.enableEncryption);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // Переключение поля пароля
  function togglePasswordField(enabled) {
    const row = document.getElementById('encryptionPasswordRow');
    row.style.display = enabled ? 'flex' : 'none';
  }

  // Сохранение настроек
  async function saveSettings() {
    const newSettings = {
      enableNotifications: enableNotifications.checked,
      enableSync: enableSync.checked,
      autoCleanup: autoCleanup.checked,
      autoSaveDelay: parseInt(autoSaveDelay.value) || 500,
      maxForms: parseInt(maxForms.value) || 100,
      enableEncryption: enableEncryption.checked,
      encryptionPassword: encryptionPassword.value
    };

    try {
      await browser.runtime.sendMessage({
        action: 'updateSettings',
        settings: newSettings
      });

      showStatus('Настройки сохранены!', 'success');
    } catch (error) {
      showStatus('Ошибка сохранения: ' + error.message, 'error');
    }
  }

  // Показ статуса
  function showStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = `save-status ${type} visible`;
    
    setTimeout(() => {
      saveStatus.classList.remove('visible');
    }, 3000);
  }

  // Обработчики
  enableEncryption.addEventListener('change', () => {
    togglePasswordField(enableEncryption.checked);
  });

  // Автосохранение при изменении
  [enableNotifications, enableSync, autoCleanup, autoSaveDelay, maxForms, enableEncryption, encryptionPassword]
    .forEach(el => {
      el.addEventListener('change', saveSettings);
    });

  // Экспорт данных
  exportBtn.addEventListener('click', async () => {
    try {
      const response = await browser.runtime.sendMessage({ action: 'exportData' });
      const dataStr = JSON.stringify(response.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-saver-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showStatus('Данные экспортированы!', 'success');
    } catch (error) {
      showStatus('Ошибка экспорта: ' + error.message, 'error');
    }
  });

  // Импорт данных
  importBtn.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.forms) {
        throw new Error('Неверный формат файла');
      }

      if (!confirm('Импортированные данные будут добавлены к существующим. Продолжить?')) {
        return;
      }
      
      await browser.runtime.sendMessage({
        action: 'importData',
        data: data
      });

      showStatus('Данные импортированы!', 'success');
    } catch (error) {
      showStatus('Ошибка импорта: ' + error.message, 'error');
    }

    e.target.value = '';
  });

  // Очистка всех данных
  clearAllBtn.addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите удалить ВСЕ данные? Это действие необратимо!')) {
      return;
    }

    const confirmText = prompt('Введите "DELETE" для подтверждения:');
    if (confirmText !== 'DELETE') {
      showStatus('Отменено', 'error');
      return;
    }

    try {
      await browser.runtime.sendMessage({ action: 'clearAllForms' });
      showStatus('Все данные удалены!', 'success');
    } catch (error) {
      showStatus('Ошибка удаления: ' + error.message, 'error');
    }
  });

  // Инициализация
  loadSettings();
});
