import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  // Check local storage for saved theme, default to 'light'
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('neuroskin-theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    localStorage.setItem('neuroskin-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};