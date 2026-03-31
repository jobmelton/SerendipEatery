import { ClerkProvider } from './src/providers/ClerkProvider'
import { RootNavigator } from './src/navigation/RootNavigator'

export default function App() {
  return (
    <ClerkProvider>
      <RootNavigator />
    </ClerkProvider>
  )
}
