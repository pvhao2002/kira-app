export interface HealthProfile {
  heightCm: number; birthDate: string; formulaSex: 'MALE' | 'FEMALE'; goal: 'LOSE' | 'MAINTAIN' | 'GAIN';
  timezone: string; activityFactor: number; calorieAdjustment: number; foodPreferences: string; allergies: string;
  avoidedFoods: string; preparationMinutes: number; exerciseExperience: string; equipment: string;
  availability: string; movementRestrictions: string;
}
export interface HealthProfileView { data: HealthProfile; version: number; }
export interface HealthWeight { date: string; kg: number; }
export interface HealthPlanItem {
  date: string; kind: 'MEAL' | 'WORKOUT' | 'REST'; title: string; portion: string; calories: number;
  minutes: number; notes: string; completed: boolean;
}
export interface HealthPlanData { title: string; items: HealthPlanItem[]; warnings: string[]; }
export interface HealthPlan { id: string; weekStart: string; status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; data: HealthPlanData; version: number; }
export interface HealthJournalData { kind: 'MEAL' | 'WORKOUT'; title: string; calories: number; minutes: number; notes: string; }
export interface HealthJournal { id: string; date: string; data: HealthJournalData; version: number; }
export interface HealthWorkout { id: string; start: string; end: string; type: string; calories: number | null; source: string; }
export interface HealthSummary {
  date: string; bmi: number | null; restingEstimate: number | null; eatenCalories: number; targetCalories: number | null;
  activeCalories: number | null; restingCalories: number | null; totalBurned: number | null; netCalories: number | null;
  targetSource: string; provisional: boolean; steps: number | null; workouts: HealthWorkout[];
}
export interface HealthDevice { deviceId: string; generation: string; timezone: string; lastRevision: number; lastSyncedAt: string | null; }
export interface HealthAiJob { id: string; status: string; planId: string | null; errorCode: string | null; }
