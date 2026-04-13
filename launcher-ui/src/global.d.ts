export {};

declare global {
  interface Window {
    noir: {
      getAccounts: () => Promise<any[]>;
      loginOffline: (username: string) => Promise<void>;
      removeAccount: (uuid: string) => Promise<void>;
      startMicrosoftLogin: () => Promise<void>;
      completeMicrosoftLogin: () => Promise<void>;
      openLoginWindow: () => Promise<void>;
      closeLoginWindow: () => Promise<void>;
      play: (accountUuid: string) => Promise<void>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      getLogs: () => Promise<any[]>;
      syncModpack: () => Promise<any>;
      getModpackStatus: () => Promise<any>;
      onModpackProgress: (callback: (status: any) => void) => void;
      onMinecraftStatus: (callback: (status: any) => void) => void;
      checkUpdates: () => Promise<void>;
      getAppVersion: () => Promise<string>;
    };
  }
}

declare module '*.png';
