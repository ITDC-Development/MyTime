export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'blocked';
  jiraAccountId: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  preferences: UserPreferences;
}

export interface UserPreferences {
  showPauses: boolean;
  columns: {
    projectReport: string[];
    companyReport: string[];
    overview: string[];
  };
  lastSelectedUser: string | null;
}
