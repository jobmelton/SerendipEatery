import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useAuth } from '@clerk/clerk-expo'
import { Text } from 'react-native'
import { DashboardScreen } from '../screens/DashboardScreen'
import { CreateSaleScreen } from '../screens/CreateSaleScreen'
import { SaleDetailScreen } from '../screens/SaleDetailScreen'
import { AnalyticsScreen } from '../screens/AnalyticsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { SignUpScreen } from '../screens/auth/SignUpScreen'

// ─── Type Definitions ─────────────────────────────────────────────────────

export type MainStackParamList = {
  DashboardTabs: undefined
  CreateSale: { businessId: string }
  SaleDetail: { saleId: string }
  Analytics: { businessId: string }
}

export type AuthStackParamList = {
  SignIn: undefined
  SignUp: undefined
}

export type RootStackParamList = MainStackParamList & AuthStackParamList

export type TabParamList = {
  Dashboard: undefined
  Sales: undefined
  AnalyticsTab: undefined
  Settings: undefined
}

// ─── Tab Navigator ────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>()

function DashboardTabs() {
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
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Sales"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Sales',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>🎰</Text>,
        }}
      />
      <Tab.Screen
        name="AnalyticsTab"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>⚙️</Text>,
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
      <MainStack.Screen name="DashboardTabs" component={DashboardTabs} />
      <MainStack.Screen name="CreateSale" component={CreateSaleScreen} />
      <MainStack.Screen name="SaleDetail" component={SaleDetailScreen} />
      <MainStack.Screen name="Analytics" component={AnalyticsScreen} />
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
