/* global browser */

async function getFromStorage(type, id, fallback) {
  let tmp = await browser.storage.local.get(id);
  return typeof tmp[id] === type ? tmp[id] : fallback;
}

function onChange(evt) {
  let id = evt.target.id;
  let el = document.getElementById(id);

  let value = el.type === "checkbox" ? el.checked : el.value;
  let obj = {};

  if (value === "") {
    return;
  }
  if (el.type === "number") {
    try {
      value = parseInt(value, 10);
      if (isNaN(value)) {
        value = parseInt(el.min, 10);
      }
      if (value < parseInt(el.min, 10)) {
        value = parseInt(el.min, 10);
      }
    } catch (e) {
      value = parseInt(el.min, 10) || 0;
    }
  }

  obj[id] = value;

  browser.storage.local.set(obj).then(() => {
    if (id === "showMobileBookmarks") {
      initSelect();
    }
  }).catch(console.error);
}


function updateOverlay() {
  const sel = document.getElementById("saveFolder");
  const label = document.getElementById("saveFolderLabel");
  if (!sel || !label) return;
  const opt = sel.options[sel.selectedIndex];
  if (opt) {
    label.textContent = opt.dataset.title || opt.text.trim();
  }
}

// Ensure DOM is fully loaded before querying elements
document.addEventListener("DOMContentLoaded", () => {
  ["noTimestampSubfolder", "saveFolder", "closeAfterSave", "showMobileBookmarks"].forEach((id) => {
    browser.storage.local
      .get(id)
      .then((obj) => {
        let el = document.getElementById(id);
        if (!el) return;
        
        let val = obj[id];

        if (typeof val !== "undefined") {
          if (el.type === "checkbox") {
            el.checked = val;
          } else {
            el.value = val;
          }
        }
        el.addEventListener("input", onChange);
      })
      .catch(console.error);
  });
});

function recGetFolders(node, depth = 0, out = new Map(), showMobile = false) {
  if (typeof node.url !== "string") {
    let isRoot = node.id === "root________";
    let isMobile = node.id === "mobile________" || node.id === "mobile" || node.title === "Mobile Bookmarks";

    if (!isRoot && !(isMobile && !showMobile)) {
      out.set(node.id, { depth: depth, title: node.title });
    }

    if (node.children) {
      // Always recurse into the root node. 
      // For other folders, only recurse if they aren't hidden (like the mobile folder).
      if (isRoot || !(isMobile && !showMobile)) {
        for (let child of node.children) {
          recGetFolders(child, depth + 1, out, showMobile);
        }
      }
    }
  }
  return out;
}

async function initSelect() {
  const folders = document.getElementById("saveFolder");
  if (!folders) return;

  folders.innerHTML = ""; // Clear existing options

  const showMobile = await getFromStorage("boolean", "showMobileBookmarks", false);

  const nodes = await browser.bookmarks.getTree();
  let out = new Map();
  let depth = 1;
  for (const node of nodes) {
    recGetFolders(node, depth, out, showMobile);
  }
  let tmp = await getFromStorage("string", "saveFolder", "unfiled_____");
  let last_val = "";
  for (const [k, v] of out) {
    // Indent to represent the hierarchy
    let indent = "\u00A0\u00A0\u00A0\u00A0".repeat(Math.max(0, v.depth - 1));
    let displayTitle = indent + v.title;
    let o = new Option(displayTitle, k);
    o.dataset.title = v.title;
    folders.add(o);
    if (k === tmp) {
      last_val = k;
    }
  }
  folders.value = last_val;

  // Remove prior listener in case initSelect is called again (e.g., toggling mobile bookmarks)
  folders.removeEventListener("change", updateOverlay);
  folders.addEventListener("change", updateOverlay);
  updateOverlay();
}

async function onLoad() {
  await initSelect();

  document.getElementById("savebtn").addEventListener("click", async () => {
    await browser.runtime.sendMessage({
      cmd: "bookmark-tabs",
      postfix: document.getElementById("postfix").value,
    });
    window.close();
  });

  document.getElementById("postfix").addEventListener("keyup", async (el) => {
    if (el.key === "Enter") {
      await browser.runtime.sendMessage({
        cmd: "bookmark-tabs",
        postfix: document.getElementById("postfix").value,
      });
      window.close();
    }
  });

  setTimeout(() => {
    document.getElementById("postfix").focus();
  }, 300); // 1000ms was quite long, shortened to 300ms for better UX
}

document.addEventListener("DOMContentLoaded", onLoad);
