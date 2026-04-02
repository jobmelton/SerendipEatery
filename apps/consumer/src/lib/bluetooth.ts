/**
 * Bluetooth proximity detection for P2P battles.
 *
 * Uses react-native-ble-plx for BLE scanning. Falls back to GPS
 * if Bluetooth is unavailable or permission denied.
 *
 * NOTE: Requires `react-native-ble-plx` to be installed:
 *   npx expo install react-native-ble-plx
 *
 * Also requires Expo config plugin in app.json:
 *   "plugins": [["react-native-ble-plx", { "isBackgroundEnabled": false }]]
 */

import { Platform, PermissionsAndroid } from 'react-native'

// BLE service UUID for SerendipEatery battle mode
const BATTLE_SERVICE_UUID = '6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E'

export interface NearbyPlayer {
  userId: string
  battleModeEnabled: boolean
  rssi: number // signal strength — closer = stronger
}

let bleManagerInstance: any = null

/**
 * Lazy-load BLE manager so the app doesn't crash if the package isn't installed.
 */
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

/**
 * Request Bluetooth permissions for iOS and Android.
 * Returns true if granted.
 */
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS: BLE permissions are requested automatically on first scan
    return true
  }

  if (Platform.OS === 'android') {
    const apiLevel = Platform.Version
    if (typeof apiLevel === 'number' && apiLevel >= 31) {
      // Android 12+
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ])
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      )
    } else {
      // Android <12
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      )
      return result === PermissionsAndroid.RESULTS.GRANTED
    }
  }

  return false
}

/**
 * Scan for nearby players broadcasting the SerendipEatery BLE service.
 * Returns a list of detected players within ~10 seconds.
 *
 * Falls back to null if BLE is unavailable — caller should use GPS fallback.
 */
export async function detectNearbyPlayers(
  timeoutMs = 10000,
): Promise<NearbyPlayer[] | null> {
  const manager = await getBleManager()
  if (!manager) return null

  const hasPermission = await requestBluetoothPermission()
  if (!hasPermission) return null

  return new Promise((resolve) => {
    const found = new Map<string, NearbyPlayer>()

    const timer = setTimeout(() => {
      manager.stopDeviceScan()
      resolve(Array.from(found.values()))
    }, timeoutMs)

    try {
      manager.startDeviceScan(
        [BATTLE_SERVICE_UUID],
        { allowDuplicates: false },
        (error: any, device: any) => {
          if (error) {
            clearTimeout(timer)
            manager.stopDeviceScan()
            resolve(null) // BLE error — caller should fallback to GPS
            return
          }

          if (device?.localName?.startsWith('SE:')) {
            // Format: SE:<hashedUserId>:<battleMode 0|1>
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
      resolve(null)
    }
  })
}

/**
 * Start advertising this device as a battle-mode player.
 * Broadcasting format: SE:<hashedUserId>:<battleMode>
 *
 * Note: BLE advertising from React Native is limited.
 * Full implementation requires a native module or Expo config plugin.
 * This is a placeholder for the advertising setup.
 */
export async function startBattleAdvertising(
  _userId: string,
  _battleModeEnabled: boolean,
): Promise<boolean> {
  // BLE peripheral mode (advertising) is not natively supported
  // by react-native-ble-plx. A native module or expo-ble-peripheral
  // would be needed for full implementation.
  // For now, battle discovery relies on the GPS-based /battles/nearby API.
  return false
}
