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
    currentSpeed: 0,

    flightState: "WAITING",
    takeoffAltitude: 0,
    takeoffTime: null,
    landingDetectionStartTime: null,
    landingDetectionAltitude: null,

    flightStartTime: null,
    maxAltitude: 0,
    maxAltitudeGain: 0,

    thermalHistory: [],
    currentThermal: null,
    thermalStartAltitude: null,
    thermalStartTime: null,
    inThermal: false,
    thermalIndicator: null,

    flightStateIndicator: null,
    flightDurationWidget: null,
    altitudeWidget: null,
    gainWidget: null,
    maxAltWidget: null,
  },

  config: {
    deadband: 0.2,
    animationInterval: 100,

    takeoff: {
      minGroundSpeed: 10,
      minVerticalSpeed: 0.5,
      minAltitudeGain: 5,
    },

    landing: {
      maxGroundSpeed: 5,
      maxVerticalSpeed: 0.3,
      maxAltitudeChange: 2,
      confirmationTime: 10000,
    },

    thresholds: {
      climbWeak: 0.2,
      climbMedium: 1.0,
      climbStrong: 2.0,
      climbExceptional: 3.5,
      sink: -0.5,
      sinkStrong: -2.0,
    },

    thermal: {
      minClimbRate: 0.5,
      minDuration: 10000,
      minAltitudeGain: 20,
      exitClimbRate: 0.2,
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
        takeoff: { duration: 300, count: 3, gap: 200, interval: 0 },
        landing: { duration: 500, count: 2, gap: 300, interval: 0 },
      },
    },

    colors: {
      neutral: 0x000000,
      waiting: 0xffff00,
      flying: 0x00ff00,
      landed: 0xff8800,
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

    // Fond noir pur
    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000,
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

    // === ÉTAT VOL (centre haut) ===
    this.state.flightStateIndicator = createWidget(widget.TEXT, {
      x: 0,
      y: 25,
      w: 480,
      h: 30,
      text: "⏸️ WAITING",
      text_size: 18,
      color: 0xffff00,
      align_h: align.CENTER_H,
    });

    // === DURÉE VOL ===
    this.state.flightDurationWidget = createWidget(widget.TEXT, {
      x: 0,
      y: 55,
      w: 480,
      h: 28,
      text: "00:00",
      text_size: 20,
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    // === ALTITUDE (gauche) ===
    this.state.altitudeWidget = createWidget(widget.TEXT, {
      x: 70,
      y: 95,
      w: 85,
      h: 80,
      text: "---",
      text_size: 36,
      color: 0xffffff,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    });

    createWidget(widget.TEXT, {
      text: "m",
      x: 70,
      y: 170,
      w: 85,
      h: 18,
      text_size: 14,
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === GAIN ALTITUDE (droite haut) ===
    createWidget(widget.TEXT, {
      text: "↗",
      x: 325,
      y: 95,
      w: 85,
      h: 22,
      text_size: 18,
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    this.state.gainWidget = createWidget(widget.TEXT, {
      x: 325,
      y: 117,
      w: 85,
      h: 35,
      text: "+0m",
      text_size: 24,
      color: 0x00ff00,
      align_h: align.CENTER_H,
    });

    // === ALTITUDE MAX (droite bas) ===
    createWidget(widget.TEXT, {
      text: "MAX",
      x: 325,
      y: 150,
      w: 85,
      h: 18,
      text_size: 12,
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    this.state.maxAltWidget = createWidget(widget.TEXT, {
      x: 325,
      y: 168,
      w: 85,
      h: 28,
      text: "0m",
      text_size: 18,
      color: 0xff8800,
      align_h: align.CENTER_H,
    });

    // === INDICATEUR THERMIQUE (centre) ===
    this.state.thermalIndicator = createWidget(widget.TEXT, {
      x: 160,
      y: 90,
      w: 160,
      h: 55,
      text: "",
      text_size: 13,
      color: 0x00ff00,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    });

    // === CHEVRONS (centre) ===
    this.state.chevrons = [];
    for (let i = 0; i < 3; i++) {
      this.state.chevrons.push(
        createWidget(widget.IMG, {
          x: 220,
          y: 150 + i * 30,
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
      y: 250,
      w: 480,
      h: 90,
      text_size: 85,
      color: 0xffffff,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
    });

    createWidget(widget.TEXT, {
      text: "m/s",
      x: 0,
      y: 335,
      w: 480,
      h: 22,
      text_size: 18,
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === NOMBRE THERMIQUES (centre) ===
    createWidget(widget.TEXT, {
      text: "🌀",
      x: 170,
      y: 360,
      w: 35,
      h: 28,
      text_size: 22,
      color: 0xffffff,
      align_h: align.CENTER_H,
    });

    this.state.thermalCountWidget = createWidget(widget.TEXT, {
      x: 205,
      y: 360,
      w: 110,
      h: 28,
      text: "0 thermals",
      text_size: 15,
      color: 0xcccccc,
      align_h: align.LEFT,
    });

    // === VITESSE SOL (en bas gauche) ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.SPEED,
      x: 80,
      y: 395,
      w: 150,
      h: 45,
      text_size: 26,
      color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 150,
      text_h: 38,
      align_h: align.LEFT,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "km/h",
      x: 80,
      y: 435,
      w: 150,
      h: 18,
      text_size: 14,
      color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === DISTANCE (en bas droite) ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 3,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.DISTANCE_TOTAL,
      x: 250,
      y: 395,
      w: 150,
      h: 45,
      text_size: 26,
      color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 150,
      text_h: 38,
      align_h: align.RIGHT,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "km",
      x: 250,
      y: 435,
      w: 150,
      h: 18,
      text_size: 14,
      color: 0xcccccc,
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
          this.state.flightState === "FLYING" &&
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
    this.state.flightState = "WAITING";

    console.log("[detectAndStart] === START ===");
    console.log("[detectAndStart] ⏸️ Waiting for takeoff...");

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
      console.log(
        `[monitoringLoop] STOP (active=${this.state.monitoringActive})`,
      );
      return;
    }

    if (this.state.isSimulation) {
      const mockVSpeed = (Math.random() - 0.5) * 8;

      if (this.state.vSpeedWidget) {
        this.state.vSpeedWidget.setProperty(prop.MORE, {
          text: mockVSpeed.toFixed(2),
        });
      }

      this.state.currentAltitude = 1000 + Math.random() * 100;
      this.state.currentSpeed = 25 + Math.random() * 20;

      this.updateFeedback(mockVSpeed);
    } else {
      this.fetchRealData();
    }

    this.detectFlightState();

    if (this.state.flightState === "FLYING") {
      this.updateFlightDuration();
    }

    this.updateAltitudeDisplay();

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
    getSportData({ type: "vertical_speed" }, (callbackResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed = JSON.parse(callbackResult.data);

          if (parsed && parsed[0] && parsed[0].vertical_speed !== undefined) {
            const rawValue = parseFloat(parsed[0].vertical_speed);
            const vSpeed = rawValue / 100;

            if (this.state.vSpeedWidget) {
              this.state.vSpeedWidget.setProperty(prop.MORE, {
                text: vSpeed.toFixed(2),
              });
            }

            this.updateFeedback(vSpeed);
          }
        } catch (error) {
          console.log(`[fetchRealData] VSpeed error: ${error}`);
        }
      }
    });

    getSportData({ type: "altitude" }, (callbackResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed = JSON.parse(callbackResult.data);
          if (parsed && parsed[0] && parsed[0].altitude !== undefined) {
            this.state.currentAltitude = parseFloat(parsed[0].altitude);
          }
        } catch (error) {
          console.log(`[fetchRealData] Altitude error: ${error}`);
        }
      }
    });

    getSportData({ type: "speed" }, (callbackResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed = JSON.parse(callbackResult.data);
          if (parsed && parsed[0] && parsed[0].speed !== undefined) {
            this.state.currentSpeed = parseFloat(parsed[0].speed) * 3.6;
          }
        } catch (error) {
          console.log(`[fetchRealData] Speed error: ${error}`);
        }
      }
    });
  },

  updateAltitudeDisplay() {
    if (!this.state.altitudeWidget) return;

    const alt = Math.round(this.state.currentAltitude);
    this.state.altitudeWidget.setProperty(prop.MORE, {
      text: alt.toString(),
    });

    if (this.state.flightState === "FLYING") {
      const gain = this.state.currentAltitude - this.state.takeoffAltitude;

      if (this.state.gainWidget) {
        const gainColor = gain >= 0 ? 0x00ff00 : 0xff0000;
        this.state.gainWidget.setProperty(prop.MORE, {
          text: `${gain >= 0 ? '+' : ''}${Math.round(gain)}m`,
          color: gainColor,
        });
      }

      if (this.state.maxAltWidget) {
        this.state.maxAltWidget.setProperty(prop.MORE, {
          text: `${Math.round(this.state.maxAltitude)}m`,
        });
      }
    } else {
      if (this.state.gainWidget) {
        this.state.gainWidget.setProperty(prop.MORE, {
          text: "+0m",
          color: 0x00ff00,
        });
      }

      if (this.state.maxAltWidget) {
        this.state.maxAltWidget.setProperty(prop.MORE, {
          text: "0m",
        });
      }
    }
  },

  detectFlightState() {
    const currentAlt = this.state.currentAltitude;
    const vSpeed = this.state.lastVerticalSpeed;
    const gSpeed = this.state.currentSpeed;
    const now = Date.now();

    if (this.state.flightState === "WAITING") {
      if (this.state.takeoffAltitude === 0) {
        this.state.takeoffAltitude = currentAlt;
      }

      const altGain = currentAlt - this.state.takeoffAltitude;

      const isRunning = gSpeed > this.config.takeoff.minGroundSpeed;
      const isClimbing = vSpeed > this.config.takeoff.minVerticalSpeed;
      const hasGainedAlt = altGain > this.config.takeoff.minAltitudeGain;

      if (isRunning || (isClimbing && hasGainedAlt)) {
        console.log(
          `[FlightState] 🚀 TAKEOFF! Speed:${gSpeed.toFixed(1)}km/h VSpeed:${vSpeed.toFixed(1)}m/s Gain:${altGain.toFixed(1)}m`,
        );

        this.state.flightState = "FLYING";
        this.state.flightStartTime = now;
        this.state.takeoffAltitude = currentAlt;
        this.state.maxAltitude = currentAlt;

        if (this.state.vibrator) {
          this.executeVibrationPattern(this.config.vibration.patterns.takeoff);
        }
        this.flashTakeoff();

        if (this.state.flightStateIndicator) {
          this.state.flightStateIndicator.setProperty(prop.MORE, {
            text: "✈️ FLYING",
            color: 0x00ff00,
          });
        }
      }
    } else if (this.state.flightState === "FLYING") {
      if (currentAlt > this.state.maxAltitude) {
        this.state.maxAltitude = currentAlt;
      }

      const isSlowSpeed = gSpeed < this.config.landing.maxGroundSpeed;
      const isNotClimbing =
        Math.abs(vSpeed) < this.config.landing.maxVerticalSpeed;

      if (isSlowSpeed && isNotClimbing) {
        if (!this.state.landingDetectionStartTime) {
          this.state.landingDetectionStartTime = now;
          this.state.landingDetectionAltitude = currentAlt;
          console.log("[FlightState] 🛬 Landing detection started...");
        } else {
          const detectionDuration = now - this.state.landingDetectionStartTime;
          const altChange = Math.abs(
            currentAlt - this.state.landingDetectionAltitude,
          );

          if (
            detectionDuration > this.config.landing.confirmationTime &&
            altChange < this.config.landing.maxAltitudeChange
          ) {
            console.log(
              `[FlightState] 🛬 LANDED! ${(detectionDuration/1000).toFixed(0)}s on ground`,
            );

            this.state.flightState = "LANDED";

            if (this.state.vibrator) {
              this.executeVibrationPattern(
                this.config.vibration.patterns.landing,
              );
            }

            if (this.state.flightStateIndicator) {
              this.state.flightStateIndicator.setProperty(prop.MORE, {
                text: "🛬 LANDED",
                color: 0xff8800,
              });
            }
          }
        }
      } else {
        this.state.landingDetectionStartTime = null;
        this.state.landingDetectionAltitude = null;
      }
    }
  },

  flashTakeoff() {
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

  updateFlightDuration() {
    if (!this.state.flightStartTime || !this.state.flightDurationWidget) {
      return;
    }

    const duration = Date.now() - this.state.flightStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    this.state.flightDurationWidget.setProperty(prop.MORE, {
      text: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
    });
  },

  updateFeedback(vSpeed) {
    this.state.lastVerticalSpeed = vSpeed;

    if (this.state.flightState === "FLYING") {
      this.detectThermal(vSpeed);
      this.updateChevrons(vSpeed);
      this.handleVibration(vSpeed);
      this.playVariometerSound(vSpeed);
    } else {
      this.updateChevrons(0);
    }
  },

  detectThermal(vSpeed) {
    const now = Date.now();

    if (!this.state.inThermal) {
      if (vSpeed >= this.config.thermal.minClimbRate) {
        console.log("[Thermal] ✅ ENTERING");
        this.state.inThermal = true;
        this.state.thermalStartTime = now;
        this.state.thermalStartAltitude = this.state.currentAltitude;

        this.state.currentThermal = {
          startTime: now,
          startAltitude: this.state.currentAltitude,
          maxClimbRate: vSpeed,
          samples: [vSpeed],
        };

        if (this.state.vibrator) {
          this.executeVibrationPattern(
            this.config.vibration.patterns.thermalEntry,
          );
        }
        this.flashThermalEntry();
      }
    } else {
      if (vSpeed < this.config.thermal.exitClimbRate) {
        const duration = now - this.state.thermalStartTime;
        const altitudeGain =
          this.state.currentAltitude - this.state.thermalStartAltitude;

        console.log(
          `[Thermal] ❌ EXITING - ${(duration/1000).toFixed(1)}s, +${altitudeGain.toFixed(0)}m`,
        );

        if (
          duration >= this.config.thermal.minDuration &&
          altitudeGain >= this.config.thermal.minAltitudeGain
        ) {
          const samples = this.state.currentThermal.samples;
          const avgClimbRate =
            samples.reduce((a, b) => a + b, 0) / samples.length;

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
          console.log(`[Thermal] 🌀 SAVED +${altitudeGain.toFixed(0)}m`);

          if (this.state.thermalHistory.length > 10) {
            this.state.thermalHistory.shift();
          }

          this.updateThermalCount();
        }

        this.state.inThermal = false;
        this.state.currentThermal = null;
      } else {
        this.state.currentThermal.samples.push(vSpeed);
        this.state.currentThermal.maxClimbRate = Math.max(
          this.state.currentThermal.maxClimbRate,
          vSpeed,
        );
      }
    }

    this.updateThermalIndicator();
  },

  updateThermalIndicator() {
    if (!this.state.thermalIndicator) return;

    if (this.state.inThermal) {
      const duration = (Date.now() - this.state.thermalStartTime) / 1000;
      const gain = this.state.currentAltitude - this.state.thermalStartAltitude;

      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: `🌀 THERMALn+${gain.toFixed(0)}m  ${duration.toFixed(0)}s`,
        color: 0x00ff00,
      });
    } else {
      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: "",
      });
    }
  },

  updateThermalCount() {
    if (!this.state.thermalCountWidget) return;

    const count = this.state.thermalHistory.length;
    const text =
      count === 0
        ? "0 thermals"
        : count === 1
          ? "1 thermal"
          : `${count} thermals`;

    this.state.thermalCountWidget.setProperty(prop.MORE, {
      text: text,
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

  updateChevrons(vSpeed) {
    if (!this.state.chevrons) return;

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
          alpha: 2 - i < numChevrons ? 255 : 50,
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
        let baseY = 150 + i * 30;

        if (vSpeed > this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY - Math.abs(offset) });
        } else if (vSpeed < -this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY + Math.abs(offset) });
        }
      });
    }

    if (this.state.leftBar && this.state.rightBar) {
      if (this.state.flightState !== "FLYING" || this.state.inThermal) return;

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

      try {
        this.state.player.play(fullPath);
      } catch (error) {
        console.log(`[playVariometerSound] Error: ${error}`);
      }
    }
  },
});
