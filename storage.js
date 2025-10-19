// storage.js - 本地存储管理
class StorageManager {
  // 保存表格配置
  static async saveTable(config) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['feishuTables'], (result) => {
        const tables = result.feishuTables || [];

        // 检查是否已存在
        const existingIndex = tables.findIndex(t => t.url === config.url);
        if (existingIndex >= 0) {
          tables[existingIndex] = { ...tables[existingIndex], ...config };
        } else {
          tables.push({
            ...config,
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
          });
        }

        chrome.storage.local.set({ feishuTables: tables }, () => {
          resolve(tables);
        });
      });
    });
  }

  // 获取所有表格配置
  static async getTables() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['feishuTables'], (result) => {
        resolve(result.feishuTables || []);
      });
    });
  }

  // 删除表格配置
  static async deleteTable(tableId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['feishuTables'], (result) => {
        const tables = result.feishuTables || [];
        const filteredTables = tables.filter(t => t.id !== tableId);

        chrome.storage.local.set({ feishuTables: filteredTables }, () => {
          resolve(filteredTables);
        });
      });
    });
  }

  // 保存历史记录
  static async saveHistory(record) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['saveHistory'], (result) => {
        const history = result.saveHistory || [];
        history.unshift({
          ...record,
          id: Date.now().toString()
        });

        // 只保留最近50条记录
        const limitedHistory = history.slice(0, 50);

        chrome.storage.local.set({ saveHistory: limitedHistory }, () => {
          resolve(limitedHistory);
        });
      });
    });
  }

  // 获取历史记录
  static async getHistory(limit = 10) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['saveHistory'], (result) => {
        const history = result.saveHistory || [];
        resolve(history.slice(0, limit));
      });
    });
  }

  // 保存最近使用的标签
  static async saveRecentTags(tags) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['recentTags'], (result) => {
        const existingTags = result.recentTags || [];
        const allTags = [...new Set([...existingTags, ...tags])];
        const limitedTags = allTags.slice(-20); // 保留最近20个标签

        chrome.storage.local.set({ recentTags: limitedTags }, () => {
          resolve(limitedTags);
        });
      });
    });
  }

  // 获取最近使用的标签
  static async getRecentTags() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['recentTags'], (result) => {
        resolve(result.recentTags || []);
      });
    });
  }

  // 保存设置
  static async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        const currentSettings = result.settings || {};
        const newSettings = { ...currentSettings, ...settings };

        chrome.storage.local.set({ settings: newSettings }, () => {
          resolve(newSettings);
        });
      });
    });
  }

  // 获取设置
  static async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result) => {
        resolve(result.settings || {});
      });
    });
  }

  // 清空所有数据
  static async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve();
      });
    });
  }
}

// 导出存储管理器
window.StorageManager = StorageManager;