// content.js - 获取当前页面信息
console.log('Feishu Saver content script loaded');

// 获取页面信息
function getPageInfo() {
  return {
    title: document.title,
    url: window.location.href,
    description: getMetaDescription(),
    timestamp: new Date().toISOString()
  };
}

// 获取页面描述
function getMetaDescription() {
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    return metaDesc.getAttribute('content');
  }
  return '';
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageInfo') {
    sendResponse(getPageInfo());
  }
});