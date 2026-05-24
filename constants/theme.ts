export const COLORS = {
  primary: '#0F62FE',
  primaryDark: '#0043CE',
  primaryLight: '#4589FF',
  secondary: '#0EA5E9',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  textLight: '#94A3B8',
};

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#EF4444',
  Groceries: '#F97316',
  Rent: '#8B5CF6',
  Travel: '#3B82F6',
  Shopping: '#EC4899',
  Subscriptions: '#6366F1',
  Bills: '#F59E0B',
  Entertainment: '#10B981',
  Investments: '#14B8A6',
  Transfers: '#64748B',
  Others: '#94A3B8',
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_COLORS);

export const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };

export const FONT = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
  sizes: { xs: 11, sm: 13, md: 15, lg: 17, xl: 20, xxl: 28, xxxl: 36 },
};
