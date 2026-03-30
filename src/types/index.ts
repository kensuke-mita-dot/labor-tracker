export interface Member {
  id: string;
  name: string;
  monthlySalary: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface WeekEntry {
  id: string;
  memberId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  hours: Record<string, number>; // categoryId -> hours
  submittedAt: string;
}

// monthKey "YYYY-MM" -> memberId -> categoryId -> hours
export type MonthlyData = Record<string, Record<string, Record<string, number>>>;

export interface AppState {
  members: Member[];
  categories: Category[];
  weekEntries: WeekEntry[];
  monthlyData: MonthlyData;
}

export type Screen = 'input' | 'check' | 'admin';
