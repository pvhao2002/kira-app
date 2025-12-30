# Design Document

## Overview

The Vietnamese Sports and Finance Mobile App is a React Native Expo application that combines financial card management with sports betting analytics. The app follows iOS Human Interface Guidelines and uses native React Native components to deliver a smooth, performant experience that works seamlessly in Expo Go.

The application architecture emphasizes modularity, with clear separation between financial services, sports data, user management, and UI components. The design prioritizes user experience with intuitive navigation, responsive layouts, and comprehensive theme support.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Screens   │ │ Components  │ │ Navigation  │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Hooks     │ │   Context   │ │  Services   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │AsyncStorage │ │ API Client  │ │ Mock Data   │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Navigation Structure

The app uses React Navigation v6 with a combination of Stack and Tab navigators:

```
AuthStack (when not authenticated)
├── LoginScreen

MainTabs (when authenticated)
├── HomeTab (Stack Navigator)
│   ├── CardManagementScreen
│   └── TransactionDetailScreen
├── TransactionTab (Stack Navigator)
│   ├── TransactionHistoryScreen
│   └── TransactionDetailScreen
├── SportsTab (Stack Navigator)
│   ├── SportsAnalyticsScreen
│   ├── MatchDetailScreen
│   └── BettingHistoryScreen
└── ProfileTab (Stack Navigator)
    ├── ProfileScreen
    └── SettingsScreen
```

## Components and Interfaces

### Core Components

#### Theme Provider
- Manages light/dark mode switching based on system preferences
- Provides consistent color schemes and typography across the app
- Exposes theme context to all child components

#### Safe Area Handler
- Wraps all screens with proper iOS safe area handling
- Manages notch, status bar, and home indicator spacing
- Provides consistent padding and margins

#### Card Component
- Displays financial card information with Vietnamese formatting
- Supports multiple card types (credit, debit, banking)
- Handles balance display with proper VND formatting

#### Transaction List Component
- Renders scrollable transaction history
- Implements color-coded transaction types (green/red)
- Supports pull-to-refresh and infinite scrolling

#### Sports Match Component
- Displays match information with team logos and statistics
- Shows betting odds in organized market sections
- Handles live match indicators and status updates

#### Form Components
- Input fields with Vietnamese placeholder text
- Validation feedback with proper error messaging
- Secure password input with visibility toggle

### Screen Components

#### LoginScreen
- Email/password authentication form
- Biometric authentication options (Face ID/Touch ID)
- Social login integration (Google, Facebook)
- Password recovery functionality

#### CardManagementScreen
- Primary card display with balance and details
- Transaction initiation interface
- Card selection for multiple cards
- Quick action buttons for common operations

#### TransactionHistoryScreen
- Chronological transaction list with filtering
- Search functionality for transaction lookup
- Category-based transaction grouping
- Export functionality for statements

#### SportsAnalyticsScreen
- Match prediction cards with accuracy percentages
- League-based match organization
- Live match indicators and updates
- Betting market odds display

#### ProfileScreen
- User information display and editing
- Security settings management
- Premium status and benefits
- App preferences and notifications

## Data Models

### User Model
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isPremium: boolean;
  createdAt: Date;
  preferences: UserPreferences;
}

interface UserPreferences {
  notifications: boolean;
  biometricAuth: boolean;
  language: 'vi' | 'en';
  currency: 'VND';
}
```

### Card Model
```typescript
interface Card {
  id: string;
  type: 'credit' | 'debit' | 'banking';
  bankName: string;
  cardNumber: string; // masked
  holderName: string;
  balance: number;
  currency: 'VND';
  expiryDate: Date;
  isActive: boolean;
}
```

### Transaction Model
```typescript
interface Transaction {
  id: string;
  cardId: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: 'VND';
  description: string;
  timestamp: Date;
  status: 'completed' | 'pending' | 'failed';
  reference?: string;
}
```

### Sports Match Model
```typescript
interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  league: string;
  venue: string;
  startTime: Date;
  status: 'scheduled' | 'live' | 'finished';
  score?: Score;
  odds: BettingOdds;
  prediction?: MatchPrediction;
}

interface Team {
  id: string;
  name: string;
  logo: string;
  country: string;
}

interface BettingOdds {
  handicap: number[];
  overUnder: number[];
  oneXTwo: number[];
  corners: number[];
}

interface MatchPrediction {
  accuracy: number;
  recommendation: string;
  analysis: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, I'll focus on the most critical properties that provide unique validation value:

**Property 1: Card information completeness**
*For any* card data, when rendering the card management screen, the displayed output should contain balance, card holder name, and expiry date information
**Validates: Requirements 1.1**

**Property 2: VND currency formatting consistency**
*For any* numeric amount, when formatting as Vietnamese dong, the output should include "VND" suffix and proper thousand separators (periods for thousands)
**Validates: Requirements 1.2**

**Property 3: Transaction validation completeness**
*For any* transaction data, when validating required fields, all mandatory fields (amount, recipient, card) must be present and valid before processing can proceed
**Validates: Requirements 1.4**

**Property 4: Transaction color coding consistency**
*For any* transaction, when displaying the transaction type, credit transactions should render with green color styling and debit transactions should render with red color styling
**Validates: Requirements 2.2**

**Property 5: Match information completeness**
*For any* match data, when displaying match information, the output should contain team names, league information, match times, and venue details
**Validates: Requirements 3.2**

**Property 6: Betting markets completeness**
*For any* match with betting odds, when displaying betting information, all four markets (1X2, Over/Under, Handicap, Corners) should be present in the rendered output
**Validates: Requirements 3.3**

**Property 7: Profile information completeness**
*For any* user data, when displaying the profile screen, the output should contain name, email, and premium status information
**Validates: Requirements 4.1**

**Property 8: Authentication input validation**
*For any* credential input, when validating email format, invalid email formats should be rejected with appropriate error messages
**Validates: Requirements 5.2**

**Property 9: Safe area layout consistency**
*For any* screen content, when displaying on iOS devices, all content should be positioned within safe area bounds to avoid notch and home indicator overlap
**Validates: Requirements 6.3**

**Property 10: Theme consistency**
*For any* component, when the system theme is set to light mode, all themed elements should use light color scheme values consistently
**Validates: Requirements 7.1**

**Property 11: Dark theme consistency**
*For any* component, when the system theme is set to dark mode, all themed elements should use dark color scheme values consistently
**Validates: Requirements 7.2**

## Error Handling

### Network Error Handling
- Implement retry mechanisms for failed API calls
- Display user-friendly error messages for network timeouts
- Provide offline mode indicators when network is unavailable
- Cache critical data for offline access

### Validation Error Handling
- Real-time form validation with immediate feedback
- Clear error messages in Vietnamese language
- Field-specific error highlighting with color and icons
- Prevention of form submission with invalid data

### Authentication Error Handling
- Secure handling of authentication failures
- Account lockout protection after multiple failed attempts
- Session expiration handling with automatic re-authentication
- Biometric authentication fallback to password

### Data Error Handling
- Graceful handling of malformed API responses
- Default values for missing data fields
- Error boundaries to prevent app crashes
- Logging of errors for debugging purposes

## Testing Strategy

### Dual Testing Approach

The application will implement both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Testing:**
- Specific examples that demonstrate correct behavior
- Integration points between components
- Edge cases and error conditions
- Mock data scenarios for isolated testing

**Property-Based Testing:**
- Universal properties that should hold across all inputs
- Automated generation of test cases with random data
- Verification of correctness properties defined above
- Minimum 100 iterations per property test

### Testing Framework Selection

**Property-Based Testing Library:** fast-check
- Chosen for its excellent TypeScript support and React Native compatibility
- Provides sophisticated generators for complex data structures
- Integrates well with Jest testing framework
- Supports shrinking for minimal failing examples

**Unit Testing Framework:** Jest with React Native Testing Library
- Standard testing framework for React Native applications
- Excellent component testing capabilities
- Built-in mocking and assertion utilities
- Full Expo Go compatibility

### Testing Requirements

Each property-based test must:
- Run a minimum of 100 iterations to ensure statistical confidence
- Include explicit comments referencing the design document property
- Use the format: `**Feature: vietnamese-sports-finance-app, Property {number}: {property_text}**`
- Generate realistic test data that matches production data patterns
- Verify the specific correctness property without over-testing edge cases

### Test Data Generation Strategy

**Smart Generators:**
- Vietnamese-specific data generators (names, addresses, phone numbers)
- Realistic financial data (VND amounts, card numbers, transaction types)
- Sports data generators (team names, match schedules, betting odds)
- User profile generators with appropriate constraints

**Constraint-Based Generation:**
- Email generators that produce valid and invalid formats
- Currency amount generators within realistic ranges
- Date generators for past, present, and future scenarios
- Card data generators with proper validation rules

### Performance Testing Considerations

While property-based testing focuses on correctness, the testing strategy acknowledges performance requirements:
- Scroll performance testing through manual verification
- Memory usage monitoring during development
- Network request optimization validation
- Theme switching performance verification

The testing approach prioritizes functional correctness through automated property verification while relying on manual testing and development best practices for performance characteristics that are difficult to automate.