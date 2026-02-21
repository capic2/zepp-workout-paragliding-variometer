import {
  createWidget,
  widget,
  align,
  text_style,
  sport_data,
  edit_widget_group_type,
  prop,
  event,
} from "@zos/ui";
import { getSportData } from "@zos/app-access";
import { Vibrator, Accelerometer } from "@zos/sensor";
import {
  pauseDropWristScreenOff,
  pausePalmScreenOff,
  setWakeUpRelaunch,
} from "@zos/display";
import { create, id } from "@zos/media";

import type {
  VariometerState,
  VariometerConfig,
  VibrationPattern,
  ThermalData,
  CurrentThermal,
  SportDataResult,
  VerticalSpeedData,
  AltitudeData,
  SpeedData,
  AccelerometerData,
  ZeppWidget,
} from "./types";

const globalNativePlayer = create(id.PLAYER);

DataWidget({
  state: {
    animationInterval: null,
    monitoringInterval: null,
    monitoringActive: false,
    isActive: false,
    isSimulation: false,
    isTestMode: false,
    testVSpeed: 0,
    vibrator: null,
    accelerometer: null,
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
    lastAltitude: 0,
    altitudeHistory: [],

    flightState: "WAITING",
    takeoffAltitude: 0,
    landingDetectionStartTime: null,
    landingDetectionAltitude: null,

    flightStartTime: null,
    maxAltitude: 0,

    thermalHistory: [],
    currentThermal: null,
    thermalStartAltitude: null,
    thermalStartTime: null,
    inThermal: false,
    thermalIndicator: null,
    thermalCountWidget: null,

    // Accéléromètre : composante verticale pour déterminer le signe de vSpeed
    verticalAccelZ: null,
    accelBaselineZ: null,

    flightStateIndicator: null,
    flightDurationWidget: null,
    altitudeWidget: null,
    gainWidget: null,
    maxAltWidget: null,

    // Widgets mode test
    testPanel: null,
    testButtonClimb: null,
    testButtonSink: null,
    testButtonSound: null,
    testButtonVibration: null,
    testTitle: null,
    testInstruction: null,
    testButtonReset: null,
    _testPanelListenersAdded: false,
  } as VariometerState,

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
        test: { duration: 200, count: 2, gap: 100, interval: 0 },
      },
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
  } as VariometerConfig,

  onInit(): void {
    console.log("=== LIFECYCLE: onInit ===");
  },

  build(): void {
    console.log("=== LIFECYCLE: build START ===");

    if (globalNativePlayer) {
      console.log("[build] ✅ Native player available");
    } else {
      console.log("[build] ⚠️ Native player not available");
    }

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
      setWakeUpRelaunch({ relaunch: true });
      console.log("[build] Screen will stay ON");
    } catch (error) {
      console.log(`[build] Screen error: ${error}`);
    }

    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000,
    });

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
      rect_visible: 0,
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
      rect_visible: 0,
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

    const touchArea = createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x000000,
      alpha: 0,
    });

    let touchStartTime = 0;

    touchArea.addEventListener(event.CLICK_DOWN, () => {
      touchStartTime = Date.now();
      console.log("[Touch] Down");
    });

    touchArea.addEventListener(event.CLICK_UP, () => {
      const touchDuration = Date.now() - touchStartTime;
      console.log(`[Touch] Up - Duration: ${touchDuration}ms`);

      if (touchDuration > 2000) {
        console.log("[TEST] Long press detected - Entering test mode");
        this.enterTestMode();
      }
    });

    this.buildTestPanel();

    this.initNativeAudioPlayer();
    this.initVibrator();
    this.initAccelerometer();

    console.log("=== LIFECYCLE: build END ===");

    this.detectAndStart();
  },

  buildTestPanel(): void {
    this.state.testPanel = createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: 0x222222,
    });
    this.state.testPanel.setProperty(prop.VISIBLE, false);

    this.state.testTitle = createWidget(widget.TEXT, {
      x: 0,
      y: 30,
      w: 480,
      h: 40,
      text: "🧪 MODE TEST",
      text_size: 28,
      color: 0xffff00,
      align_h: align.CENTER_H,
    });
    this.state.testTitle.setProperty(prop.VISIBLE, false);

    this.state.testInstruction = createWidget(widget.TEXT, {
      x: 0,
      y: 420,
      w: 480,
      h: 30,
      text: "Appui long pour quitter",
      text_size: 14,
      color: 0x888888,
      align_h: align.CENTER_H,
    });
    this.state.testInstruction.setProperty(prop.VISIBLE, false);

    // Bouton CLIMB +2m/s
    this.state.testButtonClimb = createWidget(widget.BUTTON, {
      x: 40,
      y: 100,
      w: 180,
      h: 80,
      radius: 15,
      normal_color: 0x00aa00,
      press_color: 0x008800,
      text: "⬆️ CLIMB\n+2.0 m/s",
      text_size: 20,
      click_func: () => {
        console.log("[TEST] Simulating CLIMB +2.0m/s");
        this.testVSpeed(2.0);
      },
    });
    this.state.testButtonClimb.setProperty(prop.VISIBLE, false);

    // Bouton SINK -2m/s
    this.state.testButtonSink = createWidget(widget.BUTTON, {
      x: 260,
      y: 100,
      w: 180,
      h: 80,
      radius: 15,
      normal_color: 0xaa0000,
      press_color: 0x880000,
      text: "⬇️ SINK\n-2.0 m/s",
      text_size: 20,
      click_func: () => {
        console.log("[TEST] Simulating SINK -2.0m/s");
        this.testVSpeed(-2.0);
      },
    });
    this.state.testButtonSink.setProperty(prop.VISIBLE, false);

    // Bouton TEST SOUND
    this.state.testButtonSound = createWidget(widget.BUTTON, {
      x: 40,
      y: 200,
      w: 180,
      h: 80,
      radius: 15,
      normal_color: 0x0000aa,
      press_color: 0x000088,
      text: "🔊 SOUND\nClimb 3",
      text_size: 20,
      click_func: () => {
        this.testSound();
      },
    });
    this.state.testButtonSound.setProperty(prop.VISIBLE, false);

    // Bouton TEST VIBRATION
    this.state.testButtonVibration = createWidget(widget.BUTTON, {
      x: 260,
      y: 200,
      w: 180,
      h: 80,
      radius: 15,
      normal_color: 0xaa00aa,
      press_color: 0x880088,
      text: "📳 VIBRATE\nTest",
      text_size: 20,
      click_func: () => {
        console.log("[TEST] Testing vibration");
        this.testVibration();
      },
    });
    this.state.testButtonVibration.setProperty(prop.VISIBLE, false);

    // Bouton RESET
    this.state.testButtonReset = createWidget(widget.BUTTON, {
      x: 140,
      y: 300,
      w: 200,
      h: 60,
      radius: 15,
      normal_color: 0x555555,
      press_color: 0x777777,
      text: "🔄 RESET\n0 m/s",
      text_size: 18,
      click_func: () => {
        console.log("[TEST] Reset to 0 m/s");
        this.testVSpeed(0);
      },
    });
    this.state.testButtonReset.setProperty(prop.VISIBLE, false);
  },

  enterTestMode(): void {
    if (this.state.isTestMode) return; // garde contre les appels multiples

    this.state.isTestMode = true;
    this.state.testVSpeed = 0;

    this.state.testPanel!.setProperty(prop.VISIBLE, true);
    this.state.testTitle!.setProperty(prop.VISIBLE, true);
    this.state.testInstruction!.setProperty(prop.VISIBLE, true);
    this.state.testButtonClimb!.setProperty(prop.VISIBLE, true);
    this.state.testButtonSink!.setProperty(prop.VISIBLE, true);
    this.state.testButtonSound!.setProperty(prop.VISIBLE, true);
    this.state.testButtonVibration!.setProperty(prop.VISIBLE, true);
    this.state.testButtonReset!.setProperty(prop.VISIBLE, true);

    // Les listeners ne sont enregistrés qu'une seule fois (lors du premier appel)
    if (!this.state._testPanelListenersAdded) {
      let touchStartTime = 0;

      this.state.testPanel!.addEventListener(event.CLICK_DOWN, () => {
        touchStartTime = Date.now();
        console.log("[TEST] Panel touch down");
      });

      this.state.testPanel!.addEventListener(event.CLICK_UP, () => {
        const touchDuration = Date.now() - touchStartTime;
        console.log(`[TEST] Panel touch up - Duration: ${touchDuration}ms`);

        if (touchDuration > 2000) {
          console.log("[TEST] Long press detected - Exiting test mode");
          this.exitTestMode();
        }
      });

      this.state._testPanelListenersAdded = true;
    }

    console.log("[TEST] Test mode ACTIVATED");
  },

  exitTestMode(): void {
    this.state.isTestMode = false;
    this.state.testVSpeed = 0;

    this.state.testPanel!.setProperty(prop.VISIBLE, false);
    this.state.testTitle!.setProperty(prop.VISIBLE, false);
    this.state.testInstruction!.setProperty(prop.VISIBLE, false);
    this.state.testButtonClimb!.setProperty(prop.VISIBLE, false);
    this.state.testButtonSink!.setProperty(prop.VISIBLE, false);
    this.state.testButtonSound!.setProperty(prop.VISIBLE, false);
    this.state.testButtonVibration!.setProperty(prop.VISIBLE, false);
    this.state.testButtonReset!.setProperty(prop.VISIBLE, false);

    // ✅ CORRIGER pour utiliser globalNativePlayer
    if (globalNativePlayer) {
      try {
        const status = globalNativePlayer.getStatus();
        if (status === globalNativePlayer.state.PLAY) {
          globalNativePlayer.stop();
        }
      } catch (e) {
        console.log(`[exitTestMode] Stop error: ${e}`);
      }
    }

    console.log("[TEST] Test mode DEACTIVATED");
  },

  testVSpeed(vSpeed: number): void {
    this.state.testVSpeed = vSpeed;
    this.state.lastVerticalSpeed = vSpeed;

    if (this.state.vSpeedWidget) {
      this.state.vSpeedWidget.setProperty(prop.MORE, {
        text: vSpeed.toFixed(2),
      });
    }

    this.updateChevrons(vSpeed);
    this.updateAnimations();
    this.playVariometerSound(vSpeed);

    console.log(`[TEST] VSpeed set to: ${vSpeed.toFixed(2)} m/s`);
  },

  testSound(): void {
    if (!globalNativePlayer) {
      console.log("[TEST] ❌ No player available");
      return;
    }

    // Forcer testVSpeed à une valeur positive pour que la boucle de monitoring
    // ne stoppe pas le son (deadband = 0.2, 0 < 0.2 → stop immédiat sinon)
    this.state.testVSpeed = 2.0;
    this.state.lastVerticalSpeed = 2.0;
    this.state.currentSound = null; // forcer la relecture même si même fichier

    console.log("[TEST] 🔊 Playing test sound via playVariometerSound(2.0)");
    this.playVariometerSound(2.0);
  },

  testVibration(): void {
    if (!this.state.vibrator) {
      console.log("[TEST] ❌ No vibrator available");
      return;
    }

    console.log("[TEST] 📳 Testing vibration");
    this.executeVibrationPattern(this.config.vibration.patterns.test);
    console.log("[TEST] ✅ Vibration test done");
  },

  initNativeAudioPlayer(): void {
    try {
      console.log("[initNativeAudioPlayer] START");

      if (!globalNativePlayer) {
        console.log("[initNativeAudioPlayer] ❌ No native player");
        return;
      }

      globalNativePlayer.setVolume(100);
      console.log("[initNativeAudioPlayer] Volume set to 100");

      // ✅ UTILISER ARROW FUNCTIONS
      globalNativePlayer.addEventListener(
        globalNativePlayer.event.PREPARE,
        (result: boolean) => {
          if (result) {
            console.log("[NativeAudio] ✅ Prepare success");
            globalNativePlayer.start();
          } else {
            console.log("[NativeAudio] ❌ Prepare fail");
            // Réinitialiser pour permettre une nouvelle tentative
            this.state.currentSound = null;
          }
        },
      );

      globalNativePlayer.addEventListener(
        globalNativePlayer.event.COMPLETE,
        () => {
          console.log("[NativeAudio] ✅ Complete - Audio finished");

          // Réinitialiser currentSound pour permettre la relance du même fichier
          this.state.currentSound = null;

          // Relancer le son si toujours en vol ou en mode test, hors deadband
          if (
            this.state.isActive &&
            (this.state.flightState === "FLYING" || this.state.isTestMode) &&
            Math.abs(this.state.lastVerticalSpeed) > this.config.deadband
          ) {
            console.log("[NativeAudio] 🔄 Will restart in 50ms");
            setTimeout(() => {
              if (this.state.isActive) {
                this.playVariometerSound(this.state.lastVerticalSpeed);
              }
            }, 50);
          }
        },
      );

      // ✅ AJOUTER événement ERROR
      globalNativePlayer.addEventListener(
        globalNativePlayer.event.PLAY,
        (result: boolean) => {
          if (result) {
            console.log("[NativeAudio] ✅ PLAY started successfully");
          } else {
            console.log(
              "[NativeAudio] ❌ PLAY failed (start() returned false)",
            );
          }
        },
      );

      globalNativePlayer.addEventListener(
        globalNativePlayer.event.ERROR,
        (error: unknown) => {
          console.log(`[NativeAudio] ❌ Error: ${error}`);
        },
      );

      console.log("[initNativeAudioPlayer] ✅ OK");
    } catch (error) {
      console.log(`[initAudioPlayer] ❌ Error: ${error}`);
    }
  },

  initVibrator(): void {
    try {
      console.log("[initVibrator] Start");
      this.state.vibrator = new Vibrator();
      console.log("[initVibrator] OK");
    } catch (error) {
      console.log(`[initVibrator] Error: ${error}`);
    }
  },

  initAccelerometer(): void {
    try {
      console.log("[initAccelerometer] Start");
      this.state.accelerometer = new Accelerometer();

      // Alpha très faible : la baseline suit lentement la composante statique de gravité.
      // La différence (data.z - baseline) représente uniquement l'accélération dynamique :
      //   > 0 → montée   < 0 → descente
      const BASELINE_ALPHA = 0.02;

      this.state.accelerometer.onChange((data: AccelerometerData) => {
        if (this.state.accelBaselineZ === null) {
          this.state.accelBaselineZ = data.z;
        } else {
          this.state.accelBaselineZ =
            this.state.accelBaselineZ * (1 - BASELINE_ALPHA) +
            data.z * BASELINE_ALPHA;
        }
        this.state.verticalAccelZ = data.z - this.state.accelBaselineZ;
      });

      this.state.accelerometer.start();
      console.log("[initAccelerometer] OK");
    } catch (error) {
      console.log(`[initAccelerometer] Error: ${error}`);
    }
  },

  detectAndStart(): void {
    this.state.isActive = true;
    this.state.monitoringActive = true;
    this.state.flightState = "WAITING";

    console.log("[detectAndStart] === START ===");
    console.log("[detectAndStart] ⏸️ Waiting for takeoff...");

    const testResult = getSportData(
      { type: "vertical_speed" },
      (callbackResult: SportDataResult) => {
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

  startMonitoring(): void {
    console.log("[startMonitoring] START");

    if (this.state.monitoringInterval) {
      console.log("[startMonitoring] Already running");
      return;
    }

    this.state.monitoringActive = true;
    this.monitoringLoop();

    console.log("[startMonitoring] Loop started");
  },

  monitoringLoop(): void {
    if (!this.state.monitoringActive || !this.state.isActive) {
      console.log(
        `[monitoringLoop] STOP (active=${this.state.monitoringActive})`,
      );
      return;
    }

    // Mode TEST : utiliser testVSpeed
    if (this.state.isTestMode) {
      const vSpeed = this.state.testVSpeed;

      if (this.state.vSpeedWidget) {
        this.state.vSpeedWidget.setProperty(prop.MORE, {
          text: vSpeed.toFixed(2),
        });
      }

      this.updateFeedback(vSpeed);
    }
    // Mode SIMULATION
    else if (this.state.isSimulation) {
      const mockVSpeed = (Math.random() - 0.5) * 8;

      if (this.state.vSpeedWidget) {
        this.state.vSpeedWidget.setProperty(prop.MORE, {
          text: mockVSpeed.toFixed(2),
        });
      }

      this.state.currentAltitude = 1000 + Math.random() * 100;
      // Vitesse sol faible pour ne pas déclencher le TAKEOFF automatiquement
      // (seuil minGroundSpeed = 10 km/h)
      this.state.currentSpeed = 3 + Math.random() * 5;

      this.updateFeedback(mockVSpeed);
    }
    // Mode RÉEL
    else {
      this.fetchRealData();
    }

    if (!this.state.isTestMode) {
      this.detectFlightState();

      if (this.state.flightState === "FLYING") {
        this.updateFlightDuration();
      }

      this.updateAltitudeDisplay();
    }

    this.state.monitoringInterval = setTimeout(() => {
      this.monitoringLoop();
    }, 500);
  },

  stopMonitoring(): void {
    console.log("[stopMonitoring] STOP");
    this.state.monitoringActive = false;

    if (this.state.monitoringInterval) {
      clearTimeout(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }
  },

  fetchRealData(): void {
    getSportData(
      { type: "vertical_speed" },
      (callbackResult: SportDataResult) => {
        if (callbackResult.code === 0) {
          try {
            const parsed: VerticalSpeedData[] = JSON.parse(callbackResult.data);

            if (parsed && parsed[0] && parsed[0].vertical_speed !== undefined) {
              const vSpeedMeterPerHour = parseFloat(
                String(parsed[0].vertical_speed),
              );
              const vSpeedMeterPerSecond = vSpeedMeterPerHour / 3600;

              let vSpeedWithSign = vSpeedMeterPerSecond;

              if (this.state.verticalAccelZ !== null) {
                // Signe déterminé par l'accéléromètre (plus réactif que l'altitude)
                vSpeedWithSign =
                  this.state.verticalAccelZ >= 0
                    ? Math.abs(vSpeedMeterPerSecond)
                    : -Math.abs(vSpeedMeterPerSecond);
              } else if (this.state.lastAltitude !== 0) {
                // Fallback : delta d'altitude
                const altDiff =
                  this.state.currentAltitude - this.state.lastAltitude;
                vSpeedWithSign =
                  altDiff < 0
                    ? -Math.abs(vSpeedMeterPerSecond)
                    : Math.abs(vSpeedMeterPerSecond);
              }

              console.log(
                `[VSpeed] Raw=${vSpeedMeterPerHour.toFixed(0)}m/h Final=${vSpeedWithSign.toFixed(2)}m/s`,
              );

              if (this.state.vSpeedWidget) {
                this.state.vSpeedWidget.setProperty(prop.MORE, {
                  text: vSpeedWithSign.toFixed(2),
                });
              }

              this.updateFeedback(vSpeedWithSign);
            }
          } catch (error) {
            console.log(`[fetchRealData] VSpeed error: ${error}`);
          }
        }
      },
    );

    getSportData({ type: "altitude" }, (callbackResult: SportDataResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed: AltitudeData[] = JSON.parse(callbackResult.data);
          if (parsed && parsed[0] && parsed[0].altitude !== undefined) {
            this.state.lastAltitude = this.state.currentAltitude;
            this.state.currentAltitude = parseFloat(String(parsed[0].altitude));

            this.state.altitudeHistory.push(this.state.currentAltitude);
            if (this.state.altitudeHistory.length > 5) {
              this.state.altitudeHistory.shift();
            }
          }
        } catch (error) {
          console.log(`[fetchRealData] Altitude error: ${error}`);
        }
      }
    });

    getSportData({ type: "speed" }, (callbackResult: SportDataResult) => {
      if (callbackResult.code === 0) {
        try {
          const parsed: SpeedData[] = JSON.parse(callbackResult.data);
          if (parsed && parsed[0] && parsed[0].speed !== undefined) {
            this.state.currentSpeed = parseFloat(String(parsed[0].speed)) * 3.6;
          }
        } catch (error) {
          console.log(`[fetchRealData] Speed error: ${error}`);
        }
      }
    });
  },

  updateAltitudeDisplay(): void {
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
          text: `${gain >= 0 ? "+" : ""}${Math.round(gain)}m`,
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

  detectFlightState(): void {
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
            currentAlt - this.state.landingDetectionAltitude!,
          );

          if (
            detectionDuration > this.config.landing.confirmationTime &&
            altChange < this.config.landing.maxAltitudeChange
          ) {
            console.log(
              `[FlightState] 🛬 LANDED! ${(detectionDuration / 1000).toFixed(0)}s on ground`,
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

  flashTakeoff(): void {
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

  updateFlightDuration(): void {
    if (!this.state.flightStartTime || !this.state.flightDurationWidget) {
      return;
    }

    const duration = Date.now() - this.state.flightStartTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    this.state.flightDurationWidget.setProperty(prop.MORE, {
      text: `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
    });
  },

  updateFeedback(vSpeed: number): void {
    this.state.lastVerticalSpeed = vSpeed;

    if (this.state.flightState === "FLYING" || this.state.isTestMode) {
      if (!this.state.isTestMode) {
        // detectThermal nécessite une altitude réelle — désactivé en mode test
        this.detectThermal(vSpeed);
      }
      this.updateChevrons(vSpeed);
      this.handleVibration(vSpeed);
      this.playVariometerSound(vSpeed);
    } else {
      this.updateChevrons(0);
    }
  },

  detectThermal(vSpeed: number): void {
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
        const duration = now - this.state.thermalStartTime!;
        const altitudeGain =
          this.state.currentAltitude - this.state.thermalStartAltitude!;

        console.log(
          `[Thermal] ❌ EXITING - ${(duration / 1000).toFixed(1)}s, +${altitudeGain.toFixed(0)}m`,
        );

        if (
          duration >= this.config.thermal.minDuration &&
          altitudeGain >= this.config.thermal.minAltitudeGain
        ) {
          const samples = this.state.currentThermal!.samples;
          const avgClimbRate =
            samples.reduce((a: number, b: number) => a + b, 0) / samples.length;

          const thermal: ThermalData = {
            startTime: this.state.thermalStartTime!,
            endTime: now,
            duration: duration,
            startAltitude: this.state.thermalStartAltitude!,
            endAltitude: this.state.currentAltitude,
            altitudeGain: altitudeGain,
            maxClimbRate: this.state.currentThermal!.maxClimbRate,
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
        this.state.currentThermal!.samples.push(vSpeed);
        this.state.currentThermal!.maxClimbRate = Math.max(
          this.state.currentThermal!.maxClimbRate,
          vSpeed,
        );
      }
    }

    this.updateThermalIndicator();
  },

  updateThermalIndicator(): void {
    if (!this.state.thermalIndicator) return;

    if (this.state.inThermal) {
      const duration = (Date.now() - this.state.thermalStartTime!) / 1000;
      const gain =
        this.state.currentAltitude - this.state.thermalStartAltitude!;

      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: `🌀 THERMAL\n+${gain.toFixed(0)}m  ${duration.toFixed(0)}s`,
        color: 0x00ff00,
      });
    } else {
      this.state.thermalIndicator.setProperty(prop.MORE, {
        text: "",
      });
    }
  },

  updateThermalCount(): void {
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

  flashThermalEntry(): void {
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

  updateChevrons(vSpeed: number): void {
    if (!this.state.chevrons) return;

    if (vSpeed > this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron: ZeppWidget, i: number) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_up.png",
          alpha: i < numChevrons ? 255 : 50,
        });
      });
    } else if (vSpeed < -this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron: ZeppWidget, i: number) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_down.png",
          alpha: 2 - i < numChevrons ? 255 : 50,
        });
      });
    } else {
      this.state.chevrons.forEach((chevron: ZeppWidget) => {
        chevron.setProperty(prop.MORE, {
          src: "chevron_neutral.png",
          alpha: 100,
        });
      });
    }
  },

  updateAnimations(): void {
    const vSpeed = this.state.lastVerticalSpeed;

    if (this.state.chevrons && Math.abs(vSpeed) > this.config.deadband) {
      const offset = Math.sin((this.state.animationPhase * Math.PI) / 5) * 5;

      this.state.chevrons.forEach((chevron: ZeppWidget, i: number) => {
        let baseY = 150 + i * 30;

        if (vSpeed > this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY - Math.abs(offset) });
        } else if (vSpeed < -this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY + Math.abs(offset) });
        }
      });
    }

    if (this.state.leftBar && this.state.rightBar) {
      if (this.state.flightState !== "FLYING" && !this.state.isTestMode) return;
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

  onResume(): void {
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

    if (this.state.accelerometer) {
      this.state.accelerometer.start();
    }

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
    } catch (error) {
      console.log(`[onResume] Error: ${error}`);
    }
  },

  onPause(): void {
    console.log("=== LIFECYCLE: onPause ===");
        this.state.isActive = false;

            if (globalNativePlayer) {
            try {
                if (globalNativePlayer.getStatus() === globalNativePlayer.state.PLAY) {
                    globalNativePlayer.stop();
                  }
              } catch (e) {
                console.log(`[onPause] Audio stop error: ${e}`);
              }
          }

            if (this.state.vibrator) {
            this.state.vibrator.stop();
          }

    if (this.state.monitoringInterval) {
      console.log("[onPause] Clearing monitoring");
      clearTimeout(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }

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

    if (this.state.accelerometer) {
      this.state.accelerometer.stop();
    }
  },

  onDestroy(): void {
    console.log("=== LIFECYCLE: onDestroy ===");

    this.state.isActive = false;
    this.state.monitoringActive = false;

    this.stopMonitoring();
    this.stopAnimation();

    if (globalNativePlayer) {
      globalNativePlayer.release();
    }

    if (this.state.vibrator) {
      this.state.vibrator.stop();
    }

    if (this.state.accelerometer) {
      this.state.accelerometer.stop();
    }

    try {
      pauseDropWristScreenOff({ duration: 1 });
      pausePalmScreenOff({ duration: 1 });
    } catch (error) {
      console.log(`[onDestroy] Error: ${error}`);
    }
  },

  startAnimation(): void {
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

  stopAnimation(): void {
    if (this.state.animationInterval) {
      clearInterval(this.state.animationInterval);
      this.state.animationInterval = null;
      console.log("[stopAnimation] Stopped");
    }
  },

  handleVibration(vSpeed: number): void {
    if (!this.config.vibration.enabled || !this.state.vibrator) {
      return;
    }

    const now = Date.now();
    const vib = this.config.vibration;
    const thresh = this.config.thresholds;
    let pattern: VibrationPattern | null = null;
    let shouldVibrate = false;

    if (vSpeed >= thresh.climbExceptional) {
      pattern = vib.patterns.climbExceptional;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    } else if (vSpeed >= thresh.climbStrong) {
      pattern = vib.patterns.climbStrong;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    } else if (vSpeed >= thresh.climbMedium) {
      pattern = vib.patterns.climbMedium;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    } else if (vSpeed >= thresh.climbWeak) {
      pattern = vib.patterns.climbWeak;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    } else if (vSpeed <= thresh.sinkStrong) {
      pattern = vib.patterns.sinkStrong;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    } else if (vSpeed <= thresh.sink) {
      pattern = vib.patterns.sink;
      shouldVibrate = now - this.state.lastVibrationTime >= pattern!.interval;
    }

    if (shouldVibrate && pattern) {
      this.state.lastVibrationTime = now;
      this.executeVibrationPattern(pattern);
    }
  },

  executeVibrationPattern(pattern: VibrationPattern): void {
    if (!this.state.vibrator) {
      return;
    }

    const count = pattern.count || 1;
    const duration = pattern.duration;
    const gap = pattern.gap || 0;

    this.state.vibrator.start();
    setTimeout(() => {
      this.state.vibrator?.stop();
    }, duration);

    if (count > 1) {
      for (let i = 1; i < count; i++) {
        setTimeout(
          () => {
            this.state.vibrator?.start();
            setTimeout(() => {
              this.state.vibrator?.stop();
            }, duration);
          },
          i * (duration + gap),
        );
      }
    }
  },

  playVariometerSound(vSpeed: number): void {
    if (!globalNativePlayer) {
      console.log("[Audio] ❌ No player");
      return;
    }

    let soundFile: string | null = null;

    if (Math.abs(vSpeed) < this.config.deadband) {
      console.log(
        `[Audio] 🔇 In deadband (${vSpeed.toFixed(2)}m/s < ${this.config.deadband})`,
      );
      if (globalNativePlayer.getStatus() === globalNativePlayer.state.PLAY) {
        globalNativePlayer.stop();
      }
      this.state.currentSound = null;
      return;
    }

    if (vSpeed > 0) {
      for (let i = this.config.climb.length - 1; i >= 0; i--) {
        if (vSpeed >= this.config.climb[i].threshold) {
          soundFile = this.config.climb[i].sound;
          console.log(
            `[Audio] 📈 CLIMB: vSpeed=${vSpeed.toFixed(2)} → ${soundFile}`,
          );
          break;
        }
      }
    } else {
      for (let i = this.config.sink.length - 1; i >= 0; i--) {
        if (vSpeed <= this.config.sink[i].threshold) {
          soundFile = this.config.sink[i].sound;
          console.log(
            `[Audio] 📉 SINK: vSpeed=${vSpeed.toFixed(2)} → ${soundFile}`,
          );
          break;
        }
      }
    }

    if (soundFile && soundFile !== this.state.currentSound) {
      this.state.currentSound = soundFile;
      const fullPath = `raw/media/${soundFile}`;

      console.log(`[Audio] 🔊 Playing: ${fullPath}`);

      try {
        const status = globalNativePlayer.getStatus();
        if (status === globalNativePlayer.state.PLAY) {
          globalNativePlayer.stop();
        }
      } catch (e) {
        console.log(`[Audio] ⚠️ Stop error (ignored): ${e}`);
      }

      try {
        globalNativePlayer.setSource(globalNativePlayer.source.FILE, {
          file: fullPath,
        });
        globalNativePlayer.prepare();
        console.log("[Audio] ✅ Play command sent");
      } catch (error) {
        console.log(`[Audio] ❌ Play error: ${error}`);
      }
    } else if (!soundFile) {
      console.log(`[Audio] ⚠️ No sound file for vSpeed=${vSpeed.toFixed(2)}`);
    }
  },
});
