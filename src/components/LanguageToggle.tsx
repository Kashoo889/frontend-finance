import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

const LanguageToggle = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ur' : 'en');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground"
      aria-label="Toggle language"
      title={language === 'en' ? 'Switch to Urdu' : 'Switch to English'}
    >
      <Globe className="w-4 h-4" />
      <span className="text-sm font-medium">
        {language === 'en' ? '🇬🇧 English' : '🇵🇰 اردو'}
      </span>
    </button>
  );
};

export default LanguageToggle;

