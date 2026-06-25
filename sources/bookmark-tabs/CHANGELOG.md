# Changelog

All notable changes to this project will be documented in this file.

## [2.1.4] - 2026-06-25

### Added
- **Dynamic Alias Count**: Displays the total number of mappings next to the section title (e.g., `Domain Aliases (9)`).
- **Sequential Item Numbering**: Prepends ordered numbers to each domain alias row for easier scanning.
- **Export & Import (Append)**: Added an Export button to copy domain aliases configuration JSON to the clipboard, and an Import button to paste and merge/append JSON configurations into the existing alias list.

### Improved
- **Clean Scrollable View**: Hid the scrollbar from the domain alias list visually while retaining full mouse wheel scroll functionality for a sleek design.

## [2.1.3] - 2026-06-25

### Fixed
- **Nesting Domain Folders**: Prevented unnecessary same-name nested subfolders (e.g., `apache.org/apache.org/`) when saving or organizing bookmarks in folders already named after those domains (supporting direct names and domain alias mappings).
- **Cleanup Automation**: Automatically runs the deduplication and cleanup process immediately following domain organization in the context menu handler.

## [2.1.2] - 2026-06-25

### Added
- **Domain Alias Manager**: Fully interactive UI within the settings popup to view, add, and delete domain aliases. Custom mappings are immediately synchronized to the background sorting/organization systems for real-time bookmark folder flattening.
- **Input Sanitization**: Auto-normalization for custom domain inputs (handles trimming, downcasing, stripping protocol prefixes, paths, and `www.` prefixes).

## [2.1.1] - 2026-06-25

### Fixed
- **Performance**: Hoisted `domainPrefix` storage reads out of per-bookmark loops in `sortFolder` and `organizeFolderRecursive` — eliminates N×IPC calls per folder operation.
- **Notifications**: `notify()` now checks `browser.permissions.contains()` before calling `browser.notifications.create()`, respecting the optional permission contract.

### Improved
- **URL Cleaning**: Added 16 additional tracking parameters: `wbraid`, `gbraid`, `sca_esv`, `sxsrf`, `ttclid`, `twclid`, `igshid`, `si`, `feature`, `_ga`, `_gl`, `__s`, `oly_enc_id`, `oly_anon_id`, `vero_id`, `s_cid`.
- **Documentation**: Added inline documentation to `getBaseDomain()` noting the TLD heuristic trade-off vs. Public Suffix List.

## [2.1.0] - 2026-06-25

### Added
- Added "Organize into Domain Folders" (Smart Sorter) option to group bookmarks by domain, automatically cleaning up hostnames (e.g. stripping `www.`).
- Added "Sort Bookmarks by Domain" option to sort bookmarks and folders alphabetically by domain name, respecting bookmark separators.
- Integrated right-click context menu options into the Firefox Bookmark Manager (Library window) to sort or organize bookmarks in any selected folder recursively (with parent deduction when right-clicking individual bookmarks).
- Complete popup UI visual redesign to a premium, dark-mode/glassmorphic interface with custom slider-like checkboxes, elegant gradients, custom scrollbar styling, and glowing focus borders.

## [2.0.3] - 2026-06-05

### Added
- Added size-specific icon assets (`icon-96.png`, `icon-128.png`) to support high-DPI screens and avoid generic placeholder icons in the Add-ons manager.

### Fixed
- Updated `manifest.json` and `resize.ps1` to generate and map all standard Firefox icon sizes correctly.

## [2.0.2] - 2026-06-02

### Added
- Complete custom dropdown component for "Base Save Folder" to replace the native browser `<select>` overlay hack.
- Full keyboard navigation and accessibility for folder selection (ArrowUp, ArrowDown, Enter, Space, Escape).
- Synchronized mouse-hover and keyboard-focus highlights in the custom dropdown to prevent duplicate indicators.

### Fixed
- Limited dropdown menu height to `65vh` (leaving ~35% viewport space below the menu).
- Added `box-sizing: border-box` to `#postfix` to prevent the text box from overflowing its parent container padding.
- Removed extra `<br>` spacing between the folder selection dropdown and options checklist.
- Moved the "No timestamp subfolder" option into the "Persistent options" fieldset.
- Satisfied safety analysis (CWE-94) by eliminating variable-keyed bracket-notation on objects (now extracted cleanly via `Object.entries()`).
- Removed empty CSS rule `#closeAfterSave {}` to satisfy emptyRules lint warnings.
- Fixed Firefox Add-on Hub validation warning by defining and generating size-specific icon files (`icon-16.png`, `icon-32.png`, `icon-48.png`).
