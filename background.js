var pluginStatusInTab = {}; // 插件在标签页中的状态
var lastActiveTabId = null; // 保存上一个激活的标签页ID
var lastActiveTabUrl = null; // 保存上一个激活标签页的URL
// 封装执行脚本的函数
function executeInTab(tabId, func, args = [], file = null) {
  // 检查 tabId 是否存在，避免报错
  chrome.tabs.get(tabId, (tab) => {
    // 检查是否是无法注入脚本的页面
    if (
      !tab ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("about:") ||
      tab.url.startsWith("file://")
    ) {
      console.warn(`无法在 ${tab.url} 页面注入脚本`);
      return;
    }
    if (chrome.runtime.lastError || !tab) {
      console.warn(`找不到 ${tabId} : ${chrome.runtime.lastError?.message}`);
      return;
    }

    // 如果需要先注入文件
    if (file) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabId },
          files: [file],
        },
        () => {
          if (chrome.runtime.lastError) {
            console.warn(`无法注入脚本：${chrome.runtime.lastError.message}`);
            return;
          }
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: func,
            args: args,
          });
        }
      );
    } else {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: func,
        args: args,
      });
    }
  });
}

// 激活页面时调用
chrome.tabs.onActivated.addListener(function (activeInfo) {
  const newTabId = activeInfo.tabId;
  console.log("页面激活", newTabId, lastActiveTabId);

  // 如果有上一个标签页，执行 destroy
  if (
    lastActiveTabId &&
    lastActiveTabId !== newTabId &&
    pluginStatusInTab[lastActiveTabId]
  ) {
    executeInTab(lastActiveTabId, () => destroy()); // 销毁上一个标签页中的插件
    pluginStatusInTab[lastActiveTabId] = false;
  }

  lastActiveTabId = newTabId;

  // 获取当前标签页的 URL
  chrome.tabs.get(newTabId, (tab) => {
    lastActiveTabUrl = tab.url; // 更新当前激活标签页的 URL

    // 如果当前标签页未初始化插件，则执行 init
    executeInTab(newTabId, (tab) => init(tab), [activeInfo], "injectScript.js");
    pluginStatusInTab[newTabId] = true; // 标记插件已初始化
  });
});

// 页面更新事件（例如页面刷新，输入框内容改变等）
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  console.log("页面更新", tabId, changeInfo, tab);
  if (
    changeInfo.status === "complete" &&
    tabId === lastActiveTabId // 确保是当前激活的标签页
  ) {
    // 检查 URL 是否发生变化
    if (tab.url !== lastActiveTabUrl) {
      executeInTab(tabId, (tab) => init(tab), [tab]);
      pluginStatusInTab[tabId] = true; // 标记插件已初始化
      lastActiveTabUrl = tab.url; // 更新当前激活标签页的 URL
    }
  }
});
// 监听新增页面
chrome.tabs.onCreated.addListener(function (tab) {
  console.log("新页面创建", tab.id);
  if (!pluginStatusInTab[tab.id]) {
    executeInTab(tab.id, (tab) => init(tab), [tab], "injectScript.js");
    pluginStatusInTab[tab.id] = true;
  }
});
// onRemoved: 清理被关闭的标签页
chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
  if (tabId in pluginStatusInTab) {
    console.log("标签页被移除", tabId);

    delete pluginStatusInTab[tabId];
    // 删除 lastActiveTabId 中的该标签页ID，避免后续逻辑错误
    if (lastActiveTabId === tabId) {
      lastActiveTabId = null;
      lastActiveTabUrl = null; // 清理上一个激活标签页的URL
    }
  }
});
// chrome.tabs.onHighlighted.addListener(function (highlightInfo) {
//   console.log("高亮标签页", highlightInfo);
// });

// 点击插件图标时
// chrome.action.onClicked.addListener(function (tab) {
//   console.log("点击插件图标", tab);
//   var currentTabId = tab.id;

//   if (
//     !(currentTabId in pluginStatusInTab) ||
//     !pluginStatusInTab[currentTabId]
//   ) {
//     pluginStatusInTab[currentTabId] = true;
//     // 注入脚本并执行 init 方法
//     chrome.scripting.executeScript(
//       {
//         target: { tabId: currentTabId },
//         files: ["injectScript.js"], // 首先注入脚本文件
//       },
//       function () {
//         chrome.scripting.executeScript({
//           target: { tabId: currentTabId },
//           func:(tab)=> init(tab), // 然后执行注入脚本中的 init 方法
//           args:[tab]
//         });
//       }
//     );
//   } else {
//     pluginStatusInTab[currentTabId] = false;

//     // 执行 destroy 方法
//     chrome.scripting.executeScript({
//       target: { tabId: currentTabId },
//       func: () => destroy(), // 直接调用 injectScript.js 中的 destroy 方法
//     });
//   }
// });

// 页面更新事件（例如页面刷新，输入框内容改变等）
// chrome.tabs.onUpdated.addListener(function (tabId, updateInfo) {
//   console.log("页面更新事件", tabId, updateInfo);
//   if (tabId in pluginStatusInTab) {
//     pluginStatusInTab[tabId] = false;
//   }
// });

// chrome.runtime.onInstalled.addListener(() => {
//   console.log("My extension is installed!");
// });
