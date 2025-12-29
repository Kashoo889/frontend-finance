import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  LayoutDashboard,
  Users,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Landmark,
  Star,
  Globe,
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['Persons']);

  // Navigation items configuration
  const navItems = [
    {
      label: t('common.dashboard'),
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: t('common.traders'),
      icon: Users,
      children: [
        {
          label: t('common.saudi'),
          path: '/dashboard/persons/saudi',
          icon: Globe,
        },
        {
          label: t('common.pakistani'),
          path: '/dashboard/persons/pakistani',
          icon: Landmark,
        },
        {
          label: t('common.special'),
          path: '/dashboard/persons/special',
          icon: Star,
        },
      ],
    },
  ];

  // Don't render sidebar on login page or if not authenticated
  const isLoginPage = location.pathname === '/' || location.pathname === '/login';
  if (isLoginPage || !isAuthenticated()) {
    return null;
  }

  // Check if a path is active
  const isActive = (path: string) => location.pathname === path;
  const isParentActive = (children: { path: string }[]) =>
    children.some((child) => location.pathname.startsWith(child.path));

  // Toggle expanded state for parent items
  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo/Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
          <Landmark className="w-5 h-5 text-accent-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-sidebar-foreground">Finance</h1>
          <p className="text-xs text-sidebar-muted">{t('common.dashboard')}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <div key={item.label}>
            {item.children ? (
              // Parent with children
              <>
                <button
                  onClick={() => toggleExpand(item.label)}
                  className={`w-full sidebar-link ${
                    isParentActive(item.children) ? 'sidebar-link-active' : ''
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {expandedItems.includes(item.label) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {/* Children */}
                {expandedItems.includes(item.label) && (
                  <div className="ml-4 mt-1 space-y-1 animate-fade-in">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        onClick={() => setIsMobileOpen(false)}
                        className={`sidebar-link pl-6 text-sm ${
                          isActive(child.path) ? 'sidebar-link-active' : ''
                        }`}
                      >
                        <child.icon className="w-4 h-4" />
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Single item
              <Link
                to={item.path}
                onClick={() => setIsMobileOpen(false)}
                className={`sidebar-link ${
                  isActive(item.path) ? 'sidebar-link-active' : ''
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-sidebar-border">
        <p className="text-xs text-sidebar-muted text-center">
          © 2026 {t('common.dashboard')}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar transform transition-transform duration-300 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setIsMobileOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-72 bg-sidebar z-30">
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
