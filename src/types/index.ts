export interface Member {
  id: string;
  name: string;
  monthlySalary: number;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string; // 親カテゴリID（子カテゴリのみ設定）
}

export interface WeekEntry {
  id: string;
  memberId: string;
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string;   // YYYY-MM-DD (Sunday)
  workDays?: number; // 出勤日数
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
