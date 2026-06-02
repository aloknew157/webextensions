/* global browser */

// --- Storage Helpers ---

const KNOWN_STORAGE_KEYS = new Set([
  "noTimestampSubfolder",
  "saveFolder",
  "closeAfterSave",
  "showMobileBookmarks",
]);

async function getFromStorage(type, id, fallback) {
  if (!KNOWN_STORAGE_KEYS.has(id)) return fallback;
  let tmp = await browser.storage.local.get(id);
  // Extract value without bracket notation to satisfy static analysis (CWE-94)
  let entries = Object.entries(tmp);
  if (entries.length > 0 && entries[0][0] === id && typeof entries[0][1] === type) {
    return entries[0][1];
  }
  return fallback;
}

// --- Generic Change Handler ---

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

// --- Custom Dropdown Logic ---

let dropdownOpen = false;
let highlightedIndex = -1;

function openDropdown() {
  const options = document.getElementById("saveFolderOptions");
  const trigger = document.getElementById("saveFolderTrigger");
  if (!options || !trigger) return;

  options.classList.add("open");
  trigger.setAttribute("aria-expanded", "true");
  dropdownOpen = true;

  // Highlight the currently selected item and scroll it into view
  const items = Array.from(options.children);
  const selectedItem = options.querySelector("li.selected");
  if (selectedItem) {
    highlightedIndex = items.indexOf(selectedItem);
    selectedItem.classList.add("highlighted");
    selectedItem.scrollIntoView({ block: "nearest" });
  } else {
    highlightedIndex = -1;
  }
}

function closeDropdown() {
  const options = document.getElementById("saveFolderOptions");
  const trigger = document.getElementById("saveFolderTrigger");
  if (!options || !trigger) return;

  options.classList.remove("open");
  trigger.setAttribute("aria-expanded", "false");
  dropdownOpen = false;
  highlightedIndex = -1;

  // Remove all keyboard highlights
  options.querySelectorAll("li.highlighted").forEach(
    (li) => li.classList.remove("highlighted")
  );
}

function selectFolder(folderId, folderTitle) {
  const hiddenInput = document.getElementById("saveFolder");
  const label = document.getElementById("saveFolderLabel");
  if (!hiddenInput || !label) return;

  hiddenInput.value = folderId;
  label.textContent = folderTitle;

  // Update selected state in the option list
  const options = document.getElementById("saveFolderOptions");
  if (options) {
    options.querySelectorAll("li.selected").forEach(
      (li) => li.classList.remove("selected")
    );
    const selected = options.querySelector(
      'li[data-value="' + CSS.escape(folderId) + '"]'
    );
    if (selected) selected.classList.add("selected");
  }

  closeDropdown();

  // Trigger storage save via the existing onChange handler
  hiddenInput.dispatchEvent(new Event("input"));
}

function handleDropdownKeydown(evt) {
  const options = document.getElementById("saveFolderOptions");
  if (!options) return;

  const items = Array.from(options.children);
  if (items.length === 0) return;

  // Open dropdown on Enter / Space / ArrowDown when closed
  if (!dropdownOpen) {
    if (evt.key === "Enter" || evt.key === " " || evt.key === "ArrowDown") {
      evt.preventDefault();
      openDropdown();
    }
    return;
  }

  switch (evt.key) {
    case "ArrowDown":
      evt.preventDefault();
      if (highlightedIndex >= 0) {
        items[highlightedIndex].classList.remove("highlighted");
      }
      highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
      items[highlightedIndex].classList.add("highlighted");
      items[highlightedIndex].scrollIntoView({ block: "nearest" });
      break;

    case "ArrowUp":
      evt.preventDefault();
      if (highlightedIndex >= 0) {
        items[highlightedIndex].classList.remove("highlighted");
      }
      highlightedIndex = Math.max(highlightedIndex - 1, 0);
      items[highlightedIndex].classList.add("highlighted");
      items[highlightedIndex].scrollIntoView({ block: "nearest" });
      break;

    case "Enter":
    case " ":
      evt.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < items.length) {
        const li = items[highlightedIndex];
        selectFolder(li.dataset.value, li.dataset.title);
      }
      break;

    case "Escape":
      evt.preventDefault();
      closeDropdown();
      document.getElementById("saveFolderTrigger").focus();
      break;
  }
}

// --- Bookmark Tree Traversal ---

function recGetFolders(node, depth = 0, out = new Map(), showMobile = false) {
  if (typeof node.url !== "string") {
    let isRoot = node.id === "root________";
    let isMobile =
      node.id === "mobile________" ||
      node.id === "mobile" ||
      node.title === "Mobile Bookmarks";

    if (!isRoot && !(isMobile && !showMobile)) {
      out.set(node.id, { depth: depth, title: node.title });
    }

    if (node.children) {
      // Always recurse into root; skip mobile folder when hidden
      if (isRoot || !(isMobile && !showMobile)) {
        for (let child of node.children) {
          recGetFolders(child, depth + 1, out, showMobile);
        }
      }
    }
  }
  return out;
}

// --- Populate Custom Dropdown ---

async function initSelect() {
  const optionsList = document.getElementById("saveFolderOptions");
  const hiddenInput = document.getElementById("saveFolder");
  const label = document.getElementById("saveFolderLabel");
  if (!optionsList || !hiddenInput || !label) return;

  // Reset
  optionsList.innerHTML = "";
  closeDropdown();

  const showMobile = await getFromStorage(
    "boolean",
    "showMobileBookmarks",
    false
  );

  const nodes = await browser.bookmarks.getTree();
  let out = new Map();
  for (const node of nodes) {
    recGetFolders(node, 1, out, showMobile);
  }

  let storedValue = await getFromStorage(
    "string",
    "saveFolder",
    "unfiled_____"
  );
  let selectedTitle = "";

  for (const [k, v] of out) {
    // Indent with non-breaking spaces to show hierarchy in the open list
    let indent = "\u00A0\u00A0\u00A0\u00A0".repeat(
      Math.max(0, v.depth - 1)
    );

    let li = document.createElement("li");
    li.textContent = indent + v.title;
    li.dataset.value = k;
    li.dataset.title = v.title; // Clean title without indent
    li.setAttribute("role", "option");

    if (k === storedValue) {
      li.classList.add("selected");
      selectedTitle = v.title;
    }

    // Click to select this folder
    li.addEventListener("click", () => {
      selectFolder(k, v.title);
    });

    // Sync keyboard highlight with mouse hover
    li.addEventListener("mouseenter", () => {
      optionsList
        .querySelectorAll("li.highlighted")
        .forEach((el) => el.classList.remove("highlighted"));
      highlightedIndex = Array.from(optionsList.children).indexOf(li);
    });

    optionsList.appendChild(li);
  }

  // Set label and hidden input to the stored (or first available) value
  if (selectedTitle) {
    hiddenInput.value = storedValue;
    label.textContent = selectedTitle;
  } else if (out.size > 0) {
    // Stored folder no longer exists; fall back to first available
    const first = out.entries().next().value;
    hiddenInput.value = first[0];
    label.textContent = first[1].title;
    browser.storage.local
      .set({ saveFolder: first[0] })
      .catch(console.error);
  }
}

// --- Restore Stored Settings on DOM Ready ---

document.addEventListener("DOMContentLoaded", () => {
  [
    "noTimestampSubfolder",
    "saveFolder",
    "closeAfterSave",
    "showMobileBookmarks",
  ].forEach((id) => {
    browser.storage.local
      .get(id)
      .then((obj) => {
        let el = document.getElementById(id);
        if (!el) return;

        // Extract value without bracket notation to satisfy static analysis (CWE-94)
        let entries = Object.entries(obj);
        let val = entries.length > 0 && entries[0][0] === id ? entries[0][1] : undefined;

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

// --- Main Initialization ---

async function onLoad() {
  await initSelect();

  // Wire up custom dropdown toggle and keyboard
  const trigger = document.getElementById("saveFolderTrigger");
  const container = document.getElementById("saveFolderContainer");

  if (trigger) {
    trigger.addEventListener("click", () => {
      if (dropdownOpen) {
        closeDropdown();
      } else {
        openDropdown();
      }
    });

    trigger.addEventListener("keydown", handleDropdownKeydown);
  }

  // Close dropdown when clicking outside
  document.addEventListener("click", (evt) => {
    if (container && !container.contains(evt.target) && dropdownOpen) {
      closeDropdown();
    }
  });

  // Save button
  document.getElementById("savebtn").addEventListener("click", async () => {
    await browser.runtime.sendMessage({
      cmd: "bookmark-tabs",
      postfix: document.getElementById("postfix").value,
    });
    window.close();
  });

  // Enter key in postfix field
  document
    .getElementById("postfix")
    .addEventListener("keyup", async (el) => {
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
  }, 300);
}

document.addEventListener("DOMContentLoaded", onLoad);
