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

      const apiURL = `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`;

      const response = await fetch(apiURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: fields
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = this.parsePermissionError(errorData, response.status);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('添加记录失败:', error);
      throw error;
    }
  }

  // 解析权限错误并提供详细解决方案
  parsePermissionError(errorData, statusCode) {
    const errorCode = errorData.code || 'UNKNOWN';
    const errorMsg = errorData.msg || errorData.error || '未知错误';

    // 根据错误代码提供具体的解决方案
    switch (errorCode) {
      case '99991663': // 无权限
        return `❌ 权限不足：应用没有操作此多维表格的权限\n\n🔧 解决方案：\n1. 检查飞书应用是否已发布\n2. 确保应用具有 bitable:app 权限\n3. 检查多维表格是否已分享给应用\n\n📋 错误详情：${errorMsg} (代码: ${errorCode})`;

      case '99991401': // Token无效
        return `❌ 访问令牌无效：${errorMsg}\n\n🔧 解决方案：\n1. 检查访问令牌是否已过期（2小时有效期）\n2. 重新获取 app_access_token\n3. 确保使用已发布应用的凭证\n\n📋 错误详情：${errorMsg} (代码: ${errorCode})`;

      case '99991400': // 应用不存在
        return `❌ 应用不存在：${errorMsg}\n\n🔧 解决方案：\n1. 检查应用ID是否正确\n2. 确保应用已发布\n3. 重新生成访问令牌\n\n📋 错误详情：${errorMsg} (代码: ${errorCode})`;

      case '99991368': // 表格不存在
        return `❌ 多维表格不存在：${errorMsg}\n\n🔧 解决方案：\n1. 检查表格链接是否正确\n2. 确保表格未删除\n3. 重新获取表格分享链接\n\n📋 错误详情：${errorMsg} (代码: ${errorCode})`;

      case 'Permission denied':
        return `❌ 权限被拒绝：${errorMsg}\n\n🔧 解决方案：\n1. 确保应用已发布并审核通过\n2. 检查应用权限配置（需要 bitable:app 权限）\n3. 确认多维表格分享权限设置\n4. 验证访问令牌类型（推荐使用 app_access_token）\n\n📋 错误详情：${errorMsg}`;

      default:
        if (statusCode === 401) {
          return `❌ 认证失败：${errorMsg}\n\n🔧 解决方案：\n1. 检查访问令牌是否正确\n2. 重新获取 app_access_token\n3. 确保令牌未过期\n\n📋 错误详情：${errorMsg} (状态码: ${statusCode})`;
        } else if (statusCode === 403) {
          return `❌ 权限不足：${errorMsg}\n\n🔧 解决方案：\n1. 检查应用权限配置\n2. 确保应用已发布\n3. 检查表格分享权限\n\n📋 错误详情：${errorMsg} (状态码: ${statusCode})`;
        } else {
          return `❌ 飞书API错误：${errorMsg}\n\n📋 错误代码：${errorCode}\n📋 状态码：${statusCode}\n📋 原始错误：${JSON.stringify(errorData)}`;
        }
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
        const errorMessage = this.parsePermissionError(errorData, response.status);
        throw new Error(errorMessage);
      }

      return { success: true, message: '✅ 连接成功！多维表格权限正常' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 权限检查功能
  async checkPermissions(tableUrl) {
    try {
      const accessToken = await this.getAccessToken();
      const parsed = this.parseFeishuUrl(tableUrl);

      if (!parsed) {
        return { success: false, message: 'URL解析失败' };
      }

      const { appToken, tableId } = parsed;

      // 测试读取权限
      const readResponse = await fetch(
        `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!readResponse.ok) {
        const errorData = await readResponse.json();
        return {
          success: false,
          type: 'read_permission',
          message: this.parsePermissionError(errorData, readResponse.status)
        };
      }

      // 测试写入权限（创建临时测试记录）
      const testRecord = {
        fields: {
          '标题': '权限测试记录',
          '链接': 'https://test.example.com',
          '备注': '这是一条用于测试权限的临时记录',
          '标签': '测试',
          '保存时间': new Date().toLocaleString('zh-CN')
        }
      };

      const writeResponse = await fetch(
        `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testRecord)
        }
      );

      if (!writeResponse.ok) {
        const errorData = await writeResponse.json();
        return {
          success: false,
          type: 'write_permission',
          message: this.parsePermissionError(errorData, writeResponse.status)
        };
      }

      // 删除测试记录（如果成功创建）
      const writeData = await writeResponse.json();
      if (writeData.data && writeData.data.record && writeData.data.record.record_id) {
        try {
          await fetch(
            `${this.baseURL}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${writeData.data.record.record_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              }
            }
          );
        } catch (deleteError) {
          // 删除失败不影响权限检查结果
          console.warn('测试记录删除失败:', deleteError);
        }
      }

      return {
        success: true,
        message: '✅ 权限检查通过！应用具有读取和写入权限'
      };

    } catch (error) {
      return {
        success: false,
        message: `权限检查失败: ${error.message}`
      };
    }
  }
}

// 导出API实例
window.feishuAPI = new FeishuAPI();