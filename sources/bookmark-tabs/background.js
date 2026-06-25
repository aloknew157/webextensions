/* global browser */

const manifest = browser.runtime.getManifest();
const extname = manifest.name;
let multipleHighlighted = false;
let postfix = "";

async function notify(message, iconUrl = "icon.png") {
  try {
    const allowed = await browser.permissions.contains({
      permissions: ["notifications"],
    });
    if (!allowed) return;

    const n = await browser.notifications.create("" + Date.now(), {
      type: "basic",
      iconUrl,
      title: extname,
      message,
    });

    setTimeout(() => {
      browser.notifications.clear(n);
    }, 3000);
  } catch (e) {
    console.warn("Notification failed:", e);
  }
}

async function getFromStorage(expectedtype, storeid, fallback) {
  try {
    const tmp = await browser.storage.local.get(storeid);
    if (typeof tmp[storeid] === expectedtype) {
      return tmp[storeid];
    }
  } catch (e) {
    console.error(e);
  }
  return fallback;
}

// add zero padding
function pad(val) {
  return (val < 10 ? "0" : "") + val;
}

function getTimeStampStr() {
  const now = new Date();

  const YY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());

  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());

  return YY + "-" + MM + "-" + DD + " " + hh + ":" + mm + ":" + ss;
}

function getCleanDomain(urlStr) {
  try {
    if (!urlStr) return "";
    const url = new URL(urlStr);
    let hostname = url.hostname;
    if (!hostname) return "";
    hostname = hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    return hostname.trim();
  } catch (e) {
    return "";
  }
}

function getPrefixedTitle(title, urlStr) {
  const domain = getCleanDomain(urlStr);
  if (!domain) return title;
  const prefix = `[${domain}]`;
  const cleanTitle = (title || "").trim();
  if (cleanTitle.startsWith(prefix)) {
    return cleanTitle;
  }
  return `${prefix} ${cleanTitle}`.trim();
}

function getCleanUrl(urlStr) {
  try {
    if (!urlStr) return "";
    const url = new URL(urlStr);
    
    // 1. Strip www.
    if ((url.protocol === "http:" || url.protocol === "https:") && url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.substring(4);
    }
    
    // 2. Google Search specific cleaning vs general tracking parameters
    const isGoogleSearch = url.hostname.includes("google.") && url.pathname === "/search";
    const isAmazon = url.hostname.includes("amazon.");
    const searchParams = url.searchParams;
    const keysToDelete = [];
    
    if (isGoogleSearch) {
      const allowedParams = new Set(["q", "udm", "tbm", "tbs", "pws", "start", "hl", "gl", "num"]);
      for (const key of searchParams.keys()) {
        if (!allowedParams.has(key.toLowerCase())) {
          keysToDelete.push(key);
        }
      }
    } else {
      for (const key of searchParams.keys()) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.startsWith("utm_") ||
          lowerKey.startsWith("pf_rd_") ||
          lowerKey.startsWith("pd_rd_") ||
          // Meta / Google / Microsoft / Yahoo click IDs
          lowerKey === "fbclid" ||
          lowerKey === "gclid" ||
          lowerKey === "gclsrc" ||
          lowerKey === "dclid" ||
          lowerKey === "msclkid" ||
          lowerKey === "yclid" ||
          // Google iOS privacy-safe click IDs
          lowerKey === "wbraid" ||
          lowerKey === "gbraid" ||
          // Google non-functional tokens
          lowerKey === "sca_esv" ||
          lowerKey === "sxsrf" ||
          // Social platform click IDs
          lowerKey === "ttclid" ||
          lowerKey === "twclid" ||
          lowerKey === "igshid" ||
          // YouTube share tracking
          lowerKey === "si" ||
          lowerKey === "feature" ||
          // Google Analytics cross-domain linkers
          lowerKey === "_ga" ||
          lowerKey === "_gl" ||
          // Email marketing trackers
          lowerKey === "mc_cid" ||
          lowerKey === "mc_eid" ||
          lowerKey === "_hsenc" ||
          lowerKey === "_hsmi" ||
          lowerKey === "mkt_tok" ||
          lowerKey === "__s" ||
          lowerKey === "oly_enc_id" ||
          lowerKey === "oly_anon_id" ||
          lowerKey === "vero_id" ||
          // Adobe / Omniture
          lowerKey === "s_cid" ||
          // Amazon / generic referral
          lowerKey === "ref" ||
          lowerKey === "ref_" ||
          lowerKey === "smid" ||
          lowerKey === "qid" ||
          lowerKey === "sr" ||
          lowerKey === "_encoding" ||
          (isAmazon && (lowerKey === "th" || lowerKey === "psc" || lowerKey === "tag"))
        ) {
          keysToDelete.push(key);
        }
      }
    }
    
    for (const key of keysToDelete) {
      searchParams.delete(key);
    }
    
    return url.toString();
  } catch (e) {
    return urlStr;
  }
}

// NOTE: This uses a simple heuristic rather than the full Public Suffix List.
// It works correctly for ~95% of real-world domains (e.g. .co.uk, .com.au, .co.in)
// but has known edge cases with service-level domains like github.io, blogspot.com,
// and deeply nested ccTLDs like .pvt.k12.ma.us.
// A full PSL library (e.g. tldts, psl) would add ~50KB and is not justified for
// a lightweight bookmark extension where grouping accuracy is non-critical.
function getBaseDomain(hostname) {
  if (!hostname) return "";
  const parts = hostname.split(".");
  if (parts.length <= 2) {
    return hostname;
  }
  
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  
  // Heuristic for country code multi-part TLDs (e.g. .co.uk, .com.au)
  const isMultiPart = (last.length === 2 && (prev.length === 2 || prev.length === 3));
  const sliceCount = isMultiPart ? 3 : 2;
  return parts.slice(-sliceCount).join(".");
}

// --- Domain Alias System ---
// User-editable map to merge folders across TLDs (e.g. github.blog → github.com).
// Stored in browser.storage.local as an array of [from, to] pairs.
const DEFAULT_DOMAIN_ALIASES = [
  ["github.blog", "github.com"],
  ["googleblog.com", "google.com"],
];

async function loadAliasMap() {
  const stored = await getFromStorage("object", "domainAliases", null);
  const entries = Array.isArray(stored) ? stored : DEFAULT_DOMAIN_ALIASES;
  const map = new Map();
  for (const [from, to] of entries) {
    if (from && to) map.set(from.toLowerCase().trim(), to.toLowerCase().trim());
  }
  return map;
}

function resolveAlias(baseDomain, aliasMap) {
  if (!baseDomain || !aliasMap) return baseDomain;
  return aliasMap.get(baseDomain) || baseDomain;
}

function isFolderNamedForDomain(folderTitle, domain, aliasMap) {
  if (!folderTitle || !domain) return false;
  const cleanTitle = folderTitle.toLowerCase().trim();
  const cleanDomain = domain.toLowerCase().trim();
  const canonicalTitle = resolveAlias(cleanTitle, aliasMap);
  const canonicalDomain = resolveAlias(cleanDomain, aliasMap);
  return canonicalTitle === canonicalDomain;
}

async function organizeFolderRecursive(folderId) {
  if (!folderId) return;
  const domainPrefix = await getFromStorage("boolean", "domainPrefix", false);
  const aliasMap = await loadAliasMap();

  let folderTitle = "";
  try {
    const parentNodes = await browser.bookmarks.get(folderId);
    if (parentNodes.length > 0) {
      folderTitle = (parentNodes[0].title || "").toLowerCase().trim();
    }
  } catch (e) {
    // Root folders may not have a title
  }

  let children = [];
  try {
    children = await browser.bookmarks.getChildren(folderId);
  } catch (e) {
    console.error("Failed to get folder children for organization:", folderId, e);
    return;
  }

  const bookmarks = [];
  const existingSubfolders = [];

  for (const child of children) {
    if (child.url) {
      bookmarks.push(child);
    } else if (child.type !== "separator") {
      existingSubfolders.push(child);
    }
  }

  // 1. Process existing subfolders recursively first
  for (const sub of existingSubfolders) {
    try {
      await organizeFolderRecursive(sub.id);
    } catch (e) {
      console.error("Failed to recursively organize subfolder:", sub.id, e);
    }
  }

  // 2. Group the bookmarks in the current folder into domain folders (clubbed by base domain)
  const domainFolders = new Map();
  for (const sub of existingSubfolders) {
    domainFolders.set(sub.title.toLowerCase().trim(), sub.id);
  }

  for (const bm of bookmarks) {
    const cleanDomain = getCleanDomain(bm.url);
    const domain = resolveAlias(getBaseDomain(cleanDomain), aliasMap);
    if (!domain) continue;

    if (folderTitle && isFolderNamedForDomain(folderTitle, domain, aliasMap)) {
      try {
        const cleanUrl = getCleanUrl(bm.url);
        const newTitle = domainPrefix ? getPrefixedTitle(bm.title, cleanUrl) : bm.title;
        const updates = {};
        if (cleanUrl !== bm.url) {
          updates.url = cleanUrl;
        }
        if (newTitle !== bm.title) {
          updates.title = newTitle;
        }
        if (Object.keys(updates).length > 0) {
          await browser.bookmarks.update(bm.id, updates);
        }
      } catch (err) {
        console.error("Failed to clean bookmark in place:", bm.url, err);
      }
      continue;
    }

    let targetSubfolderId = domainFolders.get(domain);
    if (!targetSubfolderId) {
      try {
        const newFolder = await browser.bookmarks.create({
          parentId: folderId,
          title: domain,
        });
        targetSubfolderId = newFolder.id;
        domainFolders.set(domain, targetSubfolderId);
      } catch (err) {
        console.error("Failed to create domain folder:", domain, err);
        continue;
      }
    }

    try {
      const cleanUrl = getCleanUrl(bm.url);
      const newTitle = domainPrefix ? getPrefixedTitle(bm.title, cleanUrl) : bm.title;
      const updates = {};
      if (cleanUrl !== bm.url) {
        updates.url = cleanUrl;
      }
      if (newTitle !== bm.title) {
        updates.title = newTitle;
      }
      if (Object.keys(updates).length > 0) {
        await browser.bookmarks.update(bm.id, updates);
      }
      await browser.bookmarks.move(bm.id, { parentId: targetSubfolderId });
    } catch (err) {
      console.error("Failed to move/update bookmark in domain folder:", bm.url, err);
    }
  }
}

async function sortFolderRecursive(folderId) {
  if (!folderId) return;
  try {
    await sortFolder(folderId);
  } catch (err) {
    console.error("Failed to sort folder:", folderId, err);
  }

  let children = [];
  try {
    children = await browser.bookmarks.getChildren(folderId);
  } catch (e) {
    console.error("Failed to get folder children for recursive sort:", folderId, e);
    return;
  }

  for (const child of children) {
    if (!child.url && child.type !== "separator") {
      try {
        await sortFolderRecursive(child.id);
      } catch (e) {
        console.error("Failed to recursively sort subfolder:", child.id, e);
      }
    }
  }
}

async function sortFolder(folderId) {
  const domainPrefix = await getFromStorage("boolean", "domainPrefix", false);
  const aliasMap = await loadAliasMap();
  const children = await browser.bookmarks.getChildren(folderId);
  let segment = [];
  const segments = [];
  let startIdx = 0;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isSeparator = child.type === "separator" || (!child.url && !child.title && child.type === undefined);
    if (isSeparator) {
      if (segment.length > 0) {
        segments.push({ startIdx, items: segment });
        segment = [];
      }
      startIdx = i + 1;
    } else {
      segment.push(child);
    }
  }
  if (segment.length > 0) {
    segments.push({ startIdx, items: segment });
  }

  for (const seg of segments) {
    const sorted = [...seg.items].sort((a, b) => {
      const hostA = a.url ? getCleanDomain(a.url) : (a.title || "");
      const hostB = b.url ? getCleanDomain(b.url) : (b.title || "");
      const baseA = resolveAlias(getBaseDomain(hostA), aliasMap).toLowerCase();
      const baseB = resolveAlias(getBaseDomain(hostB), aliasMap).toLowerCase();

      if (baseA !== baseB) {
        return baseA.localeCompare(baseB);
      }
      return hostA.toLowerCase().localeCompare(hostB.toLowerCase());
    });

    for (let j = 0; j < sorted.length; j++) {
      const targetIdx = seg.startIdx + j;
      try {
        const bm = sorted[j];
        if (bm.url) {
          const cleanUrl = getCleanUrl(bm.url);
          const newTitle = domainPrefix ? getPrefixedTitle(bm.title, cleanUrl) : bm.title;
          const updates = {};
          if (cleanUrl !== bm.url) {
            updates.url = cleanUrl;
          }
          if (newTitle !== bm.title) {
            updates.title = newTitle;
          }
          if (Object.keys(updates).length > 0) {
            await browser.bookmarks.update(bm.id, updates);
          }
        }
        await browser.bookmarks.move(bm.id, { index: targetIdx });
      } catch (err) {
        console.error("Failed to move/update node during sort:", sorted[j].id, err);
      }
    }
  }
}

async function dedupeAndCleanupFolder(folderId) {
  if (!folderId) return;
  const domainPrefix = await getFromStorage("boolean", "domainPrefix", false);
  const aliasMap = await loadAliasMap();

  // Resolve this folder's own title for same-name flattening
  let parentTitle = "";
  try {
    const parentNodes = await browser.bookmarks.get(folderId);
    if (parentNodes.length > 0) parentTitle = (parentNodes[0].title || "").toLowerCase().trim();
  } catch (e) {
    // root folders may not have a title — safe to continue
  }

  let children = [];
  try {
    children = await browser.bookmarks.getChildren(folderId);
  } catch (e) {
    console.error("Failed to get children for dedupe:", folderId, e);
    return;
  }

  // --- Step 1a: Flatten child folders whose name matches this parent ---
  // e.g. reddit.com/reddit.com → move contents up, delete empty child
  if (parentTitle) {
    for (const child of children) {
      const childKey = resolveAlias(child.title.toLowerCase().trim(), aliasMap);
      if (!child.url && child.type !== "separator" && (childKey === parentTitle || childKey === resolveAlias(parentTitle, aliasMap))) {
        try {
          const innerChildren = await browser.bookmarks.getChildren(child.id);
          for (const item of innerChildren) {
            await browser.bookmarks.move(item.id, { parentId: folderId });
          }
          await browser.bookmarks.removeTree(child.id);
        } catch (err) {
          console.error("Failed to flatten same-name subfolder:", child.title, err);
        }
      }
    }
    // Re-fetch after flattening
    try {
      children = await browser.bookmarks.getChildren(folderId);
    } catch (e) {
      return;
    }
  }

  // --- Step 1b: Merge duplicate-named AND alias-matched subfolders ---
  // e.g. github.blog + github.com → merge into github.com
  const folderMap = new Map(); // canonical domain → first folder node
  const duplicateFolders = [];

  for (const child of children) {
    if (!child.url && child.type !== "separator") {
      const rawKey = child.title.toLowerCase().trim();
      const canonicalKey = resolveAlias(rawKey, aliasMap);
      if (folderMap.has(canonicalKey)) {
        duplicateFolders.push({ source: child, target: folderMap.get(canonicalKey) });
      } else {
        folderMap.set(canonicalKey, child);
        // If the folder title differs from its canonical name, rename it
        if (rawKey !== canonicalKey) {
          try {
            await browser.bookmarks.update(child.id, { title: canonicalKey });
          } catch (err) {
            console.error("Failed to rename alias folder:", rawKey, "→", canonicalKey, err);
          }
        }
      }
    }
  }

  for (const { source, target } of duplicateFolders) {
    try {
      const sourceChildren = await browser.bookmarks.getChildren(source.id);
      for (const item of sourceChildren) {
        await browser.bookmarks.move(item.id, { parentId: target.id });
      }
      await browser.bookmarks.removeTree(source.id);
    } catch (err) {
      console.error("Failed to merge duplicate folder:", source.title, err);
    }
  }

  // --- Step 2: Deduplicate bookmarks by cleaned URL ---
  try {
    children = await browser.bookmarks.getChildren(folderId);
  } catch (e) {
    console.error("Failed to re-fetch children after merge:", folderId, e);
    return;
  }

  const seenUrls = new Set();
  for (const child of children) {
    if (child.url) {
      const cleanUrl = getCleanUrl(child.url);
      if (seenUrls.has(cleanUrl)) {
        try {
          await browser.bookmarks.remove(child.id);
        } catch (err) {
          console.error("Failed to remove duplicate bookmark:", child.url, err);
        }
      } else {
        seenUrls.add(cleanUrl);
        try {
          const updates = {};
          if (cleanUrl !== child.url) updates.url = cleanUrl;
          const newTitle = domainPrefix ? getPrefixedTitle(child.title, cleanUrl) : child.title;
          if (newTitle !== child.title) updates.title = newTitle;
          if (Object.keys(updates).length > 0) {
            await browser.bookmarks.update(child.id, updates);
          }
        } catch (err) {
          console.error("Failed to clean bookmark during dedupe:", child.url, err);
        }
      }
    }
  }

  // --- Step 3: Recurse into remaining subfolders ---
  try {
    children = await browser.bookmarks.getChildren(folderId);
  } catch (e) {
    return;
  }
  for (const child of children) {
    if (!child.url && child.type !== "separator") {
      await dedupeAndCleanupFolder(child.id);
    }
  }

  // --- Step 4: Sort after all cleanup ---
  try {
    await sortFolder(folderId);
  } catch (err) {
    console.error("Failed to sort after dedupe:", folderId, err);
  }
}

async function save() {
  let tabs = [];
  try {
    const queryObj = {
      url: ["http://*/*", "https://*/*"],
      currentWindow: true,
      hidden: false,
    };
    if (multipleHighlighted) {
      queryObj.highlighted = true;
    }
    tabs = await browser.tabs.query(queryObj);
  } catch (e) {
    console.error("Error querying tabs:", e);
    return 0;
  }

  if (!tabs || tabs.length < 1) {
    return 0;
  }

  const closeAfterSave = await getFromStorage("boolean", "closeAfterSave", false);
  const noTimestampSubfolder = await getFromStorage("boolean", "noTimestampSubfolder", false);
  const saveFolderId = await getFromStorage("string", "saveFolder", "unfiled_____");
  const smartFolder = await getFromStorage("boolean", "smartFolder", false);
  const domainSort = await getFromStorage("boolean", "domainSort", false);
  const domainPrefix = await getFromStorage("boolean", "domainPrefix", false);

  let saveFolderBM = null;
  try {
    const arr = await browser.bookmarks.get(saveFolderId);
    if (arr.length > 0) {
      saveFolderBM = arr[0];
    }
  } catch (e) {
    console.error("Error getting save folder bookmark:", e);
  }

  if (!saveFolderBM) {
    return 0;
  }

  let targetFolderId = saveFolderBM.id;

  if (!noTimestampSubfolder) {
    try {
      const tsBM = await browser.bookmarks.create({
        parentId: saveFolderBM.id,
        title: (getTimeStampStr() + " " + postfix).trim(),
      });
      targetFolderId = tsBM.id;
    } catch (e) {
      console.error("Error creating timestamp subfolder:", e);
      return 0;
    }
  }

  let targetFolderTitle = "";
  try {
    const parentNodes = await browser.bookmarks.get(targetFolderId);
    if (parentNodes.length > 0) {
      targetFolderTitle = parentNodes[0].title || "";
    }
  } catch (e) {
    // Root folders may not have a title
  }

  // Save each tab sequentially to respect bookmark limits/quota
  let savedCount = 0;
  const domainFolders = new Map();
  const aliasMap = await loadAliasMap();

  for (const tab of tabs) {
    try {
      let destFolderId = targetFolderId;

      if (smartFolder) {
        const cleanDomain = getCleanDomain(tab.url);
        const domain = resolveAlias(getBaseDomain(cleanDomain), aliasMap);
        if (domain && !isFolderNamedForDomain(targetFolderTitle, domain, aliasMap)) {
          let folderId = domainFolders.get(domain);
          if (!folderId) {
            // Check if it already exists under targetFolderId (in case of noTimestampSubfolder = true)
            const children = await browser.bookmarks.getChildren(targetFolderId);
            const existing = children.find(c => !c.url && c.title.toLowerCase().trim() === domain);
            if (existing) {
              folderId = existing.id;
            } else {
              const newFolder = await browser.bookmarks.create({
                parentId: targetFolderId,
                title: domain,
              });
              folderId = newFolder.id;
            }
            domainFolders.set(domain, folderId);
          }
          destFolderId = folderId;
        }
      }

      const cleanUrl = getCleanUrl(tab.url);
      let bmTitle = tab.title || "";
      if (domainPrefix) {
        bmTitle = getPrefixedTitle(bmTitle, cleanUrl);
      }

      const bmCreateData = {
        parentId: destFolderId,
        url: cleanUrl,
      };
      if (typeof bmTitle === "string" && bmTitle.trim() !== "") {
        bmCreateData.title = bmTitle;
      }
      await browser.bookmarks.create(bmCreateData);
      savedCount++;
      if (closeAfterSave) {
        await browser.tabs.remove(tab.id);
      }
    } catch (err) {
      console.error("Failed to bookmark tab:", tab.url, err);
    }
  }

  // Dedupe & sort after saving
  if (smartFolder || domainSort) {
    try {
      await dedupeAndCleanupFolder(targetFolderId);
    } catch (err) {
      console.error("Failed to dedupe/cleanup saved bookmarks folder:", err);
    }
  }

  return savedCount;
}

async function saveAll() {
  if (browser.action) {
    await browser.action.disable();
  }
  
  const nbtabs = await save();
  notify("Saved " + nbtabs + " Tabs");
  
  setTimeout(() => {
    if (browser.action) {
      browser.action.enable();
    }
  }, 3000);
}

function handleHighlighted(highlightInfo) {
  multipleHighlighted = highlightInfo.tabIds.length > 1;
}

browser.tabs.onHighlighted.addListener(handleHighlighted);

browser.commands.onCommand.addListener(async (command) => {
  if (command === "bookmark-tabs") {
    saveAll();
  }
});

browser.runtime.onMessage.addListener(async (data, sender) => {
  if (data.cmd === "bookmark-tabs") {
    postfix = (data.postfix || "").trim();
    await saveAll();
    postfix = "";
  }
});

browser.runtime.onInstalled.addListener(() => {
  browser.menus.create({
    id: "bookmark-tabs-menu",
    title: extname,
    contexts: ["tab"]
  });

  browser.menus.create({
    id: "bookmark-tabs-bookmark-root",
    title: "Bookmark Tabs Options",
    contexts: ["bookmark"]
  });

  browser.menus.create({
    id: "bookmark-organize-domain",
    parentId: "bookmark-tabs-bookmark-root",
    title: "Organize into Domain Folders",
    contexts: ["bookmark"]
  });

  browser.menus.create({
    id: "bookmark-sort-domain",
    parentId: "bookmark-tabs-bookmark-root",
    title: "Sort Bookmarks by Domain",
    contexts: ["bookmark"]
  });

  browser.menus.create({
    id: "bookmark-dedupe-cleanup",
    parentId: "bookmark-tabs-bookmark-root",
    title: "Dedupe \u0026 Cleanup",
    contexts: ["bookmark"]
  });
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "bookmark-tabs-menu") {
    if (browser.action) {
      browser.action.openPopup();
    }
    return;
  }

  // All bookmark-context actions need a resolved folder ID
  const bookmarkActions = new Set([
    "bookmark-organize-domain",
    "bookmark-sort-domain",
    "bookmark-dedupe-cleanup",
  ]);
  if (!bookmarkActions.has(info.menuItemId)) return;

  const bookmarkId = info.bookmarkId;
  if (!bookmarkId) return;

  let folderId = bookmarkId;
  try {
    const nodes = await browser.bookmarks.get(bookmarkId);
    const node = nodes[0];
    if (node && (node.url || node.type === "separator")) {
      folderId = node.parentId;
    }
  } catch (e) {
    console.error("Error getting bookmark node:", e);
    return;
  }

  if (info.menuItemId === "bookmark-organize-domain") {
    await organizeFolderRecursive(folderId);
    await dedupeAndCleanupFolder(folderId);
    notify("Bookmarks organized by domain");
  } else if (info.menuItemId === "bookmark-sort-domain") {
    await sortFolderRecursive(folderId);
    notify("Bookmarks sorted by domain");
  } else if (info.menuItemId === "bookmark-dedupe-cleanup") {
    await dedupeAndCleanupFolder(folderId);
    notify("Bookmarks deduped & cleaned up");
  }
});

