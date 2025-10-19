// popup.js - 插件弹窗逻辑（完整版）
console.log('Feishu Saver popup loaded');

document.addEventListener('DOMContentLoaded', function() {
  const pageTitle = document.getElementById('pageTitle');
  const notesTextarea = document.getElementById('notes');
  const tagsInput = document.getElementById('tags');
  const tagsSuggestions = document.getElementById('tagsSuggestions');
  const tableSelect = document.getElementById('tableSelect');
  const newTableInput = document.getElementById('newTableInput');
  const newTableUrl = document.getElementById('newTableUrl');
  const newTableName = document.getElementById('newTableName');
  const addTableBtn = document.getElementById('addTableBtn');
  const testUrlBtn = document.getElementById('testUrlBtn');
  const urlDebugInfo = document.getElementById('urlDebugInfo');
  const debugContent = document.getElementById('debugContent');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const historyList = document.getElementById('historyList');

  let currentTabInfo = null;
  let recentTags = [];

  // 获取当前页面信息
  function getCurrentPageInfo() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      if (currentTab) {
        currentTabInfo = {
          title: currentTab.title,
          url: currentTab.url
        };
        pageTitle.textContent = currentTab.title || '无法获取页面标题';
      }
    });
  }

  // 初始化
  getCurrentPageInfo();
  initializeStorage();
  loadSavedTables();
  loadRecentTags();
  loadHistory();

  // 初始化存储
  async function initializeStorage() {
    const settings = await StorageManager.getSettings();
    if (!settings.feishuTokenConfigured) {
      // 首次使用，显示配置提示
      showTokenConfigurationDialog();
    }
  }

  // 显示Token配置对话框
  function showTokenConfigurationDialog() {
    const token = prompt('请输入您的飞书访问令牌（Access Token）:\n\n获取方式:\n1. 打开飞书开发者后台\n2. 创建应用并获取权限\n3. 生成Access Token\n\n如需跳过此配置，请点击取消');

    if (token) {
      window.feishuAPI.setAccessToken(token);
      StorageManager.saveSettings({ feishuTokenConfigured: true });
      updateStatus('飞书令牌配置成功！', 'success');
    } else {
      updateStatus('未配置飞书令牌，无法使用保存功能', 'error');
    }
  }

  // 标签输入处理
  tagsInput.addEventListener('input', function() {
    const value = this.value.trim();
    if (value.includes(',')) {
      const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
      updateTagSuggestions(tags);
    } else {
      hideTagSuggestions();
    }
  });

  // 更新标签建议
  async function updateTagSuggestions(tags) {
    tagsSuggestions.innerHTML = '';
    const newTags = tags.filter(tag => !recentTags.includes(tag));

    if (newTags.length > 0) {
      newTags.forEach(tag => {
        const item = document.createElement('div');
        item.className = 'tag-suggestion';
        item.textContent = `+ ${tag}`;
        item.addEventListener('click', async () => {
          recentTags = [...new Set([...recentTags, tag])].slice(-10);
          await StorageManager.saveRecentTags([tag]);
          hideTagSuggestions();
        });
        tagsSuggestions.appendChild(item);
      });
      tagsSuggestions.style.display = 'block';
    } else {
      hideTagSuggestions();
    }
  }

  function hideTagSuggestions() {
    tagsSuggestions.style.display = 'none';
  }

  // 表格选择变化处理
  tableSelect.addEventListener('change', function() {
    if (this.value === 'new') {
      newTableInput.style.display = 'block';
      newTableUrl.focus();
    } else {
      newTableInput.style.display = 'none';
      clearNewTableForm();
      urlDebugInfo.style.display = 'none';
    }
  });

  // URL测试按钮
  testUrlBtn.addEventListener('click', async function() {
    const url = newTableUrl.value.trim();
    if (!url) {
      showDebugResult({
        success: false,
        message: '请先输入飞书表格链接'
      });
      return;
    }

    // 显示加载状态
    showDebugResult({
      success: null,
      message: '正在解析URL...'
    });

    // 延迟一下让UI更新
    setTimeout(() => {
      testUrlParsing(url);
    }, 100);
  });

  // 添加表格按钮
  addTableBtn.addEventListener('click', async function() {
    const url = newTableUrl.value.trim();
    const name = newTableName.value.trim() || extractTableNameFromUrl(url);

    if (!url) {
      updateStatus('请输入飞书表格链接', 'error');
      return;
    }

    if (!isValidFeishuUrl(url)) {
      updateStatus('请输入有效的飞书链接（应该包含feishu.cn或feishu.com）', 'error');
      return;
    }

    try {
      // 首先测试URL解析
      const parsed = window.feishuAPI.parseFeishuUrl(url);
      if (!parsed) {
        updateStatus('URL格式无法解析，请点击"🔍 测试解析"查看详情', 'error');
        return;
      }

      if (!parsed.appToken || !parsed.tableId) {
        let errorMsg = 'URL解析不完整，缺少';
        if (!parsed.appToken) errorMsg += ' App Token';
        if (!parsed.tableId) errorMsg += ' Table ID';
        errorMsg += '。请确保使用完整的飞书表格分享链接';
        updateStatus(errorMsg, 'error');
        return;
      }

      // 测试连接
      updateStatus('正在测试表格连接...', 'loading');
      const testResult = await window.feishuAPI.testConnection(url);

      if (testResult.success) {
        await StorageManager.saveTable({ url, name });
        updateStatus('✅ 表格添加成功！', 'success');
        loadSavedTables();
        clearNewTableForm();
        newTableInput.style.display = 'none';
        tableSelect.value = '';
        urlDebugInfo.style.display = 'none';
      } else {
        updateStatus(`❌ 连接失败: ${testResult.message}`, 'error');
      }
    } catch (error) {
      console.error('添加表格出错:', error);
      if (error.message.includes('未配置飞书访问令牌')) {
        updateStatus('请先配置飞书访问令牌（点击右上角⚙️按钮）', 'error');
      } else {
        updateStatus(`❌ 添加失败: ${error.message}`, 'error');
      }
    }
  });

  // 从URL提取表格名称
  function extractTableNameFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      return pathParts[pathParts.length - 1] || '未命名表格';
    } catch (e) {
      return '未命名表格';
    }
  }

  // 验证飞书URL
  function isValidFeishuUrl(url) {
    try {
      const urlObj = new URL(url);
      // 支持更多飞书相关域名
      const validDomains = [
        'feishu.cn',
        'feishu.com',
        'larksuite.com',
        'larksuite.cn'
      ];
      return validDomains.some(domain => urlObj.hostname.includes(domain));
    } catch (error) {
      return false;
    }
  }

  // 保存按钮点击事件
  saveBtn.addEventListener('click', async function() {
    if (!validateForm()) {
      return;
    }

    const formData = {
      title: currentTabInfo.title,
      url: currentTabInfo.url,
      notes: notesTextarea.value.trim(),
      tags: parseTags(tagsInput.value),
      tableUrl: tableSelect.value,
      timestamp: new Date().toISOString()
    };

    try {
      updateStatus('正在保存到飞书...', 'loading');
      saveBtn.disabled = true;

      // 调用飞书API保存
      await window.feishuAPI.addRecord(formData.tableUrl, formData);

      // 保存到历史记录
      await StorageManager.saveHistory(formData);

      // 保存标签到最近使用
      if (formData.tags.length > 0) {
        await StorageManager.saveRecentTags(formData.tags);
      }

      updateStatus('✅ 保存成功！', 'success');
      clearForm();
      loadHistory();
      loadRecentTags();

      // 3秒后重置状态
      setTimeout(() => {
        updateStatus('准备就绪', '');
        saveBtn.disabled = false;
      }, 3000);

    } catch (error) {
      updateStatus(`❌ 保存失败: ${error.message}`, 'error');
      saveBtn.disabled = false;
    }
  });

  // 表单验证
  function validateForm() {
    if (!currentTabInfo) {
      updateStatus('无法获取页面信息', 'error');
      return false;
    }

    if (!tableSelect.value) {
      updateStatus('请选择飞书表格', 'error');
      return false;
    }

    return true;
  }

  // 解析标签
  function parseTags(tagsStr) {
    return tagsStr.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag);
  }

  // 更新状态
  function updateStatus(message, type = '') {
    statusDiv.textContent = `⏳ 状态: ${message}`;
    statusDiv.className = `status ${type}`;
  }

  // 清空表单
  function clearForm() {
    notesTextarea.value = '';
    tagsInput.value = '';
  }

  // 加载保存的表格配置
  async function loadSavedTables() {
    const tables = await StorageManager.getTables();

    // 清空现有选项（保留默认选项）
    while (tableSelect.children.length > 2) {
      tableSelect.removeChild(tableSelect.lastChild);
    }

    // 添加保存的表格
    tables.forEach((table) => {
      const option = document.createElement('option');
      option.value = table.url;
      option.textContent = table.name;
      tableSelect.appendChild(option);
    });
  }

  // 加载最近使用的标签
  async function loadRecentTags() {
    recentTags = await StorageManager.getRecentTags();
  }

  // 加载历史记录
  async function loadHistory() {
    const history = await StorageManager.getHistory(5);

    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-history">暂无保存记录</div>';
      return;
    }

    historyList.innerHTML = '';
    history.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent = `${new Date(item.timestamp).toLocaleString()} | ${item.tags.join(', ')}`;

      historyItem.appendChild(title);
      historyItem.appendChild(meta);
      historyList.appendChild(historyItem);
    });
  }

  // 清空新表格表单
  function clearNewTableForm() {
    newTableUrl.value = '';
    newTableName.value = '';
  }

  // 点击其他地方隐藏标签建议
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.tags-container')) {
      hideTagSuggestions();
    }
  });

  // 添加配置按钮到状态栏
  const configBtn = document.createElement('button');
  configBtn.className = 'config-btn';
  configBtn.textContent = '⚙️';
  configBtn.title = '配置飞书令牌';
  configBtn.addEventListener('click', showTokenConfigurationDialog);
  document.querySelector('.header').appendChild(configBtn);

  // ========== URL调试相关函数 ==========

  // 测试URL解析
  async function testUrlParsing(url) {
    try {
      // 调用解析函数
      const result = window.feishuAPI.parseFeishuUrl(url);

      if (result && result.appToken && result.tableId) {
        // 解析成功
        showDebugResult({
          success: true,
          message: 'URL解析成功！',
          details: {
            '原始URL': url,
            'App Token': result.appToken,
            'Table ID': result.tableId,
            '域名': new URL(url).hostname
          }
        });
      } else {
        // 解析失败或部分成功
        const errorMsg = result ?
          'URL格式正确，但缺少必要信息（请检查是否包含table参数）' :
          'URL格式不正确，请检查链接是否为飞书多维表格分享链接';

        showDebugResult({
          success: false,
          message: errorMsg,
          details: {
            '原始URL': url,
            '解析结果': result || 'null',
            '建议': '请使用飞书多维表格的分享链接，确保包含?table=参数'
          }
        });
      }
    } catch (error) {
      showDebugResult({
        success: false,
        message: `解析出错: ${error.message}`,
        details: {
          '错误类型': error.constructor.name,
          '错误信息': error.message
        }
      });
    }
  }

  // 显示调试结果
  function showDebugResult(result) {
    urlDebugInfo.style.display = 'block';

    let html = '';

    if (result.success === true) {
      html += `<div class="debug-item debug-success">✅ ${result.message}</div>`;
    } else if (result.success === false) {
      html += `<div class="debug-item debug-error">❌ ${result.message}</div>`;
    } else {
      html += `<div class="debug-item">⏳ ${result.message}</div>`;
    }

    if (result.details) {
      for (const [key, value] of Object.entries(result.details)) {
        const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
        html += `<div class="debug-item"><strong>${key}:</strong> ${displayValue}</div>`;
      }
    }

    // 添加使用提示
    if (result.success === false) {
      html += `
        <div class="debug-item debug-warning">
          <strong>💡 解决建议:</strong><br>
          1. 确保使用飞书多维表格的分享链接<br>
          2. 检查链接是否包含?table=参数<br>
          3. 尝试重新生成分享链接<br>
          4. 确保表格有查看权限
        </div>
      `;
    }

    debugContent.innerHTML = html;
  }
});