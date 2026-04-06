import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { isLightTheme, theme, toggleTheme } = useTheme();
  const nextTheme = isLightTheme ? 'dark' : 'light';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle ${isLightTheme ? 'theme-toggle--light' : 'theme-toggle--dark'}`}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={isLightTheme}
      title={`Current theme: ${theme}. Switch to ${nextTheme} mode.`}
    >
      <span className="sr-only">{`Switch to ${nextTheme} mode`}</span>

      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
        <span className={`theme-toggle__icon ${isLightTheme ? '' : 'is-active'}`}>
          <Moon size={15} />
        </span>
        <span className={`theme-toggle__icon ${isLightTheme ? 'is-active' : ''}`}>
          <Sun size={15} />
        </span>
      </span>
    </button>
  );
}
