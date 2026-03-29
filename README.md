![Version](https://img.shields.io/badge/version-5.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Pure JS](https://img.shields.io/badge/code-Vanilla_JS-yellow)
![Manifest](https://img.shields.io/badge/manifest-V3-orange)
![Size](https://img.shields.io/github/languages/code-size/arseniy1002/form-saver-pro)

# Form Saver Pro 🦊

**Версия:** 5.0.0  
**Лицензия:** MIT  
**Статус:** На проверке [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/form-saver-pro/)

Автосохранение и восстановление форм с шифрованием, умными полями, папками и аналитикой.

### Технологии
- **Engine:** Vanilla JavaScript (ES6+)
- **API:** WebExtensions API (Manifest V3)
- **Compatibility:** Firefox & Chromium-based (через встроенный полифилл)
- **Security:** AES-GCM (Web Crypto API)

## 🔥 Возможности

### Автосохранение и восстановление
- Автоматическое сохранение при вводе данных
- Мгновенное восстановление при возврате на сайт
- Версионность — до 10 версий каждой формы
- История изменений с возможностью отката

### Умные поля
- Распознавание 15+ типов полей (email, телефон, имя, адрес, карта и др.)
- Автозаполнение по клику с подсказками
- Шаблоны для повторяющихся данных

### Организация данных
- 📁 Папки для группировки форм
- 🏷️ Теги для категоризации
- ⭐ Избранное для быстрого доступа
- 🎨 Цветные метки (7 цветов)
- 📝 Заметки к каждой форме

### Безопасность
- 🔐 Шифрование AES-GCM 256-bit
- 🔑 Мастер-пароль для блокировки расширения
- 🔒 Аудит всех действий с временными метками
- ⏱️ Автоблокировка после бездействия

### Аналитика
- 📊 Дашборд с графиками активности
- 📈 Статистика по сохранённым формам
- 🏆 Топ сайтов по количеству форм
- 📅 Активность по дням недели

### Поиск и экспорт
- 🔍 Полнотекстовый поиск по всем полям
- 📤 Экспорт в JSON (резервная копия)
- 📊 Экспорт в CSV (таблицы)
- 📥 Импорт данных из других браузеров

## ⌨️ Горячие клавиши

| Действие | Windows/Linux | macOS |
|----------|---------------|-------|
| Сохранить форму | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Восстановить форму | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Умное заполнение | `Ctrl+Shift+D` | `Cmd+Shift+D` |
| Открыть управление | `Ctrl+Shift+A` | `Cmd+Shift+A` |
| Поиск форм | `Ctrl+Shift+K` | `Cmd+Shift+K` |

## 📦 Установка

### Из Firefox Add-ons
1. Перейдите на [страницу дополнения](https://addons.mozilla.org/ru/firefox/addon/form-saver-pro/)
2. Нажмите "Добавить в Firefox"
3. Подтвердите установку

### Из исходного кода (для разработки)
```bash
# Клонируйте репозиторий
git clone https://github.com/arseniyrub102/form-saver-pro.git
cd form-saver-pro

# Установите web-ext
npm install --global web-ext

# Запустите в режиме разработки
web-ext run

# Создайте XPI для публикации
web-ext build
```

## 🔒 Безопасность и приватность

- **Все данные хранятся локально** в браузере
- **Никаких серверов** — данные не покидают ваше устройство
- **Шифрование** — опциональное AES-GCM 256-bit
- **Открытый исходный код** — можно проверить
- **Нет аналитики** — не собираем данные о пользователях
- **Нет трекеров** — полное отсутствие отслеживания

## 🏗️ Структура проекта

```
form_saver_extension/
├── manifest.json          # Конфигурация расширения (Manifest V3)
├── popup.html             # Popup интерфейс
├── options.html           # Страница настроек
├── _locales/
│   ├── ru/messages.json   # Русский язык
│   └── en/messages.json   # Английский язык
├── icons/
│   ├── icon-48.png
│   ├── icon-96.png
│   ├── icon-128.png
│   └── icon-512.png
├── scripts/
│   ├── polyfill.js        # Кроссбраузерность
│   ├── background.js      # Фоновый скрипт (логика, шифрование)
│   ├── content.js         # Скрипт для страниц (умные поля)
│   ├── popup.js           # Логика popup (дашборд, папки)
│   └── options.js         # Логика страницы настроек
└── styles/
    ├── popup.css          # Стили popup
    └── options.css        # Стили настроек
```

## 🛠️ Разработка

### Требования
- Node.js 16+
- web-ext (`npm install --global web-ext`)

### Команды
```bash
# Запуск в режиме разработки
web-ext run

# Проверка кода
web-ext lint

# Создание XPI
web-ext build

```

## 📝 Changelog

### v5.0.0 (2026-03-29)
- ✅ Полнотекстовый поиск по полям
- ✅ Поиск и удаление дубликатов
- ✅ Экспорт в CSV
- ✅ Кастомные темы
- ✅ Напоминания
- ✅ Мультиязычность (RU/EN)
- ✅ data_collection_permissions для Firefox

### v4.0.0
- ✅ Умные поля (15+ типов)
- ✅ Папки для форм
- ✅ Правила автозаполнения
- ✅ Дашборд с графиками
- ✅ Мастер-пароль
- ✅ Аудит безопасности

### v3.0.0
- ✅ Версионность форм
- ✅ Заметки к формам
- ✅ Избранное
- ✅ Цветные метки
- ✅ История изменений
- ✅ Автозаполнение по клику

### v2.0.0
- ✅ Шифрование данных
- ✅ Теги
- ✅ Статистика
- ✅ Контекстное меню
- ✅ Горячие клавиши

### v1.0.0
- ✅ Автосохранение
- ✅ Восстановление

## 🤝 Вклад

Приветствуются issue и pull requests!

### Как помочь
1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Отправьте (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License — см. файл [LICENSE](LICENSE) для деталей.

## 📞 Контакты

- **Email:** arseniyrub102@gmail.com
- **GitHub:** [@arseniy1002](https://github.com/arseniy1002)
- **Firefox Add-ons:** [Form Saver Pro](https://addons.mozilla.org/ru/firefox/addon/form-saver-pro/)

## 🙏 Благодарности

Спасибо всем, кто использует Form Saver Pro! ❤️

---

**Form Saver Pro** — сохраняйте важное, восстанавливайте мгновенно! 🚀
