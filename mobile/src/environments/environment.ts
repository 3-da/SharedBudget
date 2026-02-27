export const environment = {
  production: false,
  // Use localhost for all platforms.
  // For Android emulator/device: run `adb reverse tcp:3000 tcp:3000` once
  // after starting the emulator — this tunnels the port through ADB so the
  // emulator's localhost:3000 reaches the host machine, bypassing firewall.
  // iOS simulator shares the host's localhost directly (no setup needed).
  apiUrl: 'http://localhost:3000/api/v1',
};
