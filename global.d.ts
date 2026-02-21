/// <reference path="node_modules/@zeppos/device-types/dist/index.d.ts" />

// Déclarations de types globales pour ZeppOS

declare function App<T = any>(options: T): void;
declare function DataWidget<T = any>(options: T): void;

// Module @zos/media
declare module "@zos/media" {
  export interface Player {
    setVolume(volume: number): void;
    getStatus(): number;
    start(): void;
    stop(): void;
    prepare(): void;
    release(): void;
    setSource(sourceType: number, options: { file: string }): void;
    addEventListener(event: number, callback: (result?: any) => void): void;

    readonly event: {
      PREPARE: number;
      COMPLETE: number;
      PLAY: number;
      ERROR: number;
    };

    readonly state: {
      PLAY: number;
      PAUSE: number;
      STOP: number;
    };

    readonly source: {
      FILE: number;
      URL: number;
    };
  }

  export const id: {
    PLAYER: number;
  };

  export function create(id: number): Player;
}
