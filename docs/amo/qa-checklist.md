# AMO QA checklist

- [ ] Load `extension/dist/firefox-mv3/manifest.json` in Firefox temporary add-ons
- [ ] Confirm arm/disarm changes popup state correctly
- [ ] Confirm idle interval changes persist across popup reopen
- [ ] Confirm demo opens the takeover tab immediately
- [ ] Confirm Firefox idle opens or reuses the takeover tab when armed
- [ ] Confirm dismiss closes the takeover tab and disarms the extension
- [ ] Confirm clear state closes the takeover tab and resets the timestamp
- [ ] Confirm takeover copy stays obviously local-only and fake
- [ ] Confirm light/dark toolbar themes show a visible icon
