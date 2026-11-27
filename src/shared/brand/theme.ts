import { theme, type ThemeConfig } from 'antd'

// The Tidy Team brand as an Ant Design theme (light). Hex values are the Design System tokens:
// berry-600 / berry-800 (accent), cocoa-700 / cocoa-500 (text), page ground (near-white, not blush-100),
// and the success, warning and danger status colours. Keep them in step with tokens.css.
export const brandTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#b61f47',
    colorPrimaryHover: '#79112d',
    colorPrimaryActive: '#79112d',
    colorInfo: '#b61f47',
    colorLink: '#b61f47',
    colorLinkHover: '#79112d',
    colorLinkActive: '#79112d',
    colorSuccess: '#0b6b7a',
    colorWarning: '#8a5a00',
    colorError: '#b3260b',
    colorText: '#3e2318',
    colorTextSecondary: '#6b402f',
    colorBgLayout: '#f7f7f7',
    fontFamily: "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
}
