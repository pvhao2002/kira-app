import { NavigatorScreenParams } from '@react-navigation/native';

// Authentication Stack Parameters
export type AuthStackParamList = {
  Login: undefined;
};

// Main Tab Parameters
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  TransactionTab: NavigatorScreenParams<TransactionStackParamList>;
  SportsTab: NavigatorScreenParams<SportsStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// Individual Tab Stack Parameters
export type HomeStackParamList = {
  CardManagement: undefined;
  TransactionDetail: { transactionId: string };
};

export type TransactionStackParamList = {
  TransactionHistory: undefined;
  TransactionDetail: { transactionId: string };
};

export type SportsStackParamList = {
  SportsAnalytics: undefined;
  MatchDetail: { matchId: string };
  BettingHistory: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  Settings: undefined;
};

// Root Stack Parameters
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}