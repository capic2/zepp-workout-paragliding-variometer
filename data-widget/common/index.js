import {
  createWidget,
  widget,
  align,
  text_style,
  sport_data,
  edit_widget_group_type,
  prop,
} from "@zos/ui";
import { getSportData } from "@zos/app-access";
import { SoundPlayer } from "@silver-zepp/easy-media";
import { Vibrator } from "@zos/sensor";
import {
  pauseDropWristScreenOff,
  pausePalmScreenOff,
  setWakeUpRelaunch,
} from "@zos/display";
import { log } from "@zos/utils";

DataWidget({
  state: {
    logger: null,
    animationInterval: null,
    monitoringInterval: null,
    monitoringActive: false,
    isActive: false,
    isSimulation: false,
    player: null,
    vibrator: null,
    currentSound: null,
    lastVerticalSpeed: 0,
    animationPhase: 0,
    lastVibrationTime: 0,
    leftBar: null,
    rightBar: null,
    chevrons: [],
    vSpeedWidget: null,
    currentAltitude: 0,
    thermalHistory: [],
    currentThermal: null,
    thermalStartAltitude: null,
    thermalStartTime: null,
    inThermal: false,
    thermalIndicator: null,
    statsWidget: null,
  },

  config: {
    deadband: 0.2,
    animationInterval: 100,

    thresholds: {
      climbWeak: 0.2,
      climbMedium: 1.0,
      climbStrong: 2.0,
      climbExceptional: 3.5,
      sink: -0.5,
      sinkStrong: -2.0,
    },

    thermal: {
      minClimbRate: 0.5,        // m/s minimum pour considérer un thermique
      minDuration: 10000,       // 10 secondes minimum
      minAltitudeGain: 20,      // 20m minimum de gain
      exitClimbRate: 0.2,       // Sortie du thermique si < 0.2 m/s
    },

    vibration: {
      enabled: true,
      patterns: {
        climbWeak: { duration: 100, interval: 2000 },
        climbMedium: { duration: 100, count: 2, gap: 100, interval: 1500 },
        climbStrong: { duration: 100, count: 3, gap: 80, interval: 1000 },
        climbExceptional: { duration: 200, count: 4, gap: 50, interval: 800 },
        sink: { duration: 300, interval: 3000 },
        sinkStrong: { duration: 400, count: 2, gap: 200, interval: 2000 },
        thermalEntry: { duration: 200, count: 3, gap: 100, interval: 0 },
      },
    },

    colors: {
      neutral: 0x1a1a1a,
    },

    climb: [
      { threshold: 0.2, sound: "climb_1.mp3" },
      { threshold: 0.5, sound: "climb_2.mp3" },
      { threshold: 1.0, sound: "climb_3.mp3" },
      { threshold: 1.5, sound: "climb_4.mp3" },
      { threshold: 2.0, sound: "climb_5.mp3" },
      { threshold: 3.0, sound: "climb_6.mp3" },
      { threshold: 4.0, sound: "climb_7.mp3" },
    ],
    sink: [
      { threshold: -0.2, sound: "sink_1.mp3" },
      { threshold: -1.0, sound: "sink_2.mp3" },
      { threshold: -2.0, sound: "sink_3.mp3" },
      { threshold: -3.0, sound: "sink_4.mp3" },
    ],
  },

  onInit() {
    this.state.logger = log.getLogger("ParaVario");
    console.log("=== LIFECYCLE: onInit ===");
  },

  build() {
    if (!this.state.logger) {
      this.state.logger = log.getLogger("ParaVario");
    }
    console.log("=== LIFECYCLE: build START ===");

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
      setWakeUpRelaunch({ relaunch: true });
      console.log("[build] Screen will stay ON");
    } catch (error) {
      console.log(`[build] Screen error: ${error}`);
    }

    // Fond
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: this.config.colors.neutral,
    });

    // Barres latérales
    this.state.leftBar = createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 60,
      h: 480,
      radius: 8,
      color: 0x333333,
    });

    this.state.rightBar = createWidget(widget.FILL_RECT, {
      x: 420,
      y: 0,
      w: 60,
      h: 480,
      color: 0x333333,
    });

    // === BOUTON STATS (haut gauche) ===
    createWidget(widget.BUTTON, {
      x: 10,
      y: 10,
      w: 80,
      h: 40,
      text: "📊",
      text_size: 24,
      radius: 8,
      normal_color: 0x333333,
      press_color: 0x555555,
      click_func: () => {
        this.showThermalHistory();
      },
    });

    // === ALTITUDE (haut centre) ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.ALTITUDE,
      x: 140,
      y: 15,
      w: 200,
      h: 40,
      text_size: 32,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 200,
      text_h: 35,
      align_h: align.CENTER_H,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "m",
      x: 0,
      y: 50,
      w: 480,
      h: 18,
      text_size: 16,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === INDICATEUR THERMIQUE (haut droite) ===
    this.state.thermalIndicator = createWidget(widget.TEXT, {
      x: 320,
      y: 10,
      w: 150,
      h: 60,
      text: "",
      text_size: 16,
      text_color: 0x00ff00,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    });

    // === CHEVRONS ===
    this.state.chevrons = [];
    for (let i = 0; i < 3; i++) {
      this.state.chevrons.push(
          createWidget(widget.IMG, {
            x: 220,
            y: 80 + i * 30,
            w: 40,
            h: 40,
            src: "chevron_neutral.png",
            alpha: 100,
          }),
      );
    }

    // === VITESSE VERTICALE (centre) ===
    this.state.vSpeedWidget = createWidget(widget.TEXT, {
      text: "---",
      x: 0,
      y: 180,
      w: 480,
      h: 120,
      text_size: 100,
      text_color: 0xffffff,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    });

    createWidget(widget.TEXT, {
      text: "m/s",
      x: 0,
      y: 290,
      w: 480,
      h: 30,
      text_size: 24,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === STATS THERMIQUES (milieu gauche) ===
    this.state.statsWidget = createWidget(widget.TEXT, {
      text: "Thermals: 0",
      x: 70,
      y: 330,
      w: 150,
      h: 40,
      text_size: 14,
      text_color: 0x888888,
      align_h: align.LEFT,
      text_style: text_style.WRAP,
    });

    // === VITESSE SOL ET DISTANCE (en bas) ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.SPEED,
      x: 60,
      y: 380,
      w: 170,
      h: 60,
      text_size: 32,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 170,
      text_h: 50,
      align_h: align.LEFT,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "km/h",
      x: 60,
      y: 430,
      w: 170,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    createWidget(widget.SPORT_DATA, {
      edit_id: 3,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.DISTANCE_TOTAL,
      x: 250,
      y: 380,
      w: 170,
      h: 60,
      text_size: 32,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 170,
      text_h: 50,
      align_h: align.RIGHT,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "km",
      x: 250,
      y: 430,
      w: 170,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    this.initAudioPlayer();
    this.initVibrator();

    console.log("=== LIFECYCLE: build END ===");

    this.detectAndStart();
  },

  initAudioPlayer() {
    try {
      console.log("[initAudioPlayer] Start");
      this.state.player = new SoundPlayer();
      this.state.player.set.volume(100);

      this.state.player.onComplete((info) => {
        if (
            this.state.isActive &&
            Math.abs(this.state.lastVerticalSpeed) > this.config.deadband
        ) {
          setTimeout(() => {
            if (this.state.isActive) {
              this.playVariometerSound(this.state.lastVerticalSpeed);
            }
          }, 50);
        }
      });

      this.state.player.onFail((info) => {
        console.log(`[initAudioPlayer] Failed: ${info.name}`);
      });

      console.log("[initAudioPlayer] OK");
    } catch (error) {
      console.log(`[initAudioPlayer] Error: ${error}`);
    }
  },

  initVibrator() {
    try {
      console.log("[initVibrator] Start");
      this.state.vibrator = new Vibrator();
      console.log("[initVibrator] OK");
    } catch (error) {
      console.log(`[initVibrator] Error: ${error}`);
    }
  },

  detectAndStart() {
    this.state.isActive = true;
    this.state.monitoringActive = true;
    console.log("[detectAndStart] === START ===");

    const testResult = getSportData(
        { type: "vertical_speed" },
        (callbackResult) => {
          console.log(`[detectAndStart] Callback: code=${callbackResult.code}`);
        },
    );

    console.log(`[detectAndStart] Result: ${testResult}`);

    if (testResult === true) {
      console.log("[detectAndStart] REAL DATA MODE");
      this.state.isSimulation = false;
    } else {
      console.log("[detectAndStart] SIMULATION MODE");
      this.state.isSimulation = true;
    }

    this.startAnimation();
    this.startMonitoring();

    console.log("[detectAndStart] === END ===");
  },

  startMonitoring() {
    console.log("[startMonitoring] START");

    if (this.state.monitoringInterval) {
      console.log("[startMonitoring] Already running");
      return;
    }

    this.state.monitoringActive = true;
    this.monitoringLoop();

    console.log("[startMonitoring] Loop started");
  },

  monitoringLoop() {
    if (!this.state.monitoringActive || !this.state.isActive) {
      console.log(`[monitoringLoop] STOP (active=${this.state.monitoringActive})`);
      return;
    }

    console.log("[monitoringLoop] TICK");

    if (this.state.isSimulation) {
      const mockVSpeed = (Math.random() - 0.5) * 8;
      console.log(`[monitoringLoop] SIM: ${mockVSpeed.toFixed(2)}`);

      if (this.state.vSpeedWidget) {
        this.state.vSpeedWidget.setProperty(prop.MORE, {
          text: mockVSpeed.toFixed(2),
        });
      }

      // Altitude simulée
      this.state.currentAltitude = 1000 + Math.random() * 100;

      this.updateFeedback(mockVSpeed);
    } else {
      this.fetchRealData();
    }

    this.state.monitoringInterval = setTimeout(() => {
      this.monitoringLoop();
    }, 500);
  },

  stopMonitoring() {
    console.log("[stopMonitoring] STOP");
    this.state.monitoringActive = false;

    if (this.state.monitoringInterval) {
      clearTimeout(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }
  },

  fetchRealData() {
    const fetchTime = Date.now();
    console.log(`[fetchRealData] >>> START at ${fetchTime}`);

    // Récupérer vitesse verticale
    getSportData({ type: "vertical_speed" }, (callbackResult) => {
      const callbackTime = Date.now();
      const { code, data } = callbackResult;

      console.log(`[fetchRealData] Callback after ${callbackTime - fetchTime}ms`);

      if (code === 0) {
        try {
          const parsed = JSON.parse(data);
          console.log(`[fetchRealData] Raw data: ${data}`);

          if (parsed && parsed[0] && parsed[0].vertical_speed !== undefined) {
            const rawValue = parseFloat(parsed[0].vertical_speed);

            const vSpeed1 = rawValue / 100;
            const vSpeed2 = (rawValue - 32768) / 100;
            const vSpeed3 = rawValue > 32768 ? (rawValue - 65536) / 100 : rawValue / 100;

            console.log("========================================");
            console.log(`Raw: ${rawValue}`);
            console.log(`÷100: ${vSpeed1.toFixed(2)}`);
            console.log(`-32768÷100: ${vSpeed2.toFixed(2)}`);
            console.log(`Unsigned: ${vSpeed3.toFixed(2)}`);
            console.log("========================================");

            const vSpeed = vSpeed1;

            if (this.state.vSpeedWidget) {
              this.state.vSpeedWidget.setProperty(prop.MORE, {
                text: vSpeed.toFixed(2),
              });
            }

            console.log(`VSpeed: ${vSpeed.toFixed(2)} m/s`);

            this.updateFeedback(vSpeed);
          }
        } catch (error) {
          console.log(`[fetchRealData] Error: ${error}`);
        }
      } else {
        console.log(`[fetchRealData] Code: ${code}`);
      }
    });

    // Récupérer altitude
    getSportData({ type: "altitude" }, (callbackResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed = JSON.parse(callbackResult.data);
          if (parsed && parsed[0] && parsed[0].altitude !== undefined) {
            this.state.currentAltitude = parseFloat(parsed[0].altitude);
            console.log(`[fetchRealData] Altitude: ${this.state.currentAltitude.toFixed(0)}m`);
          }
        } catch (error) {
          console.log(`[fetchRealData] Altitude error: ${error}`);
        }
      }
    });
  },

  updateFeedback(vSpeed) {
    console.log(`[updateFeedback] ${vSpeed.toFixed(2)} m/s`);
    this.state.lastVerticalSpeed = vSpeed;

    this.detectThermal(vSpeed);
    this.updateChevrons(vSpeed);
    this.handleVibration(vSpeed);
    this.playVariometerSound(vSpeed);
  },

  detectThermal(vSpeed) {
    const now = Date.now();

    if (!this.state.inThermal) {
      // Pas dans un thermique, chercher l'entrée
      if (vSpeed >= this.config.thermal.minClimbRate) {
        console.log("[detectThermal] ✅ ENTERING THERMAL");
        this.state.inThermal = true;
        this.state.thermalStartTime = now;
        this.state.thermalStartAltitude = this.state.currentAltitude;

        this.state.currentThermal = {
          startTime: now,
          startAltitude: this.state.currentAltitude,
          maxClimbRate: vSpeed,
          samples: [vSpeed],
        };

        // Vibration d'entrée en thermique
        if (this.state.vibrator) {
          this.executeVibrationPattern(this.config.vibration.patterns.thermalEntry);
        }

        // Flash visuel
        this.flashThermalEntry();
      }
    } else {
      // Dans un thermique
      if (vSpeed < this.config.thermal.exitClimbRate) {
        // Sortie du thermique
        const duration = now - this.state.thermalStartTime;
        const altitudeGain = this.state.currentAltitude - this.state.thermalStartAltitude;

        console.log(`[detectThermal] ❌ EXITING THERMAL - Duration: ${(duration/1000).toFixed(1)}s, Gain: ${altitudeGain.toFixed(0)}m`);

        // Vérifier si c'est un vrai thermique
        if (duration >= this.config.thermal.minDuration &&
            altitudeGain >= this.config.thermal.minAltitudeGain) {

          const samples = this.state.currentThermal.samples;
          const avgClimbRate = samples.reduce((a, b) => a + b, 0) / samples.length;

          const thermal = {
            startTime: this.state.thermalStartTime,
            endTime: now,
            duration: duration,
            startAltitude: this.state.thermalStartAltitude,
            endAltitude: this.state.currentAltitude,
            altitudeGain: altitudeGain,
            maxClimbRate: this.state.currentThermal.maxClimbRate,
            averageClimbRate: avgClimbRate,
          };

          this.state.thermalHistory.push(thermal);

          console.log(`[detectThermal] 🌀 THERMAL SAVED: +${altitudeGain.toFixed(0)}m, avg ${avgClimbRate.toFixed(1)} m/s`);

          // Garder les 10 derniers
          if (this.state.thermalHistory.length > 10) {
            this.state.thermalHistory.shift();
          }

          // Mettre à jour les stats
          this.updateThermalStats();
        } else {
          console.log("[detectThermal] ⚠️ Not a valid thermal (too short or too weak)");
        }

        this.state.inThermal = false;
        this.state.currentThermal = null;
      } else {
        // Toujours dans le thermique
        this.state.currentThermal.samples.push(vSpeed);
        this.state.currentThermal.maxClimbRate = Math.max(
            this.state.currentThermal.maxClimbRate,
            vSpeed
        );
      }
    }

    // Mettre à jour l'indicateur
    this.updateThermalIndicator();
  },

  updateThermalIndicator() {
    if (!this.state.thermalIndicator) return;

    if (this.state.inThermal) {
      const duration = (Date.now() - this.state.thermalStartTime) / 1000;
      const gain = this.state.currentAltitude - this.state.thermalStartAltitude;

      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: `🌀 THERMALn+${gain.toFixed(0)}mn${duration.toFixed(0)}s`,
        color: 0x00ff00,
      });
    } else {
      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: "",
      });
    }
  },

  updateThermalStats() {
    if (!this.state.statsWidget) return;

    if (this.state.thermalHistory.length === 0) {
      this.state.statsWidget.setProperty(prop.MORE, {
        text: "Thermals: 0",
      });
      return;
    }

    const totalGain = this.state.thermalHistory.reduce((sum, t) => sum + t.altitudeGain, 0);
    const avgGain = totalGain / this.state.thermalHistory.length;

    this.state.statsWidget.setProperty(prop.MORE, {
      text: `Thermals: ${this.state.thermalHistory.length}nAvg: +${avgGain.toFixed(0)}m`,
    });
  },

  flashThermalEntry() {
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      if (flashCount >= 6) {
        clearInterval(flashInterval);
        return;
      }

      if (this.state.leftBar && this.state.rightBar) {
        const color = flashCount % 2 === 0 ? 0x00ff00 : 0x333333;
        this.state.leftBar.setProperty(prop.MORE, { color: color });
        this.state.rightBar.setProperty(prop.MORE, { color: color });
      }

      flashCount++;
    }, 150);
  },

  showThermalHistory() {
    console.log("n=== 🌀 THERMAL HISTORY ===");

    if (this.state.thermalHistory.length === 0) {
      console.log("No thermals detected yet");
      console.log("=========================n");
      return;
    }

    this.state.thermalHistory.forEach((thermal, index) => {
      const date = new Date(thermal.startTime);
      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

      console.log(`nThermal #${index + 1} at ${timeStr}:`);
      console.log(`  Duration: ${(thermal.duration / 1000).toFixed(0)}s`);
      console.log(`  Altitude: ${thermal.startAltitude.toFixed(0)}m → ${thermal.endAltitude.toFixed(0)}m`);
      console.log(`  Gain: +${thermal.altitudeGain.toFixed(0)}m`);
      console.log(`  Avg climb: ${thermal.averageClimbRate.toFixed(1)} m/s`);
      console.log(`  Max climb: ${thermal.maxClimbRate.toFixed(1)} m/s`);
    });

    const totalGain = this.state.thermalHistory.reduce((sum, t) => sum + t.altitudeGain, 0);
    const avgGain = totalGain / this.state.thermalHistory.length;
    const totalDuration = this.state.thermalHistory.reduce((sum, t) => sum + t.duration, 0) / 1000;

    console.log(`n📊 STATISTICS:`);
    console.log(`  Total thermals: ${this.state.thermalHistory.length}`);
    console.log(`  Total gain: +${totalGain.toFixed(0)}m`);
    console.log(`  Average gain: +${avgGain.toFixed(0)}m`);
    console.log(`  Total time in thermals: ${totalDuration.toFixed(0)}s`);

    console.log("n=========================n");
  },

  updateChevrons(vSpeed) {
    if (!this.state.chevrons) {
      console.log("[updateChevrons] No chevrons");
      return;
    }

    if (vSpeed > this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron, i) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_up.png",
          alpha: i < numChevrons ? 255 : 50,
        });
      });
    } else if (vSpeed < -this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron, i) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_down.png",
          alpha: (2 - i) < numChevrons ? 255 : 50,
        });
      });
    } else {
      this.state.chevrons.forEach((chevron) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_neutral.png",
          alpha: 100,
        });
      });
    }
  },

  updateAnimations() {
    const vSpeed = this.state.lastVerticalSpeed;

    if (this.state.chevrons && Math.abs(vSpeed) > this.config.deadband) {
      const offset = Math.sin((this.state.animationPhase * Math.PI) / 5) * 5;

      this.state.chevrons.forEach((chevron, i) => {
        let baseY = 80 + i * 30;

        if (vSpeed > this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY - Math.abs(offset) });
        } else if (vSpeed < -this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY + Math.abs(offset) });
        }
      });
    }

    if (this.state.leftBar && this.state.rightBar) {
      // Ne pas animer si flash thermique en cours
      if (this.state.inThermal) return;

      let barColor = 0x333333;
      let barHeight = 480;
      let barY = 0;

      if (vSpeed > this.config.deadband) {
        const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
        const green = Math.floor(255 * intensity);
        barColor = green << 8;
        barHeight = Math.floor(480 * intensity);
        barY = 480 - barHeight;
        const animOffset = (this.state.animationPhase % 5) * 12;
        barY = Math.max(0, barY - animOffset);
      } else if (vSpeed < -this.config.deadband) {
        const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
        const red = Math.floor(255 * intensity);
        barColor = red << 16;
        barHeight = Math.floor(480 * intensity);
        const animOffset = (this.state.animationPhase % 5) * 12;
        barHeight = Math.min(480, barHeight + animOffset);
      }

      this.state.leftBar.setProperty(prop.MORE, {
        color: barColor,
        h: barHeight,
        y: barY,
      });
      this.state.rightBar.setProperty(prop.MORE, {
        color: barColor,
        h: barHeight,
        y: barY,
      });
    }
  },

  onResume() {
    console.log("=== LIFECYCLE: onResume ===");
    this.state.isActive = true;

    if (this.state.monitoringActive && !this.state.monitoringInterval) {
      console.log("[onResume] Restarting monitoring");
      this.monitoringLoop();
    }

    if (!this.state.animationInterval) {
      console.log("[onResume] Restarting animations");
      this.startAnimation();
    }

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
    } catch (error) {
      console.log(`[onResume] Error: ${error}`);
    }
  },

  onPause() {
    console.log("=== LIFECYCLE: onPause ===");

    if (this.state.monitoringInterval) {
      console.log("[onPause] Clearing monitoring");
      clearTimeout(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }

    if (this.state.animationInterval) {
      console.log("[onPause] Clearing animations");
      clearInterval(this.state.animationInterval);
      this.state.animationInterval = null;
    }
  },

  onDestroy() {
    console.log("=== LIFECYCLE: onDestroy ===");

    // Afficher un résumé final
    if (this.state.thermalHistory.length > 0) {
      this.showThermalHistory();
    }

    this.state.isActive = false;
    this.state.monitoringActive = false;

    this.stopMonitoring();
    this.stopAnimation();

    if (this.state.player) {
      this.state.player.destroy();
    }

    if (this.state.vibrator) {
      this.state.vibrator.stop();
    }

    try {
      pauseDropWristScreenOff({ duration: 1 });
      pausePalmScreenOff({ duration: 1 });
    } catch (error) {
      console.log(`[onDestroy] Error: ${error}`);
    }
  },

  startAnimation() {
    if (this.state.animationInterval) {
      return;
    }

    console.log("[startAnimation] Starting");

    this.state.animationInterval = setInterval(() => {
      if (this.state.isActive) {
        this.state.animationPhase = (this.state.animationPhase + 1) % 10;
        this.updateAnimations();
      }
    }, this.config.animationInterval);
  },

  stopAnimation() {
    if (this.state.animationInterval) {
      clearInterval(this.state.animationInterval);
      this.state.animationInterval = null;
      console.log("[stopAnimation] Stopped");
    }
  },

  handleVibration(vSpeed) {
    if (!this.config.vibration.enabled || !this.state.vibrator) {
      return;
    }

    const now = Date.now();
    const vib = this.config.vibration;
    const thresh = this.config.thresholds;
    let pattern = null;
    let shouldVibrate = false;

    if (vSpeed >= thresh.climbExceptional) {
      pattern = vib.patterns.climbExceptional;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    } else if (vSpeed >= thresh.climbStrong) {
      pattern = vib.patterns.climbStrong;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    } else if (vSpeed >= thresh.climbMedium) {
      pattern = vib.patterns.climbMedium;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    } else if (vSpeed >= thresh.climbWeak) {
      pattern = vib.patterns.climbWeak;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    } else if (vSpeed <= thresh.sinkStrong) {
      pattern = vib.patterns.sinkStrong;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    } else if (vSpeed <= thresh.sink) {
      pattern = vib.patterns.sink;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern.interval;
    }

    if (shouldVibrate && pattern) {
      this.state.lastVibrationTime = now;
      this.executeVibrationPattern(pattern);
    }
  },

  executeVibrationPattern(pattern) {
    if (!this.state.vibrator) {
      return;
    }

    const count = pattern.count || 1;
    const duration = pattern.duration;
    const gap = pattern.gap || 0;

    this.state.vibrator.start();
    setTimeout(() => {
      this.state.vibrator.stop();
    }, duration);

    if (count > 1) {
      for (let i = 1; i < count; i++) {
        setTimeout(
            () => {
              this.state.vibrator.start();
              setTimeout(() => {
                this.state.vibrator.stop();
              }, duration);
            },
            i * (duration + gap),
        );
      }
    }
  },

  playVariometerSound(vSpeed) {
    if (!this.state.player) {
      return;
    }

    let soundFile = null;

    if (Math.abs(vSpeed) < this.config.deadband) {
      if (this.state.player.get.isPlaying()) {
        this.state.player.stop();
      }
      this.state.currentSound = null;
      return;
    }

    if (vSpeed > 0) {
      for (let i = this.config.climb.length - 1; i >= 0; i--) {
        if (vSpeed >= this.config.climb[i].threshold) {
          soundFile = this.config.climb[i].sound;
          break;
        }
      }
    } else {
      for (let i = this.config.sink.length - 1; i >= 0; i--) {
        if (vSpeed <= this.config.sink[i].threshold) {
          soundFile = this.config.sink[i].sound;
          break;
        }
      }
    }

    if (soundFile && soundFile !== this.state.currentSound) {
      this.state.currentSound = soundFile;
      const fullPath = `raw/media/${soundFile}`;

      console.log(`[playVariometerSound] Playing: ${fullPath}`);

      try {
        this.state.player.play(fullPath);
      } catch (error) {
        console.log(`[playVariometerSound] Error: ${error}`);
      }
    }
  },
});