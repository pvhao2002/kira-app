import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '@/screens/LoginScreen';
import { AuthStackParamList } from '@/types/navigation';

const Stack = createStackNavigator<AuthStackParamList>();

interface AuthStackProps {
  onLogin: () => void;
}

export default function AuthStack({ onLogin }: AuthStackProps) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onLogin={onLogin} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}