'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const endpointsRouter = require('../../server/endpoints');

const CONFIG_FILE = path.join(__dirname, 'enhanced_tuning_config.json');

let pluginConfig = {
    overrideServerTuningLimit: true,
    fmLower: 64.0,
    fmUpper: 108.0,
    amLower: 0.144,
    amUpper: 30.0
};

if (fs.existsSync(CONFIG_FILE)) {
    try {
        const data = fs.readFileSync(CONFIG_FILE, 'utf8');
        pluginConfig = { ...pluginConfig, ...JSON.parse(data) };
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved lesing av config:', err);
    }
}

endpointsRouter.use('/public', express.static(path.join(__dirname, 'public')));

endpointsRouter.get('/api/plugins/enhanced_tuning/config', (req, res) => {
    res.json(pluginConfig);
});

endpointsRouter.post('/api/plugins/enhanced_tuning/config', express.json(), (req, res) => {
    try {
        pluginConfig = { ...pluginConfig, ...req.body };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(pluginConfig, null, 2));
        res.json({ success: true, message: 'Settings saved' });
    } catch (err) {
        console.error('[Enhanced Tuning] Feil ved lagring av config:', err);
        res.status(500).json({ success: false });
    }
});
