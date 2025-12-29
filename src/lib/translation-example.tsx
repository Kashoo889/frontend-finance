/**
 * Translation Usage Example
 * 
 * This file demonstrates how to use translations in your components
 */

import { useLanguage } from '@/contexts/LanguageContext';

// Example Component
const ExampleComponent = () => {
  const { t, isRTL } = useLanguage();

  return (
    <div className={isRTL ? 'rtl' : 'ltr'}>
      {/* Basic translation */}
      <h1>{t('common.dashboard')}</h1>
      
      {/* Nested translation */}
      <p>{t('login.title')}</p>
      
      {/* Using in JSX */}
      <button>{t('common.save')}</button>
      
      {/* Conditional RTL classes */}
      <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
        <span>{t('common.email')}</span>
      </div>
    </div>
  );
};

export default ExampleComponent;

