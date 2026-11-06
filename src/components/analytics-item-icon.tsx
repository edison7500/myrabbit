import {
  AppWindow, ArrowUpRight, Bot, Circle, CircleDot, Code2, Compass, Cpu, Flame, Gamepad2,
  Globe, Grid2X2, Laptop, Mail, MessagesSquare, Monitor, MonitorSmartphone, Orbit, Play,
  Rss, ScanLine, Search, Shield, Smartphone, Tablet, Terminal, Tv, Watch, type LucideIcon,
} from 'lucide-react-native';
import { createElement } from 'react';
import { View } from 'react-native';

import { createThemedStyles } from '@/constants/themed-styles';
import { useTheme } from '@/stores/theme';

export type AnalyticsIconKind = 'browser' | 'device_type' | 'operating_system' | 'dimensions' | 'referrer';

const referrerDomains: readonly [LucideIcon, readonly string[]][] = [
  [Search, ['bing.com', 'duckduckgo.com', 'baidu.com', 'yandex.com', 'yandex.ru', 'ecosia.org',
    'search.brave.com', 'startpage.com', 'qwant.com', 'sogou.com', 'naver.com', 'seznam.cz', 'search.yahoo.com']],
  [Code2, ['github.com', 'gitlab.com', 'bitbucket.org', 'codeberg.org', 'sourceforge.net']],
  [Play, ['youtube.com', 'youtu.be', 'vimeo.com', 'twitch.tv', 'dailymotion.com', 'bilibili.com', 'tiktok.com']],
  [Mail, ['mail.google.com', 'outlook.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com',
    'mail.proton.me', 'protonmail.com', 'mail.163.com', 'mail.qq.com']],
  [Rss, ['feedly.com', 'inoreader.com', 'newsblur.com', 'feedbin.com', 'theoldreader.com']],
  [MessagesSquare, ['facebook.com', 'fb.com', 'instagram.com', 'threads.net', 'threads.com', 'x.com', 'twitter.com',
    't.co', 'linkedin.com', 'reddit.com', 'old.reddit.com', 'pinterest.com', 'news.ycombinator.com',
    'mastodon.social', 'bsky.app', 'weibo.com', 'zhihu.com', 'xiaohongshu.com', 't.me', 'telegram.org']],
];

function referrerIcon(value: string): LucideIcon {
  const source = value.trim().toLowerCase();
  if (!source || /^(?:\(?direct\)?|\(?none\)?|-)$/u.test(source)) return ArrowUpRight;
  if (source.startsWith('mailto:')) return Mail;
  try {
    const host = new URL(/^[a-z][a-z\d+.-]*:\/\//u.test(source) ? source : `https://${source}`).hostname.replace(/\.$/u, '');
    for (const [Icon, domains] of referrerDomains) {
      if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return Icon;
    }
    if (/(?:^|\.)(?:google|yahoo)\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/u.test(host)) return Search;
  } catch { /* Unrecognized self-hosted values keep a generic icon. */ }
  return Globe;
}

export function getAnalyticsItemIcon(kind: AnalyticsIconKind, value: string): LucideIcon {
  if (kind === 'referrer') return referrerIcon(value);
  if (kind === 'dimensions') return ScanLine;
  const name = value.trim().toLowerCase().replace(/[._-]+/gu, ' ').replace(/([a-z])(?=\d)/gu, '$1 ');
  if (kind === 'browser') {
    if (/\b(?:chrome|chromium|crios)\b/u.test(name)) return CircleDot;
    if (/\b(?:safari|webkit)\b/u.test(name)) return Compass;
    if (/\b(?:firefox|fxios)\b/u.test(name)) return Flame;
    if (/\b(?:ie|msie|internet explorer|iemobile|samsung internet)\b/u.test(name)) return Orbit;
    if (/\b(?:edge|edg|edga|edgios)\b/u.test(name)) return Globe;
    if (/\bopera\b/u.test(name)) return Circle;
    if (/\bbrave\b/u.test(name)) return Shield;
    return AppWindow;
  }
  if (kind === 'device_type') {
    if (/\b(?:tablet|ipad)\b/u.test(name)) return Tablet;
    if (/\b(?:mobile|phone|smartphone|iphone)\b/u.test(name)) return Smartphone;
    if (/\b(?:desktop|computer|laptop)\b/u.test(name)) return Monitor;
    if (/\b(?:console|playstation|xbox)\b/u.test(name)) return Gamepad2;
    if (/\b(?:smarttv|smart tv|tv|television)\b/u.test(name)) return Tv;
    if (/\b(?:wearable|watch|smartwatch)\b/u.test(name)) return Watch;
    if (/\b(?:bot|crawler)\b/u.test(name)) return Bot;
    return MonitorSmartphone;
  }
  if (/\bwindows\b/u.test(name)) return Grid2X2;
  if (/\b(?:macos|mac os|os x)\b/u.test(name)) return Laptop;
  if (/\b(?:ios|ipados)\b/u.test(name)) return Smartphone;
  if (/\bandroid\b/u.test(name)) return Bot;
  if (/\b(?:chrome os|chromeos|chromium os)\b/u.test(name)) return AppWindow;
  if (/\b(?:linux|ubuntu|debian|fedora|centos|red hat|arch|gentoo|opensuse|suse|mint)\b/u.test(name)) return Terminal;
  return Cpu;
}

export function AnalyticsItemIcon({ kind, value }: { kind: AnalyticsIconKind; value: string }) {
  const { colors, scheme } = useTheme();
  return <View accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none" style={themedStyles[scheme].badge}>
    {createElement(getAnalyticsItemIcon(kind, value), { size: 17, strokeWidth: 1.8, color: colors.accent, accessible: false })}
  </View>;
}

const themedStyles = createThemedStyles(colors => ({
  badge: { width: 28, height: 28, flexShrink: 0, borderRadius: 8, borderCurve: 'continuous',
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSurface },
}));
