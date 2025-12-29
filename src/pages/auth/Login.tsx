import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark, Mail, Lock, Loader2 } from 'lucide-react';
import { login } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';

/**
 * Login Page Component
 * Centered login card with email and password fields
 */
const Login = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate form
  const validateForm = () => {
    const newErrors: typeof errors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = t('login.emailRequired');
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = t('login.invalidEmail');
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = t('login.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('login.passwordMinLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[name as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous general errors
    setErrors((prev) => ({ ...prev, general: undefined }));

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await login(formData.email, formData.password);
      
      if (response.success) {
        // Store token if provided
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        
        // Navigate to dashboard
        navigate('/dashboard', { replace: true });
      } else {
        setErrors({ general: response.error || t('login.loginFailed') });
      }
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : t('login.networkError'),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4 relative">
      {/* Language Toggle - Top Right/Left based on RTL */}
      <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
        <LanguageToggle />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-card rounded-2xl shadow-2xl border border-border p-8 space-y-6">
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-primary text-white shadow-lg">
              <Landmark className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('login.title')}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('login.subtitle')}
              </p>
            </div>
          </div>

          {/* Error Message */}
          {errors.general && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm animate-slide-up">
              {errors.general}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                {t('common.email')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`input-field pl-10 ${
                    errors.email
                      ? 'border-destructive focus:ring-destructive'
                      : 'focus:ring-accent'
                  }`}
                  placeholder={t('common.enterEmail')}
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive animate-slide-up">
                  {errors.email}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                {t('common.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={`input-field pl-10 ${
                    errors.password
                      ? 'border-destructive focus:ring-destructive'
                      : 'focus:ring-accent'
                  }`}
                  placeholder={t('common.enterPassword')}
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive animate-slide-up">
                  {errors.password}
                </p>
              )}
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-accent py-3 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('login.signingIn')}
                </span>
              ) : (
                t('common.signIn')
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('login.copyright')}
        </p>
      </div>
    </div>
  );
};

export default Login;

