import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '@/components/Topbar';
import Card from '@/components/Card';
import { tradersAPI } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { ArrowLeft, CreditCard, ArrowRight, Loader2, Trash2 } from 'lucide-react';

interface Bank {
  id: string;
  name: string;
  code: string;
  entries?: any[];
  totalBalance?: number;
}

interface Trader {
  id: string;
  name: string;
  shortName: string;
  color: string;
  banks?: Bank[];
  totalBalance?: number;
}

/**
 * Trader Detail page
 * Shows bank cards for a specific trader
 */
const TraderDetail = () => {
  const { traderId } = useParams<{ traderId: string }>();
  const navigate = useNavigate();
  const [trader, setTrader] = useState<Trader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch user role
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const user = await getCurrentUser();
        setUserRole(user.role || 'user');
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole('user');
      }
    };

    fetchUserRole();
  }, []);

  // Fetch trader data
  useEffect(() => {
    const fetchTrader = async () => {
      if (!traderId) return;

      try {
        setIsLoading(true);
        setError(null);
        const traderData = await tradersAPI.getOne(traderId);
        
        // Normalize banks array (ensure all banks have id instead of _id)
        const normalizedBanks = (traderData.banks || []).map((bank: any) => {
          const { _id, ...rest } = bank;
          return {
            ...rest,
            id: bank.id || _id?.toString() || '',
            name: bank.name || '',
            code: bank.code || '',
            entries: bank.entries || [],
            totalBalance: bank.totalBalance || 0,
          };
        });

        const normalizedTrader = {
          ...traderData,
          banks: normalizedBanks,
        };

        setTrader(normalizedTrader);
      } catch (err) {
        console.error('Error fetching trader:', err);
        setError('Failed to load trader data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrader();
  }, [traderId]);

  // Calculate balance for each bank
  const getBankBalance = (bank: Bank): number => {
    if (bank.totalBalance !== undefined) {
      return bank.totalBalance;
    }
    if (bank.entries && bank.entries.length > 0) {
      return bank.entries.reduce(
        (acc, entry) => acc + (entry.amountAdded || 0) - (entry.amountWithdrawn || 0),
        0
      );
    }
    return 0;
  };

  const handleBankClick = (bankId: string) => {
    if (!bankId || bankId === 'undefined') {
      console.error('Invalid bank ID:', bankId);
      return;
    }
    navigate(`/dashboard/persons/pakistani/${traderId}/bank/${bankId}`);
  };

  // Handle delete trader
  const handleDeleteTrader = async () => {
    if (!trader) return;

    const bankCount = trader.banks?.length || 0;
    const confirmMessage = bankCount > 0
      ? `Are you sure you want to delete "${trader.name}"?\n\nThis will delete the trader along with ${bankCount} bank account(s) and all associated ledger entries.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${trader.name}"?\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      await tradersAPI.delete(trader.id);
      // Navigate back to traders list
      navigate('/dashboard/persons/pakistani');
    } catch (error: any) {
      console.error('Error deleting trader:', error);
      const errorMessage = error?.message || 'Failed to delete trader. Please try again.';
      alert(errorMessage);
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <Topbar
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
            { label: 'Loading...' },
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

  if (error || !trader) {
    return (
      <div className="animate-fade-in">
        <Topbar
          title="Trader Not Found"
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
            { label: 'Not Found' },
          ]}
        />
        <main className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {error || 'The requested trader was not found.'}
            </p>
            <button
              onClick={() => navigate('/dashboard/persons/pakistani')}
              className="btn-accent"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Topbar
        title={trader.name}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
          { label: trader.name },
        ]}
      />

      <main className="p-6">
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard/persons/pakistani')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Traders</span>
        </button>

        {/* Trader Info */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-xl bg-gradient-to-br ${trader.color} flex items-center justify-center text-white font-bold text-xl`}
            >
              {trader.shortName}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{trader.name}</h2>
              <p className="text-muted-foreground">
                {trader.banks.length} Bank {trader.banks.length === 1 ? 'Account' : 'Accounts'}
              </p>
            </div>
          </div>
          {/* Delete button for admin */}
          {userRole === 'admin' && (
            <button
              onClick={handleDeleteTrader}
              disabled={isDeleting}
              className="btn-outline text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center gap-2 px-4 py-2 disabled:opacity-50"
              title="Delete trader"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Trader
                </>
              )}
            </button>
          )}
        </div>

        {/* Info Card */}
        <div className="mb-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm text-foreground">
            Select a bank to view the ledger entries and transactions.
          </p>
        </div>

        {/* Bank Cards Grid */}
        {!trader.banks || trader.banks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No bank accounts found for this trader.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {trader.banks.map((bank) => {
              const balance = getBankBalance(bank);
              const isPositive = balance >= 0;
              const entryCount = bank.entries?.length || 0;
              const bankId = bank.id || bank._id?.toString() || '';

              if (!bankId) {
                console.error('Bank missing ID:', bank);
                return null;
              }

              return (
                <Card
                  key={bankId}
                  interactive
                  onClick={() => handleBankClick(bankId)}
                  className="group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-foreground" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </div>

                  {/* Bank Name */}
                  <h3 className="font-semibold text-foreground text-lg mb-1">
                    {bank.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {entryCount} {entryCount === 1 ? 'Entry' : 'Entries'}
                  </p>

                  {/* Balance */}
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Balance</span>
                      <span
                        className={`font-semibold ${
                          isPositive ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {new Intl.NumberFormat('en-PK').format(balance)} PKR
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default TraderDetail;
