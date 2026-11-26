// Enhanced Tuning V3.2 – Analog Scale Integration, AM Scanner, Full Admin UI + Nixie Tubes
// -------------------------------------------------------------------------------------

/* global document, socket, window, WebSocket, Event, addIconToPluginPanel */
(() => {
  let pluginConfig = {
      LAYOUT_STYLE: 'modern',
      HIDE_ALL_BUTTONS: false,
      SHOW_LOOP_BUTTON: true,
      SHOW_BAND_RANGE: true,
      HIDE_DECIMAL_FOR_HF: false,
      HIDE_DECIMAL_HF_THRESHOLD: 30,
      ENABLE_TUNE_STEP_FEATURE: true,
      TUNE_STEP_TIMEOUT_SECONDS: 20,
      ENABLED_BANDS:['FM', 'OIRT', 'SW', 'MW', 'LW'],
      TUNING_STANDARD: 'international',
      ENABLE_MW_STEP_TOGGLE: true,
      ENABLE_FREQUENCY_MEMORY: true,
      ENABLE_SMART_KHZ_INPUT: true,
      ENABLE_AM_BW: true,
      FIRMWARE_TYPE: 'FM-DX-Tuner',
      ENABLE_DEFAULT_AM_BW: false,
      DEFAULT_AM_BW_VALUE: '56000',
      overrideServerTuningLimit: true,
      fmLower: 64.0, fmUpper: 108.0,
      amLower: 0.144, amUpper: 30.0,
      ENABLE_AM_SCANNER: false,
      ENABLE_ANALOG_SCALE: true,
      ANALOG_SCALE_AUTOSTART: false,
      SHOW_TUNING_KNOB: true,
      ANALOG_SCALE_BRIGHTNESS: 1.5,
      ENABLE_VU_METER: true,
      VU_METER_GAIN_FM: 1.5, 
      VU_METER_GAIN_AM: 1.5, 
      VU_METER_MODE: 'RMS', 
      ENABLE_MAGIC_EYE: true,
      ENABLE_NIXIE_TUBES: true,
      ENABLE_PS_SCALE: true,
      ENABLE_SPECTRUM_OVERLAY: true,
      ENABLE_SW_STATIONS_SCALE: false,
      SG_BANDWIDTH_HIGHLIGHT: false,
      SG_FOLLOW_BAND: 'off',

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
      }
  };
  
  let isAdmin = false;

  // A visitor's own choice wins; until they make one, the admin's default applies.
  const userPref = (storageKey, configKey) => {
      const stored = localStorage.getItem(storageKey);
      if (stored === null) return !!(pluginConfig.USER_DEFAULTS && pluginConfig.USER_DEFAULTS[configKey]);
      return stored === 'true';
  };

  // MW step exactly as the MW toggle shows it: the visitor's choice, else 10 kHz for Americas
  const getMwStepKHz = () => {
      const stored = localStorage.getItem('mwStepPreference');
      if (stored) return stored === 'true' ? 10 : 9;
      return pluginConfig.TUNING_STANDARD === 'americas' ? 10 : 9;
  };

  // Latest view reported by Spectrum Graph (CustomEvent 'spectrum-graph:update')
  let latestSpectrumView = null;
  window.addEventListener('spectrum-graph:update', (e) => {
      const d = (e && e.detail) || {};
      const minFreq = Number(d.minFreq), maxFreq = Number(d.maxFreq);
      if (Number.isFinite(minFreq) && Number.isFinite(maxFreq) && maxFreq > minFreq) {
          latestSpectrumView = { minFreq, maxFreq, isScanning: !!d.isScanning };
      }
  });

  // Public API for other plugins (Spectrum Graph etc.). Frequencies in MHz.
  window.EnhancedTuning = {
      apiVersion: 1,
      getMwStepKHz,
      getTuningStandard: () => pluginConfig.TUNING_STANDARD,
      getLimits: () => ({
          override: !!pluginConfig.overrideServerTuningLimit,
          fmLower: Number(pluginConfig.fmLower), fmUpper: Number(pluginConfig.fmUpper),
          amLower: Number(pluginConfig.amLower), amUpper: Number(pluginConfig.amUpper)
      }),
      getBands: () => [pluginConfig.customMainBands, pluginConfig.customSwBands]
          .flatMap(group => Object.entries(group || {}))
          .map(([key, band]) => ({ key, name: band.name || key, start: Number(band.start), end: Number(band.end) })),
      getSpectrumGraphOptions: () => ({
          bandwidthHighlight: !!pluginConfig.SG_BANDWIDTH_HIGHLIGHT,
          followBand: ['last', 'scan'].includes(pluginConfig.SG_FOLLOW_BAND) ? pluginConfig.SG_FOLLOW_BAND : 'off'
      })
  };

  // Tells other plugins when the tuned frequency moves into another band
  // (band button, typed frequency, scrolling). The first call only sets the baseline.
  let lastAnnouncedBandKey = null;
  const announceBandChange = (bandKey, band, freqInMHz) => {
      if (!bandKey || !band || bandKey === lastAnnouncedBandKey) return;
      const initial = lastAnnouncedBandKey === null;
      lastAnnouncedBandKey = bandKey;
      window.dispatchEvent(new CustomEvent('enhanced-tuning:band-change', {
          detail: { key: bandKey, start: Number(band.start), end: Number(band.end), freq: Number(freqInMHz), initial }
      }));
  };
  const announceConfig = (eventName) => {
      window.dispatchEvent(new CustomEvent(eventName, { detail: window.EnhancedTuning }));
  };

  let isLocalScannerRunning = false;
  let isInternalScannerTuning = false;
  let localScannerTimer = null;
  let localScannerMode = null; 
  let localScannerDir = 'up';  
  
  let _startLocalScanner = () => {};
  let _stopLocalScanner = () => {};

  const getGlobalCurrentFrequencyInMHz = () => {
      const el = document.getElementById('data-frequency');
      if (!el) return 0;
      const freqText = el.textContent;
      let freqValue = parseFloat(freqText);
      if (freqText.toLowerCase().includes('khz')) freqValue /= 1000;
      return freqValue;
  };

  // Si47XX firmware adds LSB (mode 2) and USB (mode 3). The server side passes the
  // tuner's mode and exact frequency on, as the core tracks neither.
  const isSi47xx = () => pluginConfig.FIRMWARE_TYPE === 'Si47XX';
  const getSi47xxMode = () => (isSi47xx() && window.parsedData) ? window.parsedData.si47xxMode : undefined;
  const isSsbActive = () => getSi47xxMode() === 2 || getSi47xxMode() === 3;

  const safeTuneToFrequency = (frequencyInMHz) => {
      if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
          if (isLocalScannerRunning) isInternalScannerTuning = true;
          // Si47XX takes decimal kHz, so SSB can tune in 10 Hz steps
          const khz = isSi47xx() ? Math.round(parseFloat(frequencyInMHz) * 100000) / 100 : Math.round(parseFloat(frequencyInMHz) * 1000);
          socket.send("T" + khz);
          isInternalScannerTuning = false;
      }
  };

  const originalFillRect = CanvasRenderingContext2D.prototype.fillRect;
  CanvasRenderingContext2D.prototype.fillRect = function(x, y, w, h) {
      if (this.canvas && this.canvas.id === 'sdr-graph' && AnalogScaleEngine.isVisible) {
          if (y === 9) return; 
      }
      originalFillRect.call(this, x, y, w, h);
  };

  // =========================================================================
  // DYNAMIC ANALOG SCALE ENGINE
  // =========================================================================
  const AnalogScaleEngine = {
      isVisible: false,
      isFading: false,
      wrap: null,
      vuCanvas: null,      
      scaleCanvas: null,
      knobCanvas: null,
      rafId: null,
      lastRenderTime: 0,
      lastKnobState: "",
      outerVelocity: 0,
      innerVelocity: 0,
      FRICTION: 0.90, 
      lastDragTime: 0,
      
      animFreq: null,
      currentFreq: null,
      dragFreq: null,
      lastTuneTime: 0,
      finalTuneTimer: null,
      SMOOTHING: 0.08,

      stationScrollY: 0,
      targetStationScrollY: 0,
      clearHovered: false,
      clearClickedTime: 0,
      
      isDraggingScale: false,
      isDraggingOuterKnob: false,
      isDraggingInnerKnob: false,
      lastDragAngle: 0,
      accumulatedOuterAngle: 0,
      outerKnobAngle: 0,
      innerKnobAngle: 0,

      isFineTuningMode: false,
      knobDragMoved: false,

      mX: 0, mY: 0, mW: 0, mH: 0,
      knobX: 0, knobY: 0, knobOuterR: 0, knobInnerR: 0,
      
      currentMin: 87.5,
      currentMax: 108.0,
      currentUnit: 'MHz',
      currentName: 'FM',
      currentKey: 'FM',

      _colorCache: {},
      _btnAdding: false,
      _hasAutostarted: false,
      _resizeObserver: null,

      renderedStations:[],
      swStations:[],
      lastFetchedSwBand: null,
      hoveredFreq: null,
      scanHovered: false,
      scanClickedTime: 0,

      getBrightness() {
          return parseFloat(localStorage.getItem('et_user_scale_brightness')) || pluginConfig.ANALOG_SCALE_BRIGHTNESS;
      },

      isVuEnabled() {
          return pluginConfig.ENABLE_VU_METER && userPref('et_user_vu_enabled', 'ENABLE_VU_METER');
      },

      isPsEnabled() {
          return pluginConfig.ENABLE_PS_SCALE && userPref('et_user_ps_scale', 'ENABLE_PS_SCALE');
      },

      isSpectrumEnabled() {
          return pluginConfig.ENABLE_SPECTRUM_OVERLAY && userPref('et_user_spectrum_overlay', 'ENABLE_SPECTRUM_OVERLAY');
      },
      
      isSwScaleEnabled() {
          return pluginConfig.ENABLE_SW_STATIONS_SCALE && userPref('et_user_sw_scale', 'ENABLE_SW_STATIONS_SCALE');
      },

      async getServerLocation() {
          if (this.serverLat !== undefined && this.serverLon !== undefined) {
              return { lat: this.serverLat, lon: this.serverLon };
          }
          try {
              const res = await fetch('/static_data');
              if (res.ok) {
                  const data = await res.json();
                  let apiLat = data.qthLatitude || data.lat;
                  let apiLon = data.qthLongitude || data.lon;
                  if (apiLat !== undefined && apiLon !== undefined && apiLat !== 0 && apiLon !== 0) {
                      this.serverLat = parseFloat(apiLat);
                      this.serverLon = parseFloat(apiLon);
                      localStorage.setItem('rx_lat', this.serverLat);
                      localStorage.setItem('rx_lon', this.serverLon);
                      return { lat: this.serverLat, lon: this.serverLon };
                  }
              }
          } catch(e) {
              console.warn("[Enhanced Tuning] Kunne ikke hente koordinater fra /static_data", e);
          }
          let lat = localStorage.getItem('rx_lat');
          let lon = localStorage.getItem('rx_lon');
          if (lat && lon && lat !== '0' && lon !== '0') {
              this.serverLat = parseFloat(lat);
              this.serverLon = parseFloat(lon);
              return { lat: this.serverLat, lon: this.serverLon };
          }
          return { lat: 0, lon: 0 };
      },

      async fetchSwStations(startMhz, endMhz) {
          try {
              const coords = await this.getServerLocation();
              const fStart = Math.round(startMhz * 1000);
              const fEnd = Math.round(endMhz * 1000);
              const res = await fetch(`/aoki-api-proxy?lat=${coords.lat}&lon=${coords.lon}&freqStart=${fStart}&freqEnd=${fEnd}`);
              if (!res.ok) return;
              const data = await res.json();
              if (data && data.status === 'success') {
                  this.swStations = data.stations ||[];
                  if (this.isVisible && this.scaleCanvas) {
                      this.drawScale(this.scaleCanvas, this.animFreq !== null ? this.animFreq : this.currentFreq);
                  }
              }
          } catch (e) {
              console.error("[Enhanced Tuning] Error fetching SW stations:", e);
          }
      },

      async fetchMwLwFavorites() {
          try {
              const res = await fetch('/AM-Station_info/favorites');
              if (res.ok) {
                  this.mwLwFavorites = await res.json();
                  if (this.isVisible && this.scaleCanvas) {
                      this.drawScale(this.scaleCanvas, this.animFreq !== null ? this.animFreq : this.currentFreq);
                  }
              }
          } catch (e) {
              console.warn("[Enhanced Tuning] Error fetching MW/LW favorites:", e);
          }
      },

      applyScaleLayout() {
          if (!this.wrap) return;
          const scaleDiv = document.getElementById("et-analog-scale-container");
          const knobDiv = document.getElementById("et-analog-knob-container");
          const vuDiv = document.getElementById("et-analog-vu-container");
          
          if (!scaleDiv || !knobDiv || !vuDiv) return;

          const showKnob = pluginConfig.SHOW_TUNING_KNOB && userPref('et_user_tuning_knob', 'SHOW_TUNING_KNOB');
          const showVu = this.isVuEnabled();

          knobDiv.style.display = showKnob ? "block" : "none";
          vuDiv.style.display = showVu ? "block" : "none";

          if (showKnob && showVu) {
              scaleDiv.style.flex = "0 0 58%";
              knobDiv.style.flex = "0 0 12%";
              vuDiv.style.flex = "0 0 30%";
              vuDiv.style.marginLeft = "0px";
          } else if (showKnob && !showVu) {
              scaleDiv.style.flex = "0 0 85%";
              knobDiv.style.flex = "0 0 15%";
              vuDiv.style.marginLeft = "0px";
          } else if (!showKnob && showVu) {
              scaleDiv.style.flex = "0 0 70%";
              vuDiv.style.flex = "0 0 30%";
              vuDiv.style.marginLeft = "0px";
          } else {
              scaleDiv.style.flex = "0 0 100%";
          }
          
          this.resizeCanvas();
          this.lastKnobState = ""; 
      },

      audioInitialized: false,
      audioCtx: null,
      analyserL: null, analyserR: null,
      dataL: null, dataR: null,
      currentVuLeft: 0, currentVuRight: 0,

      init() {
          if (!pluginConfig.ENABLE_ANALOG_SCALE) return;
          
          this.hookPS();
          this.setupRetroTooltip();

          const themeObserver = new MutationObserver((mutations) => {
              let themeChanged = false;
              for (const mutation of mutations) {
                  if (mutation.type === 'attributes' && 
                     (mutation.attributeName === 'class' || mutation.attributeName === 'style' || mutation.attributeName === 'data-theme')) {
                      themeChanged = true;
                      break;
                  }
              }

              if (themeChanged) {
                  this.lastKnobState = ""; 
                  console.log("[Enhanced Tuning] Tema-endring oppdaget! Oppdaterer hjulet...");
              }
          });

          themeObserver.observe(document.documentElement, { attributes: true, attributeFilter:['class', 'style', 'data-theme'] });
          themeObserver.observe(document.body, { attributes: true, attributeFilter:['class', 'style', 'data-theme'] });
      },

      tryInitAudio() {
          if (!this.isVuEnabled()) return;

          if (this.audioInitialized && this.audioCtx) {
              if (this.audioCtx.state === 'suspended') {
                  this.audioCtx.resume().catch(() => {});
              }
              if (typeof Stream !== 'undefined' && Stream && Stream.Fallback && Stream.Fallback.Player && Stream.Fallback.Player.Amplification) {
                  if (this.audioCtx !== Stream.Fallback.Player.Amplification.context) {
                      this.audioInitialized = false; 
                  }
              }
              if (this.audioInitialized) return; 
          }

          if (typeof Stream !== 'undefined' && Stream && Stream.Fallback && Stream.Fallback.Player && Stream.Fallback.Player.Amplification) {
              try {
                  let source = Stream.Fallback.Player.Amplification;
                  if (!source.context) return;
                  
                  this.audioCtx = source.context;
                  let splitter = this.audioCtx.createChannelSplitter(2);
                  this.analyserL = this.audioCtx.createAnalyser();
                  this.analyserR = this.audioCtx.createAnalyser();
                  this.analyserL.fftSize = 512;
                  this.analyserR.fftSize = 512;
                  this.dataL = new Float32Array(this.analyserL.fftSize);
                  this.dataR = new Float32Array(this.analyserR.fftSize);
                  
                  try { source.connect(splitter); } catch(e){}
                  try { splitter.connect(this.analyserL, 0); } catch(e){}
                  try { splitter.connect(this.analyserR, 1); } catch(e){}
                  
                  if (this.audioCtx.state === 'suspended') {
                      this.audioCtx.resume().catch(() => {});
                  }
                  
                  this.audioInitialized = true;
              } catch(e) {}
          }
      },

      getLevel(floatArray) {
          if (!floatArray || floatArray.length === 0) return 0;
          
          const isAmBand = (this.currentFreq !== null && this.currentFreq < 30.0);
          const gain = isAmBand ? (pluginConfig.VU_METER_GAIN_AM || 2.5) : (pluginConfig.VU_METER_GAIN_FM || 1.5);
          
          let level = 0;

          if (pluginConfig.VU_METER_MODE === 'Peak') {
              let max = 0;
              for (let i = 0; i < floatArray.length; i++) {
                  let abs = Math.abs(floatArray[i]);
                  if (abs > max) max = abs;
              }
              if (max < 0.01) return 0; 
              level = max * (2.0 * gain);
          } else {
              let sumSquares = 0;
              for (let i = 0; i < floatArray.length; i++) {
                  sumSquares += floatArray[i] * floatArray[i];
              }
              let rms = Math.sqrt(sumSquares / floatArray.length);
              
              if (rms < 0.002) return 0; 
              level = rms * (3.5 * gain); 
              
              if (level > 0.05) {
                  level += (Math.random() - 0.5) * 0.025; 
              }
          }

          return Math.min(1.0, level); 
      },

      updateBand(bandData, freq, bandKey) {
          if (!bandData || !pluginConfig.ENABLE_ANALOG_SCALE) return;
          
          if (this.currentFreq === null) {
              this.currentFreq = freq; 
              this.animFreq = freq; 
              this.dragFreq = freq;
          } else {
              if (!this.isDraggingScale && !this.isDraggingOuterKnob && !this.isDraggingInnerKnob && Math.abs(this.outerVelocity) < 0.001 && Math.abs(this.innerVelocity) < 0.001) {
                  
                  if (this.currentFreq !== freq) {
                      let diff = freq - this.currentFreq;
                      
                      if (this.currentKey === (bandKey || 'FM') || Math.abs(diff) < 3.0) {
                          let step = this.getStep();
                          
                          if (this.isFineTuningMode) {
                              const isFmSpectrum = (this.currentKey === 'FM' || this.currentKey === 'OIRT');
                              const fineStep = isFmSpectrum ? 0.010 : 0.001;
                              this.innerKnobAngle += (diff / fineStep) * (Math.PI / 6);
                          } else {
                              this.outerKnobAngle += (diff / step) * (Math.PI / 20);
                          }
                      }
                  }

                  this.currentFreq = freq;
              }
          }
          
          this.currentKey = bandKey || 'FM';
          this.addButton();

          const isSwSubband = this.currentKey && (this.currentKey in pluginConfig.customSwBands || this.currentKey.endsWith('m'));
          const isMwLw = this.currentKey === 'MW' || this.currentKey === 'LW';

          if (isSwSubband && this.isSwScaleEnabled()) {
              if (this.lastFetchedSwBand !== this.currentKey) {
                  this.fetchSwStations(bandData.start, bandData.end);
                  this.lastFetchedSwBand = this.currentKey;
              }
          } else if (isMwLw && this.isSwScaleEnabled()) {
              if (this.lastFetchedSwBand !== this.currentKey) {
                  this.fetchMwLwFavorites();
                  this.lastFetchedSwBand = this.currentKey;
              }
          } else {
              this.swStations =[];
              this.mwLwFavorites =[];
              this.lastFetchedSwBand = null;
          }
          
          if (this.currentMin !== bandData.start || this.currentMax !== bandData.end || this.currentKey !== bandKey) {
              this.currentMin = bandData.start;
              this.currentMax = bandData.end;
              this.currentUnit = bandData.displayUnit || 'MHz';
              
              if (bandData.name) {
                  this.currentName = bandData.name;
              } else if (bandKey && bandKey.endsWith('m')) {
                  this.currentName = bandKey.replace('m', ' meter');
              } else {
                  this.currentName = 'BAND';
              }
              
              if (this.isVisible && this.scaleCanvas) {
                  this.resizeCanvas(); 
              }
          }

          if (pluginConfig.ANALOG_SCALE_AUTOSTART && !this._hasAutostarted) {
              this._hasAutostarted = true;
              
              const userAutostart = userPref('et_user_analog_autostart', 'ANALOG_SCALE_AUTOSTART');
              if (userAutostart) {
                  setTimeout(() => { 
                      if (!this.isVisible && !this.isFading) this.toggle(); 
                  }, 1200); 
              }
          }
      },

      getStep() {
          if (this.currentKey === 'FM') return (pluginConfig.TUNING_STANDARD === 'americas') ? 0.200 : 0.100;
          if (this.currentKey === 'MW') return getMwStepKHz() === 10 ? 0.010 : 0.009;
          if (this.currentKey === 'LW') return 0.009;
          if (this.currentKey === 'OIRT') return 0.030;
          if (this.currentKey === 'AM_SUPER') return 0.001;
          return 0.005; 
      },

      snapFreq(f) {
          const step = this.getStep();
          let snappedOffset = Math.round((f - this.currentMin) / step) * step;
          let snappedFreq = this.currentMin + snappedOffset;
          return parseFloat(Math.max(this.currentMin, Math.min(this.currentMax, snappedFreq)).toFixed(3));
      },

      getTheme() {
          const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
          return {
              bg1: cssVar("--color-1", "#071c33"),
              bg2: cssVar("--color-2", "#0d2640"),
              accent: cssVar("--color-4", "#3abf9a"),
              text: cssVar("--color-text", "#e0e0e0")
          };
      },

      parseColor(cssColor) {
          if (this._colorCache[cssColor]) return this._colorCache[cssColor];
          const tmp = document.createElement("canvas");
          tmp.width = tmp.height = 1;
          const c = tmp.getContext("2d");
          c.fillStyle = "#000"; c.fillRect(0,0,1,1);
          c.fillStyle = cssColor; c.fillRect(0,0,1,1);
          const d = c.getImageData(0,0,1,1).data;
          const result = { r: d[0], g: d[1], b: d[2] };
          this._colorCache[cssColor] = result;
          return result;
      },

      rgba(cssColor, alpha) {
          const { r, g, b } = this.parseColor(cssColor);
          return `rgba(${r},${g},${b},${alpha})`;
      },

      getClientX(evt) { return (evt.touches && evt.touches.length > 0) ? evt.touches[0].clientX : evt.clientX; },
      getClientY(evt) { return (evt.touches && evt.touches.length > 0) ? evt.touches[0].clientY : evt.clientY; },
      getAngle(x, y) { return Math.atan2(y - this.knobY, x - this.knobX); },

      updateMetrics(sW, sH, kW) {
          this.mX = 15; 
          this.mY = sH * 0.10;
          this.mH = sH * 0.80;
          
          if (kW > 0) { 
              this.mW = sW - this.mX - 15;
              
              this.knobX = kW * 0.50; 
              this.knobY = sH * 0.5;
              
              this.knobOuterR = Math.min(kW * 0.43, sH * 0.43); 
              this.knobInnerR = this.knobOuterR * 0.65;
          } else {
              this.mW = sW - (this.mX * 2);
          }
      },

      ensureElements() {
          const cc = document.querySelector(".canvas-container.hide-phone");
          if (!cc) return false;
          if (document.getElementById("et-analog-scale-wrap")) {
              this.wrap = document.getElementById("et-analog-scale-wrap");
              this.applyScaleLayout();
              return true;
          }

          this.wrap = document.createElement("div");
          this.wrap.id = "et-analog-scale-wrap";
          Object.assign(this.wrap.style, {
              display: "none", flexDirection: "row", width: "100%", height: "160px", position: "relative",
              zIndex: "5", 
              transform: "translateX(10px)",
              margin: "0",
              overflow: "hidden", boxSizing: "border-box", userSelect: "none", webkitUserSelect: "none",
              borderRadius: "16px", boxShadow: "0 6px 15px rgba(0,0,0,0.4)",
              backgroundColor: "var(--color-1)"
          });


          const scaleDiv = document.createElement("div");
          scaleDiv.id = "et-analog-scale-container";
          Object.assign(scaleDiv.style, { position: "relative", height: "100%", overflow: "hidden", minWidth: "0" });
          this.scaleCanvas = document.createElement("canvas");
          this.scaleCanvas.id = "et-analog-scale-canvas";
          Object.assign(this.scaleCanvas.style, { width: "100%", height: "100%", display: "block", cursor: "default", touchAction: "none" });
          scaleDiv.appendChild(this.scaleCanvas);
          this.wrap.appendChild(scaleDiv);

          const knobDiv = document.createElement("div");
          knobDiv.id = "et-analog-knob-container";
          Object.assign(knobDiv.style, { position: "relative", height: "100%", overflow: "hidden", minWidth: "0" });
          this.knobCanvas = document.createElement("canvas");
          this.knobCanvas.id = "et-analog-knob-canvas";
          Object.assign(this.knobCanvas.style, { width: "100%", height: "100%", display: "block", cursor: "default", touchAction: "none" });
          knobDiv.appendChild(this.knobCanvas);
          this.wrap.appendChild(knobDiv);

          const vuDiv = document.createElement("div");
          vuDiv.id = "et-analog-vu-container";
          Object.assign(vuDiv.style, { position: "relative", height: "100%", overflow: "hidden", minWidth: "0" });
          this.vuCanvas = document.createElement("canvas");
          this.vuCanvas.id = "et-analog-vu-canvas";
          Object.assign(this.vuCanvas.style, { width: "100%", height: "100%", display: "block", cursor: "default", touchAction: "none" });
          vuDiv.appendChild(this.vuCanvas);
          this.wrap.appendChild(vuDiv);
          
          cc.appendChild(this.wrap);

          if (!this._resizeObserver) {
              this._resizeObserver = new ResizeObserver(() => {
                  if (this.isVisible) this.resizeCanvas();
              });
              this._resizeObserver.observe(this.wrap);
              window.addEventListener('resize', () => {
                  if (this.isVisible) this.resizeCanvas();
              });
          }

          this.scaleCanvas.addEventListener("wheel", (evt) => {
              if (this.isDraggingScale) return;
              const isFmSpectrum = (this.currentKey === 'FM' || this.currentKey === 'OIRT');
              const showStations = (isFmSpectrum && this.isPsEnabled()) || (!isFmSpectrum && this.isSwScaleEnabled());
              if (!showStations) return;

              evt.preventDefault();
              this.targetStationScrollY += Math.sign(evt.deltaY) * 35;
              this.targetStationScrollY = Math.max(0, this.targetStationScrollY);
          }, { passive: false });

          this.scaleCanvas.addEventListener("mousemove", (evt) => {
              if (this.isDraggingScale || this.isDraggingOuterKnob || this.isDraggingInnerKnob) return;
              const rect = this.scaleCanvas.getBoundingClientRect();
              const x = evt.clientX - rect.left;
              const y = evt.clientY - rect.top;
              
              let isOverStation = false;
              for (let st of this.renderedStations) {
                  if (x >= st.left && x <= st.right && y >= st.top && y <= st.bottom) {
                      isOverStation = true; break;
                  }
              }
              if (isOverStation) {
                  this.scaleCanvas.style.cursor = "pointer"; return;
              }

              const sdrBtn = document.getElementById('spectrum-graph-button');
              const isSpecActive = sdrBtn && (sdrBtn.classList.contains('active') || sdrBtn.classList.contains('bg-color-4'));
              const isFmSpectrum = (this.currentKey === 'FM' || this.currentKey === 'OIRT');
              const showStations = (isFmSpectrum && this.isPsEnabled()) || (!isFmSpectrum && this.isSwScaleEnabled());
              
              const paperX = this.mX + 2;
              const paperW = this.mW - 4;
              const paperH = this.mH - 4;
              const baseY = showStations ? (this.mY + 2 + paperH * 0.35) : (this.mY + 2 + paperH * 0.85);
              const actionBtnY = baseY - (showStations ? 5 : 15);

              const scanBtnLeft = paperX + paperW - 40;
              const scanBtnRight = paperX + paperW;
              const scanBtnTop = actionBtnY - 15;
              const scanBtnBottom = actionBtnY + 15;

              const clearBtnLeft = paperX;
              const clearBtnRight = paperX + 40;
              const clearBtnTop = actionBtnY - 15;
              const clearBtnBottom = actionBtnY + 15;

              let hoverScan = isFmSpectrum && isSpecActive && x >= scanBtnLeft && x <= scanBtnRight && y >= scanBtnTop && y <= scanBtnBottom;
              let hoverClear = isFmSpectrum && this.isPsEnabled() && x >= clearBtnLeft && x <= clearBtnRight && y >= clearBtnTop && y <= clearBtnBottom;

              if (hoverScan || hoverClear) {
                  this.scaleCanvas.style.cursor = "pointer";
                  if (this.scanHovered !== hoverScan || this.clearHovered !== hoverClear) {
                      this.scanHovered = hoverScan;
                      this.clearHovered = hoverClear;
                      if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
                  }
                  return;
              } else if (this.scanHovered || this.clearHovered) {
                  this.scanHovered = false; this.clearHovered = false;
                  if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
              }

              const tX = paperX + paperW * 0.04;
              const tW = paperW * 0.92;
              const needleX = tX + ((this.animFreq - this.currentMin) / (this.currentMax - this.currentMin)) * tW;
              
              if (x >= needleX - 10 && x <= needleX + 10 && y >= this.mY && y <= this.mY + this.mH) {
                  this.scaleCanvas.style.cursor = "ew-resize";
              } else {
                  this.scaleCanvas.style.cursor = "default";
              }
          });
          
          this.scaleCanvas.addEventListener("mouseleave", () => {
              this.scanHovered = false; this.clearHovered = false;
              if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
              const tooltip = document.getElementById('retro-station-tooltip');
              if (tooltip) tooltip.style.display = 'none';
              this.hoveredFreq = null;
          });

          const startScaleDrag = (evt) => {
              const rect = this.scaleCanvas.getBoundingClientRect();
              const x = this.getClientX(evt) - rect.left;
              const y = this.getClientY(evt) - rect.top;
              
              for (let st of this.renderedStations) {
                  if (x >= st.left && x <= st.right && y >= st.top && y <= st.bottom) {
                      let targetFreq = this.currentUnit === 'kHz' ? st.f / 1000 : st.f;
                      safeTuneToFrequency(targetFreq);
                      this.currentFreq = targetFreq; this.animFreq = targetFreq; this.dragFreq = targetFreq;
                      return; 
                  }
              }

              if (this.scanHovered) {
                  const origBtn = document.getElementById('spectrum-scan-button');
                  if (origBtn) origBtn.click(); 
                  this.scanClickedTime = Date.now();
                  if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
                  return;
              }

              if (this.clearHovered) {
                  if (confirm("Are you sure you want to clear all saved PS stations?")) {
                      localStorage.removeItem('retro_station_db');
                      this.clearClickedTime = Date.now();
                      if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
                  }
                  return;
              }

              if (x >= this.mX && x <= this.mX + this.mW && y >= this.mY && y <= this.mY + this.mH) {
                  this.isDraggingScale = true;
                  this.scaleCanvas.style.cursor = "col-resize";
                  this.handleGlobalMove(evt);
              }
          };
          this.scaleCanvas.addEventListener("mousedown", startScaleDrag);
          this.scaleCanvas.addEventListener("touchstart", startScaleDrag, { passive: false });

          if (this.knobCanvas) {
              this.knobCanvas.addEventListener("mousemove", (evt) => {
                  if (this.isDraggingScale || this.isDraggingOuterKnob || this.isDraggingInnerKnob) return;
                  const rect = this.knobCanvas.getBoundingClientRect();
                  const x = evt.clientX - rect.left;
                  const y = evt.clientY - rect.top;
                  const distSq = (x - this.knobX) * (x - this.knobX) + (y - this.knobY) * (y - this.knobY);
                  
                  if (distSq <= this.knobOuterR * this.knobOuterR) {
                      this.knobCanvas.style.cursor = "grab";
                  } else {
                      this.knobCanvas.style.cursor = "default";
                  }
              });

              const startKnobDrag = (evt) => {
                  const rect = this.knobCanvas.getBoundingClientRect();
                  const x = this.getClientX(evt) - rect.left;
                  const y = this.getClientY(evt) - rect.top;
                  const dx = x - this.knobX;
                  const dy = y - this.knobY;
                  const distSq = dx * dx + dy * dy;
                  
                  this.knobDragMoved = false; 
                  this.outerVelocity = 0; 
                  this.innerVelocity = 0; 
                  this.lastDragTime = Date.now();

                  if (distSq <= this.knobInnerR * this.knobInnerR) {
                      this.isDraggingInnerKnob = true;
                      this.lastDragAngle = this.getAngle(x, y);
                      this.knobCanvas.style.cursor = "grabbing";
                  } else if (distSq <= this.knobOuterR * this.knobOuterR) {
                      this.isDraggingOuterKnob = true;
                      this.accumulatedOuterAngle = 0; 
                      this.lastDragAngle = this.getAngle(x, y);
                      this.knobCanvas.style.cursor = "grabbing";
                  }
              };
              this.knobCanvas.addEventListener("mousedown", startKnobDrag);
              this.knobCanvas.addEventListener("touchstart", startKnobDrag, { passive: false });
              
              this.knobCanvas.addEventListener("dblclick", (evt) => {
                  const rect = this.knobCanvas.getBoundingClientRect();
                  const x = evt.clientX - rect.left;
                  const y = evt.clientY - rect.top;
                  const distSq = (x - this.knobX) * (x - this.knobX) + (y - this.knobY) * (y - this.knobY);
                  
                  if (distSq <= this.knobInnerR * this.knobInnerR && this.currentFreq !== null) {
                      let snappedFreq = this.snapFreq(this.currentFreq);
                      this.currentFreq = snappedFreq; this.animFreq = snappedFreq; this.dragFreq = snappedFreq;
                      safeTuneToFrequency(snappedFreq);
                  }
              });
          }

          const stopDrag = () => {
              const wasActivelyDragging = (this.isDraggingScale) || ((this.isDraggingInnerKnob || this.isDraggingOuterKnob) && this.knobDragMoved);

              if (Date.now() - this.lastDragTime > 50) {
                  this.outerVelocity = 0;
                  this.innerVelocity = 0;
              }

              if ((this.isDraggingInnerKnob || this.isDraggingOuterKnob) && !this.knobDragMoved) {
                  this.isFineTuningMode = !this.isFineTuningMode;
                  if (navigator.vibrate) navigator.vibrate(50);
                  if (this.knobCanvas) this.drawKnob(this.knobCanvas);
              }

              this.isDraggingOuterKnob = false;
              this.isDraggingInnerKnob = false;
              this.isDraggingScale = false;
              if (this.scaleCanvas) this.scaleCanvas.style.cursor = "default";
              if (this.knobCanvas) this.knobCanvas.style.cursor = "default";
              clearTimeout(this.finalTuneTimer);
              
              if (wasActivelyDragging && this.dragFreq !== null) {
                  const finalF = this.isFineTuningMode ? parseFloat(this.dragFreq.toFixed(3)) : this.snapFreq(this.dragFreq);
                  safeTuneToFrequency(finalF);
              }
          };

          window.addEventListener("mousemove", (e) => this.handleGlobalMove(e));
          window.addEventListener("mouseup", stopDrag);
          window.addEventListener("mouseleave", stopDrag);
          window.addEventListener("touchmove", (e) => this.handleGlobalMove(e), { passive: false });
          window.addEventListener("touchend", stopDrag);
          window.addEventListener("touchcancel", stopDrag);

          this.applyScaleLayout();
          this.resizeCanvas();
          return true;
      },

      applyKnobRotation(isOuter, deltaAngle) {
          let f = this.currentFreq;
          const step = this.getStep();

          if (isOuter) {
              this.outerKnobAngle += deltaAngle;
              this.accumulatedOuterAngle += deltaAngle;
              
              const anglePerStep = Math.PI / 20; 
              if (Math.abs(this.accumulatedOuterAngle) >= anglePerStep) {
                  const steps = Math.trunc(this.accumulatedOuterAngle / anglePerStep);
                  this.accumulatedOuterAngle -= steps * anglePerStep;
                  
                  f = this.snapFreq(f);
                  f += steps * step; 
              }
          } else {
              this.innerKnobAngle += deltaAngle;
              
              if (typeof this.accumulatedInnerAngle === 'undefined') {
                  this.accumulatedInnerAngle = 0;
              }
              
              this.accumulatedInnerAngle += deltaAngle;
              const anglePerInnerStep = Math.PI / 6; 
              
              if (Math.abs(this.accumulatedInnerAngle) >= anglePerInnerStep) {
                  const steps = Math.trunc(this.accumulatedInnerAngle / anglePerInnerStep);
                  this.accumulatedInnerAngle -= steps * anglePerInnerStep;
                  
                  if (!this.isFineTuningMode) {
                      f = this.snapFreq(f);
                      f += steps * step; 
                  } else {
                      const isFmSpectrum = (this.currentKey === 'FM' || this.currentKey === 'OIRT');
                      const fineStep = isFmSpectrum ? 0.010 : 0.001;
                      f += steps * fineStep;
                  }
              }
          }
          
          f = Math.max(this.currentMin, Math.min(this.currentMax, f));
          f = parseFloat(f.toFixed(3));
          
          if (this.dragFreq !== f) {
              this.dragFreq = f; 
              this.currentFreq = f;

              const now = Date.now();
              if (now - this.lastTuneTime > 80) { safeTuneToFrequency(f); this.lastTuneTime = now; }
              clearTimeout(this.finalTuneTimer);
              this.finalTuneTimer = setTimeout(() => {
                  const finalF = this.isFineTuningMode ? parseFloat(this.dragFreq.toFixed(3)) : this.snapFreq(this.dragFreq);
                  safeTuneToFrequency(finalF);
              }, 100);
          }
      },

      handleGlobalMove(evt) {
          if (!this.scaleCanvas || this.currentFreq === null) return;
          
          if (this.isDraggingOuterKnob || this.isDraggingInnerKnob || this.isDraggingScale) {
              if (evt.cancelable) evt.preventDefault();
          } else {
              return; 
          }
          
          if (this.isDraggingOuterKnob || this.isDraggingInnerKnob) {
              const rect = this.knobCanvas.getBoundingClientRect();
              const x = this.getClientX(evt) - rect.left;
              const y = this.getClientY(evt) - rect.top;

              const currentAngle = this.getAngle(x, y);
              let deltaAngle = currentAngle - this.lastDragAngle;
              
              if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
              if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
              
              if (Math.abs(deltaAngle) > 0.02) {
                  this.knobDragMoved = true;
              }
              
              this.lastDragTime = Date.now(); 
              
              if (this.isDraggingOuterKnob) {
                  this.outerVelocity = deltaAngle;
                  this.applyKnobRotation(true, deltaAngle);
              } else {
                  this.innerVelocity = deltaAngle;
                  this.applyKnobRotation(false, deltaAngle);
              }
              this.lastDragAngle = currentAngle;
          } else if (this.isDraggingScale) {
              const rect = this.scaleCanvas.getBoundingClientRect();
              const x = this.getClientX(evt) - rect.left;
              const paperX = this.mX + 2;
              const paperW = this.mW - 4;
              const tX = paperX + paperW * 0.04;
              const tW = paperW * 0.92;
              
              let rawF = this.currentMin + ((x - tX) / tW) * (this.currentMax - this.currentMin);
              let f = this.isFineTuningMode ? rawF : this.snapFreq(rawF);
              
              f = Math.max(this.currentMin, Math.min(this.currentMax, f));
              f = parseFloat(f.toFixed(3));
              
              if (this.dragFreq !== f) {
                  this.dragFreq = f; 
                  this.currentFreq = f;
                  if (this.isDraggingScale) this.animFreq = f;

                  const now = Date.now();
                  if (now - this.lastTuneTime > 80) { safeTuneToFrequency(f); this.lastTuneTime = now; }
                  clearTimeout(this.finalTuneTimer);
                  this.finalTuneTimer = setTimeout(() => {
                      const finalF = this.isFineTuningMode ? parseFloat(this.dragFreq.toFixed(3)) : this.snapFreq(this.dragFreq);
                      safeTuneToFrequency(finalF);
                  }, 100);
              }
          }
      },

      resizeCanvas() {
          if (!this.scaleCanvas || !this.wrap) return;
          const dpr = window.devicePixelRatio || 1;
          
          const sW = this.scaleCanvas.parentElement.clientWidth; 
          const sH = this.scaleCanvas.parentElement.clientHeight || 160;
          if(sW === 0 || sH === 0) return;

          this.scaleCanvas.width  = Math.round(sW * dpr);
          this.scaleCanvas.height = Math.round(sH * dpr);
          
          let kW = 0;
          if (this.knobCanvas && this.knobCanvas.parentElement.style.display !== "none") {
              kW = this.knobCanvas.parentElement.clientWidth || 96;  
              const kH = this.knobCanvas.parentElement.clientHeight || 160;
              this.knobCanvas.width   = Math.round(kW * dpr);
              this.knobCanvas.height  = Math.round(kH * dpr);
          }
          
          if (this.isVuEnabled() && this.vuCanvas) {
              const vW = this.vuCanvas.parentElement.clientWidth;
              const vH = this.vuCanvas.parentElement.clientHeight || 160;
              this.vuCanvas.width  = Math.round(vW * dpr);
              this.vuCanvas.height = Math.round(vH * dpr);
          }

          this.updateMetrics(sW, sH, kW);
          this.lastKnobState = ""; 
      },

      applyWrapperStyle() {
          const cc = document.querySelector(".canvas-container.hide-phone");
          if (!cc) return;
          
          cc.style.padding = "0";
          cc.style.lineHeight = "0";
          cc.style.overflow = "visible";
          cc.style.position = "relative";
          cc.style.height = "auto";
          cc.style.minHeight = "160px";
          cc.style.flexShrink = "0";
          cc.style.marginTop = "10px"; 
          cc.style.marginBottom = "0px"; 
          
          const p = cc.parentElement;
          if (p) {
              const cs = getComputedStyle(p);
              const pL = parseFloat(cs.paddingLeft) || 0;
              const pR = parseFloat(cs.paddingRight) || 0;
              cc.style.marginLeft = `-${pL}px`; 
              cc.style.marginRight = `-${pR}px`; 
              cc.style.width = `calc(98.4% + ${pL + pR}px)`;
          }
      },

      resetWrapperStyle() {
          const cc = document.querySelector(".canvas-container.hide-phone");
          if (!cc) return;
          const mmActive =["mm-mpx-combo-flex", "mm-signal-analyzer-flex", "mm-scope-flex"].some(id => {
              const el = document.getElementById(id);
              return el && el.style.display === "flex";
          });
          if (!mmActive) {["padding", "margin", "marginTop", "marginBottom", "lineHeight", "overflow", "marginLeft", "marginRight", "width", "position", "height", "minHeight", "flexShrink"].forEach(p => cc.style[p] = "");
          }
      },

      toggle() {
          if (this.isFading) return;
          const btn = document.getElementById("et-analog-scale-btn");
          
          if (this.isVisible) {
              this.isFading = true;
              if (this.wrap) {
                  this.wrap.style.transition = "opacity 400ms ease-in-out";
                  this.wrap.style.opacity = "0";
              }
              setTimeout(() => {
                  this.isVisible = false;
                  if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
                  if (this.wrap) { this.wrap.style.display = "none"; this.wrap.style.transition = ""; }
                  
                  document.body.classList.remove('et-analog-active');
                  this.resetWrapperStyle();
                  
                  if (btn) btn.classList.remove("active");
                  this.isFading = false;
              }, 400);
          } else {
              if (!this.ensureElements()) return;
              if (this.audioCtx && this.audioCtx.state === 'suspended') this.audioCtx.resume();
              
              document.body.classList.add('et-analog-active');
              
              this.applyWrapperStyle();
              this.wrap.style.display = "flex"; 
              this.isVisible = true;
              
              this.resizeCanvas();
              if (!this.rafId) this.rafId = requestAnimationFrame(() => this.renderLoop());
              
              this.wrap.style.opacity = "0";
              this.wrap.style.transition = "opacity 400ms ease-in-out";
              
              requestAnimationFrame(() => requestAnimationFrame(() => { this.wrap.style.opacity = "0.99"; }));
              
              setTimeout(() => { if (this.wrap) this.wrap.style.transition = ""; this.isFading = false; }, 400);
              if (btn) btn.classList.add("active");
          }
      },

      rrect(ctx, x, y, w, h, r) {
          ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
      },

      drawSilverKnurledRing(ctx, radius, width, ridges, angleOffset) {
          ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.arc(0, 0, radius - width, 0, Math.PI * 2, true);
          const silverGrad = ctx.createLinearGradient(-radius, -radius, radius, radius);
          silverGrad.addColorStop(0, "#777777"); silverGrad.addColorStop(0.2, "#aaaaaa");
          silverGrad.addColorStop(0.5, "#555555"); silverGrad.addColorStop(0.8, "#bbbbbb"); silverGrad.addColorStop(1, "#444444");
          ctx.fillStyle = silverGrad; ctx.fill();

          ctx.lineWidth = 1.0;
          for (let i = 0; i < ridges; i++) {
              const angle = (i / ridges) * Math.PI * 2 + angleOffset;
              const x1 = Math.cos(angle) * radius, y1 = Math.sin(angle) * radius;
              const x2 = Math.cos(angle) * (radius - width), y2 = Math.sin(angle) * (radius - width);
              ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
              
              const a2 = angle + (Math.PI * 2 / ridges) * 0.4;
              const x3 = Math.cos(a2) * radius, y3 = Math.sin(a2) * radius;
              const x4 = Math.cos(a2) * (radius - width), y4 = Math.sin(a2) * (radius - width);
              ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
          }
      },

      drawConcentricKnob(ctx, x, y, outerR, innerR, T) {
          ctx.save(); ctx.translate(x, y);
          
          ctx.beginPath(); ctx.arc(0, 0, outerR + 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.shadowColor = "rgba(0,0,0,0.9)";
          ctx.shadowBlur = 12; ctx.shadowOffsetY = 6; ctx.fill(); ctx.shadowColor = "transparent";

          ctx.beginPath(); ctx.arc(0, 0, outerR, 0, Math.PI * 2);
          ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.stroke();

          this.drawSilverKnurledRing(ctx, outerR, outerR * 0.07, 80, this.outerKnobAngle);

          ctx.beginPath(); ctx.arc(0, 0, outerR * 0.93, 0, Math.PI * 2);
          ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.shadowColor = "transparent";

          const outerDarkR = outerR * 0.93;
          ctx.beginPath(); ctx.arc(0, 0, outerDarkR, 0, Math.PI * 2);
          const outerGrad = ctx.createLinearGradient(-outerDarkR, -outerDarkR, outerDarkR, outerDarkR);
          outerGrad.addColorStop(0, this.rgba(T.bg2, 1.0)); outerGrad.addColorStop(0.5, this.rgba(T.bg1, 0.9)); outerGrad.addColorStop(1, this.rgba(T.bg1, 1.0));
          ctx.fillStyle = outerGrad; ctx.fill();

          const outerDimpleX = Math.cos(this.outerKnobAngle - Math.PI / 2) * (outerDarkR * 0.82);
          const outerDimpleY = Math.sin(this.outerKnobAngle - Math.PI / 2) * (outerDarkR * 0.82);

          ctx.beginPath(); ctx.arc(outerDimpleX, outerDimpleY, outerR * 0.06, 0, Math.PI * 2);
          const outerDimpleGrad = ctx.createRadialGradient(outerDimpleX, outerDimpleY, 0, outerDimpleX, outerDimpleY, outerR * 0.06);
          
          if (!this.isFineTuningMode) { 
              outerDimpleGrad.addColorStop(0, "#ffffff");
              outerDimpleGrad.addColorStop(1, "#3498db");
              ctx.shadowColor = "#3498db"; ctx.shadowBlur = 8;
          } else {
              outerDimpleGrad.addColorStop(0, "#111");
              outerDimpleGrad.addColorStop(1, this.rgba(T.bg2, 1.0));
          }
          ctx.fillStyle = outerDimpleGrad; ctx.fill(); ctx.shadowColor = "transparent";

          ctx.beginPath(); ctx.arc(outerDimpleX, outerDimpleY, outerR * 0.06, 0, Math.PI * 2);
          ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke(); ctx.shadowColor = "transparent";

          ctx.beginPath(); ctx.arc(0, 0, innerR + 3, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(0,0,0,1.0)"; ctx.shadowColor = "rgba(0,0,0,0.95)";
          ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; ctx.shadowOffsetX = 4; ctx.fill(); ctx.shadowColor = "transparent";
          
          ctx.beginPath(); ctx.arc(0, 0, innerR + 1, 0, Math.PI * 1); ctx.fillStyle = "#000000"; ctx.fill();
          ctx.beginPath(); ctx.arc(0, 0, innerR + 1, 0, Math.PI * 2);
          const rimGrad = ctx.createLinearGradient(0, -innerR, 0, innerR);
          rimGrad.addColorStop(0, this.rgba(T.bg2, 1.0)); rimGrad.addColorStop(1, "#111"); ctx.fillStyle = rimGrad; ctx.fill();
          
          this.drawSilverKnurledRing(ctx, innerR, innerR * 0.10, 60, this.innerKnobAngle);

          ctx.beginPath(); ctx.arc(0, 0, innerR * 0.90, 0, Math.PI * 2);
          ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
          ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 1.5; ctx.stroke(); ctx.shadowColor = "transparent";

          const innerDarkR = innerR * 0.90;
          ctx.beginPath(); ctx.arc(0, 0, innerDarkR, 0, Math.PI * 2);
          const innerGrad = ctx.createLinearGradient(-innerDarkR, -innerDarkR, innerDarkR, innerDarkR);
          innerGrad.addColorStop(0, this.rgba(T.bg2, 1.0)); innerGrad.addColorStop(0.6, this.rgba(T.bg1, 0.9)); innerGrad.addColorStop(1, this.rgba(T.bg1, 1.0));
          ctx.fillStyle = innerGrad; ctx.fill();

          ctx.beginPath(); ctx.arc(0, 0, innerDarkR, 0, Math.PI * 2); ctx.lineWidth = 1;
          const highlightGrad = ctx.createLinearGradient(0, -innerDarkR, 0, innerDarkR);
          highlightGrad.addColorStop(0, "rgba(255,255,255,0.4)"); highlightGrad.addColorStop(0.3, "rgba(255,255,255,0.05)"); highlightGrad.addColorStop(1, "rgba(255,255,255,0)");
          ctx.strokeStyle = highlightGrad; ctx.stroke();
          
          const dimpleX = Math.cos(this.innerKnobAngle - Math.PI / 2) * (innerDarkR * 0.7);
          const dimpleY = Math.sin(this.innerKnobAngle - Math.PI / 2) * (innerDarkR * 0.7);

          ctx.beginPath(); ctx.arc(dimpleX, dimpleY, innerR * 0.08, 0, Math.PI * 2);
          const dimpleGrad = ctx.createRadialGradient(dimpleX, dimpleY, 0, dimpleX, dimpleY, innerR * 0.08);
          
          if (this.isFineTuningMode) { 
              dimpleGrad.addColorStop(0, "#ffffff"); 
              dimpleGrad.addColorStop(1, "#3498db"); 
              ctx.shadowColor = "#3498db"; ctx.shadowBlur = 8;
          } else {
              dimpleGrad.addColorStop(0, "#111"); 
              dimpleGrad.addColorStop(1, this.rgba(T.bg2, 1.0));
          }
          ctx.fillStyle = dimpleGrad; ctx.fill(); ctx.shadowColor = "transparent";

          ctx.beginPath(); ctx.arc(dimpleX, dimpleY, innerR * 0.08, 0, Math.PI * 2);
          ctx.shadowColor = "rgba(0,0,0,0.8)"; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
          ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.stroke(); ctx.shadowColor = "transparent";

          ctx.beginPath(); ctx.arc(dimpleX, dimpleY, innerR * 0.08, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 0.5; ctx.stroke();

          ctx.restore(); 
      },

      drawScale(canvas, freq) {
          const dpr = window.devicePixelRatio || 1;
          const ctx = canvas.getContext("2d");
          const CW  = canvas.width  / dpr;
          const CH  = canvas.height / dpr;
          
          if(CW === 0 || CH === 0) return; 
          
          const T   = this.getTheme(); 

          let dMin = this.currentUnit === 'kHz' ? this.currentMin * 1000 : this.currentMin;
          let dMax = this.currentUnit === 'kHz' ? this.currentMax * 1000 : this.currentMax;
          let dFreq = this.currentUnit === 'kHz' ? freq * 1000 : freq;
          let dRange = dMax - dMin;

          let majStep, midStep, minStep, lblStep;
          if (dRange > 1000) { lblStep = 100; majStep = 100; midStep = 50; minStep = 10; } 
          else if (dRange > 100) { lblStep = 20; majStep = 20; midStep = 10; minStep = 2; } 
          else if (dRange > 15) { lblStep = 2; majStep = 2; midStep = 1; minStep = 0.1; } 
          else if (dRange > 5) { lblStep = 1; majStep = 1; midStep = 0.5; minStep = 0.1; }
          else { lblStep = 0.1; majStep = 0.1; midStep = 0.05; minStep = 0.01; }

          ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, CW, CH);
          ctx.fillStyle = this.rgba(T.bg1, 1.0); ctx.fillRect(0, 0, CW, CH);

          const mR = 8;
          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.shadowOffsetX = 2;
          this.rrect(ctx, this.mX, this.mY, this.mW, this.mH, mR);
          ctx.fillStyle = this.rgba(T.bg1, 1.0); ctx.fill();
          ctx.restore();

          ctx.save(); ctx.filter = `brightness(${this.getBrightness()})`;

          const paperX = this.mX + 2, paperY = this.mY + 2, paperW = this.mW - 4, paperH = this.mH - 4;
          ctx.fillStyle = this.rgba(T.bg2, 0.5);
          this.rrect(ctx, paperX, paperY, paperW, paperH, 2); ctx.fill();

          const paper = ctx.createRadialGradient(paperX + paperW * 0.5, paperY + paperH * 0.5, paperH * 0.1, paperX + paperW * 0.5, paperY + paperH * 0.5, paperW * 0.65);
          paper.addColorStop(0.00, this.rgba(T.accent, 0.80)); paper.addColorStop(0.40, this.rgba(T.accent, 0.50)); paper.addColorStop(1.00, this.rgba(T.accent, 0.10)); 
          ctx.fillStyle = paper; this.rrect(ctx, paperX, paperY, paperW, paperH, 2); ctx.fill();

          const isFmSpectrum = (this.currentKey === 'FM' || this.currentKey === 'OIRT');
          const psMode = isFmSpectrum && this.isPsEnabled();
          const swMode = !isFmSpectrum && this.currentKey.endsWith('m') && this.isSwScaleEnabled();
          const mwLwMode = !isFmSpectrum && (this.currentKey === 'MW' || this.currentKey === 'LW') && this.isSwScaleEnabled();
          const showStationsOnScale = psMode || swMode || mwLwMode;

          const tX = paperX + paperW * 0.04, tW = paperW * 0.92;
          const baseY = showStationsOnScale ? paperY + paperH * 0.35 : paperY + paperH * 0.85;
          const numY = showStationsOnScale ? paperY + paperH * 0.15 : paperY + paperH * 0.32;
          const fX = f => tX + ((f - dMin) / dRange) * tW;

          if (isFmSpectrum && this.isSpectrumEnabled()) {
              try {
                  const sdrCanvas = document.getElementById('sdr-graph');
                  const specBtn = document.getElementById('spectrum-graph-button');
                  if (sdrCanvas && specBtn && (specBtn.classList.contains('active') || specBtn.classList.contains('bg-color-4')) && sdrCanvas.width > 100) {
                      
                      const specContainer = sdrCanvas.closest('.canvas-container') || sdrCanvas.parentElement;
                      // SG sets the label on the first .canvas-container, which may not be the one around #sdr-graph
                      const labelled = [specContainer, document.querySelector('.canvas-container[role="img"]')]
                          .find(el => el && /from [\d.]+ to [\d.]+ MHz/.test(el.getAttribute('aria-label') || ''));
                      let ariaLabel = labelled ? labelled.getAttribute('aria-label') : '';

                      let srcMin = 86.0;
                      let srcMax = 108.0;

                      if (latestSpectrumView) {
                          srcMin = latestSpectrumView.minFreq;
                          srcMax = latestSpectrumView.maxFreq;
                      } else if (ariaLabel) {
                          const match = ariaLabel.match(/from ([\d.]+) to ([\d.]+) MHz/);
                          if (match) {
                              srcMin = parseFloat(match[1]);
                              srcMax = parseFloat(match[2]);
                          }
                      } else {
                          const limitSpan = document.querySelector(".tuner-desc .text-small .color-4");
                          if (limitSpan) {
                              const match = limitSpan.textContent.match(/(\d+(\.\d+)?)\s*MHz\s*-\s*(\d+(\.\d+)?)/);
                              if (match) {
                                  srcMin = Math.max(Number(match[1]), 86);
                                  srcMax = Number(match[3]);
                              }
                          }
                      }

                      const signalText = localStorage.getItem('signalUnit') || 'dbf';
                      const xOffset = (signalText === 'dbm') ? 36 : 30;

                      const srcX = xOffset;
                      const srcY = 16;
                      const srcW = sdrCanvas.width - xOffset;
                      const srcH = sdrCanvas.height - 40;

                      const dMin = this.currentUnit === 'kHz' ? this.currentMin * 1000 : this.currentMin;
                      const dMax = this.currentUnit === 'kHz' ? this.currentMax * 1000 : this.currentMax;

                      const destX = tX + ((srcMin - dMin) / (dMax - dMin)) * tW;
                      const destW = ((srcMax - srcMin) / (dMax - dMin)) * tW;

                      if (srcW > 0 && srcH > 0) {
                          ctx.save();
                          this.rrect(ctx, paperX, paperY, paperW, paperH, 2); 
                          ctx.clip();
                          
                          ctx.filter = 'invert(1) grayscale(1) contrast(2.0) brightness(0.9)';
                          ctx.globalAlpha = 0.3; 
                          ctx.globalCompositeOperation = 'multiply';
                          
                          ctx.drawImage(sdrCanvas, srcX, srcY, srcW, srcH, destX, paperY + 2, destW, (baseY - paperY) - 2);
                          ctx.restore();
                      }
                  }
              } catch (e) {}
          }

          const inkColor = "rgba(10, 15, 20, 0.95)"; 
          const inkFaded = "rgba(10, 15, 20, 0.70)";

          ctx.beginPath(); ctx.moveTo(tX, baseY); ctx.lineTo(tX + tW, baseY);
          ctx.strokeStyle = inkFaded; ctx.lineWidth = 2.0; ctx.stroke();

          for (let i = Math.floor(dMin / minStep); i <= Math.ceil(dMax / minStep); i++) {
              const f = i * minStep;
              if (f < dMin - 0.001 || f > dMax + 0.001) continue;
              
              const x = fX(f);
              const isMaj = Math.abs(Math.round(f / majStep) * majStep - f) < 0.001;
              const isMid = !isMaj && Math.abs(Math.round(f / midStep) * midStep - f) < 0.001;
              
              let tH = paperH * (showStationsOnScale ? 0.03 : 0.06), col = "rgba(10,15,20,0.5)", lw = 1.0;
              if (showStationsOnScale) {
                  if (isMaj) { tH = paperH * 0.10; col = inkColor; lw = 2.0; } else if (isMid) { tH = paperH * 0.06; col = inkColor; lw = 1.5; }
              } else {
                  if (isMaj) { tH = paperH * 0.35; col = inkColor; lw = 2.0; } else if (isMid) { tH = paperH * 0.22; col = inkColor; lw = 1.5; } 
              }
              ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - tH);
              ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
          }

          this.renderedStations =[];
          if (showStationsOnScale) {
              let visibleStations =[];
              if (psMode) {
                  const stationDB = JSON.parse(localStorage.getItem('retro_station_db') || '{}');
                  for (let fStr in stationDB) {
                      let stFreq = parseFloat(fStr);
                      if (stFreq >= dMin - 0.2 && stFreq <= dMax + 0.2) {
                          visibleStations.push({ freq: stFreq, name: stationDB[fStr].ps, x: fX(stFreq), data: stationDB[fStr], isSw: false });
                      }
                  }
              } else if (swMode || mwLwMode) {
                  let activeList;
                  if (swMode) {
                      activeList = this.swStations;
                  } else {
                      activeList = this.mwLwFavorites;
                  }
                  
                  if (activeList !== null && activeList !== undefined) {
                      for (let i = 0; i < activeList.length; i++) {
                          let st = activeList[i];
                          let stFreq;
                          
                          if (mwLwMode) {
                              stFreq = st.frequency;
                          } else {
                              stFreq = st.frequency / 1000;
                          }
                          
                          if (stFreq >= dMin - 0.05 && stFreq <= dMax + 0.05) {
                              let shortName = st.name.replace(/(Radio|Broadcasting|Corporation|Voice of|International)/ig, '').trim();
                              
                              if (shortName.startsWith('-') || shortName.startsWith(',')) {
                                  shortName = shortName.substring(1).trim();
                              }
                              if (shortName.length > 10) {
                                  shortName = shortName.substring(0, 9) + '..';
                              }
                              if (shortName === '') {
                                  shortName = st.name.substring(0, 10);
                              }
                              
                              visibleStations.push({ freq: stFreq, name: shortName, x: fX(stFreq), data: st, isSw: true });
                          }
                      }
                  }
              }
              
              visibleStations.sort((a,b) => a.x - b.x);

              ctx.save();
              this.rrect(ctx, paperX, paperY, paperW, paperH, 2);
              ctx.clip();

              const startY = baseY + paperH * 0.02; 
              const baseRowHeight = ((paperY + paperH) - startY - (paperH * 0.02)) / 5;
              const rowHeight = Math.min(baseRowHeight, 35);
              const stFontSize = Math.max((this.isVuEnabled() ? 7 : 9), rowHeight * (this.isVuEnabled() ? 0.60 : 0.70));
              
              ctx.textAlign = "center"; ctx.textBaseline = "middle"; 
              
              let rowRightEdges =[];
              let maxRow = 0;
              
              const hoverThreshold = isFmSpectrum ? 0.04 : (this.currentUnit === 'kHz' ? 3 : 0.003);
              
              visibleStations.forEach((st, index) => {
                  const isHovered = (this.hoveredFreq === st.freq) || (Math.abs(dFreq - st.freq) <= hoverThreshold);
                  const isActive = st.isSw ? true : (st.data.active !== false);

                  ctx.font = `${stFontSize}px "Arial Narrow", Arial, sans-serif`;
                  const baseBoxWidth = Math.max(ctx.measureText(this.isVuEnabled() ? "000000" : "00000000").width, ctx.measureText(st.name).width);
                  const baseTotalWidth = baseBoxWidth + ((this.isVuEnabled() ? 2 : 4) * 2);
                  
                  let targetX = st.x;
                  if (targetX - (baseTotalWidth / 2) < paperX + 4) targetX = paperX + 4 + (baseTotalWidth / 2);
                  if (targetX + (baseTotalWidth / 2) > paperX + paperW - 4) targetX = paperX + paperW - 4 - (baseTotalWidth / 2);

                  let assignedRow = -1;
                  for (let r = 0; r < 200; r++) {
                      if (!rowRightEdges[r]) rowRightEdges[r] = -9999;
                      if (targetX - (baseTotalWidth / 2) > rowRightEdges[r] + (this.isVuEnabled() ? 6 : 8)) { 
                          assignedRow = r; break; 
                      }
                  }
                  if (assignedRow === -1) assignedRow = 0; 
                  maxRow = Math.max(maxRow, assignedRow);
                  
                  rowRightEdges[assignedRow] = Math.max(rowRightEdges[assignedRow], targetX + (baseTotalWidth / 2));
                  
                  const y = startY + assignedRow * rowHeight + (rowHeight / 2) - this.stationScrollY;

                  if (y > paperY - rowHeight && y < paperY + paperH + rowHeight) {
                      const hoverFactor = 1.15; 
                      ctx.font = `${isHovered ? 'bold ' : ''}${isHovered ? stFontSize * hoverFactor : stFontSize}px "Arial Narrow", Arial, sans-serif`;
                      
                      const drawBgBox = st.isSw ? isHovered : isActive;
                      
                      if (drawBgBox) {
                          ctx.fillStyle = this.rgba(T.bg1, 0.20); 
                          if (isHovered) { ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 4; }
                          this.rrect(ctx, targetX - baseBoxWidth/2 - 4, y - (stFontSize*1.05)/2 - (isHovered?1:0), baseBoxWidth + 8, (stFontSize*1.05) + (isHovered?2:0), 4);
                          ctx.fill(); 
                          ctx.shadowBlur = 0; 
                      }
                      
                      if (st.isSw || isActive) {
                          ctx.fillStyle = inkColor; 
                      } else {
                          if (isHovered) { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4; }
                          ctx.fillStyle = inkFaded;
                      }
                      
                      const rangeScale = this.currentUnit === 'kHz' ? 1000.0 : 1.0;
                        ctx.fillText(st.name, targetX, y, ((rangeScale / dRange) * tW * 0.90) * (isHovered ? hoverFactor : 1));
                      ctx.shadowBlur = 0;

                      this.renderedStations.push({ f: st.freq, left: targetX - baseBoxWidth/2 - 4, right: targetX + baseBoxWidth/2 + 4, top: y - stFontSize, bottom: y + stFontSize, data: st.data, isSw: st.isSw });
                  }
              });

              ctx.restore();

              const maxScroll = Math.max(0, (maxRow * rowHeight) - (paperH * 0.5));
              if (this.targetStationScrollY > maxScroll) this.targetStationScrollY = maxScroll;
          }

          const numSize = Math.max(showStationsOnScale ? 10 : 12, Math.min(18, paperW / 55));
          ctx.font = `700 ${numSize}px "Arial Narrow", Arial, sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = inkColor;

          const startNum = Math.ceil(dMin / lblStep) * lblStep;
          
          for (let f = startNum; f <= dMax + 0.001; f += lblStep) {
              ctx.fillText(lblStep < 1 ? f.toFixed(1) : Math.round(f).toString(), fX(f), numY);
          }

          const lblSize = Math.max(showStationsOnScale ? 9 : 10, paperH * (showStationsOnScale ? 0.14 : 0.20));
          const smallLabelFont = `700 ${lblSize * (showStationsOnScale ? 0.8 : 0.6)}px Arial, sans-serif`;
          
          if (showStationsOnScale) {
              const firstNumX = fX(startNum);
              const firstNumText = lblStep < 1 ? startNum.toFixed(1) : Math.round(startNum).toString();
              ctx.font = `700 ${numSize}px "Arial Narrow", Arial, sans-serif`;
              const firstNumWidth = ctx.measureText(firstNumText).width;
              
              ctx.textAlign = "left";  
              ctx.textBaseline = "middle"; 
              ctx.font = smallLabelFont; 
              ctx.fillStyle = inkColor; 
              
              const unitX = firstNumX + (firstNumWidth / 2) + 4;
              
              ctx.fillText(this.currentUnit, unitX, numY);

              ctx.textBaseline = "bottom"; 
              ctx.textAlign = "left"; 
              ctx.font = `900 ${lblSize}px "Arial Narrow", Arial, sans-serif`; 
              ctx.fillText(this.currentName, paperX + 3, paperY + paperH - 4);
          } else {
              ctx.textBaseline = "top"; ctx.textAlign = "left"; ctx.font = `900 ${lblSize}px "Arial Narrow", Arial, sans-serif`; ctx.fillText(this.currentName, paperX + 8, paperY + 5);
              ctx.textAlign = "right"; ctx.font = smallLabelFont; ctx.fillText(this.currentUnit, paperX + paperW - 8, paperY + 5);
          }

          const actionBtnY = baseY - (showStationsOnScale ? 5 : 15);
          ctx.textBaseline = "middle"; 

          if (isFmSpectrum) {
              const sdrBtnDraw = document.getElementById('spectrum-graph-button');
              if (sdrBtnDraw && (sdrBtnDraw.classList.contains('active') || sdrBtnDraw.classList.contains('bg-color-4'))) {
                  ctx.font = `700 ${lblSize * (showStationsOnScale ? 0.8 : 0.65)}px Arial, sans-serif`;
                  ctx.textAlign = "right"; 
                  ctx.fillStyle = (Date.now() - this.scanClickedTime < 150) ? "#ff3300" : (this.scanHovered ? inkColor : inkFaded);
                  ctx.fillText("↻ ", paperX + paperW - 5, actionBtnY);
              }
          }

          if (isFmSpectrum && this.isPsEnabled()) {
              ctx.font = `700 ${lblSize * 0.55}px Arial, sans-serif`; 
              ctx.textAlign = "left";
              ctx.fillStyle = (Date.now() - this.clearClickedTime < 150) ? "#ff3300" : (this.clearHovered ? inkColor : inkFaded);
              ctx.fillText(" ✖", paperX + 5, actionBtnY);
          }


          const nx = fX(Math.max(dMin, Math.min(dMax, dFreq)));
          ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.60)"; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 1;
          ctx.beginPath(); ctx.moveTo(nx, this.mY - 1); ctx.lineTo(nx, this.mY + this.mH + 1);
          ctx.strokeStyle = "#ff3300"; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore();

          ctx.beginPath(); ctx.moveTo(nx, this.mY); ctx.lineTo(nx, this.mY + this.mH);
          ctx.strokeStyle = "rgba(255,200,200,0.60)"; ctx.lineWidth = 0.9; ctx.stroke();

          const blockH = CH * 0.09, blockW = 10;
          ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.70)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
          const topBlock = ctx.createLinearGradient(nx - blockW/2, 0, nx + blockW/2, 0);
          topBlock.addColorStop(0, "#c01500"); topBlock.addColorStop(0.4, "#ff3a1a"); topBlock.addColorStop(0.6, "#ff3a1a"); topBlock.addColorStop(1, "#8a0d00");
          ctx.fillStyle = topBlock; ctx.fillRect(nx - blockW / 2, 0, blockW, blockH); ctx.restore();
          ctx.strokeStyle = "rgba(255,200,180,0.45)"; ctx.lineWidth = 0.7; ctx.strokeRect(nx - blockW / 2, 0, blockW, blockH);

          ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.70)"; ctx.shadowBlur = 4; ctx.shadowOffsetY = -1;
          const botBlock = ctx.createLinearGradient(nx - 4, 0, nx + 4, 0);
          botBlock.addColorStop(0, "#8a0d00"); botBlock.addColorStop(0.5, "#dd2a10"); botBlock.addColorStop(1, "#8a0d00");
          ctx.fillStyle = botBlock; ctx.fillRect(nx - 4, CH - blockH * 0.85, 8, blockH * 0.85); ctx.restore();

          ctx.restore(); 

          ctx.save();
          const bezelTop = ctx.createLinearGradient(0, this.mY, 0, this.mY + 6); bezelTop.addColorStop(0, "rgba(255,255,255,0.40)"); bezelTop.addColorStop(1, "rgba(255,255,255,0.00)");
          ctx.fillStyle = bezelTop; ctx.fillRect(this.mX, this.mY, this.mW, 6);
          const bezelBot = ctx.createLinearGradient(0, this.mY + this.mH - 6, 0, this.mY + this.mH); bezelBot.addColorStop(0, "rgba(0,0,0,0.00)"); bezelBot.addColorStop(1, "rgba(0,0,0,0.60)");
          ctx.fillStyle = bezelBot; ctx.fillRect(this.mX, this.mY + this.mH - 6, this.mW, 6); ctx.restore();

          ctx.save(); this.rrect(ctx, this.mX, this.mY, this.mW, this.mH, mR); ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.stroke();
          this.rrect(ctx, this.mX + 1, this.mY + 1, this.mW - 2, this.mH - 2, mR - 1); ctx.strokeStyle = "rgba(0,0,0,0.50)"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();

          ctx.save(); this.rrect(ctx, this.mX, this.mY, this.mW, this.mH, mR); ctx.clip();
          const glare = ctx.createLinearGradient(0, this.mY, 0, this.mY + this.mH * 0.22); glare.addColorStop(0, "rgba(255,255,255,0.08)"); glare.addColorStop(1, "rgba(255,255,255,0.00)");
          ctx.fillStyle = glare; ctx.fillRect(this.mX, this.mY, this.mW, this.mH * 0.22);
          ctx.beginPath(); ctx.moveTo(this.mX + this.mW * 0.05, this.mY); ctx.lineTo(this.mX + this.mW * 0.30, this.mY); ctx.lineTo(this.mX + this.mW * 0.18, this.mY + this.mH * 0.55); ctx.lineTo(this.mX + this.mW * 0.00, this.mY + this.mH * 0.55); ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.03)"; ctx.fill(); ctx.restore();
          ctx.restore(); 
      },

      drawKnob(canvas) {
          if (!canvas) return false;
          const dpr = window.devicePixelRatio || 1;
          const ctx = canvas.getContext("2d");
          const CW  = canvas.width  / dpr;
          const CH  = canvas.height / dpr;
          
          if(CW === 0 || CH === 0) return false;
          
          const T   = this.getTheme(); 

          ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, CW, CH);
          ctx.fillStyle = this.rgba(T.bg1, 1.0); ctx.fillRect(0, 0, CW, CH);
          this.drawConcentricKnob(ctx, this.knobX, this.knobY, this.knobOuterR, this.knobInnerR, T);
          ctx.restore();
          return true;
      },

      drawVuMeter(canvas, levelL, levelR) {
          if (!canvas) return;
          const dpr = window.devicePixelRatio || 1;
          const ctx = canvas.getContext("2d");
          const cw = canvas.width;
          const ch = canvas.height;
          
          if(cw === 0 || ch === 0) return;

          ctx.save();
          ctx.scale(dpr, dpr);
          const w = cw / dpr;
          const h = ch / dpr;

          const T = this.getTheme();
          ctx.fillStyle = this.rgba(T.bg1, 1.0);
          ctx.fillRect(0, 0, w, h);

          const mR = 8; 
          const mX = 5; 
          const vY = this.mY; 
          const vH = this.mH;
          const vW = w - 20

          ctx.save();
          ctx.shadowColor   = "rgba(0,0,0,0.85)";
          ctx.shadowBlur    = 10;
          ctx.shadowOffsetY = 4;
          ctx.shadowOffsetX = 2;
          this.rrect(ctx, mX, vY, vW, vH, mR);
          ctx.fillStyle = this.rgba(T.bg1, 1.0);
          ctx.fill();
          ctx.restore();

          ctx.save();
          ctx.filter = `brightness(${this.getBrightness()})`;

          const paperX = mX + 2;
          const paperY = vY + 2;
          const paperW = vW - 4;
          const paperH = vH - 4;

          ctx.fillStyle = this.rgba(T.bg2, 0.5);
          this.rrect(ctx, paperX, paperY, paperW, paperH, 2);
          ctx.fill();

          const paper = ctx.createRadialGradient(paperX + paperW * 0.5, paperY + paperH * 0.5, paperH * 0.1, paperX + paperW * 0.5, paperY + paperH * 0.5, paperW * 0.65);
          paper.addColorStop(0.00, this.rgba(T.accent, 0.80)); 
          paper.addColorStop(0.40, this.rgba(T.accent, 0.50)); 
          paper.addColorStop(1.00, this.rgba(T.accent, 0.10)); 
          ctx.fillStyle = paper; 
          this.rrect(ctx, paperX, paperY, paperW, paperH, 2); 
          ctx.fill();

          ctx.save();
          this.rrect(ctx, paperX, paperY, paperW, paperH, 2);
          ctx.clip();
          
          const innerTop = ctx.createLinearGradient(0, paperY, 0, paperY + 15);
          innerTop.addColorStop(0, "rgba(0,0,0,0.7)");
          innerTop.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = innerTop;
          ctx.fillRect(paperX, paperY, paperW, 15);
          
          const vignette = ctx.createRadialGradient(paperX + paperW/2, paperY + paperH/2, paperW*0.3, paperX + paperW/2, paperY + paperH/2, paperW*0.6);
          vignette.addColorStop(0, "rgba(0,0,0,0)");
          vignette.addColorStop(1, "rgba(0,0,0,0.5)");
          ctx.fillStyle = vignette;
          this.rrect(ctx, paperX, paperY, paperW, paperH, 2);
          ctx.fill();
          ctx.restore();

          const cx1 = paperX + paperW * 0.26;
          const cx2 = paperX + paperW * 0.74;
          const cy  = paperY + paperH * 0.85;
          
          const radius = Math.min(paperW * 0.21, paperH * 0.48); 
          const minAngle = -1.00; 
          const maxAngle = 1.00;  

          this.drawDial(ctx, cx1, cy, radius, minAngle, maxAngle);
          this.drawDial(ctx, cx2, cy, radius, minAngle, maxAngle);

          const angleL = minAngle + (levelL * (maxAngle - minAngle));
          const angleR = minAngle + (levelR * (maxAngle - minAngle));

          this.drawNeedle(ctx, cx1, cy, radius * 0.9, angleL);
          this.drawNeedle(ctx, cx2, cy, radius * 0.9, angleR);

          ctx.restore(); 

          ctx.save();
          const bezelTop = ctx.createLinearGradient(0, vY, 0, vY + 6);
          bezelTop.addColorStop(0, "rgba(255,255,255,0.40)");
          bezelTop.addColorStop(1, "rgba(255,255,255,0.00)");
          ctx.fillStyle = bezelTop;
          ctx.fillRect(mX, vY, vW, 6);

          const bezelBot = ctx.createLinearGradient(0, vY + vH - 6, 0, vY + vH);
          bezelBot.addColorStop(0, "rgba(0,0,0,0.00)");
          bezelBot.addColorStop(1, "rgba(0,0,0,0.60)");
          ctx.fillStyle = bezelBot;
          ctx.fillRect(mX, vY + vH - 6, vW, 6);
          ctx.restore();

          ctx.save();
          this.rrect(ctx, mX, vY, vW, vH, mR);
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.stroke();
          this.rrect(ctx, mX + 1, vY + 1, vW - 2, vH - 2, mR - 1);
          ctx.strokeStyle = "rgba(0,0,0,0.50)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          this.rrect(ctx, mX, vY, vW, vH, mR);
          ctx.clip(); 
          const glare = ctx.createLinearGradient(0, vY, 0, vY + vH * 0.22);
          glare.addColorStop(0, "rgba(255,255,255,0.08)");
          glare.addColorStop(1, "rgba(255,255,255,0.00)");
          ctx.fillStyle = glare;
          ctx.fillRect(mX, vY, vW, vH * 0.22);
          
          ctx.beginPath(); 
          ctx.moveTo(mX + vW * 0.05, vY); 
          ctx.lineTo(mX + vW * 0.30, vY); 
          ctx.lineTo(mX + vW * 0.18, vY + vH * 0.55); 
          ctx.lineTo(mX + vW * 0.00, vY + vH * 0.55); 
          ctx.closePath();
          ctx.fillStyle = "rgba(255,255,255,0.03)"; 
          ctx.fill();
          ctx.restore();

          ctx.restore(); 
      },

      drawDial(ctx, cx, cy, radius, minAngle, maxAngle) {
          const inkColor = "rgba(10, 15, 20, 0.85)";
          const redColor = "#e63946";
          const zeroAngle = minAngle + 0.8 * (maxAngle - minAngle); 

          ctx.save();
          ctx.shadowColor = "rgba(0,0,0,0.6)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetY = 1;
          ctx.shadowOffsetX = 1;

          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI * 1.5 + minAngle, Math.PI * 1.5 + zeroAngle);
          ctx.strokeStyle = inkColor; ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius, Math.PI * 1.5 + zeroAngle, Math.PI * 1.5 + maxAngle);
          ctx.strokeStyle = redColor; ctx.stroke();

          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 4, Math.PI * 1.5 + minAngle, Math.PI * 1.5 + zeroAngle);
          ctx.strokeStyle = inkColor; ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 4, Math.PI * 1.5 + zeroAngle, Math.PI * 1.5 + maxAngle);
          ctx.strokeStyle = redColor; ctx.stroke();

          const ticks =[
              { label: '-20', pos: 0.0,   isRed: false, major: true },
              { label: '10',  pos: 0.25,  isRed: false, major: true },
              { label: '7',   pos: 0.4,   isRed: false, major: true },
              { label: '5',   pos: 0.52,  isRed: false, major: true },
              { label: '',    pos: 0.58,  isRed: false, major: false },
              { label: '3',   pos: 0.64,  isRed: false, major: true },
              { label: '',    pos: 0.69,  isRed: false, major: false },
              { label: '1',   pos: 0.74,  isRed: false, major: true },
              { label: '0',   pos: 0.8,   isRed: false, major: true },
              { label: '1',   pos: 0.86,  isRed: true,  major: true },
              { label: '',    pos: 0.895, isRed: true,  major: false },
              { label: '3',   pos: 0.93,  isRed: true,  major: true },
              { label: '',    pos: 0.965, isRed: true,  major: false },
              { label: '+5',  pos: 1.0,   isRed: true,  major: true }
          ];

          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          ticks.forEach(t => {
              const angle = minAngle + t.pos * (maxAngle - minAngle);
              const aRad = Math.PI * 1.5 + angle;

              ctx.strokeStyle = t.isRed ? redColor : inkColor;
              ctx.fillStyle = t.isRed ? redColor : inkColor;
              ctx.lineWidth = t.major ? 2.5 : 1.5;

              const innerR = radius - 4;
              const outerR = t.major ? radius + 8 : radius + 3; 
              
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(aRad) * innerR, cy + Math.sin(aRad) * innerR);
              ctx.lineTo(cx + Math.cos(aRad) * outerR, cy + Math.sin(aRad) * outerR);
              ctx.stroke();

              if (t.label) {
                  const fontSize = Math.max(9, radius * 0.12);
                  ctx.font = `bold ${fontSize}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
                  const textR = radius + (radius * 0.30); 
                  ctx.fillText(t.label, cx + Math.cos(aRad) * textR, cy + Math.sin(aRad) * textR + (fontSize * 0.4));
              }
          });

          const vuSize = Math.max(10, radius * 0.18);
          ctx.font = `bold ${vuSize}px "Arial Narrow", Arial, sans-serif`;
          ctx.fillStyle = inkColor;
          ctx.fillText("VU", cx, cy - (radius * 0.25));

          ctx.restore(); 
      },

      drawNeedle(ctx, cx, cy, length, angle) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);

          ctx.shadowColor   = "rgba(0,0,0,0.60)";
          ctx.shadowBlur    = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 1;
          
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, -length);
          ctx.strokeStyle = "#ff3300"; ctx.lineWidth = 2.5; ctx.stroke();
          
          ctx.shadowColor = "transparent";
          ctx.beginPath();
          ctx.moveTo(0, 0); ctx.lineTo(0, -length);
          ctx.strokeStyle = "rgba(255,200,200,0.60)"; ctx.lineWidth = 0.9; ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, length * 0.08, 0, Math.PI * 2);
          ctx.fillStyle = "#111"; ctx.fill();

          ctx.restore();
      },

      renderLoop() {
          if (!this.scaleCanvas || !this.isVisible) { this.rafId = null; return; }
          
          const now = Date.now();
          if (now - this.lastRenderTime < 16) {
              this.rafId = requestAnimationFrame(() => this.renderLoop());
              return;
          }
          this.lastRenderTime = now;
          
          this.tryInitAudio();
          let targetL = 0; let targetR = 0;

          if (this.audioInitialized && this.audioCtx && this.isVuEnabled()) {
              this.analyserL.getFloatTimeDomainData(this.dataL);
              this.analyserR.getFloatTimeDomainData(this.dataR);
              targetL = this.getLevel(this.dataL);
              targetR = this.getLevel(this.dataR);
          }

          const attack = 0.35; 
          const decay = 0.08; 
          this.currentVuLeft += (targetL > this.currentVuLeft) ? (targetL - this.currentVuLeft) * attack : (targetL - this.currentVuLeft) * decay;
          this.currentVuRight += (targetR > this.currentVuRight) ? (targetR - this.currentVuRight) * attack : (targetR - this.currentVuRight) * decay;
          
          if (this.isVuEnabled() && this.vuCanvas) {
              this.drawVuMeter(this.vuCanvas, this.currentVuLeft, this.currentVuRight);
          }

          if (Math.abs(this.targetStationScrollY - this.stationScrollY) > 0.5) {
              this.stationScrollY += (this.targetStationScrollY - this.stationScrollY) * 0.15;
              if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
          }

          if (this.animFreq !== null) {
              if (!this.isDraggingScale) {
                  const diff = this.currentFreq - this.animFreq;
                  this.animFreq += Math.abs(diff) > 0.002 ? diff * this.SMOOTHING : diff;
              }
              this.drawScale(this.scaleCanvas, this.animFreq);
          }

          if (!this.isDraggingOuterKnob && Math.abs(this.outerVelocity) > 0.001) {
              this.outerVelocity *= this.FRICTION;
              this.applyKnobRotation(true, this.outerVelocity);
          } else if (!this.isDraggingOuterKnob) {
              this.outerVelocity = 0;
          }

          if (!this.isDraggingInnerKnob && Math.abs(this.innerVelocity) > 0.001) {
              this.innerVelocity *= this.FRICTION;
              this.applyKnobRotation(false, this.innerVelocity);
          } else if (!this.isDraggingInnerKnob) {
              this.innerVelocity = 0;
          }
          
          const currentKnobState = `${this.outerKnobAngle}_${this.innerKnobAngle}_${this.isFineTuningMode}`;
          if (this.knobCanvas && this.lastKnobState !== currentKnobState) {
              if (this.drawKnob(this.knobCanvas) !== false) {
                  this.lastKnobState = currentKnobState;
              }
          }
          
          this.rafId = requestAnimationFrame(() => this.renderLoop());
      },

      addButton() {
          if (!pluginConfig.ENABLE_ANALOG_SCALE) return; 
          if (this._btnAdding) return;
          const BTN_ID = "et-analog-scale-btn";
          if (document.getElementById(BTN_ID)) return;
          
          this._btnAdding = true;

          document.head.insertAdjacentHTML("beforeend", `<style>#${BTN_ID}:hover{filter:brightness(130%);} #${BTN_ID}.active{background-color:var(--color-2,#333)!important;}</style>`);
          
          const tryAdd = (attempt = 0) => {
              if (typeof addIconToPluginPanel === "function") {
                  try { 
                      addIconToPluginPanel(BTN_ID, "Analog Scale", "solid", "ruler-horizontal", `Retro Design Elements V1.3 ET<br>By Highpoint`);
                      setTimeout(() => { const btn = document.getElementById(BTN_ID); if (btn) btn.classList.add("hide-phone"); }, 50);
                  } catch(e) {}
                  
                  const btn = document.getElementById(BTN_ID);
                  if(btn) btn.addEventListener("click", () => this.toggle());
                  
                  this._btnAdding = false;
                  return;
              }
              if (attempt < 60) setTimeout(() => tryAdd(attempt + 1), 500);
              else this._btnAdding = false;
          };
          tryAdd();
      },

      removeButton() {
          const btn = document.getElementById("et-analog-scale-btn");
          if (btn) btn.remove();
          this._btnAdding = false;
      },

      hookPS() {
          const psElement = document.getElementById("data-ps");
          const freqElement = document.getElementById("data-frequency");
          if (!psElement || !freqElement) { setTimeout(() => this.hookPS(), 1000); return; }

          let deleteTimer = null; let activeDeleteFreq = null;
          let lastFreq = null; let freqSettledTime = Date.now();
          let lastPS = null; let psSettledTime = Date.now();

          const saveCurrentPS = () => {
              if (this.currentFreq === null) return;
              if (this.currentFreq !== lastFreq) { lastFreq = this.currentFreq; freqSettledTime = Date.now(); }
              
              const ps = (psElement.innerText || psElement.textContent || "").replace(/\u00A0/g, ' ').trim(); 
              if (ps !== lastPS) { lastPS = ps; psSettledTime = Date.now(); }

              const freqStr = (Math.round(this.currentFreq * 10) / 10).toFixed(1); 
              let db = JSON.parse(localStorage.getItem('retro_station_db') || '{}');

              const isValidPS = ps.length >= 3 && ps !== freqStr && !ps.match(/^[.\-]+$/) && !ps.includes("MHz");
              const isOnCenter = Math.abs(this.currentFreq - parseFloat(freqStr)) <= 0.015; 

              if (isValidPS) {
                  if (deleteTimer) { clearTimeout(deleteTimer); deleteTimer = null; activeDeleteFreq = null; }
                    
                      if (Date.now() - freqSettledTime < 800) {
                          return; 
                      }

                  let shouldSave = true;
                  for (let key in db) {
                      if (db[key].ps === ps && key !== freqStr) {
                          if (Math.abs(parseFloat(key) - parseFloat(freqStr)) <= 0.2) { shouldSave = false; break; }
                      }
                  }

                  if (shouldSave) {
                      let entry = db[freqStr] || { ps: ps };
                      let isUpdated = false;

                      if (entry.ps !== ps) { 
                          entry.ps = ps; isUpdated = true;['name','city','itu','erp','pol','dist','azi'].forEach(k => delete entry[k]);
                      }
                      if (entry.active !== true) { entry.active = true; isUpdated = true; }
                      
                      if (Date.now() - freqSettledTime > 2000 && Date.now() - psSettledTime > 2000) {
                          const domFreq = parseFloat(freqElement.innerText);
                          if (Math.abs(domFreq - parseFloat(freqStr)) < 0.02) {
                              const getT = (id) => { const el = document.getElementById(id); return el ? el.innerText.trim() : ""; };
                              const meta = { name: 'data-station-name', city: 'data-station-city', itu: 'data-station-itu', erp: 'data-station-erp', pol: 'data-station-pol', dist: 'data-station-distance', azi: 'data-station-azimuth' };
                              for (let m in meta) {
                                  let val = getT(meta[m]);
                                  if (val && entry[m] !== val) { entry[m] = val; isUpdated = true; }
                              }
                          }
                      }

                      if (isUpdated || !db[freqStr]) {
                          entry.lastSeen = Date.now();
                          db[freqStr] = entry;
                          localStorage.setItem('retro_station_db', JSON.stringify(db));
                          if (this.isVisible && this.scaleCanvas) this.drawScale(this.scaleCanvas, this.currentFreq);
                      }
                  }
              } else {
                  if (isOnCenter && db[freqStr]) {
                      if (activeDeleteFreq !== freqStr) {
                          clearTimeout(deleteTimer); activeDeleteFreq = freqStr;
                          deleteTimer = setTimeout(() => {
                              let currentDb = JSON.parse(localStorage.getItem('retro_station_db') || '{}');
                              if (currentDb[freqStr]) {
                                  delete currentDb[freqStr]; localStorage.setItem('retro_station_db', JSON.stringify(currentDb));
                                  if (this.isVisible && this.scaleCanvas) this.drawScale(this.scaleCanvas, this.currentFreq);
                              }
                              activeDeleteFreq = null;
                          }, 3000); 
                      }
                  } else {
                      if (deleteTimer) {
                          clearTimeout(deleteTimer); deleteTimer = null; activeDeleteFreq = null;
                      }
                  }
              }
          };

          new MutationObserver(() => setTimeout(saveCurrentPS, 300)).observe(psElement, { childList: true, subtree: true, characterData: true });
          new MutationObserver(saveCurrentPS).observe(freqElement, { childList: true, subtree: true, characterData: true });
          setInterval(saveCurrentPS, 2000);
      },

      setupRetroTooltip() {
          let tooltip = document.getElementById('retro-station-tooltip');
          if (!tooltip) {
              tooltip = document.createElement('div');
              tooltip.id = 'retro-station-tooltip';
              tooltip.style.cssText = `position:fixed; background:rgba(15,25,30,0.95); color:#eee; padding:10px 14px; border-radius:6px; border:1px solid rgba(80,160,180,0.3); font-family:Arial,sans-serif; font-size:13px; z-index:90000; pointer-events:none; display:none; box-shadow:0 4px 12px rgba(0,0,0,0.5); backdrop-filter:blur(4px); min-width:150px;`;
              document.body.appendChild(tooltip);
          }

          window.addEventListener('mousemove', (evt) => {
              if (!this.isVisible || !this.scaleCanvas) return;
              let hovered = null;
              for (let st of this.renderedStations) {
                  if (evt.clientX >= this.scaleCanvas.getBoundingClientRect().left + st.left && evt.clientX <= this.scaleCanvas.getBoundingClientRect().left + st.right && 
                      evt.clientY >= this.scaleCanvas.getBoundingClientRect().top + st.top && evt.clientY <= this.scaleCanvas.getBoundingClientRect().top + st.bottom) {
                      hovered = st; break;
                  }
              }

              if (hovered) {
                  if (this.hoveredFreq !== hovered.f) {
                      this.hoveredFreq = hovered.f;
                      if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
                  }
                  
                  const d = hovered.data;
                  const isSw = hovered.isSw;
                  const displayName = isSw ? d.name : (d.name || d.ps);
                  let freqStr = "";
if (this.currentUnit === 'kHz') {
    freqStr = `${Math.round(hovered.f)} kHz`;
} else {
    freqStr = `${hovered.f.toFixed(isSw ? 3 : 1)} MHz`;
}

let html = `<div style="font-size:16px; font-weight:bold; color:#fff; margin-bottom:4px;">${displayName} <span style="color:#3abf9a; font-size:14px; margin-left:6px;">${freqStr}</span></div>`;
                  
                  let locStr = isSw ? (d.country ? `${d.location || ''}[${d.country}]` : d.location) : (d.city ? `${d.city} <span style="opacity:0.7">[${d.itu || '-'}]</span>` : '');
                  if (locStr) {
                      html += `<div style="margin-bottom:4px;">${locStr}</div>`;
                  }

                  let infos =[];
                  if (isSw) {
                      if (d.power) infos.push(`${d.power} kW`);
                      if (d.distance) infos.push(`${d.distance} km`);
                      if (d.azimuth) infos.push(`${d.azimuth}°`);
                      if (d.language) infos.push(`Lang: ${d.language}`);
                  } else {
                      if (d.erp) infos.push(`${d.erp} kW ${d.pol ? '['+d.pol+']' : ''}`);
                      if (d.dist) infos.push(`${d.dist} km`);
                      if (d.azi) infos.push(`${d.azi}°`);
                  }

                  if (infos.length) html += `<div style="font-size:11px; color:#aaa; margin-bottom:6px;">${infos.join(' &bull; ')}</div>`;

                  if (isSw) {
                      if (d.timeUTC) html += `<div style="font-size:11px; color:#88b; margin-bottom:2px;">UTC: ${d.timeUTC}</div>`;
                      if (d.source) html += `<div style="font-size:10px; color:#666;">Source: ${d.source}</div>`;
                  } else {
                      html += `<hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:6px 0;"><div style="font-size:11px; color:#77a;">Last seen: ${d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'Unknown'}</div>`;
                  }

                  tooltip.innerHTML = html; tooltip.style.display = 'block';
                  let tX = evt.clientX + 15, tY = evt.clientY + 15;
                  if (tX + tooltip.offsetWidth > window.innerWidth) tX = evt.clientX - tooltip.offsetWidth - 15;
                  tooltip.style.left = tX + 'px'; tooltip.style.top = tY + 'px';
              } else {
                  tooltip.style.display = 'none';
                  if (this.hoveredFreq !== null) {
                      this.hoveredFreq = null;
                      if (this.animFreq !== null) this.drawScale(this.scaleCanvas, this.animFreq);
                  }
              }
          });
      }
  };

  // =========================================================================
  // MAGIC EYE ENGINE (Retro Vacuum Tube Indicator)
  // =========================================================================
  const MagicEyeEngine = {
      audioInitialized: false,
      audioCtx: null,
      analyser: null,
      dataArray: null,
      currentLevel: 0,
      canvasWrapper: null,
      canvas: null,
      lightCanvas: null,
      
      isUserEnabled() {
          return pluginConfig.ENABLE_ANALOG_SCALE && pluginConfig.ENABLE_MAGIC_EYE && userPref('et_user_magic_eye', 'ENABLE_MAGIC_EYE');
      },

      toggleVisibility() {
          if (this.canvasWrapper) {
              this.canvasWrapper.style.display = this.isUserEnabled() ? 'block' : 'none';
          }
      },

      init() {
          if (!pluginConfig.ENABLE_ANALOG_SCALE || !pluginConfig.ENABLE_MAGIC_EYE) return;
          this.attemptMount();
      },

      attemptMount() {
          const signalValueSpan = document.getElementById('data-signal');
          if (!signalValueSpan) {
              setTimeout(() => this.attemptMount(), 1000);
              return;
          }

          const signalPanel = signalValueSpan.closest('.panel-33') || signalValueSpan.closest('div[class*="panel"]');
          if (!signalPanel) return;

          if (signalPanel.dataset.magicEyeInit === "true") return;
          signalPanel.dataset.magicEyeInit = "true";

          const heading = signalPanel.querySelector('h2.signal-heading') || signalPanel.querySelector('h2');
          if (!heading) return;

          const contentWrapper = document.createElement('div');
          contentWrapper.className = 'magic-eye-content-wrapper magic-eye-row-wrapper';
          Object.assign(contentWrapper.style, {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              width: '100%',
              flexDirection: 'row',
              position: 'relative'
          });

          const textWrapper = document.createElement('div');
          textWrapper.className = 'magic-eye-text-wrapper';
          Object.assign(textWrapper.style, {
              flex: "1",
              minWidth: "0",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
          });

          let currentElem = heading;
          while (currentElem) {
              const next = currentElem.nextElementSibling;
              textWrapper.appendChild(currentElem);
              currentElem = next;
          }

          this.canvasWrapper = document.createElement('div');
          this.canvasWrapper.id = "magic-eye-wrapper"; 
          Object.assign(this.canvasWrapper.style, {
              width: "95px",
              height: "95px",
              flexShrink: "0",
              position: "relative",
              marginLeft: "15px"
          });

          if (!this.isUserEnabled()) {
              this.canvasWrapper.style.display = 'none';
          }

          this.canvas = document.createElement('canvas');
          this.canvas.id = 'magic-eye-canvas';
          this.canvas.style.width = '100%';
          this.canvas.style.height = '100%';
          this.canvasWrapper.appendChild(this.canvas);

          contentWrapper.appendChild(this.canvasWrapper);
          contentWrapper.appendChild(textWrapper);

          signalPanel.appendChild(contentWrapper);


          this.lightCanvas = document.createElement('canvas');
          this.updateLoop();
      },

      tryInitAudio() {
          if (this.audioInitialized) return;
          if (typeof Stream !== 'undefined' && Stream?.Fallback?.Player?.Amplification) {
              try {
                  let source = Stream.Fallback.Player.Amplification;
                  if (!source.context) return;
                  this.audioCtx = source.context;
                  this.analyser = this.audioCtx.createAnalyser();
                  this.analyser.fftSize = 256;
                  this.dataArray = new Float32Array(this.analyser.fftSize);
                  source.connect(this.analyser);
                  this.audioInitialized = true;
              } catch(e) {}
          }
      },
    lastEyeRenderTime: 0,
      updateLoop() {
          this.tryInitAudio();
          
          const signalElem = document.getElementById('data-signal');
          if (!signalElem) {
              requestAnimationFrame(() => this.updateLoop());
              return;
          }

          const now = Date.now();
          if (now - this.lastEyeRenderTime < 33) {
              requestAnimationFrame(() => this.updateLoop());
              return;
          }
          this.lastEyeRenderTime = now;

          const signalText = signalElem.textContent;
          let textVal = parseFloat(signalText);
          let targetBaseLevel = 0; 

          if (!isNaN(textVal)) {
              let ssu = 'dbf'; 
              const panelText = signalElem.parentElement ? signalElem.parentElement.textContent.toLowerCase() : '';
              
              if (panelText.includes('dbm')) ssu = 'dbm';
              else if (panelText.includes('dbuv') || panelText.includes('dbµv') || panelText.includes('dbμv')) ssu = 'dbuv';

              let resultSensitivity;
              if (ssu === 'dbuv' || ssu === 'dbµv' || ssu === 'dbμv') resultSensitivity = Math.round(textVal + 10.875);
              else if (ssu === 'dbm') resultSensitivity = Math.round(textVal + 119.75);
              else resultSensitivity = Math.round(textVal); 

              let clampedVal = Math.max(0.0, resultSensitivity);
              targetBaseLevel = Math.min(1.0, clampedVal / 100.0);
          }

          let audioPulse = 0;
          if (this.audioInitialized && this.audioCtx.state === 'running') {
              this.analyser.getFloatTimeDomainData(this.dataArray);
              let sum = 0;
              for (let i = 0; i < this.dataArray.length; i++) { sum += this.dataArray[i] * this.dataArray[i]; }
              let rmsLevel = Math.sqrt(sum / this.dataArray.length);
              audioPulse = Math.min(1.0, rmsLevel * 10.0);
          }

          const targetCombinedLevel = (targetBaseLevel * 0.9) + (audioPulse * 0.1);
          this.currentLevel += (targetCombinedLevel - this.currentLevel) * 0.12;

          const dpr = window.devicePixelRatio || 1;
          const w = this.canvasWrapper.offsetWidth;
          const h = this.canvasWrapper.offsetHeight;

          if (w > 0 && h > 0) {
              this.canvas.width = w * dpr;
              this.canvas.height = h * dpr;
              this.lightCanvas.width = this.canvas.width;
              this.lightCanvas.height = this.canvas.height;
              
              const ctx = this.canvas.getContext('2d');
              const lCtx = this.lightCanvas.getContext('2d');
              ctx.scale(dpr, dpr);
              lCtx.scale(dpr, dpr);
              
              this.drawExtremeGlowTube(ctx, lCtx, w, h, this.currentLevel);
          }
          
          requestAnimationFrame(() => this.updateLoop());
      },

      drawExtremeGlowTube(ctx, lCtx, w, h, level) {
          const cx = w / 2;
          const cy = h / 2;
          const r = Math.min(cx, cy) - 2; 
          const innerR = r * 0.88; 
          const capR = innerR * 0.45;

          lCtx.clearRect(0, 0, w, h);
          const glowGrad = lCtx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
          glowGrad.addColorStop(0.00, "rgba(0, 40, 10, 0.4)");   
          glowGrad.addColorStop(0.35, "rgba(0, 180, 30, 1.0)");  
          glowGrad.addColorStop(0.65, "rgba(0, 255, 40, 1.0)");  
          glowGrad.addColorStop(0.90, "rgba(30, 255, 60, 1.0)"); 
          glowGrad.addColorStop(1.00, "rgba(0, 20, 5, 0.0)");    
          
          lCtx.fillStyle = glowGrad;
          lCtx.beginPath();
          lCtx.arc(cx, cy, innerR, 0, Math.PI * 2);
          lCtx.fill();

          lCtx.save();
          lCtx.globalCompositeOperation = "destination-out";
          lCtx.lineWidth = 3.5; 
          for(let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
              lCtx.beginPath();
              lCtx.moveTo(cx + Math.cos(a) * capR, cy + Math.sin(a) * capR);
              lCtx.lineTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR);
              lCtx.strokeStyle = "rgba(0, 0, 0, 0.55)"; 
              lCtx.stroke();
          }
          lCtx.restore();

          lCtx.save();
          lCtx.globalCompositeOperation = "source-atop"; 
          lCtx.lineWidth = 1.5; 
          
          let j = 0;
          for (let rCircle = capR + 1; rCircle <= innerR; rCircle += 3.5) {
              lCtx.beginPath();
              lCtx.arc(cx, cy, rCircle, 0, Math.PI * 2);
              lCtx.strokeStyle = (j % 2 === 0) ? "rgba(0, 40, 5, 0.06)" : "rgba(150, 255, 150, 0.04)";
              lCtx.stroke();
              j++;
          }
          lCtx.restore();

          lCtx.globalCompositeOperation = "destination-out";
          const maxShadowAngle = Math.PI; 
          const minShadowAngle = Math.PI * 0.05; 
          const currentShadowAngle = maxShadowAngle - (level * (maxShadowAngle - minShadowAngle));

          lCtx.fillStyle = "black";
          lCtx.shadowColor = "black";
          lCtx.shadowBlur = innerR * 0.15; 
          const curveFactor = level * 0.65; 

          const drawCurvedShadow = (midAngle) => {
              const startAngle = midAngle - currentShadowAngle / 2;
              const endAngle = midAngle + currentShadowAngle / 2;
              const R_out = innerR * 1.5;

              lCtx.beginPath();
              lCtx.moveTo(cx + Math.cos(startAngle) * capR, cy + Math.sin(startAngle) * capR);
              
              let cp1Angle = startAngle + (midAngle - startAngle) * curveFactor;
              let cpR = capR + (R_out - capR) * 0.38; 
              lCtx.quadraticCurveTo(
                  cx + Math.cos(cp1Angle) * cpR, cy + Math.sin(cp1Angle) * cpR,
                  cx + Math.cos(startAngle) * R_out, cy + Math.sin(startAngle) * R_out
              );
              
              lCtx.arc(cx, cy, R_out, startAngle, endAngle);
              
              let cp2Angle = endAngle - (endAngle - midAngle) * curveFactor;
              lCtx.quadraticCurveTo(
                  cx + Math.cos(cp2Angle) * cpR, cy + Math.sin(cp2Angle) * cpR,
                  cx + Math.cos(endAngle) * capR, cy + Math.sin(endAngle) * capR
              );
              lCtx.fill();
          };

          drawCurvedShadow(0);
          drawCurvedShadow(Math.PI);

          lCtx.shadowBlur = 0;
          lCtx.globalCompositeOperation = "source-over";

          ctx.clearRect(0, 0, w, h);
          ctx.save();
          ctx.shadowColor   = "rgba(0,0,0,0.85)";
          ctx.shadowBlur    = 8;
          ctx.shadowOffsetY = 4;
          ctx.shadowOffsetX = 2;
          
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          
          const glassRimGrad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
          glassRimGrad.addColorStop(0, "rgba(200, 200, 200, 0.80)"); 
          glassRimGrad.addColorStop(0.15, "rgba(100, 100, 100, 0.7)"); 
          glassRimGrad.addColorStop(0.5, "rgba(30, 30, 30, 0.5)"); 
          glassRimGrad.addColorStop(0.85, "rgba(80, 80, 80, 0.7)"); 
          glassRimGrad.addColorStop(1, "rgba(180, 180, 180, 0.7)"); 
          ctx.fillStyle = glassRimGrad;
          ctx.fill();
          ctx.restore();

          ctx.beginPath(); ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"; ctx.lineWidth = 1; ctx.stroke();
          
          ctx.beginPath(); ctx.arc(cx, cy, innerR + 1, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)"; ctx.lineWidth = 2.0; ctx.stroke();

          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = "#010401"; ctx.fillRect(0, 0, w, h);

          ctx.save();
          ctx.lineWidth = 1.5; ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4;
          let i = 0;
          for (let rLine = capR + 3; rLine < innerR; rLine += 7.0) { 
              ctx.beginPath(); ctx.arc(cx, cy, rLine, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(0, 0, 0, ${0.02 + (i % 3) * 0.01})`; 
              ctx.stroke(); i++;
          }
          ctx.restore();

          const dpr = window.devicePixelRatio || 1;
          ctx.globalCompositeOperation = "screen";
          ctx.shadowColor = "rgba(0, 255, 50, 0.8)"; ctx.shadowBlur = 15; 
          ctx.drawImage(this.lightCanvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h);
          
          ctx.globalCompositeOperation = "source-over"; ctx.shadowBlur = 0;
          ctx.drawImage(this.lightCanvas, 0, 0, w * dpr, h * dpr, 0, 0, w, h);

          const funnelGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
          funnelGrad.addColorStop(0.00, "rgba(0, 0, 0, 0.95)");  
          funnelGrad.addColorStop(0.25, "rgba(0, 0, 0, 0.70)");  
          funnelGrad.addColorStop(0.50, "rgba(0, 0, 0, 0.05)");  
          funnelGrad.addColorStop(0.82, "rgba(0, 0, 0, 0.00)");  
          funnelGrad.addColorStop(0.90, "rgba(200, 255, 200, 0.08)"); 
          funnelGrad.addColorStop(0.96, "rgba(0, 0, 0, 0.60)");  
          funnelGrad.addColorStop(1.00, "rgba(0, 0, 0, 1.00)");  
          ctx.fillStyle = funnelGrad; ctx.fillRect(0, 0, w, h);
          ctx.restore();

          ctx.beginPath(); ctx.arc(cx, cy, capR, 0, Math.PI * 2);
          const capGrad = ctx.createLinearGradient(cx - capR, cy - capR, cx + capR, cy + capR);
          capGrad.addColorStop(0, "#222"); capGrad.addColorStop(0.5, "#0f0f0f"); capGrad.addColorStop(1, "#000");
          ctx.fillStyle = capGrad;
          
          ctx.shadowColor = "rgba(0,0,0,0.95)"; ctx.shadowBlur = innerR * 0.4;
          ctx.shadowOffsetY = 0; ctx.shadowOffsetX = 0; ctx.fill(); ctx.shadowBlur = 0;
          
          ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"; ctx.stroke();

          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.clip(); 
          
          const glassGlare = ctx.createRadialGradient(cx, cy - innerR * 0.5, 0, cx, cy, innerR * 1.1);
          glassGlare.addColorStop(0, "rgba(255,255,255,0.18)"); 
          glassGlare.addColorStop(0.4, "rgba(255,255,255,0.03)");
          glassGlare.addColorStop(1, "rgba(255,255,255,0.00)");
          
          ctx.fillStyle = glassGlare;
          ctx.beginPath(); ctx.arc(cx, cy, innerR, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
      }
  };


  // =========================================================================
  // NIXIE TUBE ENGINE (Retro Glow Digits)
  // =========================================================================
  const NixieTubeEngine = {
      isInitDone: false,
      _nxState: { ms: 0, lic: 0 },
      _nxHasWSMS: false,
      
      PTY_TABLE:[
          "PTY", "News", "Current Affairs", "Info",
          "Sport", "Education", "Drama", "Culture", "Science", "Varied",
          "Pop Music", "Rock Music", "Easy Listening", "Light Classical",
          "Serious Classical", "Other Music", "Weather", "Finance",
          "Children's Programmes", "Social Affairs", "Religion", "Phone-in",
          "Travel", "Leisure", "Jazz Music", "Country Music", "National Music",
          "Oldies Music", "Folk Music", "Documentary"
      ],

      isUserEnabled() {
          return pluginConfig.ENABLE_ANALOG_SCALE && pluginConfig.ENABLE_NIXIE_TUBES && userPref('et_user_nixie_enabled', 'ENABLE_NIXIE_TUBES');
      },

      applyState() {
          if (this.isUserEnabled()) {
              document.body.classList.add('nixie-active');
          } else {
              document.body.classList.remove('nixie-active');
          }
      },

      isVisEqActive() {
          return (document.getElementById('visualeq-plugin-styles') !== null || 
                  document.querySelector('.panel-eq-container') !== null || 
                  localStorage.getItem('visualeq_enabled_state') === 'true');
      },

      createTube(char, isDot) {
          let tube = document.createElement('div');
          if (isDot) {
              tube.className = 'nx-tube nx-tube-dot';
              tube.innerHTML = `<div class="nx-mesh"></div><div class="nx-char">.</div><div class="nx-glass"></div>`;
          } else {
              tube.className = 'nx-tube';
              tube.innerHTML = `<div class="nx-unlit-layer">8</div><div class="nx-mesh"></div><div class="nx-glass"></div><div class="nx-char nx-off">${char}</div>`;
          }
          return tube;
      },

      setTubeText(containerId, text, turnOn = true) {
          const container = document.getElementById(containerId);
          if (!container) return;
          
          const stateHash = text + "_" + turnOn;
          if (container.dataset.lastState === stateHash) return;
          container.dataset.lastState = stateHash;

          if (container.children.length !== text.length) {
              container.innerHTML = '';
              for (let i = 0; i < text.length; i++) {
                  container.appendChild(this.createTube(text[i], text[i] === '.'));
              }
          }
          
          const tubes = container.children;
          for (let i = 0; i < text.length; i++) {
              if (tubes[i].classList.contains('nx-tube-dot')) continue;
              let charDiv = tubes[i].querySelector('.nx-char');
              if (charDiv) {
                  if (!turnOn || text[i] === ' ' || text[i] === '') charDiv.classList.add('nx-off');
                  else { charDiv.innerText = text[i]; charDiv.classList.remove('nx-off'); }
              }
          }
      },

      setTubeFlag(containerId, isOn) {
          const container = document.getElementById(containerId);
          if (!container) return;

          const stateHash = isOn ? "1" : "0";
          if (container.dataset.lastState === stateHash) return;
          container.dataset.lastState = stateHash;

          const tubes = container.children;
          for (let i = 0; i < tubes.length; i++) {
              let charDiv = tubes[i].querySelector('.nx-char');
              if (charDiv) isOn ? charDiv.classList.remove('nx-off') : charDiv.classList.add('nx-off');
          }
      },

      init() {
          if (!pluginConfig.ENABLE_ANALOG_SCALE || !pluginConfig.ENABLE_NIXIE_TUBES || this.isInitDone) return;
          this.isInitDone = true;
          
          this.applyState();

          const fontLink = document.createElement('link');
          fontLink.href = 'https://fonts.googleapis.com/css2?family=Saira+Extra+Condensed:wght@100;200;300;500&display=swap';
          fontLink.rel = 'stylesheet';
          document.head.appendChild(fontLink);

          const visEqActive = this.isVisEqActive();

          const hidePsAndFlagsCss = visEqActive ? '' : `
              body.nixie-active #data-ps, 
              body.nixie-active .data-pty, 
              body.nixie-active .data-tp, 
              body.nixie-active .data-ta, 
              body.nixie-active .data-ms, 
              body.nixie-active .stereo-container,
          `;

          const flagsBgCss = visEqActive ? '' : `
              body.nixie-active #flags-container-desktop, 
              body.nixie-active #flags-container-phone {
                  background: color-mix(in srgb, var(--color-1) 50%, transparent) !important;
                  background-color: color-mix(in srgb, var(--color-1) 50%, transparent) !important;
                  box-shadow: none !important;
                  border: none !important;
                  transition: background 0.15s ease-in-out !important;
              }

              body.nixie-active #flags-container-desktop:hover, 
              body.nixie-active #flags-container-phone:hover {
                  background: color-mix(in srgb, var(--color-2) 70%, transparent) !important;
                  background-color: color-mix(in srgb, var(--color-2) 70%, transparent) !important;
              }
          `;

          const style = document.createElement('style');
          style.innerHTML = `
              @keyframes nxSlideOutLeft {
                  0% { transform: translateX(0); opacity: 1; }
                  100% { transform: translateX(-50%); opacity: 0; }
              }
              @keyframes nxSlideInRight {
                  0% { transform: translateX(50%); opacity: 0; }
                  100% { transform: translateX(0); opacity: 1; }
              }

              @media (min-width: 769px) {
                  body.nixie-active #data-frequency, 
                  ${hidePsAndFlagsCss}
                  body.nixie-active #data-pi, 
                  body.nixie-active #data-signal, 
                  body.nixie-active #data-signal-decimal, 
                  body.nixie-active .nx-hide-original { 
                      display: none !important; 
                  }
              }

              @media (max-width: 768px) {
                  .nx-tube-container,
                  .nx-pty-block,
                  .nx-flags-row {
                      display: none !important;
                  }
              }

              body:not(.nixie-active) .nx-tube-container,
              body:not(.nixie-active) .nx-pty-block,
              body:not(.nixie-active) .nx-flags-row {
                  display: none !important;
              }

              ${flagsBgCss}

              body.nixie-active .magic-eye-text-wrapper { flex: 1 1 auto !important; width: auto !important; min-width: fit-content !important; max-width: none !important; }
              body.nixie-active .magic-eye-row-wrapper { justify-content: center !important; gap: 8px !important; }
              body.nixie-active #magic-eye-wrapper { transform: translateX(20px) !important; }

              .nx-tube-container {
                  display: flex; justify-content: center; align-items: flex-end;
                  gap: 2px; margin-top: 1px; margin-bottom: 1px; line-height: 1;
              }

              .nx-pty-block {
                  display: flex; flex-direction: column; align-items: center;
                  width: max-content; margin: 0 auto;
              }
              .nx-flags-row {
                  display: flex; justify-content: space-between; align-items: center;
                  width: 100%; margin-top: 4px;
              }
              
              .nx-ecc-wrapper {
                  display: flex; align-items: center; justify-content: center;
                  min-width: 25px; padding: 0 4px;
              }
              .nx-ecc-wrapper i { font-size: 16px !important; border-radius: 2px; }

              #nx-st-desktop, #nx-st-phone { cursor: pointer; }
              #nx-st-desktop:hover .nx-char, #nx-st-phone:hover .nx-char { filter: saturate(2) brightness(1.6) !important; }

              .nx-tube {
                  position: relative;
                  background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.15) 20%, rgba(0,0,0,0.3) 80%, rgba(255,255,255,0.02) 100%);
                  border: 1px solid rgba(255, 255, 255, 0.08); border-bottom: none;
                  box-shadow: inset 0 -15px 15px -5px color-mix(in srgb, var(--color-4, #0050ff) 70%, transparent), 0 10px 15px -5px color-mix(in srgb, var(--color-4, #0050ff) 40%, transparent);
                  overflow: hidden;
              }
              .nx-tube::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 3px; background: #050505; border-top: 1px solid #333; z-index: 10; }

              .nx-unlit-layer {
                  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                  display: flex; align-items: center; justify-content: center;
                  font-family: 'Saira Extra Condensed', sans-serif; font-weight: 100;
                  color: transparent; -webkit-text-stroke: 1px rgba(200, 200, 220, 0.12); 
                  z-index: 1; user-select: none;
              }

              .nx-char {
                  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                  display: flex; align-items: center; justify-content: center;
                  font-family: 'Saira Extra Condensed', sans-serif; font-weight: 300; line-height: 1;
                  color: #ff8833; 
                  text-shadow: 0 0 5px #ff4400, 0 0 10px #ff2200, 0 0 20px #ff0000, 0 0 35px #ff0000;
                  z-index: 5; user-select: none; transition: opacity 0.25s ease-in-out; opacity: 1;
              }
              
              .nx-pty-block .nx-char,
              .nx-flags-row .nx-char {
                  color: #ff6600 !important; 
                  text-shadow: 0 0 5px #ff4400, 0 0 12px #ff2200, 0 0 25px #ff0000, 0 0 45px #ff0000, 0 0 70px rgba(255, 30, 0, 0.6) !important;
                  font-weight: 500 !important; filter: saturate(1.7) brightness(1.3); 
              }
              .nx-char.nx-off { opacity: 0 !important; }

              .nx-mesh { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: url("data:image/svg+xml,%3Csvg width='10' height='17.32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5 0 L10 2.88 L10 8.66 L5 11.54 L0 8.66 L0 2.88 Z M0 11.54 L5 14.42 L5 20.18 M10 11.54 L15 14.42' stroke='rgba(220,220,240,0.25)' stroke-width='0.6' fill='none'/%3E%3C/svg%3E"); z-index: 7; pointer-events: none; }
              .nx-glass { position: absolute; top: 2px; left: 3px; width: 6px; height: 95%; background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, transparent 100%); border-radius: 15px 0 0 0; z-index: 8; pointer-events: none; }

              .nx-tube-container[data-nx-size="large"] { height: 72px; }
              .nx-tube-container[data-nx-size="large"] .nx-tube { width: 32px; height: 68px; border-radius: 16px 16px 0 0; }
              .nx-tube-container[data-nx-size="large"] .nx-char { font-size: 52px; }
              .nx-tube-container[data-nx-size="medium"] { height: 60px; display: inline-flex; vertical-align: bottom; }
              .nx-tube-container[data-nx-size="medium"] .nx-tube { width: 24px; height: 56px; border-radius: 12px 12px 0 0; }
              .nx-tube-container[data-nx-size="medium"] .nx-char { font-size: 40px; }
              .nx-tube-container[data-nx-size="small"] { height: 40px; display: inline-flex; vertical-align: bottom; }
              .nx-tube-container[data-nx-size="small"] .nx-tube { width: 18px; height: 36px; border-radius: 9px 9px 0 0; }
              .nx-tube-container[data-nx-size="small"] .nx-char { font-size: 24px; }
              .nx-tube-dot { width: 10px !important; border-radius: 5px 5px 0 0 !important; }
              .nx-tube-container[data-nx-size="medium"] .nx-tube-dot { height: 56px !important; width: 8px !important; }
              .nx-tube-dot .nx-char { font-size: 32px !important; align-items: flex-end; padding-bottom: 4px; }
              .nx-tube-container[data-nx-size="medium"] .nx-tube-dot .nx-char { font-size: 24px !important; padding-bottom: 2px; }
          `;
          document.head.appendChild(style);

          // Setup PTY and Flags
          if (!visEqActive) {
              const flagContainers =[
                  document.getElementById('flags-container-desktop'),
                  document.getElementById('flags-container-phone')
              ];

              flagContainers.forEach((targetDiv, index) => {
                  if (!targetDiv) return;
                  Array.from(targetDiv.children).forEach(child => child.classList.add('nx-hide-original'));

                  const suffix = index === 0 ? '-desktop' : '-phone';
                  const block = document.createElement('div');
                  block.className = 'nx-pty-block';
                  
                  block.innerHTML = `
                      <div class="nx-tube-container" id="nx-pty${suffix}" data-nx-size="small"></div>
                      <div class="nx-flags-row">
                          <div class="nx-tube-container" id="nx-tp${suffix}" data-nx-size="small"></div>
                          <div class="nx-tube-container" id="nx-ta${suffix}" data-nx-size="small"></div>
                          <div class="nx-ecc-wrapper" id="nx-ecc${suffix}"></div> 
                          <div class="nx-tube-container" id="nx-st${suffix}" data-nx-size="small"></div>
                          <div class="nx-tube-container" id="nx-ms${suffix}" data-nx-size="small"></div>
                      </div>
                  `;
                  targetDiv.appendChild(block);

                  this.setTubeText(`nx-pty${suffix}`, '              ', false); // 14 spaces
                  this.setTubeText(`nx-tp${suffix}`, 'TP', false);
                  this.setTubeText(`nx-ta${suffix}`, 'TA', false);
                  this.setTubeText(`nx-st${suffix}`, 'ST', false);
                  this.setTubeText(`nx-ms${suffix}`, 'MS', false);
              });

              const originalFlag = document.querySelector('.data-flag');
              if (originalFlag) {
                  const updateEcc = () => {
                      const dt = document.getElementById('nx-ecc-desktop');
                      const ph = document.getElementById('nx-ecc-phone');
                      if (dt) dt.innerHTML = originalFlag.innerHTML;
                      if (ph) ph.innerHTML = originalFlag.innerHTML;
                  };
                  new MutationObserver(updateEcc).observe(originalFlag, { childList: true, subtree: true, attributes: true });
                  updateEcc();
              }['desktop', 'phone'].forEach(suffix => {
                  const stTube = document.getElementById(`nx-st-${suffix}`);
                  if (stTube) {
                      stTube.title = "Stereo / Mono toggle";
                      stTube.addEventListener('click', () => {
                          const originalToggle = document.getElementById('stereoIcon') || document.querySelector('.stereo-container');
                          if (originalToggle) originalToggle.click();
                      });
                  }
              });

              const checkInitialDomState = (selector) => {
                  const el = document.querySelector(selector);
                  if (!el) return false;
                  return parseFloat(window.getComputedStyle(el).opacity) > 0.5 && !el.classList.contains('text-gray');
              };

              ['desktop', 'phone'].forEach(suffix => {
                  this.setTubeFlag(`nx-tp-${suffix}`, checkInitialDomState('.data-tp'));
                  this.setTubeFlag(`nx-ta-${suffix}`, checkInitialDomState('.data-ta'));
                  this.setTubeText(`nx-ms-${suffix}`, 'MS', checkInitialDomState('.data-ms'));
                  
                  const stEl = document.querySelector('.stereo-container .data-st');
                  if (stEl) this.setTubeFlag(`nx-st-${suffix}`, parseFloat(window.getComputedStyle(stEl).opacity) > 0.5);
              });
          }

          // WebSocket Connection
          const attachNixieWebSocket = () => {
              if (typeof window.socketPromise !== 'undefined') {
                  window.socketPromise.then(ws => {
                      ws.addEventListener("message", (evt) => {
                          try {
                              const message = JSON.parse(evt.data);

                              if (message.pty !== undefined && message.pty !== null) {
                                  let ptyIndex = Number(message.pty);
                                  if (Number.isNaN(ptyIndex) || ptyIndex < 0 || ptyIndex >= this.PTY_TABLE.length) ptyIndex = 0;
                                  let ptyText = this.PTY_TABLE[ptyIndex];
                                  let isOn = ptyText !== "PTY";
                                  
                                  let formattedPty;
                                  if (ptyText.length >= 14) {
                                      formattedPty = ptyText.substring(0, 14); 
                                  } else {
                                      let leftSpaces = Math.floor((14 - ptyText.length) / 2);
                                      let rightSpaces = 14 - ptyText.length - leftSpaces;
                                      formattedPty = ' '.repeat(leftSpaces) + ptyText + ' '.repeat(rightSpaces);
                                  }
                                  this.setTubeText('nx-pty-desktop', formattedPty, isOn);
                                  this.setTubeText('nx-pty-phone', formattedPty, isOn);
                              }
                              if (message.tp !== undefined && message.tp !== null) {
                                  let isOn = (message.tp === 1 || message.tp === true);
                                  this.setTubeFlag('nx-tp-desktop', isOn);
                                  this.setTubeFlag('nx-tp-phone', isOn);
                              }
                              if (message.ta !== undefined && message.ta !== null) {
                                  let isOn = (message.ta === 1 || message.ta === true);
                                  this.setTubeFlag('nx-ta-desktop', isOn);
                                  this.setTubeFlag('nx-ta-phone', isOn);
                              }
                              if (message.st !== undefined && message.st !== null) {
                                  let isOn = (message.st === 1 || message.st === true);
                                  this.setTubeFlag('nx-st-desktop', isOn);
                                  this.setTubeFlag('nx-st-phone', isOn);
                              }
                              let updateMS = false;
                              if (message.ms !== undefined && message.ms !== null) {
                                  this._nxHasWSMS = true;
                                  this._nxState.ms = (message.ms === 1 || message.ms === true) ? 1 : 0;
                                  updateMS = true;
                              }
                              if (message.lic !== undefined && message.lic !== null) {
                                  this._nxState.lic = (message.lic === 1 || message.lic === true) ? 1 : 0;
                                  updateMS = true;
                              }
                              if (updateMS) {
                                  let msText = 'MS'; 
                                  let turnOn = false;
                                  if (this._nxState.ms === 1) {
                                      turnOn = true;
                                      msText = (this._nxState.lic === 0) ? 'M ' : ' S';
                                  }
                                  this.setTubeText('nx-ms-desktop', msText, turnOn);
                                  this.setTubeText('nx-ms-phone', msText, turnOn);
                              }
                          } catch (err) { }
                      });
                  }).catch(() => setTimeout(attachNixieWebSocket, 1000));
              } else {
                  setTimeout(attachNixieWebSocket, 1000);
              }
          };
          attachNixieWebSocket();

          if (!visEqActive) {
              const msDOM = document.querySelector('.data-ms');
              if (msDOM) {
                  new MutationObserver(() => {
                      if (this._nxHasWSMS) return; 
                      let opacity = parseFloat(window.getComputedStyle(msDOM).opacity);
                      let isOn = opacity > 0.8 && !msDOM.classList.contains('text-gray');
                      this.setTubeText('nx-ms-desktop', 'MS', isOn); 
                      this.setTubeText('nx-ms-phone', 'MS', isOn);   
                  }).observe(msDOM, { attributes: true, attributeFilter:['style', 'class'] });
              }
          }

          // Tubes: FREQ, PS, PI, SIGNAL
          const decElem = document.getElementById('data-signal-decimal');
          const configs =[
              { sel: '#data-frequency', type: 'FREQ', size: 'large' },
              { sel: '#data-pi', type: 'PI', size: 'large' },
              { sel: '#data-signal', type: 'SIGNAL', size: 'medium' }
          ];

          if (!visEqActive) {
              configs.push({ sel: '#data-ps', type: 'PS', size: 'large' });
          }

          configs.forEach(cfg => {
              const elems = document.querySelectorAll(cfg.sel);
              elems.forEach(originalElem => {
                  if (!originalElem) return;
                  originalElem.classList.add('nx-hide-original');

                  const tubeDisplay = document.createElement('div');
                  tubeDisplay.className = 'nx-tube-container';
                  tubeDisplay.setAttribute('data-nx-size', cfg.size);
                  originalElem.parentNode.insertBefore(tubeDisplay, originalElem.nextSibling);

                  const updateTubes = () => {
                      let rawText = originalElem.textContent || '';
                      let text = '';

                      if (cfg.type === 'PS') text = rawText.padEnd(8, ' ').substring(0, 8);
                      else if (cfg.type === 'PI') text = rawText.padStart(4, ' ').substring(0, 4);
                      else if (cfg.type === 'FREQ') {
                          let digits = rawText.replace('.', '').trim().padStart(6, ' ');
                          text = digits.substring(0, 3) + '.' + digits.substring(3, 6);
                      } else if (cfg.type === 'SIGNAL') {
                          let decVal = decElem ? decElem.textContent.replace('.', '') : '0';
                          text = rawText.trim().padStart(3, ' ').slice(-3) + '.' + decVal.substring(0, 1);
                      }

                      if (tubeDisplay.dataset.lastText === text) return;
                      let oldText = tubeDisplay.dataset.lastText || "";
                      tubeDisplay.dataset.lastText = text;

                      if (tubeDisplay.children.length !== text.length) {
                          tubeDisplay.innerHTML = '';
                          for (let i = 0; i < text.length; i++) {
                              tubeDisplay.appendChild(this.createTube(text[i], text[i] === '.'));
                          }
                      }

                      const tubes = tubeDisplay.children;
                      
                      if (cfg.type === 'PS' && oldText !== "" && oldText !== text) {
                          for (let i = 0; i < text.length; i++) {
                              if (tubes[i].classList.contains('nx-tube-dot')) continue;
                              let charDiv = tubes[i].querySelector('.nx-char');
                              if (charDiv) {
                                  charDiv.style.animation = 'nxSlideOutLeft 0.25s ease-in forwards';
                                  setTimeout(() => {
                                      if (text[i] === ' ' || text[i] === '') {
                                          charDiv.classList.add('nx-off');
                                      } else {
                                          charDiv.innerText = text[i];
                                          charDiv.classList.remove('nx-off');
                                      }
                                      charDiv.style.animation = 'nxSlideInRight 0.25s ease-out forwards';
                                      setTimeout(() => { charDiv.style.animation = ''; }, 250);
                                  }, 250);
                              }
                          }
                      } else {
                          for (let i = 0; i < text.length; i++) {
                              if (tubes[i].classList.contains('nx-tube-dot')) continue;
                              let charDiv = tubes[i].querySelector('.nx-char');
                              if (charDiv) {
                                  if (text[i] === ' ' || text[i] === '') charDiv.classList.add('nx-off');
                                  else { charDiv.innerText = text[i]; charDiv.classList.remove('nx-off'); }
                              }
                          }
                      }
                  };

                  updateTubes();
                  const observer = new MutationObserver(updateTubes);
                  observer.observe(originalElem, { characterData: true, childList: true, subtree: true });
                  if (cfg.type === 'SIGNAL' && decElem) observer.observe(decElem, { characterData: true, childList: true, subtree: true });
              });
          });
      }
  };

  // =========================================================================
  // WEBSOCKET INTERCEPTOR
  // =========================================================================
  const originalWebSocketSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function(data) {
      if (typeof data === 'string') {
          
          if (pluginConfig.ENABLE_AM_SCANNER && data.startsWith('{')) {
              try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === "Scanner" && parsed.value && parsed.value.status === "command") {
                      const cmd = parsed.value;
                      const freq = getGlobalCurrentFrequencyInMHz();
                      
                      if (freq < 30.0) {
                          // Scanner always sends both Scan and Search (one of them empty),
                          // so act on the values. Other commands (sensitivity, mode, hold
                          // time, config) go on to the Scanner server unchanged.
                          // Deferred: Scanner sends on mouseup, then its click handler flips the
                          // button as a guess until the server answers. Acting after the click,
                          // like a server answer would, leaves the button in the right state.
                          if (cmd.Scan === 'on') { setTimeout(() => _startLocalScanner('scan', 'up'), 0); return; }
                          if (cmd.Scan === 'off') { setTimeout(() => _stopLocalScanner(), 0); return; }
                          if (cmd.Search === 'up' || cmd.Search === 'down') { setTimeout(() => _startLocalScanner('search', cmd.Search), 0); return; }
                      }
                  }
              } catch(e) {}
          }

          if (pluginConfig && pluginConfig.overrideServerTuningLimit && /^T\d+(\.\d+)?$/.test(data)) {
              if (isLocalScannerRunning && !isInternalScannerTuning) _stopLocalScanner();

              let freqMhz = parseFloat(data.substring(1)) / 1000;
              
              if (freqMhz > 0) {
                  const isFm = freqMhz >= 64.0;
                  let modified = false;

                  if (isFm) {
                      if (freqMhz < pluginConfig.fmLower) { freqMhz = pluginConfig.fmLower; modified = true; }
                      else if (freqMhz > pluginConfig.fmUpper) { freqMhz = pluginConfig.fmUpper; modified = true; }
                  } else {
                      if (freqMhz < pluginConfig.amLower) { freqMhz = pluginConfig.amLower; modified = true; }
                      else if (freqMhz > pluginConfig.amUpper) { freqMhz = pluginConfig.amUpper; modified = true; }
                  }

                  if (modified) {
                      const currentFreq = getGlobalCurrentFrequencyInMHz();
                      if (Math.abs(currentFreq - freqMhz) < 0.0001) return;
                      data = "T" + Math.round(freqMhz * 1000);
                  }
              }
          }
      }
      originalWebSocketSend.apply(this, arguments);
  };

  const fetchPluginConfig = async () => {
    try {
      const res = await fetch('/enhanced_tuning/api/auth-check', { cache: 'no-store' });
      if (res.ok) {
          const data = await res.json();
          pluginConfig = { ...pluginConfig, ...data.config };
          isAdmin = data.isAdmin;
      }
    } catch (err) {
      console.warn("[Enhanced Tuning] API Fetch feilet. Bruker innebygd standard config.", err);
    }
  };

  const injectSettingsIcon = () => {
  };

  const loadPluginStylesheet = () => {
      const styleElement = document.createElement('style');
      styleElement.id = 'enhanced-tuning-styles';
      styleElement.textContent = `
/* A1: Styles for Tune Step Feature */
body.tune-step-enabled #freq-container {
    cursor: pointer;
	user-select: none;
    -webkit-user-select: none; 
    -moz-user-select: none; 
    -ms-user-select: none; 
}
body.tune-step-enabled .freq-digit-marker {
    color: #00FF00;
    text-decoration: underline;
    text-underline-offset: 3px;
}
.et-dimmed-zero {
    opacity: 0.1;
}
.et-dimmed-zero.freq-digit-marker {
    opacity: 0.9;
}
.et-ssb-sub-khz {
    font-size: 0.6em;
}
.et-ssb-sep::before {
    content: '.';
}

/* A2: Styles for disabled bands (Tune Limit) */
.disabled-band {
    background-color: var(--color-1) !important;
    color: var(--color-3) !important;
    cursor: not-allowed !important;
    pointer-events: none;
}

/* MW 9 kHz/10 kHz button */
#mw-step-toggle-button {
  position: absolute;
  top: 4px;
  right: 6px;
  z-index: 11;
  display: none;
  max-width: 50px; 
  text-align: center;
  height: auto;
  padding: 1px 6px;
  font-size: 12px;
  font-weight: bold;
  line-height: 1.4;
  color: var(--color-main);
  background-color: var(--color-4);
  border: 1px solid var(--color-2);
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

#mw-step-toggle-button:hover {
  background-color: var(--color-5);
  transform: translateY(-1px);
}

#mw-step-toggle-button.active {
  opacity: 1;
  border-color: var(--color-4);
}

/* Si47XX mode buttons */
#et-mode-buttons {
  position: absolute;
  bottom: 6px;
  right: 6px;
  z-index: 11;
  display: none;
  flex-direction: column;
  gap: 4px;
}

#et-mode-buttons button {
  padding: 1px 6px;
  font-size: 12px;
  font-weight: bold;
  line-height: 1.4;
  color: var(--color-main);
  background-color: var(--color-2);
  border: 1px solid var(--color-4);
  border-radius: 6px;
  cursor: pointer;
}

#et-mode-buttons button.active {
  background-color: var(--color-4);
}


/* ========================================================================== */
/* B: MODERN LAYOUT */
/* ========================================================================== */

/* B1: Basic structure for Modern Layout */
body.layout-modern #freq-container {
    position: relative !important;
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
}

/* B2: Main wrapper and buttons (Shown only if HIDE_ALL_BUTTONS is false) */
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper {
    display: flex;
    gap: 15px;
    margin: 20px 10px 0 10px;
    background: transparent !important;
    padding: 0 !important;
    backdrop-filter: none !important;
}
body.layout-modern.modern-buttons-visible .side-band-button-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 60px;
    flex-shrink: 0;
}
body.layout-modern.modern-buttons-visible .band-selector-button {
    height: 28px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    font-size: 16px;
    background-color: color-mix(in srgb, var(--color-4) 60%, transparent);
    color: var(--color-main);
    cursor: pointer;
    transition: all 0.2s ease-in-out;
}
body.layout-modern.modern-buttons-visible .band-selector-button:hover {
    background-color: var(--color-5);
    color: var(--color-main);
}
body.layout-modern.modern-buttons-visible .side-band-button-container .band-selector-button.active-band {
    background-color: var(--color-4);
    color: var(--color-main);
}
body.layout-modern.modern-buttons-visible #rt-container,
body.layout-modern.modern-buttons-visible .am-bands-view-container {
    flex-grow: 1;
    min-width: 0;
    background-color: var(--color-1-transparent);
    backdrop-filter: blur(5px);
    border-radius: 15px;
    margin: 0 !important;
    height: auto !important;
    align-self: stretch;
}
body.layout-modern.modern-buttons-visible .am-bands-view-container {
    display: grid;
    grid-template-columns: 85px 1fr;
    gap: 5px;
    padding: 0 5px;
}
body.layout-modern.modern-buttons-visible .sw-grid-container {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 5px;
    height: 100%;
}
body.layout-modern.modern-buttons-visible .am-view-button,
body.layout-modern.modern-buttons-visible .sw-grid-button {
    border: none;
    border-radius: 8px;
    background-color: var(--color-3);
    color: var(--color-main);
    font-weight: bold;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s ease-in-out;
}
body.layout-modern.modern-buttons-visible .am-view-button:hover,
body.layout-modern.modern-buttons-visible .sw-grid-button:hover {
    background-color: var(--color-4);
}
body.layout-modern.modern-buttons-visible .am-bands-view-container .am-view-button.active-band,
body.layout-modern.modern-buttons-visible .am-bands-view-container .sw-grid-button.active-band {
    background-color: var(--color-5);
    color: var(--color-main);
}
body.layout-modern.modern-buttons-visible .am-view-button {
    font-size: 14px;
    height: 22px;
    width: 60px;
}
body.layout-modern.modern-buttons-visible .sw-bands-fieldset,
body.layout-modern.modern-buttons-visible .band-fieldset {
    border: 1px solid var(--color-3);
    border-bottom: none;
    border-radius: 8px;
    padding: 0px 5px 5px 5px;
    margin: 0;
    position: relative;
}
body.layout-modern.modern-buttons-visible .sw-bands-fieldset legend,
body.layout-modern.modern-buttons-visible .band-fieldset legend {
    color: var(--color-4);
    font-weight: bold;
    font-size: 11px;
    width: auto;
    margin: 0 auto;
    padding: 0;
}
body.layout-modern.modern-buttons-visible .band-button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding-top: 3px;
    height: 100%;
    box-sizing: border-box;
}
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper .tooltip,
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper .bs-tooltip {
    display: inline-block;
    position: relative;
    cursor: pointer;
}
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper .bs-tooltip {
    line-height: 0;
}
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper .bs-tooltiptext {
    visibility: hidden;
    width: 180px;
    position: absolute;
    background-color: var(--color-2);
    border: 2px solid var(--color-3);
    color: var(--color-text);
    text-align: center;
    font-size: 14px;
    border-radius: 15px;
    padding: 8px;
    z-index: 1000;
    bottom: 110%;
    left: 50%;
    margin-left: -90px;
    opacity: 0;
    transition: opacity 0.3s ease;
    line-height: normal;
}
body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper .bs-tooltip:hover .bs-tooltiptext {
    visibility: visible;
    opacity: 1;
}

/* B3: Loop button and frequency range for Modern Layout */
body.layout-modern.loop-button-visible .loop-toggle-button {
    position: absolute;
    left: 6px;
    bottom: 6px;
    z-index: 5;
    width: 34px;
    height: auto;
    min-height: 22px;
    line-height: 1.2;
    font-size: 11px;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    background-color: var(--color-3);
    color: var(--color-main);
    cursor: pointer;
    padding: 2px;
}
body.layout-modern.loop-button-visible .loop-toggle-button:hover {
    background-color: var(--color-4);
}
body.layout-modern.loop-button-visible .loop-toggle-button.active {
    background-color: var(--color-5) !important;
    color: var(--color-main);
}
body.layout-modern.band-range-visible #band-range-container {
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--color-text);
    opacity: 0.7;
}
body.layout-modern.band-range-visible .band-range-part {
    cursor: pointer;
}
body.layout-modern.band-range-visible .band-range-part:hover {
    opacity: 1;
    text-decoration: underline;
}

/* B4: Mobile View for Modern Layout */
@media (max-width: 768px) {
    body.layout-modern.modern-buttons-visible .band-selector-layout-wrapper {
        display: block !important;
    }
    body.layout-modern.modern-buttons-visible .side-band-button-container,
    body.layout-modern.modern-buttons-visible .am-bands-view-container {
        display: none !important;
    }
    body.layout-modern #band-range-container,
    body.layout-modern .loop-toggle-button {
        display: none !important;
    }
    body.layout-modern.modern-buttons-visible #data-ant-container {
        display: flex;
        gap: 5px;
        padding: 0 18px 10px 18px;
        width: 100%;
        box-sizing: border-box;
        justify-content: center;
        align-items: baseline;
    }
    body.layout-modern.modern-buttons-visible #data-ant-container::before,
    body.layout-modern.modern-buttons-visible #data-ant-container::after {
        content: '';
        flex: 1;
    }
    body.layout-modern.modern-buttons-visible #data-ant-container > .dropdown,
    body.layout-modern.modern-buttons-visible #mobile-band-selector-wrapper,
    body.layout-modern.modern-buttons-visible #mobile-sw-band-selector-wrapper {
        width: 45% !important;
        flex: 0 1 auto !important;
        transition: width 0.3s ease;
    }
    body.layout-modern.modern-buttons-visible #data-ant-container.sw-mode-active > .dropdown,
    body.layout-modern.modern-buttons-visible #data-ant-container.sw-mode-active > #mobile-band-selector-wrapper,
    body.layout-modern.modern-buttons-visible #data-ant-container.sw-mode-active > #mobile-sw-band-selector-wrapper {
        width: 30% !important;
    }
    body.layout-modern.modern-buttons-visible #mobile-sw-band-selector-wrapper {
        display: none;
        justify-content: center;
        align-items: center;
    }
    body.layout-modern.modern-buttons-visible #data-ant-container:has(#mobile-band-selector-wrapper:only-child)::before,
    body.layout-modern.modern-buttons-visible #data-ant-container:has(#mobile-band-selector-wrapper:only-child)::after {
        display: none;
    }
    body.layout-modern.modern-buttons-visible #mobile-band-selector-wrapper:only-child {
        width: 50% !important;
        margin: 0 auto;
    }
    body.layout-modern.modern-buttons-visible #mobile-band-selector,
    body.layout-modern.modern-buttons-visible #mobile-sw-band-selector {
        width: 100%;
        height: 48px;
        background-color: var(--color-4);
        color: var(--color-main);
        border: none;
        border-radius: 0 0 15px 15px;
        font-weight: normal;
        font-size: 14px;
        padding: 0 10px;
        -webkit-appearance: none;
        appearance: none;
        background-image: url("data-image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 10px center;
        background-size: 1em;
    }
}


/* ========================================================================== */
/* C: CLASSIC LAYOUT */
/* ========================================================================== */

/* C1: Basic structure for Classic Layout */
body.layout-classic .band-selector-button {
    background-color: rgba(0, 0, 0, 0.4);
    color: var(--color-text);
    border: 1px solid var(--color-2);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 10px;
    font-weight: bold;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s ease;
    line-height: 1.4;
}
body.layout-classic #freq-container {
    position: relative !important;
    overflow: hidden;
}
body.layout-classic .plugin-top-container {
    position: absolute;
    top: 4px;
    left: 6px;
    z-index: 10;
    display: flex;
    align-items: flex-start;
    gap: 6px;
}
body.layout-classic .main-bands-wrapper {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
body.layout-classic .main-band-button.active-band,
body.layout-classic .sw-band-button.active-band,
body.layout-classic #loop-toggle-button.active {
    background-color: var(--color-4);
    color: var(--color-main);
    opacity: 1;
}
body.layout-classic .sw-bands-container {
    position: absolute;
    top: 4px;
    right: 6px;
    z-index: 9;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
body.layout-classic .sw-bands-grid {
    display: grid;
    gap: 2px;
}
body.layout-classic .sw-bands-top-wrapper {
    grid-template-columns: repeat(3, 1fr);
}
body.layout-classic .sw-bands-bottom-wrapper {
    grid-template-columns: repeat(2, 1fr);
}
body.layout-classic .sw-band-button {
    padding: 1px 2px;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 18px;   
}

/* Automatisk krymping av fonten ved innzooming eller på litt mindre skjermer */
@media (max-width: 1550px) {
    body.layout-classic .sw-band-button {
        font-size: 7px;
        height: 15.5px;
        min-height: 15.5px;
    }
    
    body.layout-classic #band-range-container,
    body.layout-modern #band-range-container {
        font-size: 9px !important;
        gap: 5px !important;
    }
}
body.layout-classic #band-range-container {
    position: absolute;
    bottom: 0px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    color: var(--color-text);
    opacity: 0.6;
    white-space: nowrap;
}
body.layout-classic .band-range-part {
    cursor: pointer;
    transition: opacity 0.2s;
}
body.layout-classic .band-range-part:hover {
    opacity: 1;
}
body.layout-classic .range-separator {
    opacity: 0.7;
    pointer-events: none;
}
body.layout-classic #data-ant-container.classic-mobile-controls {
    display: none;
}

/* C2: Mobile view for Classic Layout */
@media (max-width: 768px) {
    body.layout-classic .plugin-top-container,
    body.layout-classic .sw-bands-container,
    body.layout-classic #band-range-container {
        display: none !important;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls {
        display: flex !important;
        gap: 5px;
        padding: 0 18px 10px 18px;
        width: 100%;
        box-sizing: border-box;
        justify-content: center;
        align-items: baseline;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls::before,
    body.layout-classic #data-ant-container.classic-mobile-controls::after {
        content: '';
        flex: 1;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls > .dropdown,
    body.layout-classic #data-ant-container.classic-mobile-controls #mobile-band-selector-wrapper,
    body.layout-classic #data-ant-container.classic-mobile-controls #mobile-sw-band-selector-wrapper {
        width: 45% !important;
        flex: 0 1 auto !important;
        transition: width 0.3s ease;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls.sw-mode-active > .dropdown,
    body.layout-classic #data-ant-container.classic-mobile-controls.sw-mode-active > #mobile-band-selector-wrapper,
    body.layout-classic #data-ant-container.classic-mobile-controls.sw-mode-active > #mobile-sw-band-selector-wrapper {
        width: 30% !important;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls #mobile-sw-band-selector-wrapper {
        display: none;
        justify-content: center;
        align-items: center;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls:has(#mobile-band-selector-wrapper:only-child)::before,
    body.layout-classic #data-ant-container.classic-mobile-controls:has(#mobile-band-selector-wrapper:only-child)::after {
        display: none;
    }
    body.layout-classic #data-ant-container.classic-mobile-controls #mobile-band-selector-wrapper:only-child {
        width: 50% !important;
        margin: 0 auto;
    }
    body.layout-classic #mobile-band-selector,
    body.layout-classic #mobile-sw-band-selector {
        width: 100%;
        height: 48px;
        background-color: var(--color-4);
        color: var(--color-main);
        border: none;
        border-radius: 0 0 15px 15px;
        font-weight: normal;
        font-size: 14px;
        padding: 0 10px;
        -webkit-appearance: none;
        appearance: none;
        background-image: url("data-image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23333333' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: right 10px center;
        background-size: 1em;
    }
}

/* ========================================================================== */
/* FIX FOR BAND RANGE (Start <-> End) OVERLAP PÅ MOBIL / SMÅ SKJERMER */
/* ========================================================================== */

#band-range-container {
    display: flex !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    align-items: center;
    justify-content: center;
    width: 100%;
}

.band-range-part {
    white-space: nowrap !important;
}

@media (max-width: 600px) {
    #band-range-container {
        font-size: 10px !important;
    }
    
    .band-range-unit {
        display: none !important;
    }
}
@media (max-width: 768px) {
    #magic-eye-wrapper { display: none !important; }
    .magic-eye-panel-override { display: block !important; }
    .magic-eye-text-wrapper { display: contents !important; }
}
.magic-eye-hidden { display: none !important; }

.bw-option-selected {
    background-color: var(--color-4) !important;
    color: #000 !important;
    font-weight: bold;
}

/* ========================================================================== */
/* D: ANALOG SCALE HIDE FIX (THE 1x1 PIXEL HACK) */
/* ========================================================================== */
body.et-analog-active #sdr-graph {
    display: block !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    z-index: 1 !important;
    opacity: 1 !important; 
    pointer-events: none !important;
}

body.et-analog-active #signal-canvas,
body.et-analog-active #Antenna,
body.et-analog-active #containerRotator,
body.et-analog-active #sdr-graph-button-container,
body.et-analog-active .spectrum-graph-update-text,
body.et-analog-active #mm-mpx-combo-flex,
body.et-analog-active #mm-signal-analyzer-flex,
body.et-analog-active #mm-scope-flex {
    display: none !important;
}
      `;
      document.head.appendChild(styleElement);
      return Promise.resolve();
  };

  const checkForGradientPluginAndApplyStyles = () => {
    let attempts = 0;
    const maxAttempts = 40;
    const isGradientPluginActive = () => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.selectorText.includes('.playbutton') && rule.style.backgroundImage) {
              if (rule.style.backgroundImage.includes('linear-gradient')) return true;
            }
          }
        } catch (e) { continue; }
      }
      return false;
    };

    const styleCheckInterval = setInterval(() => {
      attempts++;
      if (isGradientPluginActive()) {
        clearInterval(styleCheckInterval);
        const styleElement = document.createElement('style');
        styleElement.textContent = `
          .band-selector-button, .am-view-button, .sw-grid-button, .loop-toggle-button {
            background-image: linear-gradient(var(--color-4), var(--color-3));
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease; background-color: transparent; opacity: 0.6;
          }
          .band-selector-button.active-band, .am-view-button.active-band, .sw-grid-button.active-band, .loop-toggle-button.active { opacity: 1; }
          .band-selector-button:hover, .am-view-button:hover, .sw-grid-button:hover, .loop-toggle-button:hover {
            background-image: linear-gradient(var(--color-3), var(--color-5));
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.2); transform: translateY(0.1px); opacity: 1;
          }
        `;
        document.head.appendChild(styleElement);
      } else if (attempts >= maxAttempts) {
        clearInterval(styleCheckInterval);
      }
    }, 250);
  };

  const initAdminPanel = () => {
      if (!pluginConfig || pluginConfig.overrideServerTuningLimit !== true) return;

      const globalLowerInput = document.getElementById('webserver-tuningLowerLimit');
      const globalUpperInput = document.getElementById('webserver-tuningUpperLimit');
      const origSwitchInput = document.getElementById('webserver-tuningLimit');
      
      if (!globalLowerInput || !globalUpperInput) return;

      const parentDiv = globalLowerInput.parentNode;
      if (!parentDiv) return;

      const origElementsToHide =[
          globalLowerInput,
          document.querySelector('label[for="webserver-tuningLowerLimit"]'),
          globalUpperInput,
          document.querySelector('label[for="webserver-tuningUpperLimit"]'),
          origSwitchInput ? origSwitchInput.closest('.switch') : null,
          document.querySelector('label[for="webserver-tuningLimit"]')
      ];

      origElementsToHide.forEach(el => {
          if (el) {
              el.style.display = 'none';
              if (el.nextElementSibling && el.nextElementSibling.tagName === 'BR') {
                  el.nextElementSibling.style.display = 'none';
              }
          }
      });

      if (origSwitchInput && origSwitchInput.checked) {
          origSwitchInput.checked = false;
      }

      if (!document.getElementById('et-limits-notice')) {
          const infoMsg = document.createElement('div');
          infoMsg.id = 'et-limits-notice';
          infoMsg.style.cssText = "background: rgba(52, 152, 219, 0.1); border-left: 4px solid #3498db; padding: 15px; margin-bottom: 20px; border-radius: 4px;";
          infoMsg.innerHTML = `
              <h4 style="margin: 0 0 10px 0; color: #3498db; font-size: 16px;">Tuning Limits Managed by Plugin</h4>
              <p style="margin: 0 0 10px 0; font-size: 14px; color: var(--color-text); opacity: 0.8;">
                  The native tuning limit is paused while Enhanced Tuning enforces its own AM and FM limits on the server. Configure them in the Enhanced Tuning Admin Panel; changes apply immediately.
              </p>
              <a href="/enhanced_tuning/AP" target="_blank" style="display: inline-block; background: #3498db; color: white; padding: 8px 15px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 13px; transition: background 0.2s;">
                  Open Enhanced Tuning Settings
              </a>
          `;
          parentDiv.insertBefore(infoMsg, globalLowerInput);
      }
  };

  const injectUserSettingsUI = () => {
      const modalContent = document.querySelector('.modal-panel-content');
      if (!modalContent) {
          setTimeout(injectUserSettingsUI, 500);
          return;
      }

      if (!pluginConfig.ENABLE_ANALOG_SCALE) return;

      const loginMessage = document.getElementById('login-message');
      if (!loginMessage || document.getElementById('btn-open-retro-modal')) return;

      const btnWrapper = document.createElement('div');
      btnWrapper.style.cssText = "margin: 20px auto; width: 215px; height: 48px;";
      
      const openModalBtn = document.createElement('button');
      openModalBtn.id = 'btn-open-retro-modal';
      openModalBtn.style.fontWeight = "bold";
      openModalBtn.textContent = 'Enhanced / Retro Settings';
      
      btnWrapper.appendChild(openModalBtn);
      loginMessage.parentNode.insertBefore(btnWrapper, loginMessage.nextSibling);

      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.id = 'retro-settings-modal';
      
      const createToggle = (id, label, checked) => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-1); padding: 12px 15px; border-radius: 10px;">
              <span style="font-size: 16px; font-weight: 500;">${label}</span>
              <div class="switch">
                  <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                  <label for="${id}"></label>
              </div>
          </div>`;
          
      const createSelect = (id, label, options, selected) => {
          let opts = options.map(o => `<option value="${o.val}" ${o.val === selected ? 'selected' : ''}>${o.label}</option>`).join('');
          return `
          <div style="display: flex; justify-content: space-between; align-items: center; background: var(--color-1); padding: 12px 15px; border-radius: 10px;">
              <span style="font-size: 16px; font-weight: 500;">${label}</span>
              <select id="${id}" style="width: auto; min-width: 150px; border-radius: 8px;">
                  ${opts}
              </select>
          </div>`;
      };

      const createSlider = (id, label, min, max, step, val) => `
          <div style="display: flex; flex-direction: column; background: var(--color-1); padding: 15px; border-radius: 10px; gap: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 16px; font-weight: 500;">${label}</span>
                  <span id="${id}-val" style="color: var(--color-4); font-weight: bold; font-size: 16px;">${val}</span>
              </div>
              <div style="height: 24px;">
                  <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}" style="margin:0;">
              </div>
          </div>`;

      let layoutStyle = pluginConfig.LAYOUT_STYLE;
      let isAutostart = userPref('et_user_analog_autostart', 'ANALOG_SCALE_AUTOSTART');
      let isKnobEnabled = userPref('et_user_tuning_knob', 'SHOW_TUNING_KNOB');
      let isVuEnabled = userPref('et_user_vu_enabled', 'ENABLE_VU_METER');
      let isMagicEyeEnabled = userPref('et_user_magic_eye', 'ENABLE_MAGIC_EYE');
      let isNixieEnabled = userPref('et_user_nixie_enabled', 'ENABLE_NIXIE_TUBES');
      let isPsEnabled = userPref('et_user_ps_scale', 'ENABLE_PS_SCALE');
      let isSpecEnabled = userPref('et_user_spectrum_overlay', 'ENABLE_SPECTRUM_OVERLAY');
      let isSwScaleEnabled = userPref('et_user_sw_scale', 'ENABLE_SW_STATIONS_SCALE');
      let currentBrightness = parseFloat(localStorage.getItem('et_user_scale_brightness')) || pluginConfig.ANALOG_SCALE_BRIGHTNESS;

      modal.innerHTML = `
          <style>
              #et-admin-modal-btn {
                  position: absolute !important;
                  right: 15px !important;
                  top: 15px !important;
                  width: 40px !important;
                  height: 30px !important;
                  background: var(--color-4) !important;
                  color: var(--color-main) !important;
                  font-weight: 900 !important;
                  font-size: 14px !important;
                  border-radius: 6px !important;
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  cursor: pointer !important;
                  z-index: 9999 !important;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.4) !important;
                  transition: all 0.2s ease !important;
                  border: none !important;
                  line-height: 1 !important;
              }
              #et-admin-modal-btn:hover { 
                  background: var(--color-5) !important; 
                  transform: scale(1.05) !important; 
              }
              .settings-section-header { font-size: 13px; font-weight: bold; color: var(--color-4); text-transform: uppercase; margin-top: 15px; margin-bottom: 2px; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 5px; }
              .settings-section-header:first-child { margin-top: 5px; }
          </style>
          <div class="modal-content" style="max-width: 500px; padding: 25px; position: relative;">
              
              <!-- Diskret AP-knapp plassert der krysset pleide å være -->
              ${isAdmin ? `<div id="et-admin-modal-btn" title="Open Admin Panel">AP</div>` : ''}
              
              <div style="margin-bottom: 20px; padding-right: 50px;">
                  <h2 class="modal-title" style="color: var(--color-4); margin: 0; font-weight: bold; font-size: 20px; border-bottom: none; padding-bottom: 0; line-height: 1.2;">Plugin Settings</h2>
              </div>
              
              <div style="display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto; padding-right: 5px;">
                  
                  <div class="settings-section-header">Enhanced Tuning Settings</div>
                  
                  ${createSelect('modal-layout-style', 'Layout Style',[
                      {val: 'modern', label: 'Modern'},
                      {val: 'classic', label: 'Classic (Compact)'}
                  ], layoutStyle)}
                  
                  <div class="settings-section-header">Retro Design Elements</div>
                  
                  ${pluginConfig.ANALOG_SCALE_AUTOSTART ? createToggle('modal-autostart-toggle', 'Autostart FM Scale', isAutostart) : ''}
                  ${pluginConfig.SHOW_TUNING_KNOB ? createToggle('modal-knob-toggle', 'Show Tuning Knob', isKnobEnabled) : ''}
                  ${pluginConfig.ENABLE_VU_METER ? createToggle('modal-vu-toggle', 'Show VU Meter', isVuEnabled) : ''}
                  ${pluginConfig.ENABLE_MAGIC_EYE ? createToggle('modal-magic-eye-toggle', 'Show Magic Eye Tube', isMagicEyeEnabled) : ''}
                  ${pluginConfig.ENABLE_NIXIE_TUBES ? createToggle('modal-nixie-toggle', 'Show Nixie Tubes', isNixieEnabled) : ''}
                  ${pluginConfig.ENABLE_PS_SCALE ? createToggle('modal-ps-toggle', 'Scale: RDS Station Names', isPsEnabled) : ''}
                  ${pluginConfig.ENABLE_SPECTRUM_OVERLAY ? createToggle('modal-spec-toggle', 'Scale: Spectrum Overlay', isSpecEnabled) : ''}
                  ${pluginConfig.ENABLE_SW_STATIONS_SCALE ? createToggle('modal-sw-scale-toggle', 'Scale: SW Stations', isSwScaleEnabled) : ''}
                  
                  ${createSlider('modal-scale-brightness', 'FM Scale Brightness', '0.2', '1.8', '0.05', currentBrightness)}
              </div>
              
              <button class="button-close" id="retro-modal-close-btn" style="position: static; margin-top: 25px; width: 100%;">Close Settings</button>
          </div>
      `;

      document.body.appendChild(modal);

      const apBtn = document.getElementById('et-admin-modal-btn');
      if (apBtn) {
          apBtn.addEventListener('click', (e) => {
              e.preventDefault(); e.stopPropagation();
              window.open('/enhanced_tuning/AP', '_blank');
          });
      }

      const closeModal = () => {
          modal.style.opacity = '0';
          setTimeout(() => { modal.style.display = 'none'; document.body.classList.remove('modal-open'); }, 300);
      };

      openModalBtn.addEventListener('click', (e) => {
          e.preventDefault();
          modal.style.display = 'block';
          document.body.classList.add('modal-open');
          setTimeout(() => modal.style.opacity = '1', 10);
      });

      document.getElementById('retro-modal-close-btn').addEventListener('click', closeModal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

      const addListener = (id, key, callback) => {
          const el = document.getElementById(id);
          if (el) el.addEventListener('change', (e) => {
              if (el.type === 'checkbox') localStorage.setItem(key, e.target.checked);
              else localStorage.setItem(key, e.target.value);
              if (callback) callback(e);
          });
      };

      addListener('modal-layout-style', 'et_user_layout_style', () => {
          if (confirm("Changing layout requires reloading the page. Reload now?")) {
              window.location.reload();
          }
      });

      addListener('modal-autostart-toggle', 'et_user_analog_autostart');
      addListener('modal-knob-toggle', 'et_user_tuning_knob', () => AnalogScaleEngine.applyScaleLayout());
      addListener('modal-vu-toggle', 'et_user_vu_enabled', () => AnalogScaleEngine.applyScaleLayout());
      addListener('modal-magic-eye-toggle', 'et_user_magic_eye', () => MagicEyeEngine.toggleVisibility());
      addListener('modal-nixie-toggle', 'et_user_nixie_enabled', () => NixieTubeEngine.applyState());
      
      addListener('modal-ps-toggle', 'et_user_ps_scale', () => {
          if (AnalogScaleEngine.scaleCanvas) AnalogScaleEngine.drawScale(AnalogScaleEngine.scaleCanvas, AnalogScaleEngine.animFreq);
      });
      
      addListener('modal-spec-toggle', 'et_user_spectrum_overlay', () => {
          if (AnalogScaleEngine.scaleCanvas) AnalogScaleEngine.drawScale(AnalogScaleEngine.scaleCanvas, AnalogScaleEngine.animFreq);
      });
      
      addListener('modal-sw-scale-toggle', 'et_user_sw_scale', (e) => {
          if (e.target.checked && AnalogScaleEngine.currentKey && AnalogScaleEngine.currentKey.endsWith('m')) {
              AnalogScaleEngine.fetchSwStations(AnalogScaleEngine.currentMin, AnalogScaleEngine.currentMax);
          } else if (AnalogScaleEngine.scaleCanvas) {
              AnalogScaleEngine.drawScale(AnalogScaleEngine.scaleCanvas, AnalogScaleEngine.animFreq);
          }
      });

      const brightSlider = document.getElementById('modal-scale-brightness');
      if (brightSlider) {
          brightSlider.addEventListener('input', (e) => {
              document.getElementById('modal-scale-brightness-val').innerText = e.target.value;
              localStorage.setItem('et_user_scale_brightness', parseFloat(e.target.value));
              AnalogScaleEngine.lastKnobState = "";
          });
      }
  };

  const initializePlugin = () => {
    try {
        const userLayoutStyle = localStorage.getItem('et_user_layout_style');
        if (userLayoutStyle === 'modern' || userLayoutStyle === 'classic') pluginConfig.LAYOUT_STYLE = userLayoutStyle;
        const enabledBandsList = Array.isArray(pluginConfig.ENABLED_BANDS) ? pluginConfig.ENABLED_BANDS :['FM', 'OIRT', 'SW', 'MW', 'LW'];

        checkForGradientPluginAndApplyStyles();
        injectSettingsIcon();
        injectUserSettingsUI();

        // INIT RETRO MODULES
        AnalogScaleEngine.init();
        MagicEyeEngine.init();
        NixieTubeEngine.init();

        if (!pluginConfig.ENABLE_AM_BW && (typeof console !== 'undefined')) {
          if (pluginConfig.ENABLE_DEFAULT_AM_BW) console.warn('[BandSelector] ENABLE_DEFAULT_AM_BW set but ENABLE_AM_BW is false.');
        }

        const dataFrequencyElement = document.getElementById('data-frequency');
        if(!dataFrequencyElement) return;

        const getCurrentFrequencyInMHz = () => { 
          const freqText = dataFrequencyElement.textContent; 
          let freqValue = parseFloat(freqText); 
          if (freqText.toLowerCase().includes('khz')) freqValue /= 1000; 
          return freqValue; 
        };

        // =========================================================================
        // HIDE DECIMAL POINT FOR HF BAND, AND DIM LEADING ZERO BELOW 1 MHz
        // =========================================================================
        const findFreqCharNode = (targetIndex) => {
            let pos = 0, child = dataFrequencyElement.firstChild;
            while (child) {
                const len = child.textContent.length;
                if (targetIndex >= pos && targetIndex < pos + len) return { node: child, pos, len };
                pos += len;
                child = child.nextSibling;
            }
            return null;
        };

        // Si47XX SSB: the exact frequency to 10 Hz, which the core rounds to 1 kHz, plus a 1 Hz digit to match the radio
        const getSsbFreqText = () => (isSsbActive() && window.parsedData.si47xxFreq !== undefined) ? (parseFloat(window.parsedData.si47xxFreq) / 1000).toFixed(6) : null;

        // The sub-kHz digits are drawn smaller after a second dot, as on most radios; the dot is CSS-only so the text still parses
        const ssbFreqHtml = (text, markerPos = -1) => text.split('').map((c, i) => {
            const classes = [];
            if (i >= text.length - 3) classes.push('et-ssb-sub-khz');
            if (i === markerPos) classes.push('freq-digit-marker');
            const sep = i === text.length - 3 ? '<span class="et-ssb-sub-khz et-ssb-sep"></span>' : '';
            return `${sep}<span${classes.length ? ` class="${classes.join(' ')}"` : ''}>${c}</span>`;
        }).join('');

        const applyFreqDecimalHiding = () => {
            const exact = getSsbFreqText();
            if (exact && dataFrequencyElement.textContent !== exact) {
                dataFrequencyElement.innerHTML = ssbFreqHtml(exact);
                return;
            }

            const raw = dataFrequencyElement.textContent;
            if (!raw || raw.toLowerCase().includes('khz') || !raw.includes('.')) return;
            const value = parseFloat(raw);
            if (isNaN(value)) return;
            const shouldHide = pluginConfig.HIDE_DECIMAL_FOR_HF && value <= pluginConfig.HIDE_DECIMAL_HF_THRESHOLD;
            const shouldDimZero = shouldHide && value < 1 && raw.charAt(0) === '0' && raw.charAt(1) === '.';
            const dotIndex = raw.indexOf('.');

            const dotInfo = findFreqCharNode(dotIndex);
            if (dotInfo) {
                const { node: child, pos, len } = dotInfo;
                if (child.nodeType === Node.TEXT_NODE) {
                    if (shouldHide) {
                        const text = child.textContent;
                        const localIdx = dotIndex - pos;
                        const frag = document.createDocumentFragment();
                        if (localIdx > 0) frag.appendChild(document.createTextNode(text.slice(0, localIdx)));
                        const span = document.createElement('span');
                        span.className = 'et-hidden-dot';
                        span.dataset.etHiddenByDecimal = '1';
                        span.style.display = 'none';
                        span.textContent = '.';
                        frag.appendChild(span);
                        if (localIdx + 1 < text.length) frag.appendChild(document.createTextNode(text.slice(localIdx + 1)));
                        dataFrequencyElement.replaceChild(frag, child);
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE && len === 1) {
                    if (shouldHide && child.style.display !== 'none') {
                        child.dataset.etHiddenByDecimal = '1';
                        child.style.display = 'none';
                    } else if (!shouldHide && child.dataset.etHiddenByDecimal === '1') {
                        child.style.display = '';
                        delete child.dataset.etHiddenByDecimal;
                    }
                }
            }

            const zeroInfo = findFreqCharNode(0);
            if (zeroInfo) {
                const { node: child, len } = zeroInfo;
                if (child.nodeType === Node.TEXT_NODE) {
                    if (shouldDimZero) {
                        const text = child.textContent;
                        const frag = document.createDocumentFragment();
                        const span = document.createElement('span');
                        span.className = 'et-dimmed-zero';
                        span.textContent = text.charAt(0);
                        frag.appendChild(span);
                        if (text.length > 1) frag.appendChild(document.createTextNode(text.slice(1)));
                        dataFrequencyElement.replaceChild(frag, child);
                    }
                } else if (child.nodeType === Node.ELEMENT_NODE && len === 1) {
                    if (shouldDimZero && !child.classList.contains('et-dimmed-zero')) {
                        child.classList.add('et-dimmed-zero');
                    } else if (!shouldDimZero && child.classList.contains('et-dimmed-zero')) {
                        child.classList.remove('et-dimmed-zero');
                    }
                }
            }
        };

        const freqDecimalObserver = new MutationObserver(applyFreqDecimalHiding);
        freqDecimalObserver.observe(dataFrequencyElement, { childList: true, characterData: true, subtree: true });
        applyFreqDecimalHiding();

        // =========================================================================
        // SMART kHZ INPUT INTERCEPTOR 
        // =========================================================================
        if (pluginConfig.ENABLE_SMART_KHZ_INPUT) {
            setTimeout(() => {
                const oldInput = document.getElementById('commandinput');
                if (oldInput && !oldInput.dataset.smartKhz) {
                    const newInput = oldInput.cloneNode(true);
                    newInput.dataset.smartKhz = "true"; 
                    oldInput.parentNode.replaceChild(newInput, oldInput);

                    // Cloning drops the webserver's own keyup listener, so other plugins
                    // (e.g. AutoMemory) that tune by setting the value and dispatching a
                    // synthetic keyup Enter must be handled here too. On a real keypress
                    // keydown clears the field first, so keyup finds nothing to send.
                    const handleSmartEnter = (e) => {
                        if (e.key === 'Enter' || e.keyCode === 13) {
                            e.preventDefault();
                            let valStr = newInput.value.trim();
                            let val = parseFloat(valStr);

                            if (!isNaN(val)) {
                                const currentFreq = getGlobalCurrentFrequencyInMHz();
                                let targetMhz = val;

                                if (currentFreq < 30.0) {
                                    if (/^\d+$/.test(valStr) && val >= 130) targetMhz = val / 1000; 
                                } 
                                else {
                                    if (/^\d+$/.test(valStr)) {
                                        if (val >= 640 && val <= 1080) targetMhz = val / 10; 
                                        else if (val >= 6400 && val <= 10800) targetMhz = val / 100; 
                                    }
                                }
                                if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
                                    socket.send("T" + Math.round(targetMhz * 1000));
                                }
                                newInput.value = '';
                                if (e.isTrusted) newInput.focus();
                            }
                        }
                    };
                    newInput.addEventListener('keydown', handleSmartEnter);
                    newInput.addEventListener('keyup', handleSmartEnter);
                }
            }, 1000); 
        }
        

        const FM_DX_TUNER_BW_OPTIONS = { '3 kHz': 'W3000', '4 kHz': 'W4000', '6 kHz': 'W6000', '8 kHz': 'W8000' };
        const SI47XX_AM_BW_OPTIONS = { '1 kHz': 'W1000', '1.8 kHz': 'W1800', '2 kHz': 'W2000', '2.5 kHz': 'W2500', '3 kHz': 'W3000', '4 kHz': 'W4000', '6 kHz': 'W6000' };
        const SI47XX_SSB_BW_OPTIONS = { '0.5 kHz': 'W500', '1 kHz': 'W1000', '1.2 kHz': 'W1200', '2.2 kHz': 'W2200', '3 kHz': 'W3000', '4 kHz': 'W4000' };
        // The radio only reports bandwidth in reply to W, so a mode switch always sends one
        const SI47XX_DEFAULT_BW = { am: '3000', ssb: '2200' };

        // Each option is [label, command, 'am' or 'ssb'], the HF mode it belongs to
        const getTunerBwOptions = () => {
          const tag = (options, hfMode) => Object.entries(options).map(([text, command]) => [text, command, hfMode]);
          return isSi47xx()
            ? [...tag(SI47XX_AM_BW_OPTIONS, 'am'), ...tag(SI47XX_SSB_BW_OPTIONS, 'ssb')]
            : tag(FM_DX_TUNER_BW_OPTIONS, 'am');
        };
        const getHfBwStorageKey = () => isSsbActive() ? 'lastKnownSsbBw' : 'lastKnownAmBw';
        const AM_BW_MAPPING = { '56000': 3, '64000': 4, '72000': 6, '84000': 8 };

        const ALL_BANDS = {
          'AM_SUPER': { name: 'AM', tune: 1.000, start: 0.144, end: 27.0, displayUnit: 'MHz' },
          'FM':   { name: 'FM',   tune: 87.500,  start: 87.5,    end: 108.0,   displayUnit: 'MHz' },
          'OIRT': { name: 'OIRT', tune: 65.900,  start: 65.9,    end: 74.0,    displayUnit: 'MHz' },
          'SW':   { name: 'SW',   tune: 9.400,   start: 1.710,   end: 27.0,    displayUnit: 'MHz' },
          'MW':   { name: 'MW',   tune: 0.504,   start: 0.504,   end: 1.701,   displayUnit: 'kHz' },
          'LW':   { name: 'LW',   tune: 0.144,   start: 0.144,   end: 0.351,   displayUnit: 'kHz' },
        };
        
        switch (pluginConfig.TUNING_STANDARD) {
          case 'americas':
            ALL_BANDS['MW'] = { name: 'MW', tune: 0.530, start: 0.530, end: 1.700, displayUnit: 'kHz' };
            ALL_BANDS['FM'] = { name: 'FM', tune: 87.500, start: 87.5, end: 107.9, displayUnit: 'MHz' };
            break;
          case 'japan':
            ALL_BANDS['FM'] = { name: 'FM', tune: 76.000, start: 76.0, end: 95.0, displayUnit: 'MHz' };
            break;
        }

        if (pluginConfig.customMainBands) {
            for (const key in pluginConfig.customMainBands) {
                if (ALL_BANDS[key] && pluginConfig.customMainBands[key]) {
                    if (pluginConfig.customMainBands[key].name) ALL_BANDS[key].name = pluginConfig.customMainBands[key].name;
                    if (pluginConfig.customMainBands[key].tune !== undefined && !isNaN(pluginConfig.customMainBands[key].tune)) ALL_BANDS[key].tune = pluginConfig.customMainBands[key].tune;
                    if (pluginConfig.customMainBands[key].start !== undefined) ALL_BANDS[key].start = pluginConfig.customMainBands[key].start;
                    if (pluginConfig.customMainBands[key].end !== undefined) ALL_BANDS[key].end = pluginConfig.customMainBands[key].end;
                }
            }
        }

        const SW_BANDS = {
          '160m': { tune: 1.8, start: 1.8, end: 2.0, displayUnit: 'MHz' }, '120m': { tune: 2.3, start: 2.3, end: 2.5, displayUnit: 'MHz' },
          '90m':  { tune: 3.2, start: 3.2, end: 3.4, displayUnit: 'MHz' }, '75m':  { tune: 3.9, start: 3.9, end: 4.0, displayUnit: 'MHz' },
          '60m':  { tune: 4.75,start: 4.75,end: 5.06,displayUnit: 'MHz' }, '49m':  { tune: 5.9, start: 5.9, end: 6.2, displayUnit: 'MHz' },
          '41m':  { tune: 7.2, start: 7.2, end: 7.6, displayUnit: 'MHz' }, '31m':  { tune: 9.4, start: 9.4, end: 9.9, displayUnit: 'MHz' },
          '25m':  { tune: 11.6,start: 11.6,end: 12.1,displayUnit: 'MHz'},  '22m':  { tune: 13.57,start:13.57,end:13.87,displayUnit: 'MHz'},
          '19m':  { tune: 15.1,start: 15.1,end: 15.83,displayUnit: 'MHz'}, '16m':  { tune: 17.48,start:17.48,end:17.9,displayUnit: 'MHz'},
          '15m':  { tune: 18.9,start: 18.9,end: 19.02,displayUnit: 'MHz'}, '13m':  { tune: 21.45,start:21.45,end:21.85,displayUnit: 'MHz'},
          '11m':  { tune: 25.67,start:25.67,end:26.1,displayUnit: 'MHz'}
        };

        if (pluginConfig.customSwBands) {
            for (const key in pluginConfig.customSwBands) {
                if (SW_BANDS[key] && pluginConfig.customSwBands[key]) {
                    if (pluginConfig.customSwBands[key].tune !== undefined && !isNaN(pluginConfig.customSwBands[key].tune)) SW_BANDS[key].tune = pluginConfig.customSwBands[key].tune;
                    if (pluginConfig.customSwBands[key].start !== undefined) SW_BANDS[key].start = pluginConfig.customSwBands[key].start;
                    if (pluginConfig.customSwBands[key].end !== undefined) SW_BANDS[key].end = pluginConfig.customSwBands[key].end;
                }
            }
        }

        const amBandKeys =['SW', 'MW', 'LW'];
        let masterBwListTemplates =[];

        const initializeBwFilter = () => {
          const desktopBwList = document.querySelector('#data-bw .options');
          const mobileBwList = document.querySelector('#data-bw-phone .options');
          if (desktopBwList) masterBwListTemplates = Array.from(desktopBwList.querySelectorAll('li')).map(li => li.cloneNode(true));
          
          getTunerBwOptions().forEach(([text, command, hfMode]) => {
            const value = command.replace('W', '');
            if (desktopBwList) {
              const newLi = document.createElement('li');
              newLi.textContent = text; newLi.dataset.value = value; newLi.dataset.hfMode = hfMode; newLi.classList.add('fmdx-tuner-bw-option'); newLi.style.display = 'none'; 
              newLi.addEventListener('click', (ev) => {
                ev.stopImmediatePropagation(); 
                ev.preventDefault();
    
               if(typeof socket !== 'undefined' && socket) socket.send(command);
    
                const root = document.getElementById('data-bw')?.closest('.dropdown') || document.getElementById('data-bw');
                if(root) { 
                    const sel = root.querySelector('.selected'); 
                    if(sel) sel.textContent = text; 
                    root.classList.remove('open','active','show'); 
                }

                const allOptions = desktopBwList.querySelectorAll('li');
                allOptions.forEach(li => li.classList.remove('bw-option-selected'));
                newLi.classList.add('bw-option-selected');

                localStorage.setItem(hfMode === 'ssb' ? 'lastKnownSsbBw' : 'lastKnownAmBw', value);
            }, { capture: true });
              desktopBwList.appendChild(newLi);
            }
            if (mobileBwList) {
              const newLi = document.createElement('li');
              newLi.textContent = text; newLi.dataset.value = value; newLi.dataset.hfMode = hfMode; newLi.classList.add('fmdx-tuner-bw-option'); newLi.style.display = 'none';
              newLi.addEventListener('click', () => { if(socket) socket.send(command); });
              mobileBwList.appendChild(newLi);
            }
          });
        };

        let _prevIsAmMode = null;
        const updateBwOptionsForMode = (freqInMHz) => {
          if (!pluginConfig.ENABLE_AM_BW) return;
          const isAmMode = freqInMHz < (isSi47xx() ? 30.0 : 27.0);
          const isFirstRun = (_prevIsAmMode === null); 
          const justEnteredAmMode = _prevIsAmMode === false && isAmMode;

          if (isAmMode && (isFirstRun || justEnteredAmMode)) {
            const lastBw = localStorage.getItem(getHfBwStorageKey()) || (justEnteredAmMode && isSi47xx() ? SI47XX_DEFAULT_BW[isSsbActive() ? 'ssb' : 'am'] : null);
            if (lastBw) {
              setTimeout(() => { 
                if (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN) {
                  console.log("[Enhanced Tuning] Synkroniserer BW med hardware: W" + lastBw);
                  socket.send(`W${lastBw}`); 
                }
              }, 300); 
            }
          }
          const justLeftAmMode = _prevIsAmMode === true && !isAmMode;
          if (justLeftAmMode && typeof socket !== 'undefined' && socket) {
              socket.send('W0');
              const dt = document.querySelector('#data-bw .selected'); if(dt) dt.textContent = 'Auto';
              const mt = document.querySelector('#data-bw-phone .selected'); if(mt) mt.textContent = 'Auto';
          }
          const allBwItems = document.querySelectorAll('#data-bw .options li, #data-bw-phone .options li');
          if (allBwItems.length === 0) return;

          const amValuesToShow = new Set(['0', ...Object.keys(AM_BW_MAPPING)]);
          allBwItems.forEach(li => {
              const isTunerOption = li.classList.contains('fmdx-tuner-bw-option');
              const value = li.dataset.value;
              if (isAmMode) {
                if (pluginConfig.FIRMWARE_TYPE === 'FM-DX-Tuner' || isSi47xx()) {
                    li.style.display = isTunerOption && li.dataset.hfMode === (isSsbActive() ? 'ssb' : 'am') ? '' : 'none';
                }
                else { 
                    const isRel = !isTunerOption && amValuesToShow.has(value);
                    li.style.display = isRel ? '' : 'none';
                    if (isRel && AM_BW_MAPPING.hasOwnProperty(value)) li.textContent = `${AM_BW_MAPPING[value]} kHz`;
                }
              } else { 
                li.style.display = isTunerOption ? 'none' : '';
                if (!isTunerOption && value) {
                    const template = masterBwListTemplates.find(t => t.dataset.value === value);
                    if (template) li.textContent = template.textContent;
                }
              }
          });
          if (isAmMode && pluginConfig.FIRMWARE_TYPE === 'TEF6686_ESP32') {
              const desktopBwList = document.querySelector('#data-bw .options');
              if (desktopBwList && pluginConfig.ENABLE_DEFAULT_AM_BW && _prevIsAmMode !== true && pluginConfig.DEFAULT_AM_BW_VALUE) {
                const targetLi = desktopBwList.querySelector(`li[data-value="${pluginConfig.DEFAULT_AM_BW_VALUE}"]`);
                if (targetLi) targetLi.click();
              }
          }
        const currentSavedBw = localStorage.getItem(getHfBwStorageKey());
          if (currentSavedBw) {
            allBwItems.forEach(li => {
                if (li.dataset.value === currentSavedBw) {
                    li.classList.add('bw-option-selected');
                } else {
                    li.classList.remove('bw-option-selected');
                }
            });
        }
          _prevIsAmMode = isAmMode;
        };

        const LOOP_STORAGE_KEY = 'bandSelectorLoopState';
        const LAST_FREQS_STORAGE_KEY = 'bandSelectorLastFreqs';
        const FULL_SW_MODE_KEY = 'bandSelectorFullSwMode';

        const getStoredFreqOrTune = (bKey, bData) => {
            if (!bData) return 0;
            const lastFreqs = pluginConfig.ENABLE_FREQUENCY_MEMORY ? (JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {}) : {};
            let f = lastFreqs[bKey];
            
            if (f === undefined || f === null || f < bData.start || f > bData.end) {
                return bData.tune;
            }
            return f;
        };

        let loopEnabled = localStorage.getItem(LOOP_STORAGE_KEY) === 'true';
        if (!pluginConfig.SHOW_LOOP_BUTTON) { loopEnabled = false; localStorage.setItem(LOOP_STORAGE_KEY, 'false'); }

        let activeBandForLooping = null;
        let fullSwTuningActive = sessionStorage.getItem(FULL_SW_MODE_KEY) === 'true';

        const freqContainer = document.getElementById("freq-container");
        const rtContainer = document.getElementById('rt-container');
        const tuneUpButton = document.getElementById('freq-up');
        const tuneDownButton = document.getElementById('freq-down');
        
        if (!freqContainer || !rtContainer) return;
        
        let observer;
        let updateFrequencyDisplayWithMarker = () => {};
        let tuneEventHandler = () => {};
        let handleCustomStepTune = () => false;

        const tuneToFrequency = (frequencyInMHz) => safeTuneToFrequency(frequencyInMHz);

        // Scanner Logic Overrides
        _stopLocalScanner = () => {
            isLocalScannerRunning = false;
            clearTimeout(localScannerTimer);
            
            const scanBtn = document.getElementById('Scan-on-off');
            const btnDown = document.getElementById('freq-down');
            const btnUp = document.getElementById('freq-up');
            const searchDown = document.getElementById('search-down');
            const searchUp = document.getElementById('search-up');
            const blinkers = document.querySelectorAll('.autoscan-blink');

            if (scanBtn) {
                scanBtn.classList.remove('bg-color-4');
                scanBtn.dataset.scanStatus = "off";
                scanBtn.style.backgroundColor = 'var(--color-3)'; // Scanner's click handler sets it inline
            }
            if (btnDown) btnDown.style.display = '';
            if (btnUp) btnUp.style.display = '';
            if (searchDown) searchDown.style.display = '';
            if (searchUp) searchUp.style.display = '';
            blinkers.forEach(b => b.style.display = 'none');
        };

        const doLocalScannerStep = () => {
            if (!isLocalScannerRunning) return;

            const currentFreq = getCurrentFrequencyInMHz();
            let activeBandKey = 'SW', bStart = 1.710, bEnd = 30.0, stepSize = 0.005;

            for (const key in SW_BANDS) {
                if (currentFreq >= SW_BANDS[key].start && currentFreq <= SW_BANDS[key].end) {
                    activeBandKey = key; bStart = SW_BANDS[key].start; bEnd = SW_BANDS[key].end; stepSize = 0.005; break;
                }
            }
            if (currentFreq >= ALL_BANDS['MW'].start && currentFreq <= ALL_BANDS['MW'].end) {
                activeBandKey = 'MW'; bStart = ALL_BANDS['MW'].start; bEnd = ALL_BANDS['MW'].end;
                const is10kHz = getMwStepKHz() === 10;
                stepSize = is10kHz ? 0.010 : 0.009;
            }
            else if (currentFreq >= ALL_BANDS['LW'].start && currentFreq <= ALL_BANDS['LW'].end) {
                activeBandKey = 'LW'; bStart = ALL_BANDS['LW'].start; bEnd = ALL_BANDS['LW'].end; stepSize = 0.009;
            }

            let newFreq = currentFreq + (localScannerDir === 'up' ? stepSize : -stepSize);
            if (newFreq > bEnd) newFreq = bStart;
            if (newFreq < bStart) newFreq = bEnd;

            tuneToFrequency(newFreq.toFixed(3));

            localScannerTimer = setTimeout(() => {
                if (!isLocalScannerRunning) return;
                const sigEl = document.getElementById('data-sig');
                let signalValue = 0;
                if (sigEl) {
                    const match = sigEl.innerText.match(/-?\d+(\.\d+)?/);
                    if (match) signalValue = parseFloat(match[0]);
                }
                const thresholdKey = 'thr_' + activeBandKey;
                const threshold = (pluginConfig && pluginConfig[thresholdKey] !== undefined) ? pluginConfig[thresholdKey] : 35;

                if (!isNaN(signalValue) && signalValue >= threshold) {
                    if (localScannerMode === 'search') _stopLocalScanner();
                    else if (localScannerMode === 'scan') {
                        const holdInput = document.querySelector('input[title="Scanhold Time"]');
                        let holdMs = 5000;
                        if (holdInput) holdMs = parseInt(holdInput.getAttribute('data-value'), 10) || 5000;
                        localScannerTimer = setTimeout(doLocalScannerStep, holdMs);
                    }
                } else {
                    doLocalScannerStep();
                }
            }, 800);
        };

        _startLocalScanner = (mode, dir) => {
            _stopLocalScanner(); 
            isLocalScannerRunning = true; localScannerMode = mode; localScannerDir = dir;
            
            if (mode === 'scan') {
                const scanBtn = document.getElementById('Scan-on-off');
                const btnDown = document.getElementById('freq-down');
                const btnUp = document.getElementById('freq-up');
                const searchDown = document.getElementById('search-down');
                const searchUp = document.getElementById('search-up');
                const blinkers = document.querySelectorAll('.autoscan-blink');

                if (scanBtn) { scanBtn.classList.add('bg-color-4'); scanBtn.dataset.scanStatus = "on"; scanBtn.style.backgroundColor = 'var(--color-4)'; }
                if (btnDown) btnDown.style.display = 'none'; if (btnUp) btnUp.style.display = 'none';
                if (searchDown) searchDown.style.display = 'none'; if (searchUp) searchUp.style.display = 'none';
                blinkers.forEach(b => b.style.display = 'inline-block');
            }
            doLocalScannerStep();
        };

        if (pluginConfig.ENABLE_TUNE_STEP_FEATURE || pluginConfig.TUNING_STANDARD === 'americas') {
            if (pluginConfig.ENABLE_TUNE_STEP_FEATURE) {
                const TUNE_STEP_CONFIG =[
                    { step: 0.001, markerIndex: -1 }, { step: 0.010, markerIndex: -2 },
                    { step: 0.100, markerIndex: -3 }, { step: 1.000, markerIndex: -5 },
                ];
                // Si47XX SSB adds 10 Hz and 100 Hz steps; its last decimal (1 Hz) has no step
                const SSB_TUNE_STEP_CONFIG = [
                    { step: 0.00001, markerIndex: -2 }, { step: 0.0001, markerIndex: -3 },
                    { step: 0.001, markerIndex: -4 }, { step: 0.010, markerIndex: -5 },
                    { step: 0.100, markerIndex: -6 }, { step: 1.000, markerIndex: -8 },
                ];
                let currentTuneStepIndex = -1;
                let tuneStepConfig = TUNE_STEP_CONFIG;
                const syncTuneStepConfig = () => {
                    const config = isSsbActive() ? SSB_TUNE_STEP_CONFIG : TUNE_STEP_CONFIG;
                    if (config === tuneStepConfig) return;
                    const step = currentTuneStepIndex === -1 ? null : tuneStepConfig[currentTuneStepIndex].step;
                    tuneStepConfig = config;
                    currentTuneStepIndex = config.findIndex(c => c.step === step);
                };
                let tuneStepResetTimer = null;
                let startResetTimer = () => {};

                if (pluginConfig.TUNE_STEP_TIMEOUT_SECONDS > 0) {
                    const resetTuneStep = () => { currentTuneStepIndex = -1; updateFrequencyDisplayWithMarker(); };
                    startResetTimer = () => {
                        clearTimeout(tuneStepResetTimer);
                        if (currentTuneStepIndex !== -1) tuneStepResetTimer = setTimeout(resetTuneStep, pluginConfig.TUNE_STEP_TIMEOUT_SECONDS * 1000);
                    };
                    const clearResetTimer = () => clearTimeout(tuneStepResetTimer);
                    freqContainer.addEventListener('mouseenter', clearResetTimer);
                    freqContainer.addEventListener('mouseleave', startResetTimer);
                }

                updateFrequencyDisplayWithMarker = () => {
                    syncTuneStepConfig();
                    const ssbText = getSsbFreqText();
                    const originalText = ssbText || dataFrequencyElement.textContent;
                    if (observer) observer.disconnect();
                    if (ssbText) {
                        dataFrequencyElement.innerHTML = ssbFreqHtml(ssbText, currentTuneStepIndex === -1 ? -1 : ssbText.length + tuneStepConfig[currentTuneStepIndex].markerIndex);
                    } else if (currentTuneStepIndex === -1) {
                        dataFrequencyElement.innerHTML = originalText;
                    } else {
                        const config = tuneStepConfig[currentTuneStepIndex];
                        const textOnly = originalText.replace(/[^\d.]/g, '');
                        const chars = textOnly.split('');
                        const markerPos = chars.length + config.markerIndex;
                        let html = '';
                        for (let i = 0; i < chars.length; i++) {
                            if (i === markerPos && chars[i] !== '.') html += `<span class="freq-digit-marker">${chars[i]}</span>`;
                            else html += `<span>${chars[i]}</span>`;
                        }
                        dataFrequencyElement.innerHTML = html;
                    }
                    applyFreqDecimalHiding();
                    if (observer) observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });
                };

                handleCustomStepTune = (direction) => {
                    syncTuneStepConfig();
                    if (currentTuneStepIndex === -1) return false;
                    const currentFreq = getCurrentFrequencyInMHz();
                    if (isNaN(currentFreq)) return true;

                    let newFreq;
                    const isFmBand = (currentFreq >= 64.0);
                    const directionMultiplier = (direction === 'up' ? 1 : -1);
                    const ssb = tuneStepConfig === SSB_TUNE_STEP_CONFIG;

                    if (ssb) {
                        newFreq = currentFreq + (tuneStepConfig[currentTuneStepIndex].step * directionMultiplier);
                    } else if (isFmBand) {
                        let stepSize = TUNE_STEP_CONFIG[currentTuneStepIndex].step;
                        if (currentTuneStepIndex === 2) {
                            stepSize = (pluginConfig.TUNING_STANDARD === 'americas') ? 0.200 : 0.100;
                            newFreq = currentFreq + (stepSize * directionMultiplier);
                            newFreq = Math.round(newFreq * 10) / 10;
                        } else {
                            newFreq = currentFreq + (stepSize * directionMultiplier);
                        }
                    } else {
                        const stepSize = TUNE_STEP_CONFIG[currentTuneStepIndex].step;
                        newFreq = currentFreq + (stepSize * directionMultiplier);
                        
                        if (currentTuneStepIndex === 1) {
                            let bandStep = 0.005; 
                            if (newFreq >= ALL_BANDS['MW'].start && newFreq <= ALL_BANDS['MW'].end) {
                                const isAmericasTuning = (pluginConfig.TUNING_STANDARD === 'americas');
                                const storedPref = localStorage.getItem('mwStepPreference');
                                const is10kHzStep = storedPref ? (storedPref === 'true') : isAmericasTuning;
                                bandStep = is10kHzStep ? 0.010 : 0.009;
                            } else if (newFreq >= ALL_BANDS['LW'].start && newFreq <= ALL_BANDS['LW'].end) {
                                bandStep = 0.009; 
                            }
                            newFreq = Math.round(newFreq / bandStep) * bandStep;
                        }
                    }

                    tuneToFrequency(newFreq.toFixed(ssb ? 5 : 3));
                    startResetTimer();
                    return true;
                };

                freqContainer.addEventListener('click', (e) => {
                    if (e.target.closest('#mw-step-toggle-button, .loop-toggle-button, #band-range-container, .band-selector-button')) return;
                    e.preventDefault(); e.stopImmediatePropagation();

                    syncTuneStepConfig();
                    currentTuneStepIndex++;
                    const freqInMHz = getCurrentFrequencyInMHz();
                    const isFmBand = (freqInMHz >= 64.0);
                    if (isFmBand && currentTuneStepIndex === 0) currentTuneStepIndex = 1;
                    if (currentTuneStepIndex >= tuneStepConfig.length) currentTuneStepIndex = -1;
                    
                    updateFrequencyDisplayWithMarker();
                    startResetTimer();
                });
            }
            
            const handleAmericasDefaultStepTune = (direction) => {
                const currentFreq = getCurrentFrequencyInMHz();
                if (isNaN(currentFreq)) return;
                let newFreq;
                if (currentFreq >= ALL_BANDS['FM'].start && currentFreq <= ALL_BANDS['FM'].end) {
                    const step = 0.2;
                    newFreq = parseFloat(currentFreq.toFixed(1)); 
                    if (direction === 'up') newFreq += step; else newFreq -= step;
                    if (Math.round(newFreq * 10) % 2 === 0) newFreq -= 0.1;
                } else {
                    const step = 0.010;
                    const directionMultiplier = (direction === 'up' ? 1 : -1);
                    newFreq = Math.round((currentFreq + (step * directionMultiplier)) / step) * step;
                }
                tuneToFrequency(newFreq.toFixed(3));
            };
            
            tuneEventHandler = (event, direction) => {
                if (pluginConfig.SHOW_LOOP_BUTTON && loopEnabled && activeBandForLooping) {
                    const currentFreq = getCurrentFrequencyInMHz();
                    const tolerance = 0.0001;
                    let looped = false;
                    if (
            direction === 'up' && currentFreq >= activeBandForLooping.end - tolerance) {
                        tuneToFrequency(activeBandForLooping.start); looped = true;
                    } else if (direction === 'down' && currentFreq <= activeBandForLooping.start + tolerance) {
                        tuneToFrequency(activeBandForLooping.end); looped = true;
                    }
                    if (looped) { event.preventDefault(); event.stopImmediatePropagation(); return; }
                }

                if (handleCustomStepTune(direction)) {
                    event.preventDefault(); event.stopImmediatePropagation(); return;
                }

                // Si47XX SSB: 100 Hz steps
                if (isSsbActive()) {
                    const freq = getCurrentFrequencyInMHz() + (direction === 'up' ? 0.0001 : -0.0001);
                    tuneToFrequency(freq.toFixed(5));
                    event.preventDefault(); event.stopImmediatePropagation(); return;
                }

                if (pluginConfig.TUNING_STANDARD === 'americas') {
                    const currentFreq = getCurrentFrequencyInMHz();
                    const isFmBand = currentFreq >= ALL_BANDS['FM'].start && currentFreq <= ALL_BANDS['FM'].end;
                    const isMwBand = currentFreq >= ALL_BANDS['MW'].start && currentFreq <= ALL_BANDS['MW'].end;
                    if (isFmBand || isMwBand) {
                        handleAmericasDefaultStepTune(direction);
                        event.preventDefault(); event.stopImmediatePropagation();
                    }
                }
            };

            freqContainer.addEventListener('wheel', (e) => tuneEventHandler(e, e.deltaY < 0 ? 'up' : 'down'), true);
            if(tuneUpButton) tuneUpButton.addEventListener('click', (e) => tuneEventHandler(e, 'up'), true);
            if(tuneDownButton) tuneDownButton.addEventListener('click', (e) => tuneEventHandler(e, 'down'), true);
            
            let lastKeyTuneTime = 0;
            let finalKeyTuneTimer = null;
            let virtualKeyFreq = null;

            document.addEventListener('keydown', (e) => {
                if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

                if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    e.stopPropagation();

                    let direction;
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') direction = 'up';
                    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') direction = 'down';

                    const isFineTuning = (e.key === 'ArrowUp' || e.key === 'ArrowDown'); 

                    if (typeof AnalogScaleEngine !== 'undefined') {
                        AnalogScaleEngine.isFineTuningMode = isFineTuning;
                        AnalogScaleEngine.lastKnobState = ""; 
                    }

                    let handledByCustom = false;
                    if (typeof handleCustomStepTune === 'function') {
                        const now = Date.now();
                        if (now - lastKeyTuneTime > 150) {
                            handledByCustom = handleCustomStepTune(direction);
                            if (handledByCustom) lastKeyTuneTime = now;
                        } else {
                            if (handleCustomStepTune(direction)) handledByCustom = true;
                        }
                    }

                    if (!handledByCustom) {
                        let baseFreq = virtualKeyFreq !== null ? virtualKeyFreq : getCurrentFrequencyInMHz();
                        if (isNaN(baseFreq)) return;

                        let step = 0.1; // Default standard FM
                        const ssb = isSsbActive();
                        const decimals = ssb ? 5 : 3;

                        if (isFineTuning) {
                            // INNER KNOB FIX: 10 kHz (0.01) for FM, 1 kHz (0.001) for AM/SW, 100 Hz for Si47XX SSB
                            step = (baseFreq < 30.0) ? (ssb ? 0.0001 : 0.001) : 0.01;
                        } else if (ssb) {
                            step = 0.001;
                        } else {
                            if (baseFreq < 30.0) {
                                step = 0.005; 
                                if (baseFreq >= ALL_BANDS['MW'].start && baseFreq <= ALL_BANDS['MW'].end) {
                                    const is10kHz = getMwStepKHz() === 10;
                                    step = is10kHz ? 0.010 : 0.009;
                                } else if (baseFreq >= ALL_BANDS['LW'].start && baseFreq <= ALL_BANDS['LW'].end) {
                                    step = 0.009;
                                }
                            } else if (pluginConfig.TUNING_STANDARD === 'americas') {
                                step = 0.2; 
                            }
                        }

                        const dirMult = direction === 'up' ? 1 : -1;
                        virtualKeyFreq = baseFreq + (step * dirMult);

                        // Rounding safeguards
                        if (isFineTuning || ssb) {
                            // Fix floating point errors for up to 3 decimals (1 kHz precision), 5 in SSB
                            virtualKeyFreq = Math.round(virtualKeyFreq * 10 ** decimals) / 10 ** decimals;
                        } else {
                            if (baseFreq < 30.0) {
                                virtualKeyFreq = Math.round(virtualKeyFreq / step) * step;
                            } else if (pluginConfig.TUNING_STANDARD === 'americas') {
                                 if (Math.round(virtualKeyFreq * 10) % 2 === 0) virtualKeyFreq -= 0.1;
                            }
                        }

                        const freqDisplay = document.getElementById('frequency') || document.querySelector('.freq-value');
                        if (freqDisplay) {
                            freqDisplay.innerText = virtualKeyFreq.toFixed(decimals);
                        }
                        
                        if (typeof updateVisualsByFrequency === 'function') updateVisualsByFrequency(virtualKeyFreq);

                        const now = Date.now();
                        if (now - lastKeyTuneTime > 200) {
                            safeTuneToFrequency(virtualKeyFreq.toFixed(decimals));
                            lastKeyTuneTime = now;
                        }

                        clearTimeout(finalKeyTuneTimer);
                        finalKeyTuneTimer = setTimeout(() => {
                            safeTuneToFrequency(virtualKeyFreq.toFixed(decimals));
                            virtualKeyFreq = null; 
                            lastKeyTuneTime = Date.now();
                        }, 250);
                    }
                }
            }, true);
        }
        
        let updateVisualsByFrequency;

        const updateBandButtonStates = () => {
            const allBandData = { ...ALL_BANDS, ...SW_BANDS };
            let limits = null;

            if (pluginConfig && pluginConfig.overrideServerTuningLimit) {
                limits = {
                    useCustom: true, fmL: pluginConfig.fmLower, fmU: pluginConfig.fmUpper, amL: pluginConfig.amLower, amU: pluginConfig.amUpper
                };
            }

            document.querySelectorAll('[data-band-key],[data-band-name]').forEach(button => {
                const key = button.dataset.bandKey || button.dataset.bandName;
                const bandData = allBandData[key];

                if (bandData && limits) {
                    const bandStartMHz = bandData.start;
                    const bandEndMHz = bandData.end;
                    
                    let isOutside = false;
                    if (limits.useCustom) {
                        const isFmBand = bandEndMHz >= 64.0;
                        const lowerLimit = isFmBand ? limits.fmL : limits.amL;
                        const upperLimit = isFmBand ? limits.fmU : limits.amU;
                        isOutside = bandEndMHz < lowerLimit || bandStartMHz > upperLimit;
                    } 

                    button.classList.toggle('disabled-band', isOutside);

                    const parent = button.parentElement;
                    const isAlreadyWrapped = parent && parent.classList.contains('bs-tooltip'); 

                    if (pluginConfig.LAYOUT_STYLE === 'modern') {
                        if (isOutside && !isAlreadyWrapped) {
                            const tooltipWrapper = document.createElement('div');
                            tooltipWrapper.className = 'bs-tooltip'; 
                            const tooltipText = document.createElement('span');
                            tooltipText.className = 'bs-tooltiptext';
                            tooltipText.id = `tooltip-band-${key}`;
                            tooltipText.textContent = 'This band is outside the tuning limits.';
                            button.parentNode.insertBefore(tooltipWrapper, button);
                            tooltipWrapper.appendChild(button);
                            tooltipWrapper.appendChild(tooltipText);
                        } else if (!isOutside && isAlreadyWrapped) {
                            const grandParent = parent.parentNode;
                            grandParent.insertBefore(button, parent);
                            grandParent.removeChild(parent);
                        }
                    }
                }
            });
        };

        if (pluginConfig.LAYOUT_STYLE === 'modern') {
            const layoutWrapper = document.createElement('div');
            const sideButtonContainer = document.createElement('div');
            const amBandsViewContainer = document.createElement('div');
            const mobileBandSelectorWrapper = document.createElement('div');
            const mobileBandSelector = document.createElement('select');
            const bandRangeContainer = document.createElement("div");
            const loopButton = document.createElement("button");

            const updateBandRangeDisplay = (band) => {
                if (!pluginConfig.SHOW_BAND_RANGE || !band) { bandRangeContainer.style.display = 'none'; return; } 
                bandRangeContainer.style.display = 'flex'; 
                const unit = band.displayUnit || 'MHz'; 
                const start = unit === 'kHz' ? Math.round(band.start * 1000) : band.start.toFixed(3); 
                const end = unit === 'kHz' ? Math.round(band.end * 1000) : band.end.toFixed(3); 
                bandRangeContainer.querySelector('.band-range-start').innerHTML = `${start} <span class="band-range-unit">${unit}</span>`; 
                bandRangeContainer.querySelector('.band-range-end').innerHTML = `${end} <span class="band-range-unit">${unit}</span>`; 
            };
            
            const updateView = (activeBandKey) => { 
                if (pluginConfig.HIDE_ALL_BUTTONS) return;
                const freqForAmCheck = getCurrentFrequencyInMHz();
                const isAmView = (freqForAmCheck >= ALL_BANDS.AM_SUPER.start && freqForAmCheck <= ALL_BANDS.AM_SUPER.end);
                rtContainer.style.display = isAmView ? 'none' : 'block'; 
                amBandsViewContainer.style.display = isAmView ? 'grid' : 'none'; 
            };

            const createBandButton = (key, data, cssClass) => {
                const button = document.createElement("button");
                button.className = cssClass;
                button.textContent = data.displayName || key.replace('m', '');
                button.dataset.bandKey = key;
                return button;
            };

            updateVisualsByFrequency = (freqInMHz) => {
                let currentMainKey = null, currentSwKey = null;
                for (const key in ALL_BANDS) { if (key !== 'AM_SUPER' && enabledBandsList.includes(key) && freqInMHz >= ALL_BANDS[key].start && freqInMHz <= ALL_BANDS[key].end) { currentMainKey = key; break; } }
                if (currentMainKey === 'SW') {
                    for (const key in SW_BANDS) { if (freqInMHz >= SW_BANDS[key].start && freqInMHz <= SW_BANDS[key].end) { currentSwKey = key; break; } }
                }
                if (pluginConfig.ENABLE_FREQUENCY_MEMORY) {
                    try {
                        const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
                        if (currentSwKey) lastFreqs[currentSwKey] = freqInMHz;
                        if (currentMainKey) lastFreqs[currentMainKey] = freqInMHz;
                        localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
                    } catch (e) { }
                }
                const bandForDisplay = (currentMainKey === 'SW' && fullSwTuningActive) ? ALL_BANDS['SW'] : (SW_BANDS[currentSwKey] || ALL_BANDS[currentMainKey]);
                updateView(currentMainKey);
                updateBandRangeDisplay(bandForDisplay);
                activeBandForLooping = bandForDisplay;
                
                // ANALOG SCALE BINDING (MODERN)
                AnalogScaleEngine.updateBand(bandForDisplay, freqInMHz, currentSwKey || currentMainKey);
                announceBandChange(currentSwKey || currentMainKey, bandForDisplay, freqInMHz);

                if (amBandKeys.includes(currentMainKey)) localStorage.setItem('bandSelectorLastAmBand', currentMainKey);
                const activeKeys = new Set();
                if (currentMainKey) activeKeys.add(currentMainKey);
                if (currentSwKey) activeKeys.add(currentSwKey);
                if (amBandKeys.includes(currentMainKey)) activeKeys.add('AM');
                document.querySelectorAll('.band-selector-button, .am-view-button, .sw-grid-button').forEach(btn => { btn.classList.toggle('active-band', activeKeys.has(btn.dataset.bandKey)); });
                if (mobileBandSelector && currentMainKey) { if (document.activeElement !== mobileBandSelector) mobileBandSelector.value = currentMainKey; }
                const loopOption = document.getElementById('mobile-loop-toggle-option');
                if (loopOption) loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
                const antContainer = document.getElementById('data-ant-container');
                const swSelectorWrapper = document.getElementById('mobile-sw-band-selector-wrapper');
                const mobileSwBandSelector = document.getElementById('mobile-sw-band-selector');
                if (antContainer && swSelectorWrapper) {
                    if (currentMainKey === 'SW') {
                        swSelectorWrapper.style.display = 'flex';
                        antContainer.classList.add('sw-mode-active');
                    } else {
                        swSelectorWrapper.style.display = 'none';
                        antContainer.classList.remove('sw-mode-active');
                    }
                }
                if (mobileSwBandSelector) mobileSwBandSelector.value = currentSwKey || '';
                updateFrequencyDisplayWithMarker();
            };
            
            if (pluginConfig.SHOW_LOOP_BUTTON) {
                loopButton.className = 'loop-toggle-button'; loopButton.innerHTML = 'Band<br>Loop';
                loopButton.title = 'Enable/disable frequency loop'; loopButton.classList.toggle('active', loopEnabled);
                freqContainer.appendChild(loopButton);
                loopButton.addEventListener('click', (e) => { e.stopPropagation(); loopEnabled = !loopEnabled; loopButton.classList.toggle('active', loopEnabled); localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled); });
            }
            if (pluginConfig.SHOW_BAND_RANGE) {
                bandRangeContainer.id = "band-range-container"; bandRangeContainer.innerHTML = `<span class="band-range-part band-range-start"></span><span class="range-separator">↔</span><span class="band-range-part band-range-end"></span>`;
                freqContainer.appendChild(bandRangeContainer);
                bandRangeContainer.querySelector('.band-range-start').addEventListener('click', () => { if (activeBandForLooping) tuneToFrequency(activeBandForLooping.start); });
                bandRangeContainer.querySelector('.band-range-end').addEventListener('click', () => { if (activeBandForLooping) tuneToFrequency(activeBandForLooping.end); });
            }
            if (!pluginConfig.HIDE_ALL_BUTTONS) {
                layoutWrapper.className = `band-selector-layout-wrapper ${rtContainer.className}`; rtContainer.className = '';
                rtContainer.parentNode.replaceChild(layoutWrapper, rtContainer);
                sideButtonContainer.className = 'side-band-button-container'; layoutWrapper.appendChild(sideButtonContainer);
                layoutWrapper.appendChild(rtContainer);
                amBandsViewContainer.className = 'am-bands-view-container'; layoutWrapper.appendChild(amBandsViewContainer);
                const sideButtonKeys =['FM', 'OIRT', 'AM'];
                sideButtonKeys.forEach(key => {
                    const isAmButton = (key === 'AM');
                    const shouldCreate = isAmButton ? amBandKeys.some(b => enabledBandsList.includes(b)) : enabledBandsList.includes(key);
                    if (shouldCreate) {
                        const btn = createBandButton(key, { displayName: key === 'AM' ? ALL_BANDS['AM_SUPER'].name : ALL_BANDS[key].name }, 'band-selector-button');
                        btn.addEventListener('click', () => {
                            let targetFreq;
                            if (isAmButton) {
                                const lastAmBand = localStorage.getItem('bandSelectorLastAmBand');
                                if (lastAmBand && enabledBandsList.includes(lastAmBand)) {
                                    targetFreq = getStoredFreqOrTune(lastAmBand, ALL_BANDS[lastAmBand]);
                                } else {
                                    const firstEnabledAmBand = amBandKeys.find(b => enabledBandsList.includes(b));
                                    if (firstEnabledAmBand) targetFreq = getStoredFreqOrTune(firstEnabledAmBand, ALL_BANDS[firstEnabledAmBand]);
                                }
                            } else {
                                fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                                targetFreq = getStoredFreqOrTune(key, ALL_BANDS[key]);
                            }
                            if (targetFreq !== undefined) tuneToFrequency(targetFreq);
                            updateVisualsByFrequency(getCurrentFrequencyInMHz());
                        });
                        sideButtonContainer.appendChild(btn);
                    }
                });
                if (enabledBandsList.includes('SW')) {
                    const swFieldset = document.createElement('fieldset'); swFieldset.className = 'sw-bands-fieldset';
                    const swLegend = document.createElement('legend'); swLegend.textContent = 'SW Broadcast Band'; swFieldset.appendChild(swLegend);
                    const swGridContainer = document.createElement('div'); swGridContainer.className = 'sw-grid-container'; swFieldset.appendChild(swGridContainer);
                    Object.keys(SW_BANDS).forEach(key => {
                        const btn = createBandButton(key, SW_BANDS[key], 'sw-grid-button');
                        btn.addEventListener('click', () => {
                            fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                            const targetFreq = getStoredFreqOrTune(key, SW_BANDS[key]);
                            tuneToFrequency(targetFreq);
                            updateVisualsByFrequency(getCurrentFrequencyInMHz());
                        });
                        swGridContainer.appendChild(btn);
                    });
                    amBandsViewContainer.appendChild(swFieldset);
                }
                const bandFieldset = document.createElement('fieldset'); bandFieldset.className = 'band-fieldset';
                const bandLegend = document.createElement('legend'); bandLegend.textContent = 'AM Band'; bandFieldset.appendChild(bandLegend);
                const bandButtonContainer = document.createElement('div'); bandButtonContainer.className = 'band-button-container'; bandFieldset.appendChild(bandButtonContainer);
                if (enabledBandsList.includes('SW')) {
                    const fullSwButton = createBandButton('SW', { ...ALL_BANDS['SW'], displayName: 'SW' }, 'am-view-button');
                    fullSwButton.addEventListener('click', () => {
                        fullSwTuningActive = true; sessionStorage.setItem(FULL_SW_MODE_KEY, 'true');
                        const targetFreq = getStoredFreqOrTune('SW', ALL_BANDS['SW']);
                        tuneToFrequency(targetFreq);
                        updateVisualsByFrequency(getCurrentFrequencyInMHz());
                    });
                    bandButtonContainer.appendChild(fullSwButton);
                }['MW', 'LW'].forEach(key => {
                    if (enabledBandsList.includes(key)) {
                        const btn = createBandButton(key, ALL_BANDS[key], 'am-view-button');
                        btn.addEventListener('click', () => {
                            fullSwTuningActive = false; sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                            const targetFreq = getStoredFreqOrTune(key, ALL_BANDS[key]);
                            tuneToFrequency(targetFreq);
                            updateVisualsByFrequency(getCurrentFrequencyInMHz());
                        });
                        bandButtonContainer.appendChild(btn);
                    }
                });
                if (bandButtonContainer.hasChildNodes()) amBandsViewContainer.prepend(bandFieldset);
                const rtContainerForAnchor = document.getElementById('rt-container');
                if (rtContainerForAnchor && rtContainerForAnchor.parentNode) {
                    let antContainer = document.getElementById('data-ant-container');
                    if (!antContainer) {
                        antContainer = document.createElement('div'); antContainer.id = 'data-ant-container'; antContainer.className = 'hide-desktop';
                        rtContainerForAnchor.parentNode.insertBefore(antContainer, rtContainerForAnchor);
                    }
                    mobileBandSelectorWrapper.id = 'mobile-band-selector-wrapper'; mobileBandSelector.id = 'mobile-band-selector';
                    const mobileBandOrder =['FM', 'OIRT', 'SW', 'MW', 'LW'];
                    mobileBandOrder.forEach(key => {
                        if (enabledBandsList.includes(key)) {
                            const option = document.createElement('option'); option.value = key; option.textContent = ALL_BANDS[key].name; mobileBandSelector.appendChild(option);
                        }
                    });
                    if (pluginConfig.SHOW_LOOP_BUTTON) {
                        const separator = document.createElement('option'); separator.disabled = true; separator.textContent = '──────────'; mobileBandSelector.appendChild(separator);
                        const loopOption = document.createElement('option'); loopOption.id = 'mobile-loop-toggle-option'; loopOption.value = 'toggle-loop';
                        loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop'; mobileBandSelector.appendChild(loopOption);
                    }
                    mobileBandSelectorWrapper.appendChild(mobileBandSelector); antContainer.appendChild(mobileBandSelectorWrapper);
                    const mobileSwBandSelectorWrapper = document.createElement('div'); mobileSwBandSelectorWrapper.id = 'mobile-sw-band-selector-wrapper'; mobileSwBandSelectorWrapper.style.display = 'none'; 
                    const mobileSwBandSelector = document.createElement('select'); mobileSwBandSelector.id = 'mobile-sw-band-selector';
                    const defaultSwOption = document.createElement('option'); defaultSwOption.value = ""; defaultSwOption.textContent = "Band"; mobileSwBandSelector.appendChild(defaultSwOption);
                    Object.keys(SW_BANDS).forEach(key => {
                        const option = document.createElement('option'); option.value = key; option.textContent = key; mobileSwBandSelector.appendChild(option);
                    });
                    mobileSwBandSelectorWrapper.appendChild(mobileSwBandSelector); antContainer.appendChild(mobileSwBandSelectorWrapper);
                    mobileSwBandSelector.addEventListener('change', (event) => {
                        const key = event.target.value; 
                        if (!key) return; 
                        const data = SW_BANDS[key]; 
                        if (!data) return;

                        fullSwTuningActive = false; 
                        sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');

                        const targetFreq = getStoredFreqOrTune(key, data);
                        tuneToFrequency(targetFreq);
                    });
                    mobileBandSelector.addEventListener('change', (event) => {
                        const key = event.target.value;
                        if (key === 'toggle-loop') {
                            loopEnabled = !loopEnabled; localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
                            if (loopButton) loopButton.classList.toggle('active', loopEnabled);
                            const freqMhz = getCurrentFrequencyInMHz();
                            let currentMainKey = null;
                            for (const bandKey in ALL_BANDS) { if (freqMhz >= ALL_BANDS[bandKey].start && freqMhz <= ALL_BANDS[bandKey].end) { currentMainKey = bandKey; break; } }
                            if (currentMainKey) mobileBandSelector.value = currentMainKey;
                            updateVisualsByFrequency(freqMhz); return;
                        }
                        const data = ALL_BANDS[key]; if (!data) return;
                        if (key === 'SW') fullSwTuningActive = true; else fullSwTuningActive = false;
                        sessionStorage.setItem(FULL_SW_MODE_KEY, String(fullSwTuningActive));
                        const targetFreq = getStoredFreqOrTune(key, data);
                        tuneToFrequency(targetFreq);
                        updateVisualsByFrequency(getCurrentFrequencyInMHz());
                    });
                }
            }
        } else if (pluginConfig.LAYOUT_STYLE === 'classic') {
            const pluginTopContainer = document.createElement("div");
            pluginTopContainer.className = "plugin-top-container";
            const mainBandsWrapper = document.createElement("div");
            mainBandsWrapper.className = "main-bands-wrapper";
            const swBandsContainer = document.createElement("div");
            swBandsContainer.className = "sw-bands-container";
            const swBandsTopWrapper = document.createElement("div");
            swBandsTopWrapper.className = "sw-bands-grid sw-bands-top-wrapper";
            const swBandsBottomWrapper = document.createElement("div");
            swBandsBottomWrapper.className = "sw-bands-grid sw-bands-bottom-wrapper";
            const bandRangeContainer = document.createElement("div");
            bandRangeContainer.id = "band-range-container";
            const startFreqSpan = document.createElement("span");
            startFreqSpan.className = "band-range-part";
            startFreqSpan.title = "Go to band start";
            const rangeSeparator = document.createElement("span");
            rangeSeparator.className = "range-separator";
            rangeSeparator.innerHTML = "↔"; 
            const endFreqSpan = document.createElement("span");
            endFreqSpan.className = "band-range-part";
            endFreqSpan.title = "Go to band end";

            const updateBandRangeDisplay = (start, end, unit) => {
                if (!pluginConfig.SHOW_BAND_RANGE || start === undefined || end === undefined) {
                    bandRangeContainer.style.display = 'none';
                    return;
                }
                bandRangeContainer.style.display = 'flex';
                const displayStart = unit === 'kHz' ? Math.round(start * 1000) : start.toFixed(3);
                const displayEnd = unit === 'kHz' ? Math.round(end * 1000) : end.toFixed(3);
                startFreqSpan.innerHTML = `${displayStart} <span class="band-range-unit">${unit}</span>`;
                startFreqSpan.dataset.freqMhz = start;
                endFreqSpan.innerHTML = `${displayEnd} <span class="band-range-unit">${unit}</span>`;
                endFreqSpan.dataset.freqMhz = end;
            };

            updateVisualsByFrequency = (freqInMHz) => {
                let activeMainBandKey = null;
                for (const bandKey of enabledBandsList) {
                    const band = ALL_BANDS[bandKey];
                    if (band && freqInMHz >= band.start && freqInMHz <= band.end) {
                        activeMainBandKey = bandKey;
                        break;
                    }
                }
                
                mainBandsWrapper.querySelectorAll('.main-band-button').forEach(btn => {
                    btn.classList.toggle('active-band', btn.dataset.bandKey === activeMainBandKey);
                });
                
                if (activeMainBandKey) activeBandForLooping = ALL_BANDS[activeMainBandKey];
                else activeBandForLooping = null;

                let activeSwBandKey = null;
                if (activeMainBandKey === 'SW') {
                    swBandsContainer.style.display = 'flex';
                    for (const swKey in SW_BANDS) {
                        const swBand = SW_BANDS[swKey];
                        if (freqInMHz >= swBand.start && freqInMHz <= swBand.end) {
                            activeSwBandKey = swKey;
                            break;
                        }
                    }
                    swBandsContainer.querySelectorAll('.sw-band-button').forEach(btn => {
                        btn.classList.toggle('active-band', btn.dataset.bandKey === activeSwBandKey);
                    });
                    
                    const activeSwBand = SW_BANDS[activeSwBandKey];
                    if (activeSwBand) { 
                        updateBandRangeDisplay(activeSwBand.start, activeSwBand.end, 'MHz');
                        activeBandForLooping = activeSwBand;
                    } else { 
                        updateBandRangeDisplay(ALL_BANDS.SW.start, ALL_BANDS.SW.end, 'MHz');
                        activeBandForLooping = ALL_BANDS.SW;
                    }
                } else {
                    swBandsContainer.style.display = 'none';
                    const activeMainBand = ALL_BANDS[activeMainBandKey];
                    if (activeMainBand) updateBandRangeDisplay(activeMainBand.start, activeMainBand.end, activeMainBand.displayUnit);
                    else updateBandRangeDisplay();
                }
                
                // ANALOG SCALE BINDING (CLASSIC)
                AnalogScaleEngine.updateBand(activeBandForLooping, freqInMHz, activeSwBandKey || activeMainBandKey);
                announceBandChange(activeSwBandKey || activeMainBandKey, activeBandForLooping, freqInMHz);

                if (pluginConfig.ENABLE_FREQUENCY_MEMORY) {
                    try {
                        const lastFreqs = JSON.parse(localStorage.getItem(LAST_FREQS_STORAGE_KEY)) || {};
                        if (activeSwBandKey) lastFreqs[activeSwBandKey] = freqInMHz;
                        if (activeMainBandKey) lastFreqs[activeMainBandKey] = freqInMHz;
                        localStorage.setItem(LAST_FREQS_STORAGE_KEY, JSON.stringify(lastFreqs));
                    } catch (e) { }
                }

                const mobileBandSelectorEl = document.getElementById('mobile-band-selector');
                if (mobileBandSelectorEl && activeMainBandKey) {
                    if (document.activeElement !== mobileBandSelectorEl) mobileBandSelectorEl.value = activeMainBandKey;
                }

                const loopOption = document.getElementById('mobile-loop-toggle-option');
                if (loopOption) loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';

                const antContainer = document.getElementById('data-ant-container');
                const swSelectorWrapper = document.getElementById('mobile-sw-band-selector-wrapper');
                const mobileSwBandSelectorEl = document.getElementById('mobile-sw-band-selector');

                if (antContainer && swSelectorWrapper) {
                    if (activeMainBandKey === 'SW') {
                        swSelectorWrapper.style.display = 'flex'; antContainer.classList.add('sw-mode-active');
                    } else {
                        swSelectorWrapper.style.display = 'none'; antContainer.classList.remove('sw-mode-active');
                    }
                }
                
                if (mobileSwBandSelectorEl) mobileSwBandSelectorEl.value = activeSwBandKey || '';

                updateFrequencyDisplayWithMarker();
            };
            
            const createBandButton = (bandKey, bandData, isSubBand = false) => {
                const button = document.createElement("button");
                button.className = isSubBand ? 'sw-band-button band-selector-button' : 'main-band-button band-selector-button';
                
                button.textContent = isSubBand ? bandKey.replace('m', '') : (bandData.name || bandKey);
                button.dataset.bandKey = bandKey;

                const safeTune = (bandData && typeof bandData.tune === 'number') ? bandData.tune : 0;
                button.title = `Go to ${safeTune.toFixed(3)} ${bandData.displayUnit || 'MHz'}`;
                
                button.addEventListener('click', () => { 
                    activeBandForLooping = bandData;
                    const targetFreq = getStoredFreqOrTune(bandKey, bandData); 
                    tuneToFrequency(targetFreq);
                });
                return button;
            };
            
            enabledBandsList.forEach((bandKey) => mainBandsWrapper.appendChild(createBandButton(bandKey, ALL_BANDS[bandKey])));
            
            let swButtonIndex = 0;
            Object.keys(SW_BANDS).forEach((swBandKey) => {
                const button = createBandButton(swBandKey, SW_BANDS[swBandKey], true);
                if (swButtonIndex < 9) swBandsTopWrapper.appendChild(button);
                else swBandsBottomWrapper.appendChild(button);
                swButtonIndex++;
            });

            if (pluginConfig.SHOW_LOOP_BUTTON) {
                const loopButton = document.createElement("button");
                loopButton.id = 'loop-toggle-button';
                loopButton.className = 'band-selector-button';
                loopButton.textContent = 'Loop';
                loopButton.title = 'Enable/disable frequency loop';
                if (loopEnabled) loopButton.classList.add('active');
                loopButton.addEventListener('click', () => {
                    loopEnabled = !loopEnabled;
                    loopButton.classList.toggle('active', loopEnabled);
                    localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
                });
                pluginTopContainer.appendChild(mainBandsWrapper);
                pluginTopContainer.appendChild(loopButton);
            } else {
                pluginTopContainer.appendChild(mainBandsWrapper);
            }

            swBandsContainer.appendChild(swBandsTopWrapper);
            swBandsContainer.appendChild(swBandsBottomWrapper);
            startFreqSpan.addEventListener('click', (e) => { const freqMhz = parseFloat(e.target.dataset.freqMhz); if (!isNaN(freqMhz)) tuneToFrequency(freqMhz); });
            endFreqSpan.addEventListener('click', (e) => { const freqMhz = parseFloat(e.target.dataset.freqMhz); if (!isNaN(freqMhz)) tuneToFrequency(freqMhz); });
            
            const rtContainerForAnchor = document.getElementById('rt-container');
            if (rtContainerForAnchor && rtContainerForAnchor.parentNode) {
                let antContainer = document.getElementById('data-ant-container');
                if (!antContainer) {
                    antContainer = document.createElement('div');
                    antContainer.id = 'data-ant-container';
                    rtContainerForAnchor.parentNode.insertBefore(antContainer, rtContainerForAnchor);
                }
                antContainer.classList.add('classic-mobile-controls');
                
                const mobileBandSelectorWrapper = document.createElement('div');
                mobileBandSelectorWrapper.id = 'mobile-band-selector-wrapper';
                const mobileBandSelector = document.createElement('select');
                mobileBandSelector.id = 'mobile-band-selector';
                
                const mobileBandOrder =['FM', 'OIRT', 'SW', 'MW', 'LW'];
                mobileBandOrder.forEach(key => {
                    if (enabledBandsList.includes(key)) {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = ALL_BANDS[key].name;
                        mobileBandSelector.appendChild(option);
                    }
                });

                if (pluginConfig.SHOW_LOOP_BUTTON) {
                    const separator = document.createElement('option');
                    separator.disabled = true; separator.textContent = '──────────';
                    mobileBandSelector.appendChild(separator);
                    const loopOption = document.createElement('option');
                    loopOption.id = 'mobile-loop-toggle-option'; loopOption.value = 'toggle-loop';
                    loopOption.textContent = loopEnabled ? 'Disable Band Loop' : 'Enable Band Loop';
                    mobileBandSelector.appendChild(loopOption);
                }
                mobileBandSelectorWrapper.appendChild(mobileBandSelector);
                antContainer.appendChild(mobileBandSelectorWrapper);

                const mobileSwBandSelectorWrapper = document.createElement('div');
                mobileSwBandSelectorWrapper.id = 'mobile-sw-band-selector-wrapper';
                mobileSwBandSelectorWrapper.style.display = 'none';
                const mobileSwBandSelector = document.createElement('select');
                mobileSwBandSelector.id = 'mobile-sw-band-selector';
                const defaultSwOption = document.createElement('option');
                defaultSwOption.value = ""; defaultSwOption.textContent = "Band";
                mobileSwBandSelector.appendChild(defaultSwOption);
                Object.keys(SW_BANDS).forEach(key => {
                    const option = document.createElement('option');
                    option.value = key; option.textContent = key;
                    mobileSwBandSelector.appendChild(option);
                });
                mobileSwBandSelectorWrapper.appendChild(mobileSwBandSelector);
                antContainer.appendChild(mobileSwBandSelectorWrapper);

                mobileSwBandSelector.addEventListener('change', (event) => {
                    const key = event.target.value; 
                    if (!key) return; 
                    const data = SW_BANDS[key]; 
                    if (!data) return;
                    fullSwTuningActive = false; 
                    sessionStorage.setItem(FULL_SW_MODE_KEY, 'false');
                    const targetFreq = getStoredFreqOrTune(key, data);
                    tuneToFrequency(targetFreq);
                });

                mobileBandSelector.addEventListener('change', (event) => {
                    const key = event.target.value;
                    if (key === 'toggle-loop') {
                        loopEnabled = !loopEnabled; 
                        localStorage.setItem(LOOP_STORAGE_KEY, loopEnabled);
                        const classicLoopButton = document.getElementById('loop-toggle-button');
                        if (classicLoopButton) classicLoopButton.classList.toggle('active', loopEnabled);
                        
                        const freqMhz = getCurrentFrequencyInMHz();
                        let currentMainKey = null;
                        for (const bandKey of enabledBandsList) {
                            if (ALL_BANDS[bandKey] && freqMhz >= ALL_BANDS[bandKey].start && freqMhz <= ALL_BANDS[bandKey].end) {
                                currentMainKey = bandKey; break; 
                            }
                        }
                        if (currentMainKey) mobileBandSelector.value = currentMainKey;
                        updateVisualsByFrequency(freqMhz); 
                        return;
                    }
                    const data = ALL_BANDS[key]; 
                    if (!data) return;

                    fullSwTuningActive = (key === 'SW');
                    sessionStorage.setItem(FULL_SW_MODE_KEY, String(fullSwTuningActive));
                    
                    const targetFreq = getStoredFreqOrTune(key, data);
                    tuneToFrequency(targetFreq);
                });
            }

            freqContainer.appendChild(pluginTopContainer);
            freqContainer.appendChild(swBandsContainer);
            
            if (pluginConfig.SHOW_BAND_RANGE) {
                bandRangeContainer.appendChild(startFreqSpan);
                bandRangeContainer.appendChild(rangeSeparator);
                bandRangeContainer.appendChild(endFreqSpan);
                freqContainer.appendChild(bandRangeContainer);
            }
        }

        const setBodyClasses = () => {
          const body = document.body;
          if (pluginConfig.LAYOUT_STYLE === 'modern') body.classList.add('layout-modern');
          else body.classList.add('layout-classic');
          
          if (pluginConfig.ENABLE_TUNE_STEP_FEATURE) body.classList.add('tune-step-enabled');
          if (pluginConfig.SHOW_LOOP_BUTTON) body.classList.add('loop-button-visible');
          if (pluginConfig.SHOW_BAND_RANGE) body.classList.add('band-range-visible');
          if (pluginConfig.LAYOUT_STYLE === 'modern' && !pluginConfig.HIDE_ALL_BUTTONS) body.classList.add('modern-buttons-visible');
        };
        
        setBodyClasses();

        observer = new MutationObserver(() => {
          setTimeout(() => {
            const freqMhz = getCurrentFrequencyInMHz();
            if (!isNaN(freqMhz)) {
              if (typeof updateVisualsByFrequency === 'function') updateVisualsByFrequency(freqMhz);
              if (pluginConfig.ENABLE_AM_BW) setTimeout(() => updateBwOptionsForMode(freqMhz), 150);
            }
          }, 0);
        });
        observer.observe(dataFrequencyElement, { characterData: true, childList: true, subtree: true });

        const limitSpanForObserver = Array.from(document.querySelectorAll('.text-small, span')).find(el => el.textContent.includes('Limit:'));
        if (limitSpanForObserver) {
            const limitObserver = new MutationObserver(updateBandButtonStates);
            limitObserver.observe(limitSpanForObserver, { childList: true, characterData: true, subtree: true });
        }

        setTimeout(() => {
          const initialFreqMhz = getCurrentFrequencyInMHz();
          if (pluginConfig.ENABLE_AM_BW) initializeBwFilter();
          if (!isNaN(initialFreqMhz)) {
            if (typeof updateVisualsByFrequency === 'function') updateVisualsByFrequency(initialFreqMhz);
            if (pluginConfig.ENABLE_AM_BW) updateBwOptionsForMode(initialFreqMhz);
          }
          if(typeof updateBandButtonStates === 'function') updateBandButtonStates();
        }, 500);

        if (pluginConfig.ENABLE_MW_STEP_TOGGLE) {
          const MW_STEP_STORAGE_KEY = 'mwStepPreference';
          const MW_BAND_AMERICAS = { name: 'MW', tune: 1.000, start: 0.530, end: 1.700, displayUnit: 'kHz' };
          const MW_BAND_INTERNATIONAL = { name: 'MW', tune: 0.999, start: 0.504, end: 1.701, displayUnit: 'kHz' };

          let is10kHzStep = localStorage.getItem(MW_STEP_STORAGE_KEY)
            ? localStorage.getItem(MW_STEP_STORAGE_KEY) === 'true'
            : (pluginConfig.TUNING_STANDARD === 'americas');

          const mwStepButton = document.createElement("button");
          mwStepButton.id = 'mw-step-toggle-button';
          mwStepButton.textContent = is10kHzStep ? '10 kHz' : '9 kHz';
          mwStepButton.title = 'Toggle MW tuning step';
          const updateButtonStyle = () => { mwStepButton.classList.toggle('active', is10kHzStep); };

          mwStepButton.addEventListener('click', (e) => {
            e.stopPropagation(); e.preventDefault();
            const originalFreq = getCurrentFrequencyInMHz();
            is10kHzStep = !is10kHzStep;
            mwStepButton.textContent = is10kHzStep ? '10 kHz' : '9 kHz';
            localStorage.setItem(MW_STEP_STORAGE_KEY, is10kHzStep);
            updateButtonStyle();

            ALL_BANDS.MW = is10kHzStep ? MW_BAND_AMERICAS : MW_BAND_INTERNATIONAL;
            const newBand = ALL_BANDS.MW;
            const newStep = is10kHzStep ? 0.010 : 0.009;
            let targetFreq = Math.round(originalFreq / newStep) * newStep;
            targetFreq = Math.max(newBand.start, Math.min(newBand.end, targetFreq));
            
            if (Math.abs(targetFreq - originalFreq) > 0.0001) tuneToFrequency(targetFreq.toFixed(3));
            if (typeof updateVisualsByFrequency === 'function') updateVisualsByFrequency(targetFreq);
          });
          freqContainer.appendChild(mwStepButton);
          updateButtonStyle();

          const originalUpdateVisuals = updateVisualsByFrequency;
          updateVisualsByFrequency = (freqInMHz) => {
            if (typeof originalUpdateVisuals === 'function') originalUpdateVisuals(freqInMHz);
            const isMwBandActive = (ALL_BANDS.MW && freqInMHz >= ALL_BANDS.MW.start && freqInMHz <= ALL_BANDS.MW.end);
            mwStepButton.style.display = isMwBandActive ? 'block' : 'none';
          };

          const originalTuneHandler = tuneEventHandler;
          tuneEventHandler = (event, direction) => {
            const currentFreq = getCurrentFrequencyInMHz();
            const isMwBand = (ALL_BANDS.MW && currentFreq >= ALL_BANDS.MW.start && currentFreq <= ALL_BANDS.MW.end);

            if (isMwBand) {
              if (pluginConfig.SHOW_LOOP_BUTTON && loopEnabled) {
                  const tolerance = 0.0001; let looped = false;
                  if (direction === 'up' && currentFreq >= ALL_BANDS.MW.end - tolerance) { tuneToFrequency(ALL_BANDS.MW.start); looped = true; } 
                  else if (direction === 'down' && currentFreq <= ALL_BANDS.MW.start + tolerance) { tuneToFrequency(ALL_BANDS.MW.end); looped = true; }
                  if (looped) { event.preventDefault(); event.stopImmediatePropagation(); return; }
              }
              if (!handleCustomStepTune(direction)) {
                const step = is10kHzStep ? 0.010 : 0.009;
                const directionMultiplier = (direction === 'up' ? 1 : -1);
                let newFreq = Math.round((currentFreq + (step * directionMultiplier)) / step) * step;
                if (pluginConfig.SHOW_LOOP_BUTTON && loopEnabled) newFreq = Math.max(ALL_BANDS.MW.start, Math.min(ALL_BANDS.MW.end, newFreq));
                tuneToFrequency(newFreq.toFixed(3));
                event.preventDefault(); event.stopImmediatePropagation(); return;
              }
            }
            originalTuneHandler(event, direction);
          };
        }

        // Si47XX firmware: AM, LSB and USB on HF
        if (isSi47xx()) {
          const modeButtons = document.createElement('div');
          modeButtons.id = 'et-mode-buttons';
          [['AM', 1], ['USB', 3], ['LSB', 2]].forEach(([label, mode]) => {
            const button = document.createElement('button');
            button.textContent = label;
            button.dataset.mode = mode;
            button.addEventListener('click', (e) => {
              e.stopPropagation(); e.preventDefault();
              if (typeof socket === 'undefined' || !socket || socket.readyState !== WebSocket.OPEN) return;
              socket.send(`M${mode}`);
              // Each mode keeps its own last bandwidth
              const bw = localStorage.getItem(mode === 1 ? 'lastKnownAmBw' : 'lastKnownSsbBw') || SI47XX_DEFAULT_BW[mode === 1 ? 'am' : 'ssb'];
              setTimeout(() => socket.send(`W${bw}`), 300);
            });
            modeButtons.appendChild(button);
          });
          freqContainer.appendChild(modeButtons);

          let shownMode;
          setInterval(() => {
            const freqMhz = getCurrentFrequencyInMHz();
            const mode = getSi47xxMode();
            modeButtons.style.display = freqMhz < 30 ? 'flex' : 'none';
            if (mode === shownMode) return;
            shownMode = mode;
            modeButtons.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.mode) === mode));
            applyFreqDecimalHiding();
            if (pluginConfig.ENABLE_AM_BW && !isNaN(freqMhz)) updateBwOptionsForMode(freqMhz);
          }, 500);
        }

        console.log(`[Enhanced Tuning] v3.2 loaded successfully.`);
    } catch (err) {
        console.error("[Enhanced Tuning] Krasj under bygging av UI:", err);
    }
  };

  window.addEventListener('storage', async (e) => {
      if (e.key === 'et_config_update_trigger') {
          console.log("[Enhanced Tuning] Nye innstillinger lagret i Admin Panel. Oppdaterer umiddelbart...");
          await fetchPluginConfig();
          announceConfig('enhanced-tuning:config');
          
          if (typeof updateBandButtonStates === 'function') {
              updateBandButtonStates();
          }
      }
  });

  document.addEventListener("DOMContentLoaded", async () => {
    await fetchPluginConfig();
    if(!pluginConfig) return; 
    announceConfig('enhanced-tuning:ready');

    initAdminPanel();

    loadPluginStylesheet()
      .then(() => initializePlugin())
      .catch(error => console.error("[Enhanced Tuning] Error under lasting:", error));
  });
})();
