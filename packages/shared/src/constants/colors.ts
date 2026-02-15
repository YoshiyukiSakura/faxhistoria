// Map colors for countries not in the INITIAL_COUNTRIES list
export const DEFAULT_COUNTRY_COLORS: Record<string, string> = {
  // Default fallback
  default: '#9CA3AF',
};

// UI colors
export const UI_COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceHover: '#334155',
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
} as const;

// Event type colors
export const EVENT_TYPE_COLORS: Record<string, string> = {
  ALLIANCE: '#3B82F6',
  ANNEXATION: '#EF4444',
  TRADE_DEAL: '#22C55E',
  WAR: '#DC2626',
  PEACE: '#10B981',
  NARRATIVE: '#8B5CF6',
  ECONOMIC_SHIFT: '#F59E0B',
  NARRATIVE_FALLBACK: '#6B7280',
};
