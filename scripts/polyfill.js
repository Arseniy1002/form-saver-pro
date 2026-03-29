// Browser Polyfill
// Обеспечивает совместимость между Chrome (chrome.*) и Firefox (browser.*)

(function() {
  if (typeof browser === 'undefined') {
    // Chrome и совместимые браузеры
    window.browser = chrome;
    
    // Промисификация API для совместимости
    if (browser.runtime && browser.runtime.sendMessage) {
      const originalSendMessage = browser.runtime.sendMessage;
      browser.runtime.sendMessage = function(message) {
        return new Promise((resolve, reject) => {
          originalSendMessage.call(browser.runtime, message, (response) => {
            if (browser.runtime.lastError) {
              reject(browser.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      };
    }
    
    if (browser.storage && browser.storage.local) {
      ['get', 'set', 'remove', 'clear'].forEach(method => {
        const originalMethod = browser.storage.local[method];
        browser.storage.local[method] = function(keys) {
          return new Promise((resolve, reject) => {
            originalMethod.call(browser.storage.local, keys, (result) => {
              if (browser.runtime.lastError) {
                reject(browser.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          });
        };
      });
    }
    
    if (browser.tabs && browser.tabs.query) {
      const originalQuery = browser.tabs.query;
      browser.tabs.query = function(queryInfo) {
        return new Promise((resolve, reject) => {
          originalQuery.call(browser.tabs, queryInfo, (tabs) => {
            if (browser.runtime.lastError) {
              reject(browser.runtime.lastError);
            } else {
              resolve(tabs);
            }
          });
        });
      };
    }
    
    if (browser.tabs && browser.tabs.sendMessage) {
      const originalSendMessage = browser.tabs.sendMessage;
      browser.tabs.sendMessage = function(tabId, message) {
        return new Promise((resolve, reject) => {
          originalSendMessage.call(browser.tabs, tabId, message, (response) => {
            if (browser.runtime.lastError) {
              reject(browser.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      };
    }
  }
})();
