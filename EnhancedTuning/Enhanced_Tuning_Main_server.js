'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const endpointsRouter = require('../../server/endpoints');

const rootDir = path.dirname(require.main.filename);
const configFolderPath = path.join(rootDir, 'plugins_configs');

if (!fs.existsSync(configFolderPath)) {
    fs.mkdirSync(configFolderPath, { recursive: true });
}

let configSuffix = '';
const configArgIndex = process.argv.indexOf('--config');
if (configArgIndex !== -1 && process.argv.length > configArgIndex + 1) {
    configSuffix = '_' + process.argv[configArgIndex + 1];
} else if (process.env.CONFIG) {
    configSuffix = '_' + process.env.CONFIG;
}

const CONFIG_FILE = path.join(configFolderPath, `enhanced_tuning_config${configSuffix}.json`);


// Default Configuration
let pluginConfig = {
    // Layout & UI
    LAYOUT_STYLE: 'modern',
    HIDE_ALL_BUTTONS: false,
    SHOW_LOOP_BUTTON: true,
    SHOW_BAND_RANGE: true,
    HIDE_DECIMAL_FOR_HF: false,
    HIDE_DECIMAL_HF_THRESHOLD: 30,
    ENABLE_TUNE_STEP_FEATURE: true,
    TUNE_STEP_TIMEOUT_SECONDS: 20,
    ENABLED_BANDS:['FM', 'OIRT', 'SW', 'MW', 'LW'],
    
    // Tuning & Hardware
    TUNING_STANDARD: 'international',
    ENABLE_MW_STEP_TOGGLE: true,
    ENABLE_FREQUENCY_MEMORY: true,
    ENABLE_SMART_KHZ_INPUT: true,
    ENABLE_AM_BW: true,
    FIRMWARE_TYPE: 'FM-DX-Tuner',
    ENABLE_DEFAULT_AM_BW: false,
    DEFAULT_AM_BW_VALUE: '56000',

    // Limits
    overrideServerTuningLimit: true,
    fmLower: 64.0, fmUpper: 108.0,
    amLower: 0.144, amUpper: 30.0,

    // Egendefinerte Bånd & Navn
    customMainBands: {
        'AM_SUPER': { name: 'AM', tune: 1.000, start: 0.144, end: 27.0 },
        'FM': { name: 'FM', tune: 87.500, start: 87.5, end: 108.0 },
        'OIRT': { name: 'OIRT', tune: 65.900, start: 65.9, end: 74.0 },
        'SW': { name: 'SW', tune: 9.400, start: 1.710, end: 27.0 },
        'MW': { name: 'MW', tune: 0.504, start: 0.504, end: 1.701 },
        'LW': { name: 'LW', tune: 0.144, start: 0.144, end: 0.351 }
    },
    customSwBands: {
        '160m': { tune: 1.8, start: 1.8, end: 2.0 }, '120m': { tune: 2.3, start: 2.3, end: 2.5 },
        '90m': { tune: 3.2, start: 3.2, end: 3.4 }, '75m': { tune: 3.9, start: 3.9, end: 4.0 },
        '60m': { tune: 4.75, start: 4.75, end: 5.06 }, '49m': { tune: 5.9, start: 5.9, end: 6.2 },
        '41m': { tune: 7.2, start: 7.2, end: 7.6 }, '31m': { tune: 9.4, start: 9.4, end: 9.9 },
        '25m': { tune: 11.6, start: 11.6, end: 12.1 }, '22m': { tune: 13.57, start: 13.57, end: 13.87 },
        '19m': { tune: 15.1, start: 15.1, end: 15.83 }, '16m': { tune: 17.48, start: 17.48, end: 17.9 },
        '15m': { tune: 18.9, start: 18.9, end: 19.02 }, '13m': { tune: 21.45, start: 21.45, end: 21.85 },
        '11m': { tune: 25.67, start: 25.67, end: 26.1 }
    },

    // Plugins Integration
    ENABLE_AM_SCANNER: false,
    SYNC_SPECTRUM_GRAPH_BANDS: false, 
    SG_BANDWIDTH_HIGHLIGHT: false,   // Spectrum Graph highlight width follows the selected bandwidth
    SG_FOLLOW_BAND: 'off',           // 'off' | 'last' (show last scan of the band) | 'scan' (scan the band)
    ENABLE_ANALOG_SCALE: true,
    ANALOG_SCALE_AUTOSTART: true,
    SHOW_TUNING_KNOB: true,
    ANALOG_SCALE_ENABLE_FM: true,
    ANALOG_SCALE_BRIGHTNESS: 1.5,
    ENABLE_VU_METER: true,
    VU_METER_GAIN_FM: 1.5,
    VU_METER_GAIN_AM: 1.5,
    VU_METER_MODE: 'RMS',
    ENABLE_MAGIC_EYE: true,
    ENABLE_NIXIE_TUBES: true, // <-- Ny verdi
    ENABLE_PS_SCALE: true,
    ENABLE_SPECTRUM_OVERLAY: true,
    ENABLE_SW_STATIONS_SCALE: false,

    // Visitor defaults for the Retro features. Used only until a visitor
    // flips the switch themselves in "Enhanced / Retro Settings".
    USER_DEFAULTS: {
        ANALOG_SCALE_AUTOSTART: false,
        SHOW_TUNING_KNOB: true,
        ENABLE_VU_METER: false,
        ENABLE_MAGIC_EYE: false,
        ENABLE_NIXIE_TUBES: false,
        ENABLE_PS_SCALE: true,
        ENABLE_SPECTRUM_OVERLAY: false,
        ENABLE_SW_STATIONS_SCALE: false
    },

    // AM Scanner Thresholds
    thr_LW: 35, thr_MW: 35, thr_160m: 35, thr_120m: 35, thr_90m: 35,
    thr_75m: 35, thr_60m: 35, thr_49m: 35, thr_41m: 35, thr_31m: 35,
    thr_25m: 35, thr_22m: 35, thr_19m: 35, thr_16m: 35, thr_15m: 35,
    thr_13m: 35, thr_11m: 35
};

const DEFAULT_CONFIG = JSON.parse(JSON.stringify(pluginConfig));

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        const saved = JSON.parse(data);
        pluginConfig = { ...pluginConfig, ...saved };
        pluginConfig.USER_DEFAULTS = { ...DEFAULT_CONFIG.USER_DEFAULTS, ...(saved.USER_DEFAULTS || {}) };
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved lesing av config:', err);
    }
} else {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(pluginConfig, null, 4));
        console.log('[Enhanced Tuning] Opprettet standard konfigurasjonsfil:', CONFIG_FILE);
    } catch (err) {
        console.error('[Enhanced Tuning] Kunne ikke opprette konfigurasjonsfil:', err);
    }
}

// =========================================================================
// BACKEND TUNING LIMITS (live, no restart)
// The core webserver checks serverConfig.webserver.tuningLimit on every
// "T" command, against the shared in-memory config object. While
// "Override Server Limits" is on, the core check is switched off in memory
// only (config.json is not touched), and this guard rejects any tune
// command outside the AM or FM range set in the admin panel. Limits are read
// from pluginConfig per command, so saving the admin panel applies at once.
// =========================================================================
const pluginsApi = require('../../server/plugins_api');
const { serverConfig: coreConfig } = require('../../server/server_config');

// The core limit as it was when the plugin loaded, restored when override is turned off
const originalCoreTuningLimit = coreConfig.webserver ? coreConfig.webserver.tuningLimit : false;

function isTuneAllowed(freqMhz) {
    const inAm = freqMhz >= Number(pluginConfig.amLower) && freqMhz <= Number(pluginConfig.amUpper);
    const inFm = freqMhz >= Number(pluginConfig.fmLower) && freqMhz <= Number(pluginConfig.fmUpper);
    return inAm || inFm;
}

function applyCoreTuningLimit() {
    if (!coreConfig.webserver) return;
    // Re-asserted on every tune command too, in case the core setup page changes it
    coreConfig.webserver.tuningLimit = pluginConfig.overrideServerTuningLimit ? false : originalCoreTuningLimit;
}

function guardSocket(ws) {
    if (ws._etLimitGuard) return;
    ws._etLimitGuard = true;
    const originalEmit = ws.emit;
    ws.emit = function (event, ...args) {
        if (event === 'message' && pluginConfig.overrideServerTuningLimit) {
            const command = String(args[0]);
            if (command.startsWith('T')) {
                applyCoreTuningLimit();
                const freqMhz = Number(command.slice(1)) / 1000;
                if (!isNaN(freqMhz) && !isTuneAllowed(freqMhz)) return false; // dropped, like the core limit does
            }
        }
        return originalEmit.call(this, event, ...args);
    };
}

function installTuningGuard() {
    const wss = pluginsApi.getWss();
    if (!wss) {
        setTimeout(installTuningGuard, 1000);
        return;
    }
    wss.clients.forEach(guardSocket);
    wss.on('connection', guardSocket);
    applyCoreTuningLimit();
    console.log('[Enhanced Tuning] Backend tuning limits active (override: ' + !!pluginConfig.overrideServerTuningLimit + ').');
}

installTuningGuard();

// =========================================================================
// SHARED STATE FOR OTHER PLUGINS (plugins_api event bus)
// Emits 'enhanced-tuning' { type: 'state', ... } at startup and on every
// admin save. A plugin that loads later can ask with { type: 'request' }.
// Frequencies are in MHz.
// =========================================================================
const ET_EVENT = 'enhanced-tuning';

function getTuningState() {
    const bands = [];
    const addBands = (group) => Object.entries(group || {}).forEach(([key, band]) => {
        if (band) bands.push({ key, name: band.name || key, start: Number(band.start), end: Number(band.end) });
    });
    addBands(pluginConfig.customMainBands);
    addBands(pluginConfig.customSwBands);
    return {
        apiVersion: 1,
        limits: {
            override: !!pluginConfig.overrideServerTuningLimit,
            fmLower: Number(pluginConfig.fmLower), fmUpper: Number(pluginConfig.fmUpper),
            amLower: Number(pluginConfig.amLower), amUpper: Number(pluginConfig.amUpper)
        },
        tuningStandard: pluginConfig.TUNING_STANDARD,
        enabledBands: pluginConfig.ENABLED_BANDS,
        bands
    };
}

function publishTuningState() {
    if (typeof pluginsApi.emitPluginEvent !== 'function') return;
    pluginsApi.emitPluginEvent(ET_EVENT, { type: 'state', ...getTuningState() }, { broadcast: false });
}

if (typeof pluginsApi.onPluginEvent === 'function') {
    pluginsApi.onPluginEvent(ET_EVENT, (msg) => {
        if (msg && msg.type === 'request') publishTuningState();
    });
}
setTimeout(publishTuningState, 1000);

function syncWithSpectrumGraph(currentConfig) {
    const sgConfigPath = path.join(configFolderPath, 'SpectrumGraph.json');
    
    if (!fs.existsSync(sgConfigPath)) return;

    try {
        const sgData = JSON.parse(fs.readFileSync(sgConfigPath, 'utf8'));
        let isModified = false;

        const fmBandStart = (currentConfig.customMainBands && currentConfig.customMainBands['FM']) 
            ? currentConfig.customMainBands['FM'].start 
            : 86;

        if (sgData.fmLowerLimit !== fmBandStart) {
            sgData.fmLowerLimit = fmBandStart;
            isModified = true;
        }

        if (Array.isArray(sgData.definedBands)) {
            const allOurBands = { ...currentConfig.customMainBands, ...currentConfig.customSwBands };

            sgData.definedBands.forEach(sgBand => {
                let ourBand = allOurBands[sgBand.name];

                if (!ourBand) {
                    for (const key in allOurBands) {
                        if (allOurBands[key].name === sgBand.name || key === sgBand.name) {
                            ourBand = allOurBands[key];
                            break;
                        }
                    }
                }

                if (ourBand && ourBand.start !== undefined && ourBand.end !== undefined) {
                    const newStartKHz = Math.round(ourBand.start * 1000);
                    const newEndKHz = Math.round(ourBand.end * 1000);

                    if (sgBand.start !== newStartKHz || sgBand.end !== newEndKHz) {
                        sgBand.start = newStartKHz;
                        sgBand.end = newEndKHz;
                        isModified = true;
                    }
                }
            });
        }

        if (isModified) {
            let jsonString = JSON.stringify(sgData, null, 4);
            
            jsonString = jsonString.replace(/"definedBands":\s*\[([\s\S]*?)\]/, () => {
                const bands = sgData.definedBands ||[];
                const compactLines = bands.map(band => {
                    const objStr = JSON.stringify(band)
                        .replace(/":/g, '": ')
                        .replace(/,"/g, ', "');
                    return '        ' + objStr;
                });
                return `"definedBands":[\n${compactLines.join(',\n')}\n    ]`;
            });

            fs.writeFileSync(sgConfigPath, jsonString);
            console.log('[Enhanced Tuning] Vellykket synkronisering til SpectrumGraph.json');
        } else {
            console.log('[Enhanced Tuning] Ingen endringer nødvendig for Spectrum Graph, alt er allerede likt.');
        }
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved synkronisering mot Spectrum Graph:', err);
    }
}

function readFromSpectrumGraph() {
    if (!pluginConfig.SYNC_SPECTRUM_GRAPH_BANDS) return;
    
    const sgConfigPath = path.join(configFolderPath, 'SpectrumGraph.json');
    if (!fs.existsSync(sgConfigPath)) return;

    try {
        const sgData = JSON.parse(fs.readFileSync(sgConfigPath, 'utf8'));
        let isModified = false;

        if (sgData.fmLowerLimit !== undefined && pluginConfig.customMainBands && pluginConfig.customMainBands['FM']) {
            if (pluginConfig.customMainBands['FM'].start !== sgData.fmLowerLimit) {
                pluginConfig.customMainBands['FM'].start = sgData.fmLowerLimit;
                isModified = true;
            }
        }

        if (Array.isArray(sgData.definedBands)) {
            const allOurBands = { ...pluginConfig.customMainBands, ...pluginConfig.customSwBands };
            
            sgData.definedBands.forEach(sgBand => {
                let ourBand = allOurBands[sgBand.name];

                if (!ourBand) {
                    for (const key in allOurBands) {
                        if (allOurBands[key].name === sgBand.name || key === sgBand.name) {
                            ourBand = allOurBands[key];
                            break;
                        }
                    }
                }

                if (ourBand && sgBand.start !== undefined && sgBand.end !== undefined) {
                    const sgStartMHz = sgBand.start / 1000;
                    const sgEndMHz = sgBand.end / 1000;

                    if (ourBand.start !== sgStartMHz || ourBand.end !== sgEndMHz) {
                        console.log(`[Enhanced Tuning] Leste inn oppdatert grense for '${sgBand.name}': ${sgStartMHz} - ${sgEndMHz} MHz`);
                        ourBand.start = sgStartMHz;
                        ourBand.end = sgEndMHz;
                        isModified = true;
                    }
                }
            });
        }

        if (isModified) {
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(pluginConfig, null, 4));
            console.log('[Enhanced Tuning] Vellykket innlesing av båndgrenser fra SpectrumGraph.json');
        }
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved lesing fra Spectrum Graph:', err);
    }
}

// Pick up band edits made in Spectrum Graph's own admin panel as they happen
function watchSpectrumGraphConfig() {
    const sgConfigPath = path.join(configFolderPath, 'SpectrumGraph.json');
    if (!fs.existsSync(sgConfigPath)) {
        setTimeout(watchSpectrumGraphConfig, 30000);
        return;
    }
    readFromSpectrumGraph();
    let debounce = null;
    const watcher = fs.watch(sgConfigPath, (eventType) => {
        clearTimeout(debounce);
        if (eventType === 'rename') {
            // File was replaced: start a fresh watcher on the new file
            watcher.close();
            setTimeout(watchSpectrumGraphConfig, 1000);
            return;
        }
        debounce = setTimeout(() => {
            readFromSpectrumGraph();
            publishTuningState();
        }, 1000);
    });
    watcher.on('error', () => setTimeout(watchSpectrumGraphConfig, 5000));
}
watchSpectrumGraphConfig();

// Si47XX firmware adds LSB and USB, and tunes SSB finer than 1 kHz. The core tracks
// neither, so the mode and exact frequency are passed on with the data sent to clients.
const dataHandler = require('../../server/datahandler');
const originalHandleData = dataHandler.handleData;

const setSi47xxField = (key, value) => {
    dataHandler.dataToSend[key] = value;
    dataHandler.initialData[key] = value;
};

dataHandler.handleData = function (wss, receivedData, rdsWss) {
    if (pluginConfig.FIRMWARE_TYPE !== 'Si47XX') return originalHandleData.apply(this, arguments);

    for (const line of String(receivedData).split('\n')) {
        if (/^M\d$/.test(line)) setSi47xxField('si47xxMode', Number(line.slice(1)));
        else if (/^T\d/.test(line)) setSi47xxField('si47xxFreq', line.slice(1).split(',')[0]);
    }
    // The core drops the rest of a chunk after a T for the current frequency, which a mode switch
    // sends, so lines queued behind it (such as the W reply) are passed on separately
    for (const part of String(receivedData).split(/(?<=^T[^\n]*\n)/m)) {
        if (part) originalHandleData.call(this, wss, part, rdsWss);
    }
};

const checkStrictAdmin = (req, res, next) => {
    if (req.session && req.session.isAdminAuthenticated) return next();
    return res.status(401).send('Unauthorized. You must be an administrator.');
};


endpointsRouter.get('/enhanced_tuning/api/auth-check', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        isAdmin: (req.session && req.session.isAdminAuthenticated) || false,
        isTune: true,
        config: pluginConfig
    });
});

endpointsRouter.post('/enhanced_tuning/api/config', checkStrictAdmin, express.json(), (req, res) => {
    try {
        pluginConfig = { ...pluginConfig, ...req.body };
        pluginConfig.USER_DEFAULTS = { ...DEFAULT_CONFIG.USER_DEFAULTS, ...(req.body.USER_DEFAULTS || {}) };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(pluginConfig, null, 2));

        if (pluginConfig.SYNC_SPECTRUM_GRAPH_BANDS) {
            syncWithSpectrumGraph(pluginConfig);
        }

        applyCoreTuningLimit();
        publishTuningState();

        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved lagring av config:', err);
        res.status(500).json({ success: false });
    }
});

// =========================================================================
// ADMIN PANEL: shared UI (GitHub links, login card, toasts)
// =========================================================================
const GITHUB_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path></svg>';

const pluginHeading = (title, repoUrl) => `
    <div class="plugin-heading">
        <h3>${title}</h3>
        <a class="gh-link" href="${repoUrl}" target="_blank" rel="noopener noreferrer" title="Open ${title} on GitHub">${GITHUB_ICON}<span>GitHub</span></a>
    </div>`;

const AP_UI_CSS = `
    .plugin-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 40px 0 12px; }
    .plugin-heading:first-of-type { margin-top: 20px; }
    .plugin-heading h3 { margin: 0; color: #aaa; font-size: 16px; font-weight: 600; }
    .gh-link { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border: 1px solid var(--border); border-radius: 999px; color: var(--subtext); font-size: 12px; font-weight: 600; text-decoration: none; background: var(--row-bg); transition: color .2s, border-color .2s, background .2s; white-space: nowrap; }
    .gh-link:hover { color: var(--text); border-color: var(--accent); background: rgba(52, 152, 219, 0.1); }
    .gh-link svg { display: block; }

    .session-status { display: flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 12px; color: var(--subtext); border-bottom: 1px solid var(--border); }
    .session-status .dot { width: 8px; height: 8px; border-radius: 50%; background: #27ae60; box-shadow: 0 0 6px rgba(39, 174, 96, .7); flex-shrink: 0; }
    .session-status.expired .dot { background: #e74c3c; box-shadow: 0 0 6px rgba(231, 76, 60, .7); }
    .session-status.expired { color: #e74c3c; cursor: pointer; }

    .login-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .65); backdrop-filter: blur(3px); display: none; align-items: center; justify-content: center; z-index: 3000; padding: 16px; }
    .login-overlay.visible { display: flex; animation: fadeIn .2s; }
    .login-card { width: 100%; max-width: 360px; background: var(--panel-bg); border: 1px solid var(--border); border-radius: 12px; padding: 28px; box-shadow: 0 20px 50px rgba(0, 0, 0, .5); }
    .login-card h3 { margin: 0 0 6px; color: var(--accent); font-size: 20px; font-weight: 600; }
    .login-card p { margin: 0 0 18px; color: var(--subtext); font-size: 13px; line-height: 1.5; }
    .login-card input { width: 100%; box-sizing: border-box; margin-bottom: 10px; }
    .login-card .login-error { color: #e74c3c; font-size: 13px; font-weight: 600; min-height: 18px; margin-bottom: 8px; }
    .login-card .btn-save { width: 100%; }
    .login-card .login-secondary { display: block; width: 100%; margin-top: 10px; background: none; border: none; color: var(--subtext); font-size: 13px; cursor: pointer; }
    .login-card .login-secondary:hover { color: var(--text); }

    #toast { display: flex; align-items: center; gap: 10px; justify-content: center; }
    #toast .toast-icon { width: 22px; height: 22px; border-radius: 50%; background: rgba(255, 255, 255, .22); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
`;

const loginCardHtml = (title, text, withCancel) => `
    <div class="login-card" role="dialog" aria-modal="true" aria-labelledby="loginTitle">
        <h3 id="loginTitle">${title}</h3>
        <p id="loginText">${text}</p>
        <input type="password" id="loginPassword" class="dark-input" placeholder="Admin password" autocomplete="current-password">
        <div class="login-error" id="loginError"></div>
        <button class="btn-save" id="loginSubmit">Log in</button>
        ${withCancel ? '<button class="login-secondary" id="loginCancel">Not now</button>' : ''}
    </div>`;

// Logs in through the webserver's own /login, then confirms admin rights with our auth-check
const LOGIN_UI_JS = `
    async function submitAdminLogin() {
        const input = document.getElementById('loginPassword');
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginSubmit');
        if (!input.value) { errorEl.textContent = 'Enter the admin password.'; input.focus(); return false; }
        btn.disabled = true; btn.textContent = 'Checking…'; errorEl.textContent = '';
        try {
            const res = await fetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: 'password=' + encodeURIComponent(input.value)
            });
            if (!res.ok) {
                let message = 'Wrong password.';
                try { const data = await res.json(); if (data && data.message) message = data.message; } catch (e) {}
                errorEl.textContent = message;
                return false;
            }
            const check = await fetch('/enhanced_tuning/api/auth-check', { cache: 'no-store' }).then(r => r.json());
            if (!check.isAdmin) { errorEl.textContent = 'That password does not give admin rights.'; return false; }
            input.value = '';
            return true;
        } catch (e) {
            errorEl.textContent = 'Could not reach the server. Check the connection and try again.';
            return false;
        } finally {
            btn.disabled = false; btn.textContent = 'Log in';
        }
    }
`;

function renderLoginPage() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enhanced Tuning Login</title>
        <style>
            :root { --bg: #121212; --panel-bg: #1e1e1e; --row-bg: #181818; --border: #333; --text: #f0f0f0; --subtext: #999; --accent: #3498db; --accent-hover: #2980b9; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; box-sizing: border-box; }
            .dark-input { background-color: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 10px 15px; border-radius: 6px; font-size: 14px; outline: none; }
            .dark-input:focus { border-color: var(--accent); }
            .btn-save { background-color: var(--accent); color: white; border: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; }
            .btn-save:hover { background-color: var(--accent-hover); }
            .btn-save:disabled { opacity: .7; cursor: default; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            ${AP_UI_CSS}
        </style>
    </head>
    <body>
        ${loginCardHtml('Enhanced Tuning', 'Log in with the webserver admin password to open the settings.', false)}
        <script>
            ${LOGIN_UI_JS}
            const go = async () => { if (await submitAdminLogin()) location.reload(); };
            document.getElementById('loginSubmit').addEventListener('click', go);
            document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
            document.getElementById('loginPassword').focus();
        </script>
    </body>
    </html>`;
}

// Admin Panel Side
endpointsRouter.get('/enhanced_tuning/AP', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!(req.session && req.session.isAdminAuthenticated)) {
        res.status(401).send(renderLoginPage());
        return;
    }
    readFromSpectrumGraph(); 
    
    const createToggleRow = (id, title, desc, isChecked) => `
        <div class="setting-row">
            <div class="setting-info">
                <div class="setting-title">${title}</div>
                <div class="setting-desc">${desc}</div>
            </div>
            <label class="switch">
                <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
    `;

    const createInputRow = (id, title, desc, value, type = "text", step = "1") => `
        <div class="setting-row">
            <div class="setting-info">
                <div class="setting-title">${title}</div>
                <div class="setting-desc">${desc}</div>
            </div>
            <input type="${type}" id="${id}" value="${value}" step="${step}" class="dark-input">
        </div>
    `;

    const createSelectRow = (id, title, desc, options, selectedValue) => {
        let opts = options.map(opt => `<option value="${opt.val}" ${opt.val === selectedValue ? 'selected' : ''}>${opt.label}</option>`).join('');
        return `
            <div class="setting-row">
                <div class="setting-info">
                    <div class="setting-title">${title}</div>
                    <div class="setting-desc">${desc}</div>
                </div>
                <select id="${id}" class="dark-input">${opts}</select>
            </div>
        `;
    };

    // Retro features: Disabled / Available (off by default) / Available (on by default)
    const TRI_STATE_OPTIONS = [
        { val: 'off', label: 'Disabled' },
        { val: 'available', label: 'Available – off by default' },
        { val: 'on', label: 'Available – on by default' }
    ];
    const createTriStateRow = (id, title, desc) => {
        const enabled = pluginConfig[id] !== false;
        const defaultOn = !!(pluginConfig.USER_DEFAULTS || {})[id];
        const state = !enabled ? 'off' : (defaultOn ? 'on' : 'available');
        return createSelectRow(id, title, desc + ' Visitors can change it in Enhanced / Retro Settings.', TRI_STATE_OPTIONS, state);
    };
    
    const createSliderRow = (id, title, desc, min, max, step, value) => `
        <div class="setting-row">
            <div class="setting-info">
                <div class="setting-title">${title}</div>
                <div class="setting-desc">${desc}</div>
            </div>
            <div style="display:flex; align-items:center; gap:15px;">
                <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" style="cursor: pointer;">
                <span id="${id}_display" style="color:var(--accent); font-weight:bold; width: 35px; text-align:right;">${value}</span>
            </div>
        </div>
    `;

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enhanced Tuning Settings</title>
        <style>
            :root { --bg: #121212; --panel-bg: #1e1e1e; --row-bg: #181818; --border: #333; --text: #f0f0f0; --subtext: #999; --accent: #3498db; --accent-hover: #2980b9; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: var(--bg); color: var(--text); margin: 0; display: flex; height: 100vh; overflow: hidden; }
            .sidebar { width: 260px; background-color: var(--panel-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
            .sidebar-header { padding: 20px; font-size: 18px; font-weight: bold; border-bottom: 1px solid var(--border); color: var(--accent); }
            .nav-btn { padding: 15px 20px; background: none; border: none; color: var(--subtext); text-align: left; cursor: pointer; font-size: 15px; border-left: 3px solid transparent; transition: all 0.2s; }
            .nav-btn:hover { background-color: var(--row-bg); color: var(--text); }
            .nav-btn.active { border-left-color: var(--accent); color: var(--accent); background-color: rgba(52, 152, 219, 0.1); font-weight: bold; }
            .main-content { flex: 1; padding: 40px; overflow-y: auto; position: relative; }
            .tab-content { display: none; max-width: 900px; margin: 0 auto; }
            .tab-content.active { display: block; animation: fadeIn 0.3s; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            h2 { color: var(--accent); margin-top: 0; margin-bottom: 25px; font-weight: 500; font-size: 24px; border-bottom: 1px solid var(--border); padding-bottom: 10px; }
            .setting-row { display: flex; justify-content: space-between; align-items: center; background-color: var(--row-bg); padding: 15px 20px; border: 1px solid var(--border); border-radius: 8px; margin-bottom: 12px; transition: border-color 0.2s; }
            .setting-row:hover { border-color: #555; }
            .setting-info { flex: 1; padding-right: 20px; }
            .setting-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
            .setting-desc { font-size: 13px; color: var(--subtext); line-height: 1.4; }
            .dark-input { background-color: var(--bg); border: 1px solid var(--border); color: var(--text); padding: 10px 15px; border-radius: 6px; font-size: 14px; min-width: 150px; outline: none; transition: border-color 0.2s; }
            .dark-input:focus { border-color: var(--accent); }
            .switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
            .switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #444; transition: .3s; border-radius: 24px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
            input:checked + .slider { background-color: var(--accent); }
            input:checked + .slider:before { transform: translateX(20px); }
            .threshold-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
            .threshold-card { background: var(--row-bg); border: 1px solid var(--border); padding: 15px; border-radius: 8px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
            .threshold-card span { font-weight: bold; color: var(--accent); }
            .threshold-card input { width: 80px; text-align: center; }
            .btn-save { background-color: var(--accent); color: white; border: none; padding: 12px 25px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transition: background 0.2s; }
            .btn-save:hover { background-color: var(--accent-hover); }
            .btn-reset { background-color: transparent; color: #e74c3c; border: 1px solid #e74c3c; padding: 12px 25px; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
            .btn-reset:hover { background-color: rgba(231, 76, 60, 0.1); }
            #toast { visibility: hidden; min-width: 250px; background-color: #27ae60; color: #fff; text-align: center; border-radius: 6px; padding: 16px; position: fixed; z-index: 1000; bottom: 40px; left: 50%; transform: translateX(-50%); font-size: 16px; font-weight: bold; opacity: 0; transition: opacity 0.3s; }
            #toast.show { visibility: visible; opacity: 1; }
            .unsaved-bar {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 48px;
                background-color: var(--accent);
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 20px;
                font-size: 14px;
                font-weight: 500;
                transform: translateY(-100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                z-index: 1000;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            }
            .unsaved-bar.visible { transform: translateY(0); }
            .unsaved-bar a { color: #ffebee; text-decoration: underline; cursor: pointer; font-weight: 700; transition: color 0.2s; }
            .unsaved-bar a:hover { color: white; }
            .unsaved-bar button { background: white; color: var(--accent); border: none; padding: 6px 15px; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
            .unsaved-bar button:hover { background: #f0f0f0; }

            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
                -webkit-appearance: none; 
                margin: 0; 
            }
            input[type=number] {
                -moz-appearance: textfield; /* For Firefox */
            }
            .btn-save:disabled { opacity: .7; cursor: default; }
            ${AP_UI_CSS}
        </style>
    </head>
    <body>
        <div class="sidebar">
            <div class="sidebar-header">Enhanced Tuning</div>
            <div class="session-status" id="sessionStatus" title="Admin session"><span class="dot"></span><span id="sessionStatusText">Logged in as admin</span></div>
            <button class="nav-btn active" data-target="tab-ui">1. General UI & Layout</button>
            <button class="nav-btn" data-target="tab-hardware">2. Tuning & Hardware</button>
            <button class="nav-btn" data-target="tab-limits">3. Band Limits</button>
            <button class="nav-btn" data-target="tab-plugins">4. Plugin Integration</button>
            
            <div style="margin-top: auto; padding: 20px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px;">
                <button class="btn-reset" id="resetBtn" style="width: 100%;">Reset to Defaults</button>
                <button class="btn-save" id="saveBtn" style="width: 100%;">Save Settings</button>
            </div>
        </div>

        <div class="main-content">
            <div class="unsaved-bar" id="unsavedBar">
                <span>Careful — you have unsaved changes!</span>
                <a onclick="discardChanges()">Discard changes</a>
                <button onclick="document.getElementById('saveBtn').click()">Save Settings</button>
            </div>
            
            <div id="tab-ui" class="tab-content active">
                <h2>General UI & Layout</h2>
                ${createSelectRow('LAYOUT_STYLE', 'Visual Layout Style', 'Choose the layout design for the plugin controls.',[{val: 'modern', label:'Modern (Side Panel)'}, {val:'classic', label:'Classic (Compact)'}], pluginConfig.LAYOUT_STYLE)}
                ${createToggleRow('HIDE_ALL_BUTTONS', 'Hide All Buttons', 'Hides new UI elements. Only effective if Layout is Modern.', pluginConfig.HIDE_ALL_BUTTONS)}
                ${createToggleRow('SHOW_LOOP_BUTTON', 'Show Band Loop Button', 'Enable or disable the frequency loop feature entirely.', pluginConfig.SHOW_LOOP_BUTTON)}
                ${createToggleRow('SHOW_BAND_RANGE', 'Show Band Range', 'Show the start ↔ end frequency text under the main display.', pluginConfig.SHOW_BAND_RANGE)}
                ${createToggleRow('HIDE_DECIMAL_FOR_HF', 'Hide Decimal Point For HF Band', 'For AM/LW/MW/SW frequencies, hide the decimal point in the main frequency display.', pluginConfig.HIDE_DECIMAL_FOR_HF)}
                ${createInputRow('HIDE_DECIMAL_HF_THRESHOLD', 'Hide Decimal Threshold (MHz)', 'Frequencies at or below this value (in MHz) will have the decimal point hidden.', pluginConfig.HIDE_DECIMAL_HF_THRESHOLD, 'number', '0.001')}
                ${createToggleRow('ENABLE_TUNE_STEP_FEATURE', 'Tune Step Feature', 'Click frequency display to change tuning steps.', pluginConfig.ENABLE_TUNE_STEP_FEATURE)}
                ${createInputRow('TUNE_STEP_TIMEOUT_SECONDS', 'Tune Step Timeout', 'Seconds of inactivity before step resets (0 to disable).', pluginConfig.TUNE_STEP_TIMEOUT_SECONDS, 'number')}
                
                <h3 style="margin-top:30px; color:#aaa; font-size:16px;">Enabled Bands</h3>
                ${createToggleRow('band_FM', 'FM Band', '', pluginConfig.ENABLED_BANDS.includes('FM'))}
                ${createToggleRow('band_OIRT', 'OIRT Band', '', pluginConfig.ENABLED_BANDS.includes('OIRT'))}
                ${createToggleRow('band_SW', 'Shortwave (SW) Band', '', pluginConfig.ENABLED_BANDS.includes('SW'))}
                ${createToggleRow('band_MW', 'Mediumwave (MW) Band', '', pluginConfig.ENABLED_BANDS.includes('MW'))}
                ${createToggleRow('band_LW', 'Longwave (LW) Band', '', pluginConfig.ENABLED_BANDS.includes('LW'))}
            </div>

            <div id="tab-hardware" class="tab-content">
                <h2>Tuning & Hardware Options</h2>
                ${createSelectRow('TUNING_STANDARD', 'Regional Tuning Standard', 'Controls AM/FM steps and ranges.',[{val:'international', label:'International'}, {val:'americas', label:'Americas'}, {val:'japan', label:'Japan'}], pluginConfig.TUNING_STANDARD)}
                ${createToggleRow('ENABLE_SMART_KHZ_INPUT', 'Smart kHz Input', 'Type e.g. "693" instead of "0.693". Auto-converts numbers on AM bands to avoid plugin conflicts.', pluginConfig.ENABLE_SMART_KHZ_INPUT)}
                ${createToggleRow('ENABLE_MW_STEP_TOGGLE', 'MW 9/10kHz Toggle Button', 'Shows a button when in MW to switch step size.', pluginConfig.ENABLE_MW_STEP_TOGGLE)}
                ${createToggleRow('ENABLE_FREQUENCY_MEMORY', 'Frequency Memory', 'Remember last tuned frequency per band.', pluginConfig.ENABLE_FREQUENCY_MEMORY)}
                
                <h3 style="margin-top:30px; color:#aaa; font-size:16px;">AM Bandwidth Injection</h3>
                ${createToggleRow('ENABLE_AM_BW', 'Enable Custom AM Bandwidth', 'Requires TEF6686_ESP32 firmware.', pluginConfig.ENABLE_AM_BW)}
                ${createSelectRow('FIRMWARE_TYPE', 'Firmware Type', 'Select compatibility mode for bandwidth.', [{val:'TEF6686_ESP32', label:'TEF6686_ESP32 (PE5PVB)'}, {val:'FM-DX-Tuner', label:'FM-DX-Tuner (kkonrad)'}, {val:'Si47XX', label:'Si47XX (ATS-Mini)'}], pluginConfig.FIRMWARE_TYPE)}
                ${createToggleRow('ENABLE_DEFAULT_AM_BW', 'Force Default AM BW', 'Auto-select a specific BW when entering AM.', pluginConfig.ENABLE_DEFAULT_AM_BW)}
                ${createSelectRow('DEFAULT_AM_BW_VALUE', 'Default AM BW Value', 'Applied if forced default is enabled.',[{val:'56000', label:'3 kHz'}, {val:'64000', label:'4 kHz'}, {val:'72000', label:'6 kHz'}, {val:'84000', label:'8 kHz'}], pluginConfig.DEFAULT_AM_BW_VALUE)}
            </div>

            <div id="tab-limits" class="tab-content">
                <h2>Tuning Limits & Bands Configuration</h2>
                
                ${createToggleRow('overrideServerTuningLimit', 'Override Server Limits', 'Allow plugin to manage its own separate hardware limits for AM and FM. Enforced on the server and applied as soon as you save, no restart needed. The core webserver limit is paused while this is on.', pluginConfig.overrideServerTuningLimit)}
                
                <div id="custom-limits-wrapper" style="display: ${pluginConfig.overrideServerTuningLimit ? 'block' : 'none'}; border-left: 2px solid #3498db; padding-left: 15px; margin-top: 15px;">
                    <h3 style="margin-top:10px; color:#aaa; font-size:16px;">Global Tuning Limits</h3>
                    <p style="color:var(--subtext); font-size:13px; margin-bottom:15px;">Set the absolute hardware tuning boundaries. Tune commands outside these ranges are rejected by the server. Only active when "Override Server Limits" is ON.</p>
                    <div style="display:flex; gap:15px; flex-wrap:wrap; margin-bottom:20px;">
                        ${createInputRow('fmLower', 'FM Lower Limit (MHz)', '', pluginConfig.fmLower, 'number', '0.1')}
                        ${createInputRow('fmUpper', 'FM Upper Limit (MHz)', '', pluginConfig.fmUpper, 'number', '0.1')}
                        ${createInputRow('amLower', 'AM Lower Limit (MHz)', '', pluginConfig.amLower, 'number', '0.001')}
                        ${createInputRow('amUpper', 'AM Upper Limit (MHz)', '', pluginConfig.amUpper, 'number', '0.1')}
                    </div>
                </div>

                <h3 style="margin-top:30px; color:#aaa; font-size:16px;">Main Bands Configuration</h3>
<p style="color:var(--subtext); font-size:13px; margin-bottom:15px;">Rename bands (max 5 chars to fit buttons), set default start frequency, and adjust limits.</p>

${['AM_SUPER', 'FM', 'OIRT', 'SW', 'MW', 'LW'].map(key => `
    <div class="setting-row" style="padding: 10px 20px;">
        <div class="setting-info"><div class="setting-title" style="font-size:14px;">${key}</div></div>
        <div style="display:flex; gap:8px; align-items:center;">
            <span style="color:var(--subtext); font-size:11px;">Name</span>
            <input type="text" id="name_${key}" maxlength="5" value="${pluginConfig.customMainBands[key].name}" class="dark-input" style="width:70px; min-width:auto; padding:6px 10px; text-align:center;">
            <span style="color:var(--subtext); font-size:11px;">Default Tune</span>
            <input type="number" id="tune_${key}" value="${pluginConfig.customMainBands[key].tune}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:6px 10px;">
            <span style="color:var(--subtext); font-size:11px;">Low</span>
            <input type="number" id="start_${key}" value="${pluginConfig.customMainBands[key].start}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:6px 10px;">
            <span style="color:var(--subtext); font-size:11px;">High</span>
            <input type="number" id="end_${key}" value="${pluginConfig.customMainBands[key].end}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:6px 10px;">
        </div>
    </div>
`).join('')}

                <h3 style="margin-top:30px; color:#aaa; font-size:16px;">Shortwave Sub-Bands</h3>
                <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                    ${Object.keys(pluginConfig.customSwBands).map(key => `
                        <div class="setting-row" style="padding: 10px; margin-bottom:0;">
                            <div class="setting-info"><div class="setting-title" style="font-size:13px;">${key}</div></div>
                            <div style="display:flex; gap:5px; align-items:center;">
                                <span style="color:var(--subtext); font-size:11px;">Default Tune</span>
                                <input type="number" id="sw_tune_${key}" value="${pluginConfig.customSwBands[key].tune}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:4px 8px; font-size:12px;">
                                <span style="color:var(--subtext); font-size:11px; margin-left:10px;">Range</span>
                                <input type="number" id="sw_start_${key}" value="${pluginConfig.customSwBands[key].start}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:4px 8px; font-size:12px;">
                                <span style="color:var(--subtext); font-size:12px;">-</span>
                                <input type="number" id="sw_end_${key}" value="${pluginConfig.customSwBands[key].end}" step="0.001" class="dark-input" style="width:65px; min-width:auto; padding:4px 8px; font-size:12px;">
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div id="tab-plugins" class="tab-content">
                <h2>Plugin Integration</h2>
                
                ${pluginHeading('Spectrum Graph Plugin by AmateurAudioDude', 'https://github.com/AmateurAudioDude/FM-DX-Webserver-Plugin-Spectrum-Graph')}
                ${createToggleRow('SYNC_SPECTRUM_GRAPH_BANDS', 'Sync Limits with Spectrum Graph', 'Automatically updates the SpectrumGraph.json config file with your start/end frequencies defined in the Band Limits tab. Allows the scanner to perfectly match your defined tuning bands.', pluginConfig.SYNC_SPECTRUM_GRAPH_BANDS)}
                ${createToggleRow('SG_BANDWIDTH_HIGHLIGHT', 'Bandwidth Highlight', 'The tuned-frequency highlight in Spectrum Graph spans the selected bandwidth instead of a fixed width, and updates as soon as the bandwidth changes. Needs Spectrum Graph with Enhanced Tuning support.', pluginConfig.SG_BANDWIDTH_HIGHLIGHT)}
                ${createSelectRow('SG_FOLLOW_BAND', 'Follow Band Changes', 'What Spectrum Graph shows when a visitor switches band in Enhanced Tuning. "Show last scan" keeps one scan per band in the visitor\'s browser and scans the band if none is stored. "Scan" starts a scan of the new band for everyone, which occupies the tuner for a moment. Needs Spectrum Graph with Enhanced Tuning support.', [{val:'off', label:'Off (unchanged)'}, {val:'last', label:'Show last scan of the band'}, {val:'scan', label:'Scan the band automatically'}], pluginConfig.SG_FOLLOW_BAND)}

                ${pluginHeading('Scanner Plugin by Highpoint', 'https://github.com/Highpoint2000/webserver-scanner')}
                ${createToggleRow('ENABLE_AM_SCANNER', 'Enable Scanner plugin override', 'Intercepts the Highpoint Scanner plugin to respect AM/SW band limits and sub-bands. (Beta)', pluginConfig.ENABLE_AM_SCANNER)}
                
                <div id="scanner-thresholds-block" style="display: ${pluginConfig.ENABLE_AM_SCANNER ? 'block' : 'none'}; border-left: 2px solid #3498db; padding-left: 15px; margin-bottom: 30px; margin-top: 15px;">
                    <p style="color:var(--subtext); margin-bottom: 15px; font-size: 13px;">Define the minimum signal strength (0-100) required to pause the scanner on a specific AM/SW band.</p>
                    <div class="threshold-grid">
                        ${['LW', 'MW', '160m', '120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'].map(t => `
                            <div class="threshold-card" style="padding: 10px;">
                                <span>${t} Band</span>
                                <input type="number" id="thr_${t}" value="${pluginConfig['thr_'+t]}" class="dark-input" style="width:60px;">
                            </div>
                        `).join('')}
                    </div>
                </div>

                ${pluginHeading('Retro Design Elements Plugin by Highpoint', 'https://github.com/Highpoint2000/RetroDesign')}
                ${createToggleRow('ENABLE_ANALOG_SCALE', 'Enable Analog Scale Integration', 'Injects a dynamic retro analog scale for all bands.', pluginConfig.ENABLE_ANALOG_SCALE)}
                
                <div id="scale-settings-block" style="display: ${pluginConfig.ENABLE_ANALOG_SCALE ? 'block' : 'none'}; border-left: 2px solid #3498db; padding-left: 15px; margin-bottom: 30px; margin-top: 15px;">
                    ${createTriStateRow('ANALOG_SCALE_AUTOSTART', 'Autostart Scale', 'Automatically open the scale when tuning to a supported band.')}
                    ${createTriStateRow('SHOW_TUNING_KNOB', 'Show Tuning Knob', 'Displays the dual rotary encoder for manual tuning.')}
                    ${createSliderRow('ANALOG_SCALE_BRIGHTNESS', 'Scale Brightness', 'Adjust the backlight brightness of the analog scale.', '0.2', '2.0', '0.05', pluginConfig.ANALOG_SCALE_BRIGHTNESS)}
                    
                    <h4 style="margin-top:20px; color:#aaa; font-size:14px; margin-bottom:10px;">VU Meter Configuration</h4>
                    ${createTriStateRow('ENABLE_VU_METER', 'Enable VU Meter', 'Displays a stereo VU meter next to the analog scale.')}
                    ${createSelectRow('VU_METER_MODE', 'VU Meter Mode', 'RMS gives smooth realistic pumping. Peak shows raw loudness.',[{val: 'RMS', label: 'RMS (Smooth & Realistic)'}, {val: 'Peak', label: 'Peak (Raw Max Levels)'}], pluginConfig.VU_METER_MODE)}
                    ${createSliderRow('VU_METER_GAIN_FM', 'VU Meter Gain (FM)', 'Calibration multiplier for the VU meter on FM/OIRT.', '0.1', '5.0', '0.1', pluginConfig.VU_METER_GAIN_FM)}
                    ${createSliderRow('VU_METER_GAIN_AM', 'VU Meter Gain (AM/SW)', 'Calibration multiplier for the VU meter on AM/SW/MW/LW.', '0.1', '5.0', '0.1', pluginConfig.VU_METER_GAIN_AM)}
                    
                    <h4 style="margin-top:20px; color:#aaa; font-size:14px; margin-bottom:10px;">Retro Indicators</h4>
                    ${createTriStateRow('ENABLE_MAGIC_EYE', 'Enable Magic Eye Indicator', 'Converts the signal panel into a glowing vacuum tube indicator.')}
                    ${createTriStateRow('ENABLE_NIXIE_TUBES', 'Enable Nixie Tubes', 'Converts frequency and RDS data into glowing Nixie tubes.')}

                    <h4 style="margin-top:20px; color:#aaa; font-size:14px; margin-bottom:10px;">Scale Overlays & Data</h4>
                   ${createTriStateRow('ENABLE_PS_SCALE', 'Show FM PS Stations', 'Display RDS PS names directly on the analog FM scale.')}
                    ${createTriStateRow('ENABLE_SPECTRUM_OVERLAY', 'Show Spectrum Overlay', 'Project the SDR spectrum waterfall onto the analog dial glass.')}
                    ${createTriStateRow('ENABLE_SW_STATIONS_SCALE', 'Show SW Stations', 'Display active shortwave stations dynamically on the analog dial.<br><span style="color:#e74c3c; font-weight:bold; font-size:14px;">⚠️ Requires AM Station Info Plugin V1.4 or later!</span>')}
                </div>
            </div>

        <div id="toast" role="status" aria-live="polite"></div>

        <div class="login-overlay" id="loginOverlay">
            ${loginCardHtml('Session expired', 'You are no longer logged in as admin. Log in again to keep working. Your unsaved changes stay on this page.', true)}
        </div>

        <script>
            const DEFAULTS = ${JSON.stringify(DEFAULT_CONFIG)};
            let toastTimer = null;
            function showToast(message, type = 'success') {
                const toast = document.getElementById('toast');
                const look = { success: ['#27ae60', '✓'], error: ['#e74c3c', '✕'], info: ['#3498db', 'i'] }[type] || ['#3498db', 'i'];
                toast.style.backgroundColor = look[0];
                toast.innerHTML = '<span class="toast-icon">' + look[1] + '</span><span></span>';
                toast.lastChild.textContent = message;
                toast.classList.add('show');
                clearTimeout(toastTimer);
                toastTimer = setTimeout(() => toast.classList.remove('show'), type === 'error' ? 6000 : 3000);
            }
            const TRI_STATE_KEYS = ["ANALOG_SCALE_AUTOSTART", "SHOW_TUNING_KNOB", "ENABLE_VU_METER", "ENABLE_MAGIC_EYE", "ENABLE_NIXIE_TUBES", "ENABLE_PS_SCALE", "ENABLE_SPECTRUM_OVERLAY", "ENABLE_SW_STATIONS_SCALE"];
            const triStateOf = (enabled, defaultOn) => enabled === false ? 'off' : (defaultOn ? 'on' : 'available');
            const navBtns = document.querySelectorAll('.nav-btn');
            const tabs = document.querySelectorAll('.tab-content');
            
            let originalSettings = {};

            function captureSettings() {
                document.querySelectorAll('.main-content input, .main-content select').forEach(el => {
                    originalSettings[el.id] = el.type === 'checkbox' ? el.checked : el.value;
                });
            }

            function checkUnsavedState() {
                let settingsChanged = false;
                document.querySelectorAll('.main-content input, .main-content select').forEach(el => {
                    let currentVal = el.type === 'checkbox' ? el.checked : el.value;
                    // Sammenligner som strenger for å unngå trøbbel med tall vs tekst
                    if (String(originalSettings[el.id]) !== String(currentVal)) {
                        settingsChanged = true;
                    }
                });

                if (settingsChanged) {
                    document.getElementById('unsavedBar').classList.add('visible');
                } else {
                    document.getElementById('unsavedBar').classList.remove('visible');
                }
            }

            function discardChanges() {
                document.querySelectorAll('.main-content input, .main-content select').forEach(el => {
                    if (originalSettings[el.id] !== undefined) {
                        if (el.type === 'checkbox') {
                            el.checked = originalSettings[el.id] === true || originalSettings[el.id] === 'true';
                        } else {
                            el.value = originalSettings[el.id];
                        }
                        // Trigger eventer slik at paneler som har blitt åpnet/lukket rydder opp seg selv automatisk
                        el.dispatchEvent(new Event('change'));
                        el.dispatchEvent(new Event('input'));
                    }
                });
                checkUnsavedState();
                
                showToast('All changes discarded.', 'info');
            }

            captureSettings();
            document.querySelectorAll('.main-content input, .main-content select').forEach(el => {
                el.addEventListener('change', checkUnsavedState);
                el.addEventListener('input', checkUnsavedState);
            });

            navBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    navBtns.forEach(b => b.classList.remove('active'));
                    tabs.forEach(t => t.classList.remove('active'));
                    btn.classList.add('active');
                    document.getElementById(btn.dataset.target).classList.add('active');
                });
            });

            document.getElementById('ENABLE_AM_SCANNER').addEventListener('change', function() {
                document.getElementById('scanner-thresholds-block').style.display = this.checked ? 'block' : 'none';
            });

            // Dynamisk visning av Analog Scale innstillinger
            document.getElementById('ENABLE_ANALOG_SCALE').addEventListener('change', function() {
                document.getElementById('scale-settings-block').style.display = this.checked ? 'block' : 'none';
            });

            document.getElementById('overrideServerTuningLimit').addEventListener('change', function() {
                document.getElementById('custom-limits-wrapper').style.display = this.checked ? 'block' : 'none';
            });

            document.querySelectorAll('input[type="range"]').forEach(slider => {
                slider.addEventListener('input', (e) => {
                    const display = document.getElementById(e.target.id + '_display');
                    if (display) display.innerText = e.target.value;
                });
            });

            document.getElementById('resetBtn').addEventListener('click', () => {
                if (!confirm('Are you sure you want to reset all settings to their default values?')) return;
                
                document.getElementById('LAYOUT_STYLE').value = DEFAULTS.LAYOUT_STYLE;
                document.getElementById('HIDE_ALL_BUTTONS').checked = DEFAULTS.HIDE_ALL_BUTTONS;
                document.getElementById('SHOW_LOOP_BUTTON').checked = DEFAULTS.SHOW_LOOP_BUTTON;
                document.getElementById('SHOW_BAND_RANGE').checked = DEFAULTS.SHOW_BAND_RANGE;
                document.getElementById('ENABLE_TUNE_STEP_FEATURE').checked = DEFAULTS.ENABLE_TUNE_STEP_FEATURE;
                document.getElementById('TUNE_STEP_TIMEOUT_SECONDS').value = DEFAULTS.TUNE_STEP_TIMEOUT_SECONDS;
                
                ['FM', 'OIRT', 'SW', 'MW', 'LW'].forEach(b => {
                    document.getElementById('band_' + b).checked = DEFAULTS.ENABLED_BANDS.includes(b);
                });

                document.getElementById('TUNING_STANDARD').value = DEFAULTS.TUNING_STANDARD;
                document.getElementById('ENABLE_SMART_KHZ_INPUT').checked = DEFAULTS.ENABLE_SMART_KHZ_INPUT;
                document.getElementById('ENABLE_MW_STEP_TOGGLE').checked = DEFAULTS.ENABLE_MW_STEP_TOGGLE;
                document.getElementById('ENABLE_FREQUENCY_MEMORY').checked = DEFAULTS.ENABLE_FREQUENCY_MEMORY;
                document.getElementById('ENABLE_AM_BW').checked = DEFAULTS.ENABLE_AM_BW;
                document.getElementById('FIRMWARE_TYPE').value = DEFAULTS.FIRMWARE_TYPE;
                document.getElementById('ENABLE_DEFAULT_AM_BW').checked = DEFAULTS.ENABLE_DEFAULT_AM_BW;
                document.getElementById('DEFAULT_AM_BW_VALUE').value = DEFAULTS.DEFAULT_AM_BW_VALUE;
                
                // Resetter override switchen og displayet for boksene
                document.getElementById('overrideServerTuningLimit').checked = DEFAULTS.overrideServerTuningLimit;
                document.getElementById('custom-limits-wrapper').style.display = DEFAULTS.overrideServerTuningLimit ? 'block' : 'none';
                
                // Resetter selve limitene
                document.getElementById('fmLower').value = DEFAULTS.fmLower;
                document.getElementById('fmUpper').value = DEFAULTS.fmUpper;
                document.getElementById('amLower').value = DEFAULTS.amLower;
                document.getElementById('amUpper').value = DEFAULTS.amUpper;

                const mainKeys =['AM_SUPER', 'FM', 'OIRT', 'SW', 'MW', 'LW'];
                mainKeys.forEach(k => {
                    document.getElementById('name_' + k).value = DEFAULTS.customMainBands[k].name;
                    document.getElementById('tune_' + k).value = DEFAULTS.customMainBands[k].tune;
                    document.getElementById('start_' + k).value = DEFAULTS.customMainBands[k].start;
                    document.getElementById('end_' + k).value = DEFAULTS.customMainBands[k].end;
                });
                
                const swKeys =['160m', '120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];
                swKeys.forEach(k => {
                    document.getElementById('sw_tune_' + k).value = DEFAULTS.customSwBands[k].tune;
                    document.getElementById('sw_start_' + k).value = DEFAULTS.customSwBands[k].start;
                    document.getElementById('sw_end_' + k).value = DEFAULTS.customSwBands[k].end;
                });
                
                document.getElementById('ENABLE_AM_SCANNER').checked = DEFAULTS.ENABLE_AM_SCANNER;
                document.getElementById('scanner-thresholds-block').style.display = DEFAULTS.ENABLE_AM_SCANNER ? 'block' : 'none';
                
                const thresholds =['LW', 'MW', '160m', '120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];
                thresholds.forEach(t => {
                    document.getElementById('thr_' + t).value = DEFAULTS['thr_' + t];
                });

                document.getElementById('SYNC_SPECTRUM_GRAPH_BANDS').checked = DEFAULTS.SYNC_SPECTRUM_GRAPH_BANDS;
                document.getElementById('SG_BANDWIDTH_HIGHLIGHT').checked = DEFAULTS.SG_BANDWIDTH_HIGHLIGHT;
                document.getElementById('SG_FOLLOW_BAND').value = DEFAULTS.SG_FOLLOW_BAND;
                document.getElementById('ENABLE_ANALOG_SCALE').checked = DEFAULTS.ENABLE_ANALOG_SCALE;
                document.getElementById('scale-settings-block').style.display = DEFAULTS.ENABLE_ANALOG_SCALE ? 'block' : 'none';
                
                
                const brightSlider = document.getElementById('ANALOG_SCALE_BRIGHTNESS');
                brightSlider.value = DEFAULTS.ANALOG_SCALE_BRIGHTNESS;
                const brightDisplay = document.getElementById('ANALOG_SCALE_BRIGHTNESS_display');
                if(brightDisplay) brightDisplay.innerText = DEFAULTS.ANALOG_SCALE_BRIGHTNESS;

                document.getElementById('VU_METER_MODE').value = DEFAULTS.VU_METER_MODE;
                
                const vuFm = document.getElementById('VU_METER_GAIN_FM');
                vuFm.value = DEFAULTS.VU_METER_GAIN_FM;
                const vuFmDisp = document.getElementById('VU_METER_GAIN_FM_display');
                if(vuFmDisp) vuFmDisp.innerText = DEFAULTS.VU_METER_GAIN_FM;
                
                const vuAm = document.getElementById('VU_METER_GAIN_AM');
                vuAm.value = DEFAULTS.VU_METER_GAIN_AM;
                const vuAmDisp = document.getElementById('VU_METER_GAIN_AM_display');
                if(vuAmDisp) vuAmDisp.innerText = DEFAULTS.VU_METER_GAIN_AM;


                TRI_STATE_KEYS.forEach(k => {
                    document.getElementById(k).value = triStateOf(DEFAULTS[k], DEFAULTS.USER_DEFAULTS[k]);
                });

                showToast('Defaults restored. Click Save Settings to apply.', 'info');
                checkUnsavedState(); 
            });

            document.getElementById('saveBtn').addEventListener('click', async () => {
                const bands =[];
                if(document.getElementById('band_FM').checked) bands.push('FM');
                if(document.getElementById('band_OIRT').checked) bands.push('OIRT');
                if(document.getElementById('band_SW').checked) bands.push('SW');
                if(document.getElementById('band_MW').checked) bands.push('MW');
                if(document.getElementById('band_LW').checked) bands.push('LW');

                const config = {
                    LAYOUT_STYLE: document.getElementById('LAYOUT_STYLE').value,
                    HIDE_ALL_BUTTONS: document.getElementById('HIDE_ALL_BUTTONS').checked,
                    SHOW_LOOP_BUTTON: document.getElementById('SHOW_LOOP_BUTTON').checked,
                    SHOW_BAND_RANGE: document.getElementById('SHOW_BAND_RANGE').checked,
                    HIDE_DECIMAL_FOR_HF: document.getElementById('HIDE_DECIMAL_FOR_HF').checked,
                    HIDE_DECIMAL_HF_THRESHOLD: parseFloat(document.getElementById('HIDE_DECIMAL_HF_THRESHOLD').value),
                    ENABLE_TUNE_STEP_FEATURE: document.getElementById('ENABLE_TUNE_STEP_FEATURE').checked,
                    TUNE_STEP_TIMEOUT_SECONDS: parseInt(document.getElementById('TUNE_STEP_TIMEOUT_SECONDS').value),
                    ENABLED_BANDS: bands,
                    
                    TUNING_STANDARD: document.getElementById('TUNING_STANDARD').value,
                    ENABLE_SMART_KHZ_INPUT: document.getElementById('ENABLE_SMART_KHZ_INPUT').checked,
                    ENABLE_MW_STEP_TOGGLE: document.getElementById('ENABLE_MW_STEP_TOGGLE').checked,
                    ENABLE_FREQUENCY_MEMORY: document.getElementById('ENABLE_FREQUENCY_MEMORY').checked,
                    ENABLE_AM_BW: document.getElementById('ENABLE_AM_BW').checked,
                    FIRMWARE_TYPE: document.getElementById('FIRMWARE_TYPE').value,
                    ENABLE_DEFAULT_AM_BW: document.getElementById('ENABLE_DEFAULT_AM_BW').checked,
                    DEFAULT_AM_BW_VALUE: document.getElementById('DEFAULT_AM_BW_VALUE').value,

                    overrideServerTuningLimit: document.getElementById('overrideServerTuningLimit').checked,

                    fmLower: parseFloat(document.getElementById('fmLower').value),
                    fmUpper: parseFloat(document.getElementById('fmUpper').value),
                    amLower: parseFloat(document.getElementById('amLower').value),
                    amUpper: parseFloat(document.getElementById('amUpper').value),
                    
                    ENABLE_AM_SCANNER: document.getElementById('ENABLE_AM_SCANNER').checked,
                    SYNC_SPECTRUM_GRAPH_BANDS: document.getElementById('SYNC_SPECTRUM_GRAPH_BANDS').checked,
                    SG_BANDWIDTH_HIGHLIGHT: document.getElementById('SG_BANDWIDTH_HIGHLIGHT').checked,
                    SG_FOLLOW_BAND: document.getElementById('SG_FOLLOW_BAND').value,
                    ENABLE_ANALOG_SCALE: document.getElementById('ENABLE_ANALOG_SCALE').checked,
                    ANALOG_SCALE_BRIGHTNESS: parseFloat(document.getElementById('ANALOG_SCALE_BRIGHTNESS').value),
                    VU_METER_MODE: document.getElementById('VU_METER_MODE').value,
                    VU_METER_GAIN_FM: parseFloat(document.getElementById('VU_METER_GAIN_FM').value),
                    VU_METER_GAIN_AM: parseFloat(document.getElementById('VU_METER_GAIN_AM').value)
                };

                config.USER_DEFAULTS = {};
                TRI_STATE_KEYS.forEach(k => {
                    const state = document.getElementById(k).value;
                    config[k] = state !== 'off';
                    config.USER_DEFAULTS[k] = state === 'on';
                });

                const mainKeys =['AM_SUPER', 'FM', 'OIRT', 'SW', 'MW', 'LW'];
                config.customMainBands = {};
                mainKeys.forEach(k => {
                    config.customMainBands[k] = {
                        name: document.getElementById('name_' + k).value,
                        tune: parseFloat(document.getElementById('tune_' + k).value),
                        start: parseFloat(document.getElementById('start_' + k).value),
                        end: parseFloat(document.getElementById('end_' + k).value)
                    };
                });

                const swKeys =['160m', '120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];
                config.customSwBands = {};
                swKeys.forEach(k => {
                    config.customSwBands[k] = {
                        tune: parseFloat(document.getElementById('sw_tune_' + k).value),
                        start: parseFloat(document.getElementById('sw_start_' + k).value),
                        end: parseFloat(document.getElementById('sw_end_' + k).value)
                    };
                });

                const thresholds =['LW', 'MW', '160m', '120m', '90m', '75m', '60m', '49m', '41m', '31m', '25m', '22m', '19m', '16m', '15m', '13m', '11m'];
                thresholds.forEach(t => {
                    config['thr_' + t] = parseInt(document.getElementById('thr_' + t).value);
                });

                try {
                    const res = await fetch('/enhanced_tuning/api/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(config)
                    });
                    
                    if (res.ok) {
                        localStorage.setItem('et_config_update_trigger', Date.now().toString());
                        captureSettings();
                        checkUnsavedState();
                        setSessionState(true);
                        showToast('Settings saved and applied.', 'success');
                    } else if (res.status === 401) {
                        // Log in again, then save the same changes automatically
                        setSessionState(false);
                        showLoginOverlay(() => document.getElementById('saveBtn').click());
                    } else {
                        throw new Error('Server returned ' + res.status);
                    }
                } catch(err) {
                    showToast('Could not save settings: ' + err.message + '. Nothing was changed on the server.', 'error');
                }
            });

            // ---------------- Admin session ----------------
            ${LOGIN_UI_JS}
            let afterLogin = null;

            function setSessionState(isAdmin) {
                const status = document.getElementById('sessionStatus');
                status.classList.toggle('expired', !isAdmin);
                document.getElementById('sessionStatusText').textContent = isAdmin ? 'Logged in as admin' : 'Session expired, click to log in';
            }

            function showLoginOverlay(onSuccess) {
                afterLogin = onSuccess || null;
                document.getElementById('loginError').textContent = '';
                document.getElementById('loginOverlay').classList.add('visible');
                setTimeout(() => document.getElementById('loginPassword').focus(), 50);
            }

            function hideLoginOverlay() {
                document.getElementById('loginOverlay').classList.remove('visible');
            }

            async function loginFromOverlay() {
                if (!(await submitAdminLogin())) return;
                hideLoginOverlay();
                setSessionState(true);
                showToast('Logged in again.', 'success');
                const next = afterLogin; afterLogin = null;
                if (next) next();
            }

            document.getElementById('loginSubmit').addEventListener('click', loginFromOverlay);
            document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') loginFromOverlay(); });
            document.getElementById('loginCancel').addEventListener('click', () => { afterLogin = null; hideLoginOverlay(); });
            document.getElementById('sessionStatus').addEventListener('click', () => {
                if (document.getElementById('sessionStatus').classList.contains('expired')) showLoginOverlay();
            });

            // Check now and then, and whenever the tab comes back into view
            let sessionKnownGood = true;
            async function checkSession() {
                try {
                    const data = await fetch('/enhanced_tuning/api/auth-check', { cache: 'no-store' }).then(r => r.json());
                    setSessionState(!!data.isAdmin);
                    if (!data.isAdmin && sessionKnownGood) showLoginOverlay();
                    sessionKnownGood = !!data.isAdmin;
                } catch (e) { /* offline for a moment: keep the current state */ }
            }
            setInterval(checkSession, 60000);
            document.addEventListener('visibilitychange', () => { if (!document.hidden) checkSession(); });
        </script>
    </body>
    </html>
    `;
    res.send(html);
});
