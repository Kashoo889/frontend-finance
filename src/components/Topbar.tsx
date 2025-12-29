import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { logout, getCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface TopbarProps {
  title: string;
  breadcrumbs: BreadcrumbItem[];
}

/**
 * Topbar component with page title, breadcrumbs, and user profile menu
 * Used across all dashboard pages for consistent navigation
 */
const Topbar = ({ title, breadcrumbs }: TopbarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
    toast({
      title: t('common.loggedOut'),
      description: t('common.loggedOutDesc'),
    });
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 lg:pl-6 flex items-center justify-between">
      <div className="flex-1">
        {/* Breadcrumbs */}
        <nav className="breadcrumb mb-2">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 breadcrumb-separator" />}
              {item.path ? (
                <Link
                  to={item.path}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumb-active">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

        {/* Page Title */}
        <h1 className="page-title">{title}</h1>
      </div>

      {/* User Profile Menu */}
      <div className="relative ml-4" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors group"
          aria-label="User menu"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center text-accent-foreground font-semibold text-sm">
            {getUserInitials()}
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-foreground">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user?.email || ''}</p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-card border border-border rounded-lg shadow-lg z-50 animate-fade-in">
            <div className="p-2">
              <Link
                to="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground"
              >
                <User className="w-4 h-4" />
                <span>{t('common.profile')}</span>
              </Link>
              <Link
                to="/dashboard/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-foreground"
              >
                <Settings className="w-4 h-4" />
                <span>{t('common.settings')}</span>
              </Link>
              <div className="border-t border-border my-1" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-foreground text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('common.logout')}</span>
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
