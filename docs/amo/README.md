# AMO preparation docs

This folder is the reviewer and submission prep area for future Firefox Add-on publication.

- `reviewer-notes.md` explains the extension-hosted local game behavior at a high level
- `permissions.md` records why each permission is needed
- `qa-checklist.md` tracks the manual checks to run before submission
- `FORKORFRY_GECKO_ID` should be set when building release artifacts so the manifest uses the published Firefox add-on ID
- the GitHub packaging workflow accepts that Gecko ID via manual input or the repo-level `FORKORFRY_GECKO_ID` variable/secret
- `listing-assets/` is reserved for store screenshots and branding assets
- `extension/SOURCE_CODE_REVIEW.md` gives exact rebuild steps for AMO review
