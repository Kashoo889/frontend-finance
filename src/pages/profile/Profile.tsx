import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '@/components/Topbar';
import { User, Lock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { changePassword, getCurrentUser, logout } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

/**
 * Profile page component
 * Allows users to change their password and logout
 */
const Profile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Fetch current user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error: any) {
        console.error('Error fetching user:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to load user data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [toast]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: typeof formErrors = {};

    if (!formData.currentPassword.trim()) {
      errors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword.trim()) {
      errors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword.trim()) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle password change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword(formData.currentPassword, formData.newPassword);

      toast({
        title: 'Success',
        description: 'Password changed successfully',
      });

      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setFormErrors({});
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/login');
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out',
    });
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <Topbar
          title="Profile"
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Profile' },
          ]}
        />
        <main className="p-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Topbar
        title="Profile"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Profile' },
        ]}
      />

      <main className="p-6 max-w-4xl mx-auto">
        {/* User Info Card */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center">
              <User className="w-8 h-8 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{user?.name || 'User'}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              <span className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full bg-accent/10 text-accent">
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Change Password</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Current Password <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                value={formData.currentPassword}
                onChange={(e) => {
                  setFormData({ ...formData, currentPassword: e.target.value });
                  setFormErrors({ ...formErrors, currentPassword: '' });
                }}
                className={`input-field ${formErrors.currentPassword ? 'border-destructive' : ''}`}
                placeholder="Enter your current password"
                required
              />
              {formErrors.currentPassword && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {formErrors.currentPassword}
                </p>
              )}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                New Password <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                value={formData.newPassword}
                onChange={(e) => {
                  setFormData({ ...formData, newPassword: e.target.value });
                  setFormErrors({ ...formErrors, newPassword: '' });
                }}
                className={`input-field ${formErrors.newPassword ? 'border-destructive' : ''}`}
                placeholder="Enter your new password (min 6 characters)"
                required
              />
              {formErrors.newPassword && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {formErrors.newPassword}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Confirm New Password <span className="text-destructive">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => {
                  setFormData({ ...formData, confirmPassword: e.target.value });
                  setFormErrors({ ...formErrors, confirmPassword: '' });
                }}
                className={`input-field ${formErrors.confirmPassword ? 'border-destructive' : ''}`}
                placeholder="Confirm your new password"
                required
              />
              {formErrors.confirmPassword && (
                <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {formErrors.confirmPassword}
                </p>
              )}
              {!formErrors.confirmPassword && formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                <p className="text-sm text-success mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  Passwords match
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="btn-accent w-full sm:w-auto disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Changing Password...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Logout Card */}
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Account Actions</h3>
              <p className="text-sm text-muted-foreground">
                Sign out of your account
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-outline text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Logout
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;

