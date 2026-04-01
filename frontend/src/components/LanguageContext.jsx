/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';

const LanguageContext = createContext();

const translations = {
  en: {
    home: 'Home',
    events: 'Events',
    projects: 'Projects',
    team: 'Team',
    contact: 'Contact',
    about: 'About',
    login: 'Log in',
    joinGuild: 'Join Guild',
    dashboard: 'My Dashboard',
    adminDashboard: 'Admin Dashboard',
    editProfile: 'Edit Profile',
    logout: 'Logout',
    chatbotTitle: 'Help Assistant',
    chatbotWelcome: 'Hi! I can help with navigation, account, and event questions.',
    chatbotInput: 'Type your question...',
    chatbotSend: 'Send',
    chatbotOpen: 'Open help assistant',
    chatbotClose: 'Close help assistant',
    contrast: 'Contrast',
    language: 'Language',
    low: 'Low',
    high: 'High',
    aiAssistant: 'Admin AI Assistant',
    aiSummary: 'Auto summary',
    aiIssues: 'Issue detection',
    aiActions: 'Next best actions',
  },
  hi: {
    home: 'होम',
    events: 'इवेंट्स',
    projects: 'प्रोजेक्ट्स',
    team: 'टीम',
    contact: 'संपर्क',
    about: 'परिचय',
    login: 'लॉग इन',
    joinGuild: 'जुड़ें',
    dashboard: 'मेरा डैशबोर्ड',
    adminDashboard: 'एडमिन डैशबोर्ड',
    editProfile: 'प्रोफाइल संपादित करें',
    logout: 'लॉग आउट',
    chatbotTitle: 'मदद सहायक',
    chatbotWelcome: 'नमस्ते! मैं नेविगेशन, अकाउंट और इवेंट्स से जुड़ी मदद कर सकता हूं।',
    chatbotInput: 'अपना सवाल लिखें...',
    chatbotSend: 'भेजें',
    chatbotOpen: 'मदद सहायक खोलें',
    chatbotClose: 'मदद सहायक बंद करें',
    contrast: 'कॉन्ट्रास्ट',
    language: 'भाषा',
    low: 'कम',
    high: 'ज्यादा',
    aiAssistant: 'एडमिन AI सहायक',
    aiSummary: 'ऑटो सारांश',
    aiIssues: 'समस्या पहचान',
    aiActions: 'अगले बेहतर कदम',
  },
};

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem('highContrast') === 'true');

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.setAttribute('lang', language === 'hi' ? 'hi' : 'en');
  }, [language]);

  useEffect(() => {
    localStorage.setItem('highContrast', String(highContrast));
    document.documentElement.classList.toggle('high-contrast', highContrast);
  }, [highContrast]);

  const t = useMemo(() => {
    const table = translations[language] || translations.en;
    return (key, fallback = '') => table[key] || fallback || key;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    highContrast,
    setHighContrast,
    t,
  }), [language, highContrast, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};
