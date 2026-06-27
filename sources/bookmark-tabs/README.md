# Bookmark Tabs (v2.1.5)

**Bookmark Tabs** is a lightweight, privacy-focused Firefox extension that allows you to instantly save your current tabs (or just the highlighted ones) into a timestamped bookmark folder.

## Features
- **One-Click Save**: Instantly backup your browsing session.
- **Domain Alias Manager**: Map domain aliases (e.g. `github.blog` → `github.com`) directly in the popup settings to merge separate domains into a single folder.
- **Smart Domain Folders**: Automatically organizes saved tabs into subfolders based on website domains, automatically stripping the `www.` prefix (e.g., `google.com`).
- **Domain Sorting**: Sort bookmarks alphabetically by their domain/hostname.
- **Bookmark Manager Context Menus**: Right-click any folder or individual bookmark in the Firefox Bookmark Manager (Library window) to sort, organize, or flatten bookmarks recursively in place.
- **Manifest V3**: Fully modernized for the latest Firefox security and performance standards.
- **Custom Postfix**: Add custom tags or IDs to your saved folders.
- **Visual Hierarchy**: Folder selection dropdown now shows indented subfolders for easier navigation.
- **Intelligent Mobile Sync**: Option to show or hide the "Mobile Bookmarks" folder based on your preference.
- **Sequential Processing**: Robust background logic prevents API rate-limiting when saving many tabs.
- **No Data Collection**: Operates entirely locally on your machine.

## Required Permissions
- **storage**: To save your preferences (e.g., base save folder, auto-close settings).
- **bookmarks**: To create and manage your saved tab folders.
- **tabs**: To read tab URLs and titles for bookmarking.
- **menus**: To provide easy access from the tab context menu.

## Optional Permissions
- **notifications**: If granted, the extension will notify you when a save operation completes.

## How to use
1. Click the **Bookmark Tabs** icon in your toolbar.
2. (Optional) Enter a postfix title for the folder.
3. Select your base folder.
4. Click **Bookmark Tabs!**

Alternatively, use the keyboard shortcut (configurable in `about:addons`) to skip the popup and save instantly with your default settings.
