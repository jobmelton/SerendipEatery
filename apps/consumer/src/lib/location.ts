import * as Location from 'expo-location'
import { Alert, Linking } from 'react-native'

export interface Coords {
  lat: number
  lng: number
}

/**
 * Request foreground location permissions and return current coords.
 * Shows an alert if denied, with a link to settings.
 */
export async function requestLocation(): Promise<Coords | null> {
  const { status } = await Location.requestForegroundPermissionsAsync()

  if (status !== 'granted') {
    Alert.alert(
      'Location Required',
      'SerendipEatery needs your location to find flash sales nearby and verify check-ins.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ],
    )
    return null
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  })

  return { lat: loc.coords.latitude, lng: loc.coords.longitude }
}

/**
 * Get current location without re-requesting permissions.
 * Returns null if permissions aren't granted.
 */
export async function getCurrentLocation(): Promise<Coords | null> {
  const { status } = await Location.getForegroundPermissionsAsync()
  if (status !== 'granted') return null

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  })

  return { lat: loc.coords.latitude, lng: loc.coords.longitude }
}

/**
 * Calculate distance in km between two coords (for display only).
 */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
