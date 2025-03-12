import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { MoonIcon, SunIcon } from "lucide-react";

export const Navbar = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Initialize theme from system preference
  useEffect(() => {
    // Check if the user prefers dark mode
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = prefersDark ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('light', initialTheme === 'light');
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  return (
    <header className="w-full py-4 border-b border-border">
      <div className="container flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" aria-label="Boliganalyse.ai - Hjem">
          <span className="text-xl font-bold">Bolig<span className="text-purple">analyse</span>.ai</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link to="/analyseret" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Analyserede boliger
          </Link>
          <Button onClick={toggleTheme} variant="ghost" size="icon" className="rounded-full">
            {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
