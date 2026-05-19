/* global browser */

const manifest = browser.runtime.getManifest();
const extname = manifest.name;
let multipleHighlighted = false;
let postfix = "";

async function notify(message, iconUrl = "icon.png") {
  try {
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
    // noop
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

  // Save each tab sequentially to respect bookmark limits/quota
  let savedCount = 0;
  for (const tab of tabs) {
    try {
      const bmCreateData = {
        parentId: targetFolderId,
        url: tab.url,
      };
      if (typeof tab.title === "string" && tab.title.trim() !== "") {
        bmCreateData.title = tab.title;
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
});

browser.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "bookmark-tabs-menu") {
    if (browser.action) {
      browser.action.openPopup();
    }
  }
});
