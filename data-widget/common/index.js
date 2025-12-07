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

DataWidget({
  state: {
    animationInterval: null,
    monitoringInterval: null,
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
    modeIndicator: null,

    verticalSpeedWidget: null,
  },

  config: {
    // Marge d'erreur pour la vitesse verticale (évite de déclencher les sons et les vibrations à la moindre variation)
    deadband: 0.2,
    animationInterval: 100,

    // Seuils unifiés pour vibrations et affichage
    thresholds: {
      climbWeak: 0.2,
      climbMedium: 1.0,
      climbStrong: 2.0,
      climbExceptional: 3.5,
      sink: -0.5,
      sinkStrong: -2.0,
    },

    // Configuration des vibrations
    vibration: {
      enabled: true,
      patterns: {
        // Montée faible : vibration courte unique
        climbWeak: { duration: 100, interval: 2000 },
        // Montée moyenne : double vibration
        climbMedium: { duration: 100, count: 2, gap: 100, interval: 1500 },
        // Montée forte : triple vibration rapide
        climbStrong: { duration: 100, count: 3, gap: 80, interval: 1000 },
        // Montée exceptionnelle : vibration continue
        climbExceptional: { duration: 200, count: 4, gap: 50, interval: 800 },
        // Descente : vibration longue unique
        sink: { duration: 300, interval: 3000 },
        sinkStrong: { duration: 400, count: 2, gap: 200, interval: 2000 },
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

  build() {
    console.log("=== ParaVario Build START (480x480) ===");

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
      setWakeUpRelaunch({ relaunch: true });
      console.log("✓✓✓ Screen will stay ON ✓✓✓");
    } catch (error) {
      console.log("Screen management error:", error);
    }

    createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 480,
      h: 480,
      color: this.config.colors.neutral,
    });

    // === BARRE LATÉRALE GAUCHE ===
    this.state.leftBar = createWidget(widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: 60,
      h: 480,
      radius: 8,
      color: 0x333333,
    });

    // === BARRE LATÉRALE DROITE ===
    this.state.rightBar = createWidget(widget.FILL_RECT, {
      x: 420,
      y: 0,
      w: 60,
      h: 480,
      color: 0x333333,
    });

    // === CHEVRONS ===
    this.state.chevrons = [];
    for (let i = 0; i < 3; i++) {
      this.state.chevrons.push(
        createWidget(widget.TEXT, {
          x: 0,
          y: 95 + i * 20,
          w: 480,
          h: 22,
          color: 0x666666,
          text_size: 28,
          align_h: align.CENTER_H,
          align_v: align.CENTER_V,
          text_style: text_style.NONE,
          text: "-",
          alpha: 100,
        }),
      );
    }

    // === VITESSE VERTICALE CENTRALE ===
    this.state.verticalSpeedWidget = createWidget(widget.SPORT_DATA, {
      edit_id: 100,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.SPEED_VERTICAL,
      x: 0,
      y: 170,
      w: 480,
      h: 180,
      text_size: 130,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 480,
      text_h: 150,
      align_h: align.CENTER_H,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "m/s",
      x: 0,
      y: 300,
      w: 480,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === ALTITUDE ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 1,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.ALTITUDE,
      x: 140,
      y: 30,
      w: 200,
      h: 60,
      text_size: 36,
      text_color: 0xffffff,
      text_x: 0,
      text_y: 0,
      text_w: 200,
      text_h: 45,
      align_h: align.CENTER_H,
      rect_visible: false,
    });

    createWidget(widget.TEXT, {
      text: "m",
      x: 0,
      y: 60,
      w: 480,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === VITESSE SOL ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 2,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.SPEED,
      x: 60,
      y: 380,
      w: 170,
      h: 70,
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
      y: 420,
      w: 170,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === DISTANCE ===
    createWidget(widget.SPORT_DATA, {
      edit_id: 3,
      category: edit_widget_group_type.SPORTS,
      default_type: sport_data.DISTANCE_TOTAL,
      x: 250,
      y: 380,
      w: 170,
      h: 70,
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
      y: 420,
      w: 170,
      h: 26,
      text_size: 20,
      text_color: 0xcccccc,
      align_h: align.CENTER_H,
    });

    // === INDICATEUR MODE ===
    this.state.modeIndicator = createWidget(widget.TEXT, {
      x: 0,
      y: 450,
      w: 480,
      h: 25,
      color: 0x666666,
      text_size: 18,
      align_h: align.CENTER_H,
      text_style: text_style.NONE,
      text: "DETECT...",
    });

    this.initAudioPlayer();
    this.initVibrator();

    console.log("=== ParaVario Build END ===");

    this.detectAndStart();
  },

  initAudioPlayer() {
    try {
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
        console.log(`Audio failed: \${info.name}`);
      });

      console.log("Audio player initialized");
    } catch (error) {
      console.log("Audio player init failed:", error);
    }
  },

  initVibrator() {
    try {
      this.state.vibrator = new Vibrator();
      console.log("Vibrator initialized");
    } catch (error) {
      console.log("Vibrator init failed:", error);
    }
  },

  detectAndStart() {
    this.state.isActive = true;
    console.log("=== Detecting mode ===");

    const testResult = getSportData(
      { type: "speed_vertical" },
      (callbackResult) => {
        console.log("getSportData callback received:", callbackResult);
      },
    );

    console.log("getSportData returned:", testResult);

    if (testResult === true) {
      console.log("✓✓✓ REAL DATA MODE ✓✓✓");
      this.state.isSimulation = false;

      if (this.state.modeIndicator) {
        this.state.modeIndicator.setProperty(prop.MORE, {
          text: "REAL",
          color: 0x00ff00,
        });
      }
    } else {
      console.log("✗✗✗ SIMULATION MODE ✗✗✗");
      this.state.isSimulation = true;

      if (this.state.modeIndicator) {
        this.state.modeIndicator.setProperty(prop.MORE, {
          text: "SIM",
          color: 0xff9900,
        });
      }
    }

    this.startAnimation();
    this.startMonitoring();
  },

  startMonitoring() {
    console.log(">>> Starting monitoring");
    if (this.state.monitoringInterval) {
      console.log("Monitoring already started");
      return;
    }

    this.state.monitoringInterval = setInterval(() => {
      if (!this.state.isActive) return;

      if (this.state.isSimulation) {
        const mockVSpeed = (Math.random() - 0.5) * 8;
        console.log(
          `Simulation mode - generating random VSpeed: ${mockVSpeed}`,
        );
        this.updateFeedback(mockVSpeed);
      } else {
        this.fetchRealData();
      }
    }, 500);
  },

  fetchRealData() {
    console.log(">>> Fetching real data");
    const result = getSportData(
      { type: "vertical_speed" },
      (callbackResult) => {
        const { code, data } = callbackResult;

        if (code === 0) {
          try {
            const [{ vertical_speed }] = JSON.parse(data);
            if (vertical_speed !== undefined) {
              const vSpeed = parseFloat(vertical_speed);
              console.log("Real VSpeed:", vSpeed);
              this.updateFeedback(vSpeed);
            }
          } catch (error) {
            console.log("Parse error:", error);
          }
        }
      },
    );
    console.log("fetchRealData result:", result);
  },

  updateFeedback(vSpeed) {
    this.state.lastVerticalSpeed = vSpeed;
    this.updateChevrons(vSpeed);
    this.handleVibration(vSpeed);
    this.playVariometerSound(vSpeed);
  },

  updateChevrons(vSpeed) {
    if (!this.state.chevrons) return;

    if (vSpeed > this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron, i) => {
        chevron.setProperty(prop.MORE, {
          text: "^",
          color: 0x00ff00,
          alpha: i < numChevrons ? 255 : 50,
        });
      });
    } else if (vSpeed < -this.config.deadband) {
      const intensity = Math.min(Math.abs(vSpeed) / 3.0, 1.0);
      const numChevrons = Math.ceil(intensity * 3);

      this.state.chevrons.forEach((chevron, i) => {
        chevron.setProperty(prop.MORE, {
          text: "v",
          color: 0xff0000,
          alpha: 2 - i < numChevrons ? 255 : 50,
        });
      });
    } else {
      this.state.chevrons.forEach((chevron) => {
        chevron.setProperty(prop.MORE, {
          text: "-",
          color: 0x666666,
          alpha: 100,
        });
      });
    }
  },

  onInit() {
    console.log("ParaVario onInit");
  },

  onResume() {
    console.log("ParaVario onResume");
    this.state.isActive = true;

    try {
      pauseDropWristScreenOff({ duration: 0 });
      pausePalmScreenOff({ duration: 0 });
    } catch (error) {
      console.log("Screen management resume error:", error);
    }
  },

  onPause() {
    console.log("ParaVario onPause");
    this.state.isActive = false;
    this.stopAnimation();

    if (this.state.monitoringInterval) {
      clearInterval(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }
  },

  onDestroy() {
    console.log("ParaVario onDestroy");
    this.state.isActive = false;
    this.stopAnimation();

    if (this.state.monitoringInterval) {
      clearInterval(this.state.monitoringInterval);
      this.state.monitoringInterval = null;
    }

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
      console.log("Screen management destroy error:", error);
    }
  },

  startAnimation() {
    if (this.state.animationInterval) return;

    console.log(">>> Starting animations");

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
    }
  },

  handleVibration(vSpeed) {
    if (!this.config.vibration.enabled || !this.state.vibrator) return;

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
    if (!this.state.vibrator) return;

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

  updateAnimations() {
    const vSpeed = this.state.lastVerticalSpeed;

    if (this.state.chevrons && Math.abs(vSpeed) > this.config.deadband) {
      const offset = Math.sin((this.state.animationPhase * Math.PI) / 5) * 5;

      this.state.chevrons.forEach((chevron, i) => {
        let baseY = 95 + i * 20;

        if (vSpeed > this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY - Math.abs(offset) });
        } else if (vSpeed < -this.config.deadband) {
          chevron.setProperty(prop.MORE, { y: baseY + Math.abs(offset) });
        }
      });
    }

    if (this.state.leftBar && this.state.rightBar) {
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

  playVariometerSound(vSpeed) {
    if (!this.state.player) return;

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
      this.state.player.changeFile(`raw/sounds/${soundFile}`);
      this.state.player.play();
    }
  },
});
