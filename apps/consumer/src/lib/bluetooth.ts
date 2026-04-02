/**
 * Battery-efficient Bluetooth proximity detection for P2P battles.
 *
 * Duty-cycle approach:
 *   - Idle:   scan 3s every 30s (~10% radio time)
 *   - Battle: scan 3s every 5s  (~60% radio time, only during active battle)
 *   - Background: all scanning stops
 *
 * GPS fallback uses Accuracy.Balanced (coarse), 60s interval.
 * Auto-disables battle mode after 2 hours of inactivity.
 *
 * Requires `react-native-ble-plx`:
 *   npx expo install react-native-ble-plx
 *   Expo config: "plugins": [["react-native-ble-plx", { "isBackgroundEnabled": false }]]
 */

import { AppState, Platform, PermissionsAndroid } from 'react-native'

// ─── Constants ──────────────────────────────────────────────────────────────
const BATTLE_SERVICE_UUID = '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E'

const SCAN_DURATION_MS = 3_000       // scan window
const IDLE_INTERVAL_MS = 30_000      // pause between scans (idle)
const BATTLE_INTERVAL_MS = 5_000     // pause between scans (active battle)
const GPS_INTERVAL_MS = 60_000       // GPS fallback refresh
const AUTO_DISABLE_MS = 2 * 60 * 60 * 1_000  // 2 hours

// ─── Types ──────────────────────────────────────────────────────────────────
export interface NearbyPlayer {
  userId: string
  battleModeEnabled: boolean
  rssi: number
}

export type ScanState = 'idle' | 'scanning' | 'paused' | 'off'

type ScanCallback = (players: NearbyPlayer[]) => void

// ─── Module state ───────────────────────────────────────────────────────────
let bleManagerInstance: any = null
let scanTimer: ReturnType<typeof setTimeout> | null = null
let cycleTimer: ReturnType<typeof setInterval> | null = null
let autoDisableTimer: ReturnType<typeof setTimeout> | null = null
let appStateSubscription: any = null
let currentCallback: ScanCallback | null = null
let inActiveBattle = false
let lastActivity = Date.now()
let _scanState: ScanState = 'off'

const scanStateListeners = new Set<(s: ScanState) => void>()

function setScanState(s: ScanState) {
  _scanState = s
  scanStateListeners.forEach((fn) => fn(s))
}

/** Subscribe to scan state changes (for UI indicator). */
export function onScanStateChange(fn: (s: ScanState) => void) {
  scanStateListeners.add(fn)
  fn(_scanState) // emit current
  return () => { scanStateListeners.delete(fn) }
}

export function getScanState(): ScanState {
  return _scanState
}

// ─── BLE Manager ────────────────────────────────────────────────────────────
async function getBleManager() {
  if (bleManagerInstance) return bleManagerInstance
  try {
    const { BleManager } = await import('react-native-ble-plx')
    bleManagerInstance = new BleManager()
    return bleManagerInstance
  } catch {
    return null
  }
}

// ─── Permissions ────────────────────────────────────────────────────────────
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') return true

  if (Platform.OS === 'android') {
    const api = Platform.Version
    if (typeof api === 'number' && api >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      )
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    )
    return result === PermissionsAndroid.RESULTS.GRANTED
  }
  return false
}

// ─── Single scan burst (3 seconds) ─────────────────────────────────────────
async function scanBurst(): Promise<NearbyPlayer[] | null> {
  const manager = await getBleManager()
  if (!manager) return null

  const hasPermission = await requestBluetoothPermission()
  if (!hasPermission) return null

  setScanState('scanning')

  return new Promise((resolve) => {
    const found = new Map<string, NearbyPlayer>()

    const timer = setTimeout(() => {
      manager.stopDeviceScan()
      setScanState('paused')
      resolve(Array.from(found.values()))
    }, SCAN_DURATION_MS)

    try {
      manager.startDeviceScan(
        [BATTLE_SERVICE_UUID],
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            clearTimeout(timer)
            manager.stopDeviceScan()
            setScanState('paused')
            resolve(null)
            return
          }
          if (device?.localName?.startsWith('SE:')) {
            const parts = device.localName.split(':')
            if (parts.length >= 3) {
              const userId = parts[1]
              const battleMode = parts[2] === '1'
              if (battleMode && !found.has(userId)) {
                found.set(userId, {
                  userId,
                  battleModeEnabled: true,
                  rssi: device.rssi ?? -100,
                })
              }
            }
          }
        },
      )
    } catch {
      clearTimeout(timer)
      setScanState('paused')
      resolve(null)
    }
  })
}

// ─── Duty-cycle scanner ─────────────────────────────────────────────────────
async function runScanCycle() {
  if (_scanState === 'off') return

  lastActivity = Date.now()
  const players = await scanBurst()
  if (players && currentCallback) {
    currentCallback(players)
  }
}

function getInterval() {
  return inActiveBattle ? BATTLE_INTERVAL_MS : IDLE_INTERVAL_MS
}

function startCycle() {
  stopCycle()
  setScanState('paused')

  // Run immediately, then on interval
  runScanCycle()
  cycleTimer = setInterval(runScanCycle, getInterval())

  // Auto-disable after 2 hours of inactivity
  resetAutoDisable()
}

function stopCycle() {
  if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null }
  if (scanTimer) { clearTimeout(scanTimer); scanTimer = null }

  // Stop any active BLE scan
  getBleManager().then((m) => m?.stopDeviceScan()).catch(() => {})
  setScanState('off')
}

function resetAutoDisable() {
  if (autoDisableTimer) clearTimeout(autoDisableTimer)
  autoDisableTimer = setTimeout(() => {
    stopScanning()
  }, AUTO_DISABLE_MS)
}

// ─── App state handling (foreground/background) ─────────────────────────────
function handleAppState(nextState: string) {
  if (nextState === 'active' && _scanState === 'off' && currentCallback) {
    // Returned to foreground — restart scanning
    startCycle()
  } else if (nextState !== 'active') {
    // Went to background — stop all scanning
    stopCycle()
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Start duty-cycle BLE scanning.
 * Call this when battle mode is enabled and the screen is active.
 *
 * @param callback — called with detected players after each scan burst
 */
export function startScanning(callback: ScanCallback) {
  currentCallback = callback
  lastActivity = Date.now()

  // Watch app state
  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', handleAppState)
  }

  startCycle()
}

/**
 * Stop all BLE scanning and clean up.
 */
export function stopScanning() {
  currentCallback = null
  stopCycle()

  if (autoDisableTimer) { clearTimeout(autoDisableTimer); autoDisableTimer = null }
  if (appStateSubscription) { appStateSubscription.remove(); appStateSubscription = null }
}

/**
 * Switch to high-frequency scanning during an active battle.
 */
export function setActiveBattle(active: boolean) {
  const changed = inActiveBattle !== active
  inActiveBattle = active
  if (changed && _scanState !== 'off') {
    // Restart cycle with new interval
    startCycle()
  }
}

/**
 * Touch activity timer — resets the 2-hour auto-disable.
 */
export function touchActivity() {
  lastActivity = Date.now()
  resetAutoDisable()
}

/**
 * Legacy single-shot scan (kept for backward compatibility).
 * Prefer startScanning() for duty-cycle approach.
 */
export async function detectNearbyPlayers(
  timeoutMs = SCAN_DURATION_MS,
): Promise<NearbyPlayer[] | null> {
  return scanBurst()
}
