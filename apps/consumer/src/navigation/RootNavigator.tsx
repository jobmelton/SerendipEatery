import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuth } from '@clerk/clerk-expo'
import { Text } from 'react-native'
import { HomeScreen } from '../screens/HomeScreen'
import { SaleDetailScreen } from '../screens/SaleDetailScreen'
import { SpinScreen } from '../screens/SpinScreen'
import { WinScreen } from '../screens/WinScreen'
import { ProfileScreen } from '../screens/ProfileScreen'
import { ReferralScreen } from '../screens/ReferralScreen'
import { ShareScreen } from '../screens/ShareScreen'
import { BattleScreen } from '../screens/BattleScreen'
import { BattleArenaScreen } from '../screens/BattleArenaScreen'
import { WalletScreen } from '../screens/WalletScreen'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { SignUpScreen } from '../screens/auth/SignUpScreen'

// ─── Type Definitions ─────────────────────────────────────────────────────

export type MainStackParamList = {
  HomeTabs: undefined
  SaleDetail: { saleId: string }
  Spin: {
    spinResult: {
      prizeId: string
      prizeName: string
      prizeType: string
      prizeValue: number
      code: string
      expiresAt: string
      pointsEarned: number
      visitIntentId: string
      animationSeed: number
      updatedPrizeCounts: Array<{ prizeId: string; spinsUsed: number; maxSpins: number }>
    }
    prizes: any[]
  }
  Win: {
    spinResult: {
      prizeName: string
      code: string
      expiresAt: string
      pointsEarned: number
      visitIntentId: string
    }
  }
  Referral: undefined
  Share: { visitIntentId: string; prizeName: string; businessName: string }
  BattleArena: { battleId: string }
}

export type AuthStackParamList = {
  SignIn: undefined
  SignUp: undefined
}

export type RootStackParamList = MainStackParamList & AuthStackParamList

export type TabParamList = {
  Home: undefined
  Battle: undefined
  Wallet: undefined
  Profile: undefined
}

// ─── Tab Navigator ────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>()

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f0a1e',
          borderTopColor: '#1a1230',
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#F7941D',
        tabBarInactiveTintColor: 'rgba(255, 248, 242, 0.4)',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Battle"
        component={BattleScreen}
        options={{
          tabBarLabel: 'Battle',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22, transform: [{ rotate: '-45deg' }] }}>✌️</Text>,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🎒</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  )
}

// ─── Stack Navigators ─────────────────────────────────────────────────────

const MainStack = createNativeStackNavigator<MainStackParamList>()
const AuthStack = createNativeStackNavigator<AuthStackParamList>()

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  )
}

function MainNavigator() {
  return (
    <MainStack.Navigator screenOptions={{ headerShown: false }}>
      <MainStack.Screen name="HomeTabs" component={HomeTabs} />
      <MainStack.Screen name="SaleDetail" component={SaleDetailScreen} />
      <MainStack.Screen
        name="Spin"
        component={SpinScreen}
        options={{ gestureEnabled: false }}
      />
      <MainStack.Screen
        name="Win"
        component={WinScreen}
        options={{ gestureEnabled: false }}
      />
      <MainStack.Screen name="Referral" component={ReferralScreen} />
      <MainStack.Screen name="Share" component={ShareScreen} />
      <MainStack.Screen
        name="BattleArena"
        component={BattleArenaScreen}
        options={{ gestureEnabled: false }}
      />
    </MainStack.Navigator>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────

export function RootNavigator() {
  const { isSignedIn } = useAuth()

  return (
    <NavigationContainer>
      {isSignedIn ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  )
}
