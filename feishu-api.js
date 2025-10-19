// feishu-api.js - 飞书API调用
class FeishuAPI {
  constructor() {
    this.baseURL = 'https://open.feishu.cn';
    this.appId = ''; // 需要配置飞书应用的App ID
    this.appSecret = ''; // 需要配置飞书应用的App Secret
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // 从飞书多维表格链接中提取App ID和Table ID
  parseFeishuUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // 尝试多种匹配模式
      let appToken = null;

      // 模式1: /base/xxxxx (标准格式)
      let match = pathname.match(/\/base\/([a-zA-Z0-9]+)/);
      if (match) {
        appToken = match[1];
      }

      // 模式2: /base/app/xxxxx (应用格式)
      if (!appToken) {
        match = pathname.match(/\/base\/app\/([a-zA-Z0-9]+)/);
        if (match) {
          appToken = match[1];
        }
      }

      // 模式3: 直接匹配路径中的字符串
      if (!appToken) {
        match = pathname.match(/\/([a-zA-Z0-9]{20,})/);
        if (match) {
          appToken = match[1];
        }
      }

      if (appToken) {
        // 尝试从查询参数中获取table ID
        let tableId = null;

        // 优先匹配 table 参数
        let tableIdMatch = urlObj.search.match(/[?&]table=([a-zA-Z0-9]+)/);
        if (tableIdMatch) {
          tableId = tableIdMatch[1];
        }

        // 如果没有找到，尝试其他可能的参数名
        if (!tableId) {
          tableIdMatch = urlObj.search.match(/[?&]tbl=([a-zA-Z0-9]+)/);
          if (tableIdMatch) {
            tableId = tableIdMatch[1];
          }
        }

        if (appToken && tableId) {
          return { appToken, tableId };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // 获取访问令牌（用户配置方式）
  async getAccessToken() {
    // 检查是否已有有效的token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // 从存储中获取用户配置的token
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['feishuAccessToken'], (result) => {
        if (result.feishuAccessToken) {
          this.accessToken = result.feishuAccessToken;
          resolve(this.accessToken);
        } else {
          reject(new Error('未配置飞书访问令牌'));
        }
      });
    });
  }

  // 设置用户访问令牌
  setAccessToken(token) {
    this.accessToken = token;
    chrome.storage.local.set({ feishuAccessToken: token });
  }

  // 向飞书多维表格添加记录
  async addRecord(tableUrl, record) {
    try {
      const parsed = this.parseFeishuUrl(tableUrl);
      if (!parsed) {
        throw new Error('无法解析飞书表格URL，请检查链接格式是否正确');
      }

      const { appToken, tableId } = parsed;
      if (!appToken || !tableId) {
        throw new Error(`URL解析不完整: appToken=${appToken}, tableId=${tableId}`);
      }

      const accessToken = await this.getAccessToken();

      const fields = {
        '标题': record.title,
        '链接': record.url,
        '备注': record.notes || '',
        '标签': Array.isArray(record.tags) ? record.tags.join(', ') : record.tags,
        '保存时间': new Date(record.timestamp).toLocaleString('zh-CN')
      };

      const response = await fetch(
        `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: fields
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`飞书API错误: ${errorData.msg || response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('添加记录失败:', error);
      throw error;
    }
  }

  // 测试连接
  async testConnection(tableUrl) {
    try {
      const parsed = this.parseFeishuUrl(tableUrl);
      if (!parsed) {
        throw new Error('无法解析飞书表格URL，请检查链接格式是否正确');
      }

      const { appToken, tableId } = parsed;
      if (!appToken || !tableId) {
        throw new Error(`URL解析不完整: appToken=${appToken}, tableId=${tableId}`);
      }

      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`连接测试失败: ${errorData.msg || response.statusText}`);
      }

      return { success: true, message: '连接成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// 导出API实例
window.feishuAPI = new FeishuAPI();