# Changelog

All notable changes to this project will be documented in this file.

## [2.0.1] - 2026-06-02

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
