import { Card, Transaction, Match, Team } from '@/types';

// Mock card data
export const mockCards: Card[] = [
  {
    id: 'CARD001',
    type: 'credit',
    bankName: 'Vietcombank',
    cardNumber: '**** **** **** 1234',
    holderName: 'Nguyen Van A',
    balance: 15000000,
    currency: 'VND',
    expiryDate: new Date('2027-12-31'),
    isActive: true,
  },
  {
    id: 'CARD002',
    type: 'debit',
    bankName: 'Techcombank',
    cardNumber: '**** **** **** 5678',
    holderName: 'Nguyen Van A',
    balance: 8500000,
    currency: 'VND',
    expiryDate: new Date('2026-08-31'),
    isActive: true,
  },
  {
    id: 'CARD003',
    type: 'banking',
    bankName: 'BIDV',
    cardNumber: '**** **** **** 9012',
    holderName: 'Nguyen Van A',
    balance: 2300000,
    currency: 'VND',
    expiryDate: new Date('2025-06-30'),
    isActive: false,
  },
];

// Mock transaction data with proper Transaction interface
export const mockTransactions: Transaction[] = [
  {
    id: 'TXN001',
    cardId: 'CARD001',
    type: 'credit',
    amount: 2000000,
    currency: 'VND',
    description: 'Lương tháng 12',
    timestamp: new Date('2024-12-01T10:00:00'),
    status: 'completed',
    reference: 'SAL202412001',
  },
  {
    id: 'TXN002',
    cardId: 'CARD001',
    type: 'debit',
    amount: 150000,
    currency: 'VND',
    description: 'Mua sắm tại Vinmart',
    timestamp: new Date('2024-12-02T14:30:00'),
    status: 'completed',
    reference: 'PUR202412002',
  },
  {
    id: 'TXN003',
    cardId: 'CARD001',
    type: 'debit',
    amount: 500000,
    currency: 'VND',
    description: 'Thanh toán hóa đơn điện',
    timestamp: new Date('2024-12-03T09:15:00'),
    status: 'completed',
    reference: 'BILL202412003',
  },
  {
    id: 'TXN004',
    cardId: 'CARD002',
    type: 'credit',
    amount: 300000,
    currency: 'VND',
    description: 'Hoàn tiền từ Shopee',
    timestamp: new Date('2024-12-04T16:45:00'),
    status: 'completed',
    reference: 'REF202412004',
  },
  {
    id: 'TXN005',
    cardId: 'CARD002',
    type: 'debit',
    amount: 80000,
    currency: 'VND',
    description: 'Cà phê với bạn bè',
    timestamp: new Date('2024-12-05T11:20:00'),
    status: 'pending',
    reference: 'PUR202412005',
  },
  {
    id: 'TXN006',
    cardId: 'CARD002',
    type: 'debit',
    amount: 1200000,
    currency: 'VND',
    description: 'Mua vé máy bay',
    timestamp: new Date('2024-12-06T08:30:00'),
    status: 'completed',
    reference: 'FLT202412006',
  },
  {
    id: 'TXN007',
    cardId: 'CARD002',
    type: 'credit',
    amount: 50000,
    currency: 'VND',
    description: 'Cashback từ thẻ tín dụng',
    timestamp: new Date('2024-12-07T12:00:00'),
    status: 'completed',
    reference: 'CB202412007',
  },
  {
    id: 'TXN008',
    cardId: 'CARD001',
    type: 'debit',
    amount: 25000,
    currency: 'VND',
    description: 'Phí chuyển khoản',
    timestamp: new Date('2024-12-08T14:15:00'),
    status: 'failed',
    reference: 'FEE202412008',
  },
  {
    id: 'TXN009',
    cardId: 'CARD003',
    type: 'debit',
    amount: 200000,
    currency: 'VND',
    description: 'Rút tiền ATM',
    timestamp: new Date('2024-12-09T09:30:00'),
    status: 'completed',
    reference: 'ATM202412009',
  },
  {
    id: 'TXN010',
    cardId: 'CARD003',
    type: 'credit',
    amount: 100000,
    currency: 'VND',
    description: 'Lãi tiết kiệm',
    timestamp: new Date('2024-12-10T15:00:00'),
    status: 'completed',
    reference: 'INT202412010',
  },
];

// Helper functions
export const getCardById = (cardId: string): Card | undefined => {
  return mockCards.find(card => card.id === cardId);
};

export const getTransactionsByCardId = (cardId: string): Transaction[] => {
  return mockTransactions.filter(transaction => transaction.cardId === cardId);
};

export const getActiveCards = (): Card[] => {
  return mockCards.filter(card => card.isActive);
};

export const getAllCards = (): Card[] => {
  return mockCards;
};

export const getAllTransactions = (): Transaction[] => {
  return mockTransactions;
};

// Group transactions by card
export const getTransactionsGroupedByCard = (): { [cardId: string]: Transaction[] } => {
  return mockTransactions.reduce((groups, transaction) => {
    const cardId = transaction.cardId;
    if (!groups[cardId]) {
      groups[cardId] = [];
    }
    groups[cardId].push(transaction);
    return groups;
  }, {} as { [cardId: string]: Transaction[] });
};

// Search transactions
export const searchTransactions = (query: string): Transaction[] => {
  const lowercaseQuery = query.toLowerCase();
  return mockTransactions.filter(transaction => 
    transaction.description.toLowerCase().includes(lowercaseQuery) ||
    transaction.reference?.toLowerCase().includes(lowercaseQuery) ||
    transaction.id.toLowerCase().includes(lowercaseQuery)
  );
};

// Filter transactions by multiple criteria
export interface TransactionFilter {
  cardIds?: string[];
  types?: ('credit' | 'debit')[];
  statuses?: ('completed' | 'pending' | 'failed')[];
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
}

export const filterTransactions = (filter: TransactionFilter): Transaction[] => {
  return mockTransactions.filter(transaction => {
    // Filter by card IDs
    if (filter.cardIds && filter.cardIds.length > 0) {
      if (!filter.cardIds.includes(transaction.cardId)) {
        return false;
      }
    }

    // Filter by transaction types
    if (filter.types && filter.types.length > 0) {
      if (!filter.types.includes(transaction.type)) {
        return false;
      }
    }

    // Filter by statuses
    if (filter.statuses && filter.statuses.length > 0) {
      if (!filter.statuses.includes(transaction.status)) {
        return false;
      }
    }

    // Filter by date range
    if (filter.dateFrom && transaction.timestamp < filter.dateFrom) {
      return false;
    }
    if (filter.dateTo && transaction.timestamp > filter.dateTo) {
      return false;
    }

    // Filter by amount range
    if (filter.amountMin && transaction.amount < filter.amountMin) {
      return false;
    }
    if (filter.amountMax && transaction.amount > filter.amountMax) {
      return false;
    }

    return true;
  });
};

// Mock teams data
export const mockTeams: Team[] = [
  { id: 'TEAM001', name: 'Manchester United', logo: '🔴', country: 'England' },
  { id: 'TEAM002', name: 'Liverpool', logo: '🔴', country: 'England' },
  { id: 'TEAM003', name: 'Real Madrid', logo: '⚪', country: 'Spain' },
  { id: 'TEAM004', name: 'Barcelona', logo: '🔵', country: 'Spain' },
  { id: 'TEAM005', name: 'Bayern Munich', logo: '🔴', country: 'Germany' },
  { id: 'TEAM006', name: 'Borussia Dortmund', logo: '🟡', country: 'Germany' },
  { id: 'TEAM007', name: 'Paris Saint-Germain', logo: '🔵', country: 'France' },
  { id: 'TEAM008', name: 'Olympique Marseille', logo: '⚪', country: 'France' },
  { id: 'TEAM009', name: 'Juventus', logo: '⚫', country: 'Italy' },
  { id: 'TEAM010', name: 'AC Milan', logo: '🔴', country: 'Italy' },
  { id: 'TEAM011', name: 'Chelsea', logo: '🔵', country: 'England' },
  { id: 'TEAM012', name: 'Arsenal', logo: '🔴', country: 'England' },
];

// Mock matches data
export const mockMatches: Match[] = [
  {
    id: 'MATCH001',
    homeTeam: mockTeams[0], // Manchester United
    awayTeam: mockTeams[1], // Liverpool
    league: 'Premier League',
    venue: 'Old Trafford',
    startTime: new Date('2024-12-15T15:00:00'),
    status: 'scheduled',
    odds: {
      oneXTwo: [2.1, 3.4, 3.2],
      overUnder: [1.9, 1.9],
      handicap: [1.8, 2.0],
      corners: [1.7, 2.1],
    },
    prediction: {
      accuracy: 78,
      recommendation: 'Tài',
      analysis: 'Cả hai đội đều có phong độ tấn công tốt, dự kiến trận đấu sẽ có nhiều bàn thắng.',
    },
  },
  {
    id: 'MATCH002',
    homeTeam: mockTeams[2], // Real Madrid
    awayTeam: mockTeams[3], // Barcelona
    league: 'La Liga',
    venue: 'Santiago Bernabéu',
    startTime: new Date('2024-12-16T20:00:00'),
    status: 'live',
    score: { home: 1, away: 0 },
    odds: {
      oneXTwo: [1.8, 3.6, 4.2],
      overUnder: [2.0, 1.8],
      handicap: [1.9, 1.9],
      corners: [1.8, 2.0],
    },
    prediction: {
      accuracy: 85,
      recommendation: 'Chủ nhà thắng',
      analysis: 'Real Madrid có lợi thế sân nhà và phong độ tốt hơn trong những trận đấu gần đây.',
    },
  },
  {
    id: 'MATCH003',
    homeTeam: mockTeams[4], // Bayern Munich
    awayTeam: mockTeams[5], // Borussia Dortmund
    league: 'Bundesliga',
    venue: 'Allianz Arena',
    startTime: new Date('2024-12-17T18:30:00'),
    status: 'scheduled',
    odds: {
      oneXTwo: [1.6, 4.0, 5.5],
      overUnder: [1.7, 2.1],
      handicap: [1.8, 2.0],
      corners: [1.9, 1.9],
    },
    prediction: {
      accuracy: 82,
      recommendation: 'Tài + Chủ nhà thắng',
      analysis: 'Bayern có sức mạnh vượt trội và thường ghi nhiều bàn thắng trên sân nhà.',
    },
  },
  {
    id: 'MATCH004',
    homeTeam: mockTeams[6], // PSG
    awayTeam: mockTeams[7], // Marseille
    league: 'Ligue 1',
    venue: 'Parc des Princes',
    startTime: new Date('2024-12-14T21:00:00'),
    status: 'finished',
    score: { home: 3, away: 1 },
    odds: {
      oneXTwo: [1.4, 4.5, 7.0],
      overUnder: [1.8, 2.0],
      handicap: [1.7, 2.1],
      corners: [1.8, 2.0],
    },
    prediction: {
      accuracy: 88,
      recommendation: 'Chủ nhà thắng',
      analysis: 'PSG có đội hình mạnh hơn hẳn và thống trị các cuộc đối đầu gần đây.',
    },
  },
  {
    id: 'MATCH005',
    homeTeam: mockTeams[8], // Juventus
    awayTeam: mockTeams[9], // AC Milan
    league: 'Serie A',
    venue: 'Allianz Stadium',
    startTime: new Date('2024-12-18T19:45:00'),
    status: 'scheduled',
    odds: {
      oneXTwo: [2.3, 3.2, 3.1],
      overUnder: [2.1, 1.7],
      handicap: [1.9, 1.9],
      corners: [1.8, 2.0],
    },
    prediction: {
      accuracy: 75,
      recommendation: 'Xỉu',
      analysis: 'Cả hai đội đều có hàng thủ chắc chắn, trận đấu có thể ít bàn thắng.',
    },
  },
  {
    id: 'MATCH006',
    homeTeam: mockTeams[10], // Chelsea
    awayTeam: mockTeams[11], // Arsenal
    league: 'Premier League',
    venue: 'Stamford Bridge',
    startTime: new Date('2024-12-19T17:30:00'),
    status: 'scheduled',
    odds: {
      oneXTwo: [2.5, 3.3, 2.8],
      overUnder: [1.9, 1.9],
      handicap: [2.0, 1.8],
      corners: [1.7, 2.1],
    },
    prediction: {
      accuracy: 72,
      recommendation: 'Hòa',
      analysis: 'Hai đội có sức mạnh tương đương, khả năng cao sẽ có kết quả hòa.',
    },
  },
];

// Sports data helper functions
export const getMatchById = (matchId: string): Match | undefined => {
  return mockMatches.find(match => match.id === matchId);
};

export const getMatchesByStatus = (status: 'scheduled' | 'live' | 'finished'): Match[] => {
  return mockMatches.filter(match => match.status === status);
};

export const getLiveMatches = (): Match[] => {
  return getMatchesByStatus('live');
};

export const getUpcomingMatches = (): Match[] => {
  return getMatchesByStatus('scheduled');
};

export const getFinishedMatches = (): Match[] => {
  return getMatchesByStatus('finished');
};

export const getMatchesByLeague = (league: string): Match[] => {
  return mockMatches.filter(match => match.league === league);
};

export const getTodayMatches = (): Match[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return mockMatches.filter(match => {
    const matchDate = new Date(match.startTime);
    return matchDate >= today && matchDate < tomorrow;
  });
};

export const getAllMatches = (): Match[] => {
  return mockMatches;
};

export const getTeamById = (teamId: string): Team | undefined => {
  return mockTeams.find(team => team.id === teamId);
};

export const getAllTeams = (): Team[] => {
  return mockTeams;
};