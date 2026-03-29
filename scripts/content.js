// Form Saver Pro v4.0 - Content Script
// Умные поля, автозаполнение по типам, правила, маски ввода

(function() {
  'use strict';

  let debounceTimer = null;
  let settings = { autoSaveDelay: 500, enableClickFill: true, enableSmartFields: true };
  let autocompletePopup = null;
  let smartFieldsData = {};

  // Типы полей для распознавания
  const FIELD_TYPES = {
    EMAIL: /email|e-mail|mail/i,
    PHONE: /phone|tel|mobile|cell/i,
    NAME: /name|full.?name/i,
    FIRST_NAME: /first.?name|given.?name/i,
    LAST_NAME: /last.?name|family.?name|surname/i,
    ADDRESS: /address|street|addr/i,
    CITY: /city|town/i,
    ZIP: /zip|postal|post.?code/i,
    CARD_NUMBER: /card.?number|card.?no|credit.?card/i,
    CARD_EXPIRY: /expiry|expir|valid.?through/i,
    CARD_CVV: /cvv|cvc|security.?code/i,
    DATE: /date|birth|dob/i,
    WEBSITE: /website|url|homepage/i,
    USERNAME: /username|user|login/i,
    PASSWORD: /password|pass|pwd/i
  };

  // Загрузка настроек и умных полей
  Promise.all([
    browser.runtime.sendMessage({ action: 'getSettings' }),
    browser.runtime.sendMessage({ action: 'getSmartFields' })
  ]).then(([settingsResponse, smartFieldsResponse]) => {
    if (settingsResponse?.settings) settings = settingsResponse.settings;
    if (smartFieldsResponse?.smartFields) smartFieldsData = smartFieldsResponse.smartFields;
  }).catch(() => {});

  // Распознавание типа поля
  function detectFieldType(element) {
    const name = element.name || element.id || '';
    const placeholder = element.placeholder || '';
    const label = document.querySelector(`label[for="${element.id}"]`)?.textContent || '';
    const ariaLabel = element.getAttribute('aria-label') || '';
    
    const combined = `${name} ${placeholder} ${label} ${ariaLabel}`;
    
    for (const [type, pattern] of Object.entries(FIELD_TYPES)) {
      if (pattern.test(combined)) {
        return type.toLowerCase();
      }
    }
    
    return 'text';
  }

  // Получаем уникальный идентификатор формы
  function getFormId(form) {
    const url = window.location.href;
    const formAction = form.action || '';
    const formIndex = Array.from(document.forms).indexOf(form);
    return btoa(`${url}|${formAction}|${formIndex}`);
  }

  // Собираем данные формы
  function collectFormData(form) {
    const data = {
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      fields: {},
      fieldTypes: {}
    };

    const elements = form.querySelectorAll('input, textarea, select');
    
    elements.forEach(element => {
      if (!element.name && !element.id) return;
      if (element.type === 'hidden') return;
      if (element.type === 'submit' || element.type === 'button') return;
      if (element.type === 'password') return;

      const key = element.name || element.id;
      const fieldType = detectFieldType(element);
      
      data.fieldTypes[key] = fieldType;
      
      switch (element.type) {
        case 'checkbox':
          data.fields[key] = element.checked;
          break;
        case 'radio':
          if (element.checked) {
            data.fields[key] = element.value;
          }
          break;
        case 'select-one':
          data.fields[key] = element.value;
          break;
        case 'select-multiple':
          data.fields[key] = Array.from(element.selectedOptions).map(opt => opt.value);
          break;
        default:
          data.fields[key] = element.value;
      }
    });

    return data;
  }

  // Сохраняем данные формы
  function saveFormData(form, showNotification = true) {
    const formId = getFormId(form);
    const formData = collectFormData(form);

    browser.runtime.sendMessage({
      action: 'saveForm',
      formId: formId,
      data: formData
    }).catch(() => {});

    if (showNotification) {
      showNotification('Форма сохранена');
    }
  }

  // Восстанавливаем данные формы
  function restoreFormData(form, formData) {
    const elements = form.querySelectorAll('input, textarea, select');
    
    elements.forEach(element => {
      if (!element.name && !element.id) return;
      if (element.type === 'hidden') return;
      if (element.type === 'submit' || element.type === 'button') return;
      if (element.type === 'password') return;

      const key = element.name || element.id;
      const value = formData.fields[key];

      if (value === undefined) return;

      switch (element.type) {
        case 'checkbox':
          element.checked = value;
          break;
        case 'radio':
          if (element.value === value) {
            element.checked = true;
          }
          break;
        case 'select-multiple':
          if (Array.isArray(value)) {
            Array.from(element.options).forEach(opt => {
              opt.selected = value.includes(opt.value);
            });
          }
          break;
        default:
          element.value = value;
      }

      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  // Умное заполнение
  function smartFill(smartFields) {
    const elements = document.querySelectorAll('input, textarea, select');
    
    elements.forEach(element => {
      if (element.type === 'password' || element.type === 'hidden') return;
      
      const fieldType = detectFieldType(element);
      const fieldName = element.name || element.id;
      
      // Ищем подходящее значение
      let value = null;
      
      // Сначала по точному совпадению имени
      if (smartFields[fieldName]?.values?.[0]) {
        value = smartFields[fieldName].values[0];
      }
      // Потом по типу поля
      else {
        for (const [name, data] of Object.entries(smartFields)) {
          if (data.type === fieldType && data.values?.[0]) {
            value = data.values[0];
            break;
          }
        }
      }
      
      if (value) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    showNotification('Умное заполнение выполнено');
  }

  // Автозаполнение по клику с учётом типа
  function showAutocomplete(element) {
    if (!settings.enableClickFill) return;
    
    const fieldName = element.name || element.id;
    const fieldType = detectFieldType(element);
    
    if (!fieldName) return;

    // Получаем значения для этого поля И для этого типа
    browser.runtime.sendMessage({ action: 'getFieldValues', fieldName })
      .then(response => {
        let values = response.values || [];
        
        // Если нет значений для конкретного поля, ищем по типу
        if (values.length === 0 && settings.enableSmartFields) {
          browser.runtime.sendMessage({ action: 'getSmartFields' })
            .then(sfResponse => {
              const smartFields = sfResponse.smartFields || {};
              for (const [name, data] of Object.entries(smartFields)) {
                if (data.type === fieldType) {
                  values = values.concat(data.values || []);
                }
              }
              if (values.length > 0) {
                hideAutocomplete();
                createAutocompletePopup(element, values, fieldType);
              }
            })
            .catch(() => {});
        } else if (values.length > 0) {
          hideAutocomplete();
          createAutocompletePopup(element, values, fieldType);
        }
      })
      .catch(() => {});
  }

  function createAutocompletePopup(element, values, fieldType) {
    const rect = element.getBoundingClientRect();
    
    autocompletePopup = document.createElement('div');
    autocompletePopup.className = 'form-saver-autocomplete';
    autocompletePopup.style.cssText = `
      position: absolute;
      top: ${rect.bottom + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
      width: ${rect.width}px;
      max-height: 200px;
      overflow-y: auto;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 999998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
    `;

    // Добавляем иконку типа
    const typeIcon = getTypeIcon(fieldType);
    
    values.forEach(value => {
      const item = document.createElement('div');
      item.className = 'form-saver-autocomplete-item';
      item.innerHTML = `<span class="type-icon">${typeIcon}</span> ${escapeHtml(value)}`;
      item.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      item.addEventListener('mouseenter', () => item.style.background = '#f0f0f0');
      item.addEventListener('mouseleave', () => item.style.background = 'white');
      item.addEventListener('click', () => {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        hideAutocomplete();
        
        const fieldName = element.name || element.id;
        browser.runtime.sendMessage({ 
          action: 'saveFieldValue', 
          fieldName, 
          value 
        }).catch(() => {});
      });
      autocompletePopup.appendChild(item);
    });

    document.body.appendChild(autocompletePopup);

    const closeHandler = (e) => {
      if (!autocompletePopup.contains(e.target) && e.target !== element) {
        hideAutocomplete();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 100);
  }

  function getTypeIcon(fieldType) {
    const icons = {
      email: '📧',
      phone: '📱',
      name: '👤',
      address: '🏠',
      city: '🏙️',
      zip: '📮',
      card_number: '💳',
      card_expiry: '📅',
      card_cvv: '🔒',
      date: '📅',
      website: '🌐',
      username: '👤',
      text: '📝'
    };
    return icons[fieldType] || icons.text;
  }

  function hideAutocomplete() {
    if (autocompletePopup) {
      autocompletePopup.remove();
      autocompletePopup = null;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showNotification(message) {
    const existing = document.querySelector('.form-saver-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'form-saver-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #4CAF50, #45a049);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: formSaverFadeIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'formSaverFadeOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Добавляем стили
  const style = document.createElement('style');
  style.textContent = `
    @keyframes formSaverFadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes formSaverFadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(10px); }
    }
    .form-saver-highlight {
      animation: formSaverHighlight 1s ease;
    }
    @keyframes formSaverHighlight {
      0%, 100% { background-color: transparent; }
      50% { background-color: rgba(76, 175, 80, 0.3); }
    }
    .form-saver-field-type {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 14px;
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // Показываем тип поля для инпутов
  function showFieldTypeIndicator(element) {
    if (element.type === 'password' || element.type === 'hidden') return;
    if (getComputedStyle(element).position === 'static') return;
    
    const fieldType = detectFieldType(element);
    const icon = getTypeIcon(fieldType);
    
    const indicator = document.createElement('span');
    indicator.className = 'form-saver-field-type';
    indicator.textContent = icon;
    
    element.style.position = 'relative';
    element.appendChild(indicator);
  }

  // Инициализация
  function init() {
    document.querySelectorAll('form').forEach(form => {
      if (form.dataset.formSaverInitialized) return;
      form.dataset.formSaverInitialized = 'true';

      form.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.tagName === 'SELECT') {
          
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            saveFormData(form);
          }, settings.autoSaveDelay);
        }
      });

      form.addEventListener('submit', () => {
        saveFormData(form);
      });
    });

    // Автовосстановление
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const formId = getFormId(form);
      browser.runtime.sendMessage({ action: 'getFormData', formId })
        .then(response => {
          if (response && response.data) {
            restoreFormData(form, response.data);
            form.classList.add('form-saver-highlight');
          }
        })
        .catch(() => {});
    });

    // Автозаполнение по клику
    document.querySelectorAll('input, textarea').forEach(element => {
      if (element.type === 'password' || element.type === 'hidden') return;
      
      element.addEventListener('click', () => showAutocomplete(element));
      element.addEventListener('focus', () => showAutocomplete(element));
      
      // Показываем индикатор типа
      if (settings.enableSmartFields) {
        showFieldTypeIndicator(element);
      }
    });
  }

  // Обработка команд
  browser.runtime.onMessage.addListener((message) => {
    switch (message.action) {
      case 'saveCurrentForm':
        const currentForm = document.activeElement?.closest('form');
        if (currentForm) {
          saveFormData(currentForm);
        } else {
          showNotification('Нет активной формы');
        }
        break;
      
      case 'restoreForm':
        const formToRestore = document.activeElement?.closest('form');
        if (formToRestore && message.data) {
          restoreFormData(formToRestore, message.data);
          formToRestore.classList.add('form-saver-highlight');
          showNotification('Форма восстановлена');
        }
        break;
      
      case 'smartFill':
        if (message.smartFields) {
          smartFill(message.smartFields);
        }
        break;
    }
    return true;
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const observer = new MutationObserver(() => {
    init();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
