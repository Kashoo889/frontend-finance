import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '@/components/Topbar';
import Card from '@/components/Card';
import Modal from '@/components/Modal';
import { tradersAPI, banksAPI } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { Building2, ArrowRight, Wallet, Plus, Loader2, X, Trash2 } from 'lucide-react';

interface Trader {
  id: string;
  name: string;
  shortName: string;
  color: string;
  banks?: any[];
  totalBalance?: number;
}

interface BankForm {
  name: string;
}

/**
 * Pakistani Hisaab Kitaab page
 * Displays trader cards in a grid layout
 */
const Pakistani = () => {
  const navigate = useNavigate();
  const [traders, setTraders] = useState<Trader[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for add trader
  const [traderForm, setTraderForm] = useState({
    name: '',
    shortName: '',
    color: 'from-blue-500 to-blue-600',
  });

  const [banks, setBanks] = useState<BankForm[]>([{ name: '' }]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string>('user');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

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

  // Fetch traders from API
  useEffect(() => {
    const fetchTraders = async () => {
      try {
        setIsLoading(true);
        const data = await tradersAPI.getAll();
        setTraders(data);
      } catch (error) {
        console.error('Error fetching traders:', error);
        setTraders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTraders();
  }, []);

  const handleTraderClick = (traderId: string) => {
    navigate(`/dashboard/persons/pakistani/${traderId}`);
  };

  // Handle delete trader
  const handleDeleteTrader = async (e: React.MouseEvent, traderId: string, traderName: string) => {
    e.stopPropagation(); // Prevent card click

    const bankCount = traders.find(t => t.id === traderId)?.banks?.length || 0;
    const confirmMessage = bankCount > 0
      ? `Are you sure you want to delete "${traderName}"?\n\nThis trader has ${bankCount} bank account(s). You must delete all bank accounts first before deleting the trader.\n\nThis action cannot be undone.`
      : `Are you sure you want to delete "${traderName}"?\n\nThis action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(traderId);
    try {
      await tradersAPI.delete(traderId);
      // Refresh traders list
      const updatedTraders = await tradersAPI.getAll();
      setTraders(updatedTraders);
    } catch (error: any) {
      console.error('Error deleting trader:', error);
      const errorMessage = error?.message || 'Failed to delete trader. Please try again.';
      if (errorMessage.includes('banks')) {
        alert(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setIsDeleting(null);
    }
  };

  // Add bank form row
  const addBankRow = () => {
    setBanks([...banks, { name: '' }]);
  };

  // Remove bank form row
  const removeBankRow = (index: number) => {
    if (banks.length > 1) {
      setBanks(banks.filter((_, i) => i !== index));
    }
  };

  // Update bank name
  const updateBankName = (index: number, value: string) => {
    const updatedBanks = [...banks];
    updatedBanks[index].name = value;
    setBanks(updatedBanks);
    // Clear errors for this bank
    setFormErrors({ ...formErrors, [`bank_${index}_name`]: '' });
  };

  // Generate bank code from bank name (first 3-4 uppercase letters)
  const generateBankCode = (bankName: string): string => {
    const cleaned = bankName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    return cleaned.slice(0, 4) || cleaned;
  };

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!traderForm.name.trim()) {
      errors.name = 'Trader name is required';
    }

    if (!traderForm.shortName.trim()) {
      errors.shortName = 'Short name is required';
    } else if (traderForm.shortName.length > 10) {
      errors.shortName = 'Short name cannot exceed 10 characters';
    }

    // Validate banks
    banks.forEach((bank, index) => {
      if (!bank.name.trim()) {
        errors[`bank_${index}_name`] = 'Bank name is required';
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle add trader
  const handleAddTrader = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      // Create trader
      const trader = await tradersAPI.create({
        name: traderForm.name.trim(),
        shortName: traderForm.shortName.trim().toUpperCase(),
        color: traderForm.color,
      });

      // Create banks for the trader
      const bankPromises = banks
        .filter((bank) => bank.name.trim())
        .map((bank) => {
          const bankName = bank.name.trim();
          const bankCode = generateBankCode(bankName);
          return banksAPI.create(trader.id, {
            name: bankName,
            code: bankCode,
          });
        });

      await Promise.all(bankPromises);

      // Close modal and reset form
      setIsAddModalOpen(false);
      setTraderForm({
        name: '',
        shortName: '',
        color: 'from-blue-500 to-blue-600',
      });
      setBanks([{ name: '' }]);
      setFormErrors({});

      // Refresh traders list
      const updatedTraders = await tradersAPI.getAll();
      setTraders(updatedTraders);
    } catch (error) {
      console.error('Error creating trader:', error);
      alert('Failed to create trader. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <Topbar
        title="Pakistani Hisaab Kitaab"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Persons', path: '/dashboard' },
          { label: 'Pakistani Hisaab Kitaab' },
        ]}
      />

      <main className="p-6">
        {/* Header with Add Button */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg flex-1">
            <p className="text-sm text-foreground">
              Click on a trader card to view their bank accounts and ledger entries.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-accent flex items-center gap-2 px-6 py-3"
          >
            <Plus className="w-5 h-5" />
            Add Trader
          </button>
        </div>

        {/* Trader Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : traders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No traders found</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-accent"
            >
              Add Your First Trader
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {traders.map((trader) => {
              const totalBalance = trader.totalBalance || 0;
              const isPositive = totalBalance >= 0;

            return (
              <Card
                key={trader.id}
                interactive
                onClick={() => handleTraderClick(trader.id)}
                className="group relative"
              >
                {/* Delete button for admin */}
                {userRole === 'admin' && (
                  <button
                    onClick={(e) => handleDeleteTrader(e, trader.id, trader.name)}
                    disabled={isDeleting === trader.id}
                    className="absolute top-3 right-3 z-10 p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors disabled:opacity-50"
                    aria-label="Delete trader"
                    title="Delete trader"
                  >
                    {isDeleting === trader.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}

                {/* Header with icon */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${trader.color} flex items-center justify-center text-white font-bold text-lg`}
                  >
                    {trader.shortName}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
                </div>

                {/* Trader Name */}
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {trader.name}
                </h3>

                {/* Bank count */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Building2 className="w-4 h-4" />
                  <span>{trader.banks?.length || 0} Bank {trader.banks?.length === 1 ? 'Account' : 'Accounts'}</span>
                </div>

                {/* Total Balance */}
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Wallet className="w-4 h-4" />
                      <span>Total Balance</span>
                    </div>
                    <span
                      className={`font-semibold ${
                        isPositive ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {new Intl.NumberFormat('en-PK').format(totalBalance)} PKR
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
          </div>
        )}
      </main>

      {/* Add Trader Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setFormErrors({});
        }}
        title="Add New Trader"
        size="lg"
      >
        <div className="space-y-6">
          {/* Trader Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
              Trader Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Trader Name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={traderForm.name}
                onChange={(e) => {
                  setTraderForm({ ...traderForm, name: e.target.value });
                  setFormErrors({ ...formErrors, name: '' });
                }}
                className={`input-field ${formErrors.name ? 'border-destructive' : ''}`}
                placeholder="Sulman Traders"
                required
              />
              {formErrors.name && (
                <p className="text-sm text-destructive mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Short Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={traderForm.shortName}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 10);
                    setTraderForm({ ...traderForm, shortName: value });
                    setFormErrors({ ...formErrors, shortName: '' });
                  }}
                  className={`input-field ${formErrors.shortName ? 'border-destructive' : ''}`}
                  placeholder="ST"
                  maxLength={10}
                  required
                />
                {formErrors.shortName && (
                  <p className="text-sm text-destructive mt-1">{formErrors.shortName}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">Max 10 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Color Theme
                </label>
                <select
                  value={traderForm.color}
                  onChange={(e) => setTraderForm({ ...traderForm, color: e.target.value })}
                  className="select-field"
                >
                  <option value="from-blue-500 to-blue-600">Blue</option>
                  <option value="from-emerald-500 to-emerald-600">Green</option>
                  <option value="from-purple-500 to-purple-600">Purple</option>
                  <option value="from-orange-500 to-orange-600">Orange</option>
                  <option value="from-cyan-500 to-cyan-600">Cyan</option>
                  <option value="from-pink-500 to-pink-600">Pink</option>
                  <option value="from-indigo-500 to-indigo-600">Indigo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bank Accounts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-semibold text-foreground">
                Bank Accounts <span className="text-destructive">*</span>
              </h3>
              <button
                type="button"
                onClick={addBankRow}
                className="btn-outline text-xs py-1.5 px-3"
              >
                <Plus className="w-3.5 h-3.5 mr-1 inline" />
                Add Bank
              </button>
            </div>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {banks.map((bank, index) => (
                <div
                  key={index}
                  className="p-4 border border-border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={bank.name}
                        onChange={(e) => updateBankName(index, e.target.value)}
                        className={`input-field ${formErrors[`bank_${index}_name`] ? 'border-destructive' : ''}`}
                        placeholder={`Bank ${index + 1} name (e.g., HBL, UBL, Meezan)`}
                      />
                      {formErrors[`bank_${index}_name`] && (
                        <p className="text-xs text-destructive mt-1">
                          {formErrors[`bank_${index}_name`]}
                        </p>
                      )}
                    </div>
                    {banks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBankRow(index)}
                        className="flex-shrink-0 p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Remove bank"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={handleAddTrader}
              disabled={isSaving}
              className="btn-accent flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Trader'
              )}
            </button>
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setFormErrors({});
              }}
              disabled={isSaving}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Pakistani;
