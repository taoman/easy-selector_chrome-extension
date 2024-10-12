var isActive = false;
var activeEl = null; // 当前选择的元素
var maskEl;
var removeEventsFn;
var socket;
var tabInfo;

// 开始选择
function handleClickEvent() {
  console.log("触发了click事件");
  if (!isActive) {
    console.log("isActive为false");
    isActive = true;
    maskEl.style.display = "block";
    maskEl.style.pointerEvents = "none";
    document.getElementById("get_ele_selector_btn").classList.add("is-use");
  } else {
    console.log("isActive为true");
    isActive = false;
    maskEl.style.display = "none";
    maskEl.style.pointerEvents = "auto";
    maskEl.style.top = "-100%";
    maskEl.style.left = "-100%";
    document.getElementById("get_ele_selector_btn").classList.remove("is-use");
  }
}
document.addEventListener("DOMContentLoaded", () => {
  try {
    init();

    console.log("初始化成功");
  } catch (error) {
    console.error("初始化错误", error);
  }
});
function init(tab) {
  console.log("init初始化", tab);
  tabInfo = tab;
  socketInit();

  // 防止重复初始化
  if (document.getElementById("easy_selector_toolbar")) {
    return;
  }
  injectHtml(); // 向页面注入html代码
  removeEventsFn = documentBindEvents(); // 给根元素绑定事件

  maskEl = document.getElementById("easy_selector_mask");
  // maskEl.style.border = "2px dashed green";
  // 给指示器按钮绑定点击事件
  document
    .getElementById("get_ele_selector_btn")
    .addEventListener("click", handleClickEvent, false);
}

// 初始化socketIo
function socketInit() {
  // 如果 socket 已经存在，则不重复初始化
  if (socket) {
    return Promise.resolve();
  }

  // 使用 Promise 确保 socket.io 加载完成后再初始化
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("libs/socket/index.js");

    script.onload = () => {
      console.log("socket.io-client 加载成功");

      try {
        // 在脚本加载成功后初始化 socket
        socket = io("http://localhost:3003");
        // socket = io("http://localhost:9108");

        socket.on("connect", () => {
          console.log("连接成功");
        });
        socket.on("connect-error", () => {
          console.log("连接失败");
        });
        socket.on("start_select", () => {
          console.log("收到选元素消息");
          handleClickEvent();
        });

        resolve(); // 成功后 resolve
      } catch (error) {
        console.error("socket 初始化失败:", error);
        reject(error); // 捕获错误并 reject
      }
    };

    script.onerror = () => {
      console.error("socket.io-client 加载失败");
      reject(new Error("socket.io-client 加载失败")); // 加载失败时 reject
    };

    document.head.appendChild(script); // 将 script 标签添加到 head 中
  });

  // if (socket) {
  //   return;
  // }

  // const script = document.createElement("script");
  // script.src = chrome.runtime.getURL("libs/socket/index.js");
  // script.onload = () => {
  //   console.log("socket.io-client 加载成功");
  //   socket = io("http://localhost:3003");
  //   socket.on("connect", () => {
  //     console.log("连接成功");
  //   });
  //   socket.on("connect-error", () => {
  //     console.log("连接失败");
  //   });
  //   socket.on("start_select", () => {
  //     console.log("收到选元素消息");
  //     handleClickEvent();
  //   });
  // };
  // script.onerror = () => {
  //   console.error("socket.io-client 加载失败");
  // };
  // document.head.appendChild(script);
}
/**
 * 给document绑定事件
 * @returns {(function(): void)|*}
 */
function documentBindEvents() {
  var maskEl = document.getElementById("easy_selector_mask");
  var toolbarEl = document.getElementById("easy_selector_toolbar");
  var getEleSelectorBtn = toolbarEl.querySelector(".get-ele-selector");
  var isMouseDown = false;
  var mouseDownTime = 0;
  var elLeftWithMouseX = 0; // 鼠标x坐标点距离元素左边的距离
  var elTopWithMouseY = 0;

  var mouseDownFn = function (e) {
    if (elementContains(toolbarEl, e.target) && !isActive) {
      var elRect = toolbarEl.getBoundingClientRect();
      elLeftWithMouseX = e.pageX - elRect.left;
      elTopWithMouseY = e.pageY - elRect.top;
      isMouseDown = true;
      mouseDownTime = new Date().getTime();
      return;
    }
    if (!isActive) {
      return;
    }

    // 设置高亮选中节点的元素的pointerEvents为auto，以达到禁用选中节点的点击事件效果
    maskEl.style.pointerEvents = "auto";
    isActive = false;
    console.log("activeEl", activeEl);

    var selector = finder(activeEl, {
      // root: document.documentElement,
      className: (name) => {
        return !name.startsWith("is-");
      },
      tagName: (name) => true,
      seedMinLength: 10,
      optimizedMinLength: 15,
    });
    const xpath = getElementWholeXPath(activeEl);
    console.log("信息", xpath, activeEl, selector);
    // showPopper(activeEl, selector, xpath);
    domtoimage.toPng(activeEl).then(function (dataUrl) {
      const data = JSON.stringify({
        "css-selector": selector,
        xpath,
        tabInfo,
        dataUrl,
      });
      socket.emit("send_dom", data);
    });
    var timer = setTimeout(function () {
      clearTimeout(timer);
      maskEl.style.display = "none";
      maskEl.style.pointerEvents = "none";
      maskEl.style.top = "-100%";
      maskEl.style.left = "-100%";
      getEleSelectorBtn.classList.remove("is-use");
    }, 220);
  };
  var mouseMoveFn = function (e) {
    var target = (e || window.event).target;
    // 移动工具栏
    if (!isActive && isMouseDown) {
      console.log("移动工具栏", isActive, isMouseDown);
      moveToolBar(e);
      return;
    }

    if (
      !isActive ||
      target === activeEl ||
      elementContains(toolbarEl, target)
    ) {
      return;
    }
    var targetRect = target.getBoundingClientRect();
    activeEl = target;
    maskEl.style.width = targetRect.width + "px";
    maskEl.style.height = targetRect.height + "px";
    maskEl.style.top = targetRect.top + "px";
    maskEl.style.left = targetRect.left + "px";
  };
  var mouseUpFn = function (e) {
    isMouseDown = false;
    console.log("触发了mouseUpFn事件");
    if (new Date().getTime() - mouseDownTime > 300) {
      // 防止按钮点击事件不可用

      if (elementContains(toolbarEl, e.target)) {
        var btns = [].slice.call(toolbarEl.querySelectorAll("button"));
        getEleSelectorBtn.classList.remove("is-use");
        // 将按钮都禁用掉，以免触发按钮的click事件，随后将其恢复可用
        btns.forEach(function (btn) {
          if (!btn.hasAttribute("disabled")) {
            btn.setAttribute("temporary-disabled", "true");
            btn.setAttribute("disabled", "disabled");
          }
        });

        var timer = setTimeout(function () {
          clearTimeout(timer);
          btns.forEach(function (btn) {
            if (btn.hasAttribute("temporary-disabled")) {
              btn.removeAttribute("disabled");
              btn.removeAttribute("temporary-disabled");
              btn.disabled = false;
            }
          });
        }, 100);
      }
    }
  };
  // 移动工具栏
  var moveToolBar = function (e) {
    var mouseX = e.pageX,
      mouseY = e.pageY;
    e.preventDefault();
    toolbarEl.style.left = mouseX - elLeftWithMouseX + "px";
    toolbarEl.style.top = mouseY - elTopWithMouseY + "px";
  };
  var handleMouseDown = function (e) {
    if (e.ctrlKey) {
      mouseDownFn(e);
    }
  };
  // 给根元素绑定mousemove事件
  document.addEventListener("mousemove", mouseMoveFn, false);
  // 给根节点绑定mousedown事件
  document.addEventListener("mousedown", handleMouseDown, false);
  // 给根节点绑定mouseup事件
  document.addEventListener("mouseup", mouseUpFn, false);

  // 移除事件
  return function () {
    document.removeEventListener("mousemove", mouseMoveFn, false);
    document.removeEventListener("mousedown", handleMouseDown, false);
    document.removeEventListener("mouseup", mouseUpFn, false);
    maskEl = toolbarEl = getEleSelectorBtn = null;
  };
}

// 销毁
function destroy() {
  if (!removeEventsFn) {
    return;
  }
  removeEventsFn();
  document.body.removeChild(document.getElementById("easy_selector_mask"));
  document.body.removeChild(document.getElementById("easy_selector_toolbar"));
  isActive = false;
  activeEl = null;
  removeEventsFn = null;
  socket.disconnect();
  socket = null;
}

/**
 * 显示气泡弹窗
 * @param targetEl 目标元素
 * @param content 内容
 */
function showPopper(targetEl, content, xpath) {
  console.log("content", content);
  let tipIns = tippy(targetEl, {
    content: "点击发送",
    trigger: "click",
    animation: "shift-away",
    arrow: true,
    interactive: true,
    allowHTML: true,
    // maxWidth: 650,
    appendTo: document.body,
    onCreate(ins) {
      var popperEl = ins.popper;
      popperEl.className = popperEl.className + " easy-selector-popper";
      let tippyContent = popperEl.querySelector(".tippy-content");
      tippyContent.title = "双击可复制内容！";
      tippyContent.addEventListener(
        "click",
        function (e) {
          // e.preventDefault();
          copy(content);
          domtoimage.toPng(targetEl).then(function (dataUrl) {
            const data = JSON.stringify({
              "css-selector": content,
              xpath,
              tabInfo,
              dataUrl,
            });
            socket.emit("send_dom", data);
            showMessage("CSS Selector复制成功！");
            ins.hide();
            tippyContent = ins = tipIns = null;
          });
        },
        false
      );
    },
    onHidden(ins) {
      ins.destroy();
    },
  });
  // 防止火狐浏览器第一次时气泡弹窗显示不了
  let timer = setTimeout(function () {
    clearTimeout(timer);
    tipIns.show();
  }, 0);
}

/**
 * 向页面插入dom
 */
function injectHtml() {
  var html = `
        <div class="easy-selector-mask" id="easy_selector_mask"></div>
        <ul class="easy-selector-toolbar" id="easy_selector_toolbar">
          <li class="easy-selector-fun">
            <button type="button" id="get_ele_selector_btn" class="get-ele-selector" title="点击即可拾取元素CSS选择器">
              <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6069" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><style type="text/css"></style></defs><path d="M281.6 137.813333a128 128 0 0 0-128 128v469.333334a128 128 0 0 0 128 128h213.333333a42.666667 42.666667 0 1 0 0-85.333334h-213.333333a42.666667 42.666667 0 0 1-42.666667-42.666666v-469.333334a42.666667 42.666667 0 0 1 42.666667-42.666666h469.333333a42.666667 42.666667 0 0 1 42.666667 42.666666v213.333334a42.666667 42.666667 0 1 0 85.333333 0v-213.333334a128 128 0 0 0-128-128h-469.333333z m294.613333 380.544l42.154667 365.184a21.333333 21.333333 0 0 0 38.357333 10.24l80.213334-108.629333 114.048 169.941333a42.666667 42.666667 0 1 0 70.826666-47.573333l-114.048-169.941333 124.416-36.693334a21.333333 21.333333 0 0 0 3.498667-39.552l-328.746667-164.522666a21.333333 21.333333 0 0 0-30.72 21.546666z" p-id="6070"></path></svg>
            </button>
          </li>
        </ul>`;
  var temp = document.createElement("div");
  temp.innerHTML = html;
  var children = [].slice.call(temp.children);
  for (var i = 0, len = children.length; i < len; i++) {
    document.body.appendChild(children[i]);
  }
  children = temp = null;
}

/**
 * 显示消息
 * @param msg 消息
 */
function showMessage(msg) {
  var msgEl = document.createElement("div");
  msgEl.className = "easy-selector-message enter";
  msgEl.innerHTML = msg;
  document.body.appendChild(msgEl);
  var timer = setTimeout(function () {
    clearTimeout(timer);
    msgEl.className = "easy-selector-message";
    msgEl.style.top = "10px";
  }, 250);
  var timer2 = setTimeout(function () {
    clearTimeout(timer2);
    document.body.removeChild(msgEl);
    msgEl = null;
  }, 2500);
}

/**
 * 复制内容到剪切板
 * @param content 需复制的内容
 */
function copy(content) {
  var input = document.createElement("input");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  input.value = content;
  document.body.appendChild(input);
  input.select();
  // 将内容复制到剪切板
  document.execCommand("copy");
  document.body.removeChild(input);
  input = null;
}
/**
 * 判断两个元素是否是包含关系
 * @param parentEl 父元素
 * @param childEle 子元素
 * @returns {Boolean}
 */
function elementContains(parentEl, childEle) {
  if (parentEl === childEle) {
    return false;
  }
  if (typeof parentEl.contains === "function") {
    return parentEl.contains(childEle);
  } else {
    while (true) {
      if (!childEle) {
        return false;
      }
      if (childEle === parentEl) {
        return true;
      } else {
        childEle = childEle.parentNode;
      }
    }
    return false;
  }
}

// /html/body/div[1]/div/main/div/div[2]/div[1]/div[2]/div[4]/div/div[2]/div[1]/section[1]/div[2]/a/h2
// /html/body/div/div/main/div/div[2]/div/div[2]/div[4]/div/div[2]/div/section/div[2]/a/h2
function getElementWholeXPath(element) {
  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const getIndex = (el) => {
    let index = 1;
    let sibling = el.previousSibling;

    while (sibling) {
      // 只计数相同类型的元素节点
      if (
        sibling.nodeType === Node.ELEMENT_NODE &&
        sibling.nodeName === el.nodeName
      ) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    return index;
  };

  const parts = [];
  while (element && element.nodeType === Node.ELEMENT_NODE) {
    const index = getIndex(element);
    const tagName = element.nodeName.toLowerCase();
    // 只有有多个相同兄弟节点时才添加索引
    const pathIndex = index > 1 ? `[${index}]` : "";
    parts.unshift(`${tagName}${pathIndex}`);
    element = element.parentNode;
  }

  return parts.length ? `/${parts.join("/")}` : null;
}

function getXPath(element) {
  if (element.id !== "") {
    // 如果元素具有 ID 属性
    return '//*[@id="' + element.id + '"]'; // 返回格式为 '//*[@id="elementId"]' 的 XPath 路径
  }
  if (element === document.body) {
    // 如果当前元素是 document.body
    return "/html/body"; // 返回 '/html/body' 的 XPath 路径
  }

  var index = 1;
  const childNodes = element.parentNode ? element.parentNode.childNodes : []; // 获取当前元素的父节点的子节点列表
  var siblings = childNodes;

  for (var i = 0; i < siblings.length; i++) {
    var sibling = siblings[i];
    if (sibling === element) {
      // 遍历到当前元素
      // 递归调用，获取父节点的 XPath 路径，然后拼接当前元素的标签名和索引
      return (
        getXPath(element.parentNode) +
        "/" +
        element.tagName.toLowerCase() +
        "[" +
        index +
        "]"
      );
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      // 遍历到具有相同标签名的元素
      index++; // 增加索引值
    }
  }
}
