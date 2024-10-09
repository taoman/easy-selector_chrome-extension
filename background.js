var pluginStatusInTab = {}; // 插件在标签页中的状态

// 点击插件图标时
chrome.action.onClicked.addListener(function (tab) {
  console.log("点击插件图标", tab);
  var currentTabId = tab.id;

  if (
    !(currentTabId in pluginStatusInTab) ||
    !pluginStatusInTab[currentTabId]
  ) {
    pluginStatusInTab[currentTabId] = true;
    // 注入脚本并执行 init 方法
    chrome.scripting.executeScript(
      {
        target: { tabId: currentTabId },
        files: ["injectScript.js"], // 首先注入脚本文件
      },
      function () {
        chrome.scripting.executeScript({
          target: { tabId: currentTabId },
          func:(tab)=> init(tab), // 然后执行注入脚本中的 init 方法
          args:[tab]
        });
      }
    );
  } else {
    pluginStatusInTab[currentTabId] = false;

    // 执行 destroy 方法
    chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      func: () => destroy(), // 直接调用 injectScript.js 中的 destroy 方法
    });
  }
});
// 页面更新事件（例如页面刷新，输入框内容改变等）
chrome.tabs.onUpdated.addListener(function (tabId, updateInfo) {
  if (tabId in pluginStatusInTab) {
    pluginStatusInTab[tabId] = false;
  }
});
