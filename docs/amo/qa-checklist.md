# AMO QA checklist

- [ ] Load `extension/dist/firefox-mv3/manifest.json` in Firefox temporary add-ons
- [ ] Confirm arm/disarm changes popup state correctly
- [ ] Confirm idle interval changes persist across popup reopen
- [ ] Confirm demo opens the active host surface immediately
- [ ] Confirm Firefox idle opens or reuses the popup-window host when armed
- [ ] Confirm the popup-window host can move the current run into the full-tab host
- [ ] Confirm closing the active host surface clears the stored open-surface state
- [ ] Confirm clear state closes any open host surface and resets the timestamp
- [ ] Confirm runtime copy stays local-only and makes no network requests
- [ ] Confirm light/dark toolbar themes show a visible icon
