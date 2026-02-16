export const SUPPORTED_LANGUAGES = ['zh-CN', 'en-US'] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

interface HomeSignal {
  label: string;
  value: string;
  progress: number;
}

interface HomeFeature {
  title: string;
  description: string;
}

interface HomeSnapshotStat {
  value: string;
  label: string;
}

interface HomeMessages {
  brand: string;
  topSignIn: string;
  topStartFree: string;
  languageSwitchLabel: string;
  badge: string;
  alpha: string;
  title: string;
  subtitle: string;
  description: string;
  ctaGuest: string;
  ctaGuestLoading: string;
  ctaCreateAccount: string;
  ctaExistingAccount: string;
  errorDismiss: string;
  featureCards: HomeFeature[];
  worldPulse: string;
  liveSimulation: string;
  panelTitle: string;
  panelDescription: string;
  signals: HomeSignal[];
  snapshotTitle: string;
  snapshotStats: HomeSnapshotStat[];
}

interface CommonMessages {
  languageNames: Record<Language, string>;
}

export interface Messages {
  common: CommonMessages;
  home: HomeMessages;
}

export const messages: Record<Language, Messages> = {
  'zh-CN': {
    common: {
      languageNames: {
        'zh-CN': '中文',
        'en-US': 'EN',
      },
    },
    home: {
      brand: 'FaxHistoria',
      topSignIn: '登录',
      topStartFree: '免费开始',
      languageSwitchLabel: '切换语言',
      badge: 'AI 历史战略沙盘',
      alpha: '测试版',
      title: '重写历史，不只是旁观历史。',
      subtitle: '在每一个战略回合里，定义下一版世界秩序。',
      description:
        'FaxHistoria 把外交、经济、军事与危机应对放进同一张可解释的 AI 沙盘。每次提交回合，世界都会被真实推进，而不是重复刷新的脚本。',
      ctaGuest: '游客立即开局',
      ctaGuestLoading: '启动中...',
      ctaCreateAccount: '创建账号',
      ctaExistingAccount: '我已有账号',
      errorDismiss: '关闭',
      featureCards: [
        {
          title: 'AI 回合裁决',
          description:
            '每一步策略都由 AI 生成事件并经规则仲裁，结果可追溯、可解释。',
        },
        {
          title: '持久世界状态',
          description:
            '外交、经济、稳定度、军事实力持续演化，不会在下一回合被重置。',
        },
        {
          title: '浏览器即时推进',
          description:
            '无需下载客户端，直接在网页里推进回合、查看时间线和国家面板。',
        },
      ],
      worldPulse: '世界脉冲',
      liveSimulation: '实时推演',
      panelTitle: '战略沙盘实时反馈',
      panelDescription:
        '从“提交行动”到“事件落库”，你可以观察每一个阶段的推进轨迹。决策不是黑盒，而是一套可验证的世界演化过程。',
      signals: [
        { label: '外交温度', value: '高压博弈', progress: 78 },
        { label: '经济景气', value: '温和增长', progress: 63 },
        { label: '军事紧张', value: '持续升温', progress: 84 },
        { label: '公共稳定', value: '可控震荡', progress: 57 },
      ],
      snapshotTitle: '战区快照',
      snapshotStats: [
        { value: '12', label: '活跃战线' },
        { value: '37', label: '外交动作' },
        { value: '4.8m', label: '受影响人口' },
      ],
    },
  },
  'en-US': {
    common: {
      languageNames: {
        'zh-CN': '中文',
        'en-US': 'EN',
      },
    },
    home: {
      brand: 'FaxHistoria',
      topSignIn: 'Sign In',
      topStartFree: 'Start Free',
      languageSwitchLabel: 'Switch language',
      badge: 'AI Alternate History Sandbox',
      alpha: 'Alpha',
      title: 'Rewrite history, not just watch it unfold.',
      subtitle: 'Define the next world order, one strategic turn at a time.',
      description:
        'FaxHistoria is an explainable AI strategy sandbox where diplomacy, economy, military pressure, and crisis response evolve in one shared world state. Every turn moves history forward.',
      ctaGuest: 'Play instantly as guest',
      ctaGuestLoading: 'Launching...',
      ctaCreateAccount: 'Create account',
      ctaExistingAccount: 'I already have an account',
      errorDismiss: 'dismiss',
      featureCards: [
        {
          title: 'AI Turn Arbitration',
          description:
            'Every action generates AI events and passes through deterministic game rules for transparent outcomes.',
        },
        {
          title: 'Persistent World State',
          description:
            'Diplomacy, economy, public stability, and military power evolve continuously across turns.',
        },
        {
          title: 'Instant Browser Play',
          description:
            'No install required. Push turns, inspect timelines, and steer your nation directly from the web.',
        },
      ],
      worldPulse: 'World Pulse',
      liveSimulation: 'Live Simulation',
      panelTitle: 'Live Strategic Theater Feedback',
      panelDescription:
        'From action submission to persisted events, each stage is observable. Decisions are not a black box. They are a traceable simulation pipeline.',
      signals: [
        { label: 'Diplomatic Heat', value: 'High pressure', progress: 78 },
        { label: 'Economic Outlook', value: 'Moderate growth', progress: 63 },
        { label: 'Military Tension', value: 'Escalating', progress: 84 },
        { label: 'Public Stability', value: 'Controlled volatility', progress: 57 },
      ],
      snapshotTitle: 'Theater Snapshot',
      snapshotStats: [
        { value: '12', label: 'Active fronts' },
        { value: '37', label: 'Diplomatic moves' },
        { value: '4.8m', label: 'Citizens impacted' },
      ],
    },
  },
};

export const FALLBACK_LANGUAGE: Language = 'en-US';

export function normalizeLanguage(input: string | null | undefined): Language | null {
  if (!input) return null;

  const lower = input.toLowerCase();
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('en')) return 'en-US';

  return null;
}
