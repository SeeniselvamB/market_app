// src/navigation/AppNavigator.tsx
// Root navigator: Setup stack + Main bottom-tab navigator

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useApp } from '../storage/AppContext';
import { useLang } from '../storage/LanguageContext';
import { COLORS, TNR, TNR_BOLD } from '../utils/theme';

import SetupScreen       from '../screens/SetupScreen';
import DashboardScreen   from '../screens/DashboardScreen';
import OrdersScreen      from '../screens/OrdersScreen';
import BillingScreen     from '../screens/BillingScreen';
import SettingsScreen    from '../screens/SettingsScreen';
import OrderEntryScreen  from '../screens/OrderEntryScreen';
import BillingDetailScreen from '../screens/BillingDetailScreen';

export type RootStackParams = {
  MainTabs:      undefined;
  OrderEntry:    { customerId: string };
  BillingDetail: { customerId: string };
};

const Stack = createNativeStackNavigator<RootStackParams>();
const Tab   = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={focused ? styles.activeTab : styles.inactiveTab}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
    </View>
  );
}

function MainTabs() {
  const { t } = useLang();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarLabelStyle: styles.tabLabel,
      }}>
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarLabel: t.dashboard, tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }} />
      <Tab.Screen name="Orders" component={OrdersScreen}
        options={{ tabBarLabel: t.orders, tabBarIcon: ({ focused }) => <TabIcon emoji="🛍️" focused={focused} /> }} />
      <Tab.Screen name="Billing" component={BillingScreen}
        options={{ tabBarLabel: t.billing, tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen}
        options={{ tabBarLabel: t.settings.replace('⚙️ ', ''), tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { state, isLoading } = useApp();
  const { t } = useLang();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingEmoji}>🧺</Text>
        <Text style={styles.loadingText}>{t.loading}</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!state.setup ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={SetupScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs"      component={MainTabs} />
          <Stack.Screen name="OrderEntry"    component={OrderEntryScreen} />
          <Stack.Screen name="BillingDetail" component={BillingDetailScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: COLORS.white, borderTopWidth: 2, borderTopColor: COLORS.border, height: 62, paddingBottom: 6, paddingTop: 4 },
  tabLabel: { fontSize: 10, fontFamily: TNR_BOLD, fontWeight: '700' },
  tabEmoji: { fontSize: 20 },
  activeTab: { borderTopWidth: 3, borderTopColor: COLORS.green, paddingTop: 2, marginTop: -4 },
  inactiveTab: { paddingTop: 2 },
  loading: { flex: 1, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  loadingEmoji: { fontSize: 64 },
  loadingText: { fontSize: 18, fontFamily: TNR_BOLD, fontWeight: '700', color: COLORS.gray, marginTop: 12 },
});
