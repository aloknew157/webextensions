/* global browser */

// --- Storage Helpers ---

const KNOWN_STORAGE_KEYS = new Set([
  "noTimestampSubfolder",
  "saveFolder",
  "closeAfterSave",
  "showMobileBookmarks",
  "smartFolder",
  "domainSort",
  "domainPrefix",
  "domainAliases",
  "aliasSectionOpen",
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
    "smartFolder",
    "domainSort",
    "domainPrefix",
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

// --- Domain Alias Manager Helpers ---

const DEFAULT_DOMAIN_ALIASES = [
  ["github.blog", "github.com"],
  ["googleblog.com", "google.com"],
];

async function loadAliases() {
  const stored = await getFromStorage("object", "domainAliases", null);
  return Array.isArray(stored) ? stored : DEFAULT_DOMAIN_ALIASES;
}

async function saveAliases(aliases) {
  await browser.storage.local.set({ domainAliases: aliases });
}

function cleanInputDomain(value) {
  if (!value) return "";
  let val = value.trim().toLowerCase();
  if (val.includes("://")) {
    try {
      const url = new URL(val);
      val = url.hostname;
    } catch (e) {
      val = val.split("://")[1];
    }
  }
  val = val.split("/")[0].split(":")[0];
  if (val.startsWith("www.")) {
    val = val.substring(4);
  }
  return val.trim();
}

function renderAliases(aliases) {
  const listEl = document.getElementById("aliasList");
  if (!listEl) return;
  listEl.innerHTML = "";

  const titleEl = document.getElementById("aliasTitle");
  if (titleEl) {
    titleEl.textContent = `Domain Aliases (${aliases.length})`;
  }

  if (aliases.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "alias-empty";
    emptyEl.textContent = "No aliases defined.";
    listEl.appendChild(emptyEl);
    return;
  }

  aliases.forEach((alias, idx) => {
    const row = document.createElement("div");
    row.className = "alias-row";

    const numSpan = document.createElement("span");
    numSpan.className = "alias-num";
    numSpan.textContent = `${idx + 1}.`;

    const fromSpan = document.createElement("span");
    fromSpan.className = "alias-from";
    fromSpan.textContent = alias[0];
    fromSpan.title = alias[0];

    const arrowSpan = document.createElement("span");
    arrowSpan.className = "alias-arrow";
    arrowSpan.textContent = "→";

    const toSpan = document.createElement("span");
    toSpan.className = "alias-to";
    toSpan.textContent = alias[1];
    toSpan.title = alias[1];

    const delBtn = document.createElement("button");
    delBtn.className = "alias-del";
    delBtn.textContent = "×";
    delBtn.title = "Delete alias";
    delBtn.addEventListener("click", async () => {
      const updated = aliases.filter((_, i) => i !== idx);
      await saveAliases(updated);
      renderAliases(updated);
    });

    row.appendChild(numSpan);
    row.appendChild(fromSpan);
    row.appendChild(arrowSpan);
    row.appendChild(toSpan);
    row.appendChild(delBtn);
    listEl.appendChild(row);
  });
}

// --- Main Initialization ---

async function onLoad() {
  await initSelect();

  // --- Initialize Multi-View Transition Logic ---
  const mainView = document.getElementById("mainView");
  const aliasView = document.getElementById("aliasView");
  const openAliasesBtn = document.getElementById("openAliasesBtn");
  const aliasBackBtn = document.getElementById("aliasBackBtn");

  if (openAliasesBtn && aliasBackBtn && mainView && aliasView) {
    openAliasesBtn.addEventListener("click", () => {
      mainView.style.display = "none";
      aliasView.style.display = "block";
      const inputFrom = document.getElementById("aliasFrom");
      if (inputFrom) {
        setTimeout(() => inputFrom.focus(), 100);
      }
    });

    aliasBackBtn.addEventListener("click", () => {
      aliasView.style.display = "none";
      mainView.style.display = "block";
      const postfixInput = document.getElementById("postfix");
      if (postfixInput) {
        setTimeout(() => postfixInput.focus(), 100);
      }
    });
  }

  const aliases = await loadAliases();
  renderAliases(aliases);

  const addBtn = document.getElementById("aliasAddBtn");
  const inputFrom = document.getElementById("aliasFrom");
  const inputTo = document.getElementById("aliasTo");

  if (addBtn && inputFrom && inputTo) {
    addBtn.addEventListener("click", async () => {
      const fromVal = cleanInputDomain(inputFrom.value);
      const toVal = cleanInputDomain(inputTo.value);

      if (!fromVal || !toVal) {
        if (!fromVal) {
          inputFrom.style.borderColor = "#ef4444";
          setTimeout(() => { inputFrom.style.borderColor = ""; }, 1500);
        }
        if (!toVal) {
          inputTo.style.borderColor = "#ef4444";
          setTimeout(() => { inputTo.style.borderColor = ""; }, 1500);
        }
        return;
      }

      if (fromVal === toVal) {
        inputFrom.style.borderColor = "#ef4444";
        inputTo.style.borderColor = "#ef4444";
        setTimeout(() => {
          inputFrom.style.borderColor = "";
          inputTo.style.borderColor = "";
        }, 1500);
        return;
      }

      const current = await loadAliases();
      const filtered = current.filter(item => item[0] !== fromVal);
      filtered.push([fromVal, toVal]);

      await saveAliases(filtered);
      renderAliases(filtered);

      inputFrom.value = "";
      inputTo.value = "";
      inputFrom.focus();
    });

    const handleAddKeydown = (evt) => {
      if (evt.key === "Enter") {
        addBtn.click();
      }
    };
    inputFrom.addEventListener("keydown", handleAddKeydown);
    inputTo.addEventListener("keydown", handleAddKeydown);
  }

  // --- Export and Import Event Listeners ---
  const exportBtn = document.getElementById("aliasExportBtn");
  const importBtn = document.getElementById("aliasImportBtn");

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      try {
        const current = await loadAliases();
        const json = JSON.stringify(current);
        await navigator.clipboard.writeText(json);
        const oldText = exportBtn.textContent;
        exportBtn.textContent = "Copied!";
        setTimeout(() => { exportBtn.textContent = oldText; }, 2000);
      } catch (err) {
        console.error("Failed to copy aliases to clipboard:", err);
      }
    });
  }

  if (importBtn) {
    importBtn.addEventListener("click", async () => {
      const input = prompt("Paste your exported JSON aliases here:");
      if (!input) return;
      try {
        const parsed = JSON.parse(input);
        if (Array.isArray(parsed)) {
          const current = await loadAliases();
          const map = new Map();
          for (const item of current) {
            if (Array.isArray(item) && item[0] && item[1]) {
              map.set(item[0].toLowerCase().trim(), item[1].toLowerCase().trim());
            }
          }
          for (const item of parsed) {
            if (Array.isArray(item) && item[0] && item[1]) {
              const fromVal = cleanInputDomain(item[0]);
              const toVal = cleanInputDomain(item[1]);
              if (fromVal && toVal && fromVal !== toVal) {
                map.set(fromVal, toVal);
              }
            }
          }
          const updated = Array.from(map.entries());
          await saveAliases(updated);
          renderAliases(updated);
        } else {
          alert("Invalid format: JSON must be an array of domain pairs.");
        }
      } catch (err) {
        alert("Failed to parse JSON. Please make sure you copied the correct export string.");
      }
    });
  }

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
