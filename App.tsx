// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider } from './src/storage/AppContext';
import { LanguageProvider } from './src/storage/LanguageContext';
import AppNavigator from './src/navigation/AppNavigator';
import { COLORS } from './src/utils/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.green} />
      <LanguageProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
