import { Moon, Sun } from 'lucide-react'

export default function ThemeToggle({ darkMode, onToggle }: { darkMode: boolean; onToggle: () => void }) {
  return <button className="theme-toggle" onClick={onToggle} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
    {darkMode ? <Sun size={17}/> : <Moon size={17}/>}
  </button>
}
