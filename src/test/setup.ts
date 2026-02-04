import "@testing-library/jest-dom/vitest";
import { vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock crypto.randomUUID
beforeEach(() => {
  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `test-uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`
  );
});

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock tauri-plugin-mic-recorder-api
vi.mock("tauri-plugin-mic-recorder-api", () => ({
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  isRecording: vi.fn().mockResolvedValue(false),
  cancelRecording: vi.fn(),
}));

// Mock Audio API for audio playback tests
class MockAudio {
  src: string = "";
  onended: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  currentTime: number = 0;

  play(): Promise<void> {
    return Promise.resolve();
  }

  pause(): void {}
}

// Assign to global
Object.defineProperty(globalThis, "Audio", {
  writable: true,
  value: MockAudio,
});
