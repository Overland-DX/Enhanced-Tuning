# Enhanced Tuning

A plugin for [FM-DX-Webserver](https://github.com/NoobishSVK/fm-dx-webserver) that makes tuning faster and more comfortable: band buttons, flexible tuning steps, AM bandwidth control, tuning limits, a retro analog scale and a full admin panel.

<img width="1346" height="705" alt="Enhanced Tuning with the analog scale" src="https://github.com/user-attachments/assets/bef356b9-2297-496b-bab7-be970e6fed19" />

**Current version: 3.2** · [What's new](#whats-new-in-32) · [Install](#installation) · [Upgrade](#upgrading) · [Admin panel](#admin-panel) · [Works with](#works-well-with) · [Screenshots](#screenshots)

---

## Features

### Tuning
- **Band buttons** for FM, OIRT, AM, SW (with all broadcast sub-bands), MW and LW. Rename bands, set their limits and default frequency in the admin panel.
- **Tune step**: click the frequency to step through 10 kHz, 100 kHz and 1 MHz on FM, or 1 kHz, 10 kHz, 100 kHz and 1 MHz on AM.
- **Band Loop**: tuning past the end of a band wraps around to its start.
- **Frequency memory**: each band remembers the last frequency you used.
- **Smart kHz input**: on AM, type `693` or `9640` and you get 0.693 or 9.640 MHz.
- **Regional tuning standards**: International, Americas (200 kHz FM / 10 kHz MW steps) and Japan.
- **MW 9/10 kHz toggle** for visitors.
- **Hide decimal point on HF** (optional), for a cleaner kHz-style display.

### AM, SW and SSB
- **AM bandwidth** selection (3, 4, 6, 8 kHz) and an optional default bandwidth when entering AM. See the [firmware notes](#firmware-notes).
- **Si47XX (ATS-Mini) support**: AM, USB and LSB mode buttons, SSB bandwidths and sub-kHz SSB tuning.
- **Local AM scanner**: with the Scanner plugin override, scans and searches below 30 MHz stay inside the active sub-band, with a signal threshold per band.

### Tuning limits
- **Server-side limits**: with *Override Server Limits*, separate AM and FM limits are enforced by the server. Tune commands outside them are rejected.
- **Applied instantly**: changes take effect as soon as you save. No restart is needed.

### Retro Design Elements
Built in from Highpoint's [Retro Design Elements](https://github.com/Highpoint2000/RetroDesign), synced with the band switching:
- Analog scale for all bands, with a dual rotary tuning knob
- VU meter, Magic Eye tube and Nixie tubes
- RDS station names on the FM scale, and SW station names on the dial (needs [AM Station Info](https://github.com/Overland-DX/AM-Station-Info) v1.4 or later)
- Spectrum overlay on the dial glass (needs [Spectrum Graph](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Spectrum-Graph))
- Add your own stations to the MW and LW scale (needs AM Station Info v1.4.1 or later)

For each Retro feature, the admin chooses whether it is **Disabled**, **Available – off by default** or **Available – on by default**. Visitors can switch the features themselves in *Enhanced / Retro Settings*, and their own choice always wins.

### Layouts
- **Modern** and **Classic** layouts, or **no buttons** at all for a minimal look.
- Works on mobile, with compact band selectors.

---

## What's new in 3.2

- **Visitor defaults for Retro features**: Disabled, Available – off by default, or Available – on by default.
- **Nixie tubes** for frequency and RDS.
- **Tuning limits enforced on the server** and applied instantly. `config.json` is no longer modified.
- **Spectrum Graph integration**:
  - Live band-limit sync.
  - The scale overlay follows the visible range.
  - Optional *Bandwidth Highlight* and *Follow Band Changes* (see the note below).
- **Admin panel**:
  - GitHub links for the integrated plugins.
  - A session indicator and an in-page login when your admin session expires. Unsaved changes are kept and saved automatically after you log in again.
- **Fixes**:
  - Scanner plugin on AM: Scan no longer turns into a downward search, auto-scan can be stopped again, and sensitivity, mode and hold-time changes now reach the Scanner.
  - Auto Memory stations can be clicked again when Smart kHz Input is on.
  - The MW step follows the 9/10 kHz button everywhere.
- **Included**: all community contributions since 3.1.1, among them Si47XX support by AmateurAudioDude.

> **Note:** *Bandwidth Highlight* and *Follow Band Changes* need matching changes in Spectrum Graph. They are submitted as a [pull request](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Spectrum-Graph/pull/8) and are awaiting review. Until they are released in Spectrum Graph, these two options have no effect. Everything else works with Spectrum Graph v1.5.1.

---

## Installation

1. Download this repository and copy **`Enhanced_Tuning.js`** and the **`EnhancedTuning`** folder into the webserver's `plugins` folder.
2. Restart the webserver, then enable **Enhanced Tuning** in the webserver setup (Plugins).
3. Restart the webserver once more.
4. Log in as admin and open the admin panel: **Settings → Enhanced / Retro Settings → AP**, or go directly to `/enhanced_tuning/AP`.

Settings are stored in `plugins_configs/enhanced_tuning_config.json`. If you start the webserver with `--config <name>`, each instance gets its own file (`enhanced_tuning_config_<name>.json`).

## Upgrading

- Replace `Enhanced_Tuning.js` and the `EnhancedTuning` folder, then restart the webserver once. Your settings are kept, and new options get their defaults.
- **If you use the analog scale**, disable the separate Retro Design Elements plugin by Highpoint. It is built into Enhanced Tuning.
- **Coming from 3.0 or older?** Delete these old files if they are still there: `EnhancedTuning/public/Enhanced_Tuning.css` and `EnhancedTuning/config.json`.
- **Coming from Band Selector?** Disable the old plugin and delete its files first.
- **Tuning limits**: earlier versions set `tuningLimit: false` in the webserver's `config.json` when *Override Server Limits* was on. If you want the webserver's own limit to apply while the override is off, enable it once in the webserver setup.

---

## Admin panel

| Tab | What you set there |
|---|---|
| **1. General UI & Layout** | Layout (Modern, Classic or no buttons), Band Loop, band range display, tune step, hide decimal on HF, enabled bands |
| **2. Tuning & Hardware** | Tuning standard, Smart kHz input, MW 9/10 kHz button, frequency memory, AM bandwidth and firmware type (TEF6686_ESP32, FM-DX-Tuner, Si47XX) |
| **3. Band Limits** | Override Server Limits with AM/FM limits, names, ranges and default frequencies for main bands and SW sub-bands |
| **4. Plugin Integration** | Spectrum Graph, Scanner and Retro Design Elements settings, including the visitor defaults for every Retro feature |

The panel shows whether you are logged in as admin. If your session expires, a login box appears on the page, so you don't lose your unsaved changes.

---

## Works well with

| Plugin | What you get |
|---|---|
| [Spectrum Graph](https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Spectrum-Graph) by AmateurAudioDude | Band-limit sync, spectrum overlay on the analog scale, MW step, scan limits, and optionally *Bandwidth Highlight* and *Follow Band Changes* |
| [Scanner](https://github.com/Highpoint2000/webserver-scanner) by Highpoint | Local AM/SW scanning inside the active sub-band, with per-band thresholds (beta) |
| [AM Station Info](https://github.com/Overland-DX/AM-Station-Info) | SW station names on the dial, and your own MW/LW stations on the scale |
| [Auto Memory](https://github.com/Highpoint2000/AutoMemory) by Highpoint | Works together with Smart kHz input |

<details>
<summary><strong>For plugin developers</strong></summary>

Enhanced Tuning shares its state so other plugins don't need to read its config or DOM.

**Browser**: `window.EnhancedTuning`
- `getMwStepKHz()`, `getTuningStandard()`, `getLimits()`, `getBands()`, `getSpectrumGraphOptions()` (frequencies in MHz)
- Events on `window`: `enhanced-tuning:ready`, `enhanced-tuning:config` (after an admin save), `enhanced-tuning:band-change` (`{ key, start, end, freq, initial }`)
- Listens for `spectrum-graph:update` (`{ minFreq, maxFreq, isScanning }`) to place the scale overlay

**Server**: `plugins_api` event bus, event `'enhanced-tuning'`
- Emits `{ type: 'state', limits, bands, tuningStandard, enabledBands }` at startup, on admin save and when Spectrum Graph's config changes
- Send `{ type: 'request' }` to get the current state

</details>

---

## Firmware notes

> AM bandwidth works with all TEF6686_ESP32 firmware by Sjef Verhoeven, for example on portable units.
> With the FM-DX-Tuner firmware by Konrad it only works on units with the 6686 (F8602) TEF chip. The 6686 (F8605) and 6687 (F8705), as in the Headless TEF, need a small firmware modification.

If you are comfortable flashing your own Headless TEF, there is a guide: [Flash Headless TEF with FM-DX-Tuner-Modded.bin](https://github.com/Overland-DX/Enhanced-Tuning/wiki/Flash-Headless-TEF-with-FM%E2%80%90DX%E2%80%90Tuner.bin)

---

## Screenshots

**Classic layout**

<img width="794" height="368" alt="Classic layout, FM" src="https://github.com/user-attachments/assets/2fbb5904-ecc2-4fff-bd95-f3214c165008" />
<img width="795" height="366" alt="Classic layout, SW" src="https://github.com/user-attachments/assets/23bc4cd0-7b53-4c24-a9f0-48575281b704" />
<img width="792" height="369" alt="Classic layout, MW" src="https://github.com/user-attachments/assets/a42aebd0-9858-43f6-a201-37670d2c41c0" />

**Modern layout**

<img width="785" height="375" alt="Modern layout, FM" src="https://github.com/user-attachments/assets/a59462ea-7253-498b-a511-751f1ca7e4ec" />
<img width="790" height="368" alt="Modern layout, SW" src="https://github.com/user-attachments/assets/94ac071d-e393-4f5f-a859-a2373bf81d91" />
<img width="797" height="373" alt="Modern layout, MW" src="https://github.com/user-attachments/assets/affd5b1b-e52b-4ffa-bc1e-fa5dc3697c38" />

**No buttons**

<img width="796" height="381" alt="Layout without buttons" src="https://github.com/user-attachments/assets/5bcc235a-024c-44aa-a99f-f971ff7453b2" />

---

## Version history

<details>
<summary><strong>3.1.1</strong></summary>

- Add your own stations to the MW and LW scale (needs AM Station Info v1.4.1).
- Community contributions by AmateurAudioDude: admin settings icon with *Hide All Buttons*, hide decimal point on HF with a threshold, Si47XX (ATS-Mini) support, and Override Server Limits for sub-kHz SSB tuning.

</details>

<details>
<summary><strong>3.1: The Retro & Shortwave update</strong></summary>

- **Analog scale integration**: a custom version of Highpoint's Retro Design Elements (v1.2), with the analog dial and dual rotary knobs synced to the band switching. Thanks to Highpoint!
- **SW station names on the dial** inside SW sub-bands, with distances from your server's location (needs AM Station Info).
- Bug fixes.

</details>

<details>
<summary><strong>3.0: The tuning overhaul</strong></summary>

- **Admin panel**: all settings, limits, layouts and bands in one place, instead of editing files.
- **Scanner plugin integration** (experimental): scans below 30 MHz stay inside the active sub-band, with a signal threshold per sub-band.
- **Smart kHz input** for AM/SW.
- **Band customization**: rename bands, adjust limits and default frequencies.
- **Multi-instance support** with `--config`.
- Mobile layout fixes, tuning-limit fixes and session-expiry handling.

</details>

---

## Credits

- **Highpoint**: Retro Design Elements, Scanner and Auto Memory
- **AmateurAudioDude**: Spectrum Graph, and Si47XX support plus other contributions to Enhanced Tuning
- Everyone who reported bugs and suggested features

Licensed under the [MIT License](LICENSE).
