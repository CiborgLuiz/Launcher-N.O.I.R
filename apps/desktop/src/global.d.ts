import type { DesktopBridge } from "./lib/bridge";

declare global {
  interface Window {
    noir?: DesktopBridge;
  }
}

export {};
