interface AppOptions {
  launchOptions?: {
    from?: number;
    url?: string;
  };
  globalData?: Record<string, unknown>;
}

interface AppError {
  message: string;
  stack?: string;
}

interface PageNotFoundObj {
  path: string;
  query: Record<string, unknown>;
  isEntryPage: boolean;
}

interface UnhandledRejectionObj {
  reason: unknown;
  promise: Promise<unknown>;
}

App({
  globalData: {},

  onCreate(options?: any): void {},

  onShow(options?: any): void {},

  onHide(options?: any): void {},

  onDestroy(options?: any): void {},

  onError(error?: any): void {},

  onPageNotFound(obj?: any): void {},

  onUnhandledRejection(obj?: any): void {},
});
