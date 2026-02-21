/**
 * Types personnalisés pour le variomètre de parapente
 */

import type { Vibrator, Accelerometer } from "@zos/sensor";

// États de vol
export type FlightState = "WAITING" | "FLYING" | "LANDED";

// Patterns de vibration
export interface VibrationPattern {
  duration: number;
  count?: number;
  gap?: number;
  interval: number;
}

export interface VibrationPatterns {
  climbWeak: VibrationPattern;
  climbMedium: VibrationPattern;
  climbStrong: VibrationPattern;
  climbExceptional: VibrationPattern;
  sink: VibrationPattern;
  sinkStrong: VibrationPattern;
  thermalEntry: VibrationPattern;
  takeoff: VibrationPattern;
  landing: VibrationPattern;
  test: VibrationPattern;
}

// Configuration des sons
export interface SoundConfig {
  threshold: number;
  sound: string;
}

// Configuration du widget
export interface VariometerConfig {
  deadband: number;
  animationInterval: number;

  takeoff: {
    minGroundSpeed: number;
    minVerticalSpeed: number;
    minAltitudeGain: number;
  };

  landing: {
    maxGroundSpeed: number;
    maxVerticalSpeed: number;
    maxAltitudeChange: number;
    confirmationTime: number;
  };

  thresholds: {
    climbWeak: number;
    climbMedium: number;
    climbStrong: number;
    climbExceptional: number;
    sink: number;
    sinkStrong: number;
  };

  thermal: {
    minClimbRate: number;
    minDuration: number;
    minAltitudeGain: number;
    exitClimbRate: number;
  };

  vibration: {
    enabled: boolean;
    patterns: VibrationPatterns;
  };

  climb: SoundConfig[];
  sink: SoundConfig[];
}

// Données d'un thermique
export interface ThermalData {
  startTime: number;
  endTime: number;
  duration: number;
  startAltitude: number;
  endAltitude: number;
  altitudeGain: number;
  maxClimbRate: number;
  averageClimbRate: number;
}

// Thermique en cours
export interface CurrentThermal {
  startTime: number;
  startAltitude: number;
  maxClimbRate: number;
  samples: number[];
}

// Type pour les widgets ZeppOS
export type ZeppWidget = any; // Les types précis viennent de @zeppos/device-types

// État du widget
export interface VariometerState {
  animationInterval: number | null;
  monitoringInterval: number | null;
  monitoringActive: boolean;
  isActive: boolean;
  isSimulation: boolean;
  isTestMode: boolean;
  testVSpeed: number;
  vibrator: Vibrator | null;
  accelerometer: Accelerometer | null;
  currentSound: string | null;
  lastVerticalSpeed: number;
  animationPhase: number;
  lastVibrationTime: number;
  leftBar: ZeppWidget | null;
  rightBar: ZeppWidget | null;
  chevrons: ZeppWidget[];
  vSpeedWidget: ZeppWidget | null;
  currentAltitude: number;
  currentSpeed: number;
  lastAltitude: number;
  altitudeHistory: number[];

  flightState: FlightState;
  takeoffAltitude: number;
  landingDetectionStartTime: number | null;
  landingDetectionAltitude: number | null;

  flightStartTime: number | null;
  maxAltitude: number;

  thermalHistory: ThermalData[];
  currentThermal: CurrentThermal | null;
  thermalStartAltitude: number | null;
  thermalStartTime: number | null;
  inThermal: boolean;
  thermalIndicator: ZeppWidget | null;
  thermalCountWidget: ZeppWidget | null;

  verticalAccelZ: number | null;
  accelBaselineZ: number | null;

  flightStateIndicator: ZeppWidget | null;
  flightDurationWidget: ZeppWidget | null;
  altitudeWidget: ZeppWidget | null;
  gainWidget: ZeppWidget | null;
  maxAltWidget: ZeppWidget | null;

  testPanel: ZeppWidget | null;
  testButtonClimb: ZeppWidget | null;
  testButtonSink: ZeppWidget | null;
  testButtonSound: ZeppWidget | null;
  testButtonVibration: ZeppWidget | null;
  testTitle: ZeppWidget | null;
  testInstruction: ZeppWidget | null;
  testButtonReset: ZeppWidget | null;
  _testPanelListenersAdded: boolean;
}

// Données de sport retournées par getSportData
export interface SportDataResult {
  code: number;
  data: string;
}

export interface VerticalSpeedData {
  vertical_speed: number;
}

export interface AltitudeData {
  altitude: number;
}

export interface SpeedData {
  speed: number;
}

// Interface pour l'accéléromètre
export interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}
