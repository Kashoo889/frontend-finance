import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Topbar from '@/components/Topbar';
import Table, { Column } from '@/components/Table';
import Modal from '@/components/Modal';
import BalanceDisplay from '@/components/BalanceDisplay';
import { calculateRemainingAmount, formatNumber } from '@/data/dummyData';
import { bankLedgerAPI, tradersAPI } from '@/lib/api';
import { ArrowLeft, Edit, CreditCard, Plus, Loader2, Trash2, Search, Download, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Normalize MongoDB entry (convert _id to id)
 */
const normalizeEntry = (entry: any) => {
  if (!entry) return entry;
  const { _id, ...rest } = entry;
  return { id: _id?.toString() || entry.id || '', ...rest };
};

interface BankLedgerEntry {
  id: string;
  date: string;
  referenceType: 'Online' | 'Cash';
  amountAdded: number;
  amountWithdrawn: number;
  referencePerson?: string;
}

// Alias for consistency (no longer needs runningBalance since we calculate per entry)
type BankLedgerEntryWithBalance = BankLedgerEntry;

/**
 * Bank Ledger page
 * Shows ledger entries for a specific bank of a trader
 */
const BankLedger = () => {
  const { traderId, bankId } = useParams<{ traderId: string; bankId: string }>();
  const navigate = useNavigate();

  const [trader, setTrader] = useState<any>(null);
  const [bank, setBank] = useState<any>(null);
  const [entries, setEntries] = useState<BankLedgerEntryWithBalance[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<BankLedgerEntryWithBalance[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BankLedgerEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    fromDate: '',
    toDate: '',
  });

  // Form state for edit modal
  const [formData, setFormData] = useState({
    date: '',
    referenceType: 'Online' as 'Online' | 'Cash',
    amountAdded: '',
    amountWithdrawn: '',
    referencePerson: '',
  });

  // Form state for add modal
  const [addFormData, setAddFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    referenceType: 'Online' as 'Online' | 'Cash',
    amountAdded: '',
    amountWithdrawn: '',
    referencePerson: '',
  });

  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Fetch trader, bank, and ledger entries
  useEffect(() => {
    const fetchData = async () => {
      if (!traderId || !bankId || bankId === 'undefined') {
        console.error('Missing or invalid traderId or bankId:', { traderId, bankId });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fetch trader data with banks
        const traderData = await tradersAPI.getOne(traderId);
        
        if (!traderData) {
          setIsLoading(false);
          return;
        }

        // Normalize banks array (ensure all banks have id instead of _id)
        const normalizedBanks = (traderData.banks || []).map((bank: any) => {
          const { _id, ...rest } = bank;
          return {
            ...rest,
            id: bank.id || _id?.toString() || '',
          };
        });

        const normalizedTrader = {
          ...traderData,
          banks: normalizedBanks,
        };

        setTrader(normalizedTrader);

        // Find bank in trader's banks
        const foundBank = normalizedBanks.find((b: any) => b.id === bankId);
        if (!foundBank) {
          console.error('Bank not found:', { 
            bankId, 
            banks: normalizedBanks.map((b: any) => ({ id: b.id, name: b.name }))
          });
          setIsLoading(false);
          return;
        }

        setBank(foundBank);

        // Fetch ledger entries
        const ledgerData = await bankLedgerAPI.getAll(traderId, bankId);

        // Normalize entries (ensure id and safe numeric fields)
        const normalizedEntries = (ledgerData.entries || []).map((entry: any) => {
          // Normalize entry (ensure id instead of _id)
          const { _id, ...rest } = entry;
          return {
            ...rest,
            id: entry.id || _id?.toString() || '',
            amountAdded: entry.amountAdded || 0,
            amountWithdrawn: entry.amountWithdrawn || 0,
            referencePerson: (entry as any).referencePerson || '',
          };
        });

        setEntries(normalizedEntries);
        setFilteredEntries(normalizedEntries);

        // Net remaining balance = Total Credit - Total Debit
        const apiRemaining =
          (ledgerData as any).remainingBalance ??
          (ledgerData as any).totalBalance ??
          0;
        setTotalBalance(apiRemaining);
      } catch (error) {
        console.error('Error fetching bank ledger data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [traderId, bankId]);

  // Helper: recompute running balance and totals for a given list of entries
  const computeRunningAndTotals = (
    list: BankLedgerEntryWithBalance[]
  ): {
    entriesWithRunning: (BankLedgerEntryWithBalance & { runningBalance?: number })[];
    netBalance: number;
  } => {
    // Work on a copy to avoid mutating original array
    const reversed = [...list].reverse();
    let cumulative = 0;

    const withRunningReversed = reversed.map((entry) => {
      const credit = entry.amountAdded || 0;
      const debit = entry.amountWithdrawn || 0;
      cumulative += credit - debit;
      return {
        ...entry,
        runningBalance: cumulative,
      };
    });

    const withRunning = withRunningReversed.reverse();
    const netBalance = cumulative;

    return { entriesWithRunning: withRunning, netBalance };
  };

  // Filter entries by date range
  const handleFilter = () => {
    if (!dateFilter.fromDate && !dateFilter.toDate) {
      const { entriesWithRunning, netBalance } = computeRunningAndTotals(entries);
      setFilteredEntries(entriesWithRunning);
      setTotalBalance(netBalance);
      return;
    }

    const filteredBase = entries.filter((entry) => {
      const entryDate = entry.date || '';

      if (dateFilter.fromDate && entryDate && entryDate < dateFilter.fromDate) {
        return false;
      }

      if (dateFilter.toDate && entryDate && entryDate > dateFilter.toDate) {
        return false;
      }

      return true;
    });

    const { entriesWithRunning, netBalance } = computeRunningAndTotals(filteredBase);
    setFilteredEntries(entriesWithRunning);
    setTotalBalance(netBalance);
  };

  // Clear filter
  const handleClearFilter = () => {
    setDateFilter({ fromDate: '', toDate: '' });
    const { entriesWithRunning, netBalance } = computeRunningAndTotals(entries);
    setFilteredEntries(entriesWithRunning);
    setTotalBalance(netBalance);
  };

  // Generate and download PDF
  const handleDownloadPDF = () => {
    try {
      const dataToExport = filteredEntries.length > 0 ? filteredEntries : entries;
      
      if (dataToExport.length === 0) {
        alert('No data to export');
        return;
      }

      // Create new PDF document
      const doc = new jsPDF('landscape', 'mm', 'a4');
    
    // Calculate totals
    const totalAmountAdded = dataToExport.reduce((sum, entry) => sum + (entry.amountAdded || 0), 0);
    const totalAmountWithdrawn = dataToExport.reduce((sum, entry) => sum + (entry.amountWithdrawn || 0), 0);
    const totalRemaining = totalAmountAdded - totalAmountWithdrawn;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`BANK LEDGER REPORT - ${bank?.name || 'Bank'} - ${trader?.name || 'Trader'}`, 14, 15);
    
    // Report info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateRange = dateFilter.fromDate && dateFilter.toDate 
      ? `${dateFilter.fromDate} to ${dateFilter.toDate}` 
      : 'All Entries';
    doc.text(`Date Range: ${dateRange}`, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);
    doc.text(`Total Entries: ${dataToExport.length}`, 14, 32);

    // Prepare table data
    const tableData = dataToExport.map(entry => {
      const remainingAmount = (entry.amountAdded || 0) - (entry.amountWithdrawn || 0);
      const runningBalance = (entry as any).runningBalance !== undefined 
        ? (entry as any).runningBalance 
        : 0;
      
      return [
        entry.date,
        entry.referenceType === 'Online' ? 'آن لائن' : 'نقد',
        formatNumber(entry.amountAdded || 0) + ' PKR',
        formatNumber(entry.amountWithdrawn || 0) + ' PKR',
        (entry as any).referencePerson || '-',
        formatNumber(remainingAmount) + ' PKR',
        formatNumber(runningBalance) + ' PKR'
      ];
    });

    // Add summary totals row
    tableData.push([
      '',
      'TOTALS',
      formatNumber(totalAmountAdded) + ' PKR',
      formatNumber(totalAmountWithdrawn) + ' PKR',
      '',
      formatNumber(totalRemaining) + ' PKR',
      formatNumber(totalRemaining) + ' PKR' // Total balance matches total remaining
    ]);

    // Create table
    autoTable(doc, {
      startY: 38,
      head: [['تاریخ', 'حوالہ کی قسم', 'جمع شدہ رقم', 'نکلوائی گئی رقم', 'حوالہ شخص', 'باقی رقم', 'کل بقیہ']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 58, 138], // Dark blue
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0]
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250]
      },
      columnStyles: {
        0: { cellWidth: 40 }, // DATE
        1: { cellWidth: 50 }, // REFERENCE TYPE
        2: { cellWidth: 50 }, // AMOUNT ADDED
        3: { cellWidth: 50 }, // AMOUNT WITHDRAWN
        4: { cellWidth: 50 }, // REFERENCE PERSON
        5: { cellWidth: 50 }  // REMAINING AMOUNT
      },
      styles: {
        overflow: 'linebreak',
        cellPadding: 2
      },
      didParseCell: function (data: any) {
        // Make totals row bold
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.getWidth() / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Generate filename
      const fileName = `Bank_Ledger_${trader?.name || 'Trader'}_${bank?.name || 'Bank'}_${dateFilter.fromDate || 'all'}_${dateFilter.toDate || 'all'}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Save PDF
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  const handleEdit = (entry: BankLedgerEntry) => {
    setSelectedEntry(entry);
    setFormData({
      date: entry.date || '',
      referenceType: entry.referenceType,
      amountAdded: entry.amountAdded.toString(),
      amountWithdrawn: entry.amountWithdrawn.toString(),
      referencePerson: (entry as any).referencePerson || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEntry || !traderId || !bankId) return;

    setIsSaving(true);
    try {
      await bankLedgerAPI.update(traderId, bankId, selectedEntry.id, {
        date: formData.date,
        referenceType: formData.referenceType,
        amountAdded: parseFloat(formData.amountAdded) || 0,
        amountWithdrawn: parseFloat(formData.amountWithdrawn) || 0,
        referencePerson: formData.referencePerson.trim(),
      });
      setIsModalOpen(false);
      setSelectedEntry(null);
      // Refresh data
      const ledgerData = await bankLedgerAPI.getAll(traderId!, bankId!);
      // Calculate total balance (running balance)
      let totalRunningBalance = 0;
      const entriesWithBalance = ledgerData.entries.map((entry: any) => {
        const normalizedEntry = {
          ...entry,
          id: entry.id || entry._id?.toString() || '',
          amountAdded: entry.amountAdded || 0,
          amountWithdrawn: entry.amountWithdrawn || 0,
          referencePerson: (entry as any).referencePerson || '',
        };
        totalRunningBalance += normalizedEntry.amountAdded - normalizedEntry.amountWithdrawn;
        return normalizedEntry;
      });
      
      // Calculate running balance for each entry (newest first, calculate backwards)
      let cumulativeBalance = totalRunningBalance;
      const entriesWithRunningBalance = entriesWithBalance.map((entry: any) => {
        const entryBalance = entry.amountAdded - entry.amountWithdrawn;
        const runningBalance = cumulativeBalance;
        cumulativeBalance -= entryBalance;
        return {
          ...entry,
          runningBalance,
        };
      });
      
      const updatedEntries = entriesWithRunningBalance as BankLedgerEntryWithBalance[];
      setEntries(updatedEntries);
      // Reapply filter if active, otherwise show all entries
      if (dateFilter.fromDate || dateFilter.toDate) {
        const filtered = updatedEntries.filter((entry) => {
          const entryDate = entry.date;
          if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
          if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
          return true;
        });
        setFilteredEntries(filtered);
      } else {
        setFilteredEntries(updatedEntries);
      }
      setTotalBalance(ledgerData.totalBalance !== undefined ? ledgerData.totalBalance : totalRunningBalance);
    } catch (error: any) {
      console.error('Error updating entry:', error);
      const errorMessage = error?.message || 'Failed to update entry. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entry: BankLedgerEntry) => {
    if (!traderId || !bankId) return;
    
    if (!window.confirm(`Are you sure you want to delete this entry?\n\nDate: ${entry.date}\nAmount Added: ${entry.amountAdded} PKR\nAmount Withdrawn: ${entry.amountWithdrawn} PKR\n\nThis action cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await bankLedgerAPI.delete(traderId, bankId, entry.id);
      // Refresh data
      const ledgerData = await bankLedgerAPI.getAll(traderId, bankId);
      // Calculate total balance (running balance)
      let totalRunningBalance = 0;
      const entriesWithBalance = ledgerData.entries.map((entry: any) => {
        totalRunningBalance += (entry.amountAdded || 0) - (entry.amountWithdrawn || 0);
        return entry;
      });
      const updatedEntries = entriesWithBalance as BankLedgerEntryWithBalance[];
      setEntries(updatedEntries);
      // Reapply filter if active, otherwise show all entries
      if (dateFilter.fromDate || dateFilter.toDate) {
        const filtered = updatedEntries.filter((entry) => {
          const entryDate = entry.date;
          if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
          if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
          return true;
        });
        setFilteredEntries(filtered);
      } else {
        setFilteredEntries(updatedEntries);
      }
      setTotalBalance(ledgerData.totalBalance !== undefined ? ledgerData.totalBalance : totalRunningBalance);
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      const errorMessage = error?.message || 'Failed to delete entry. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Validate add form
  const validateAddForm = () => {
    const errors: Record<string, string> = {};

    if (!addFormData.date) errors.date = 'Date is required';
    
    // At least one amount must be provided
    const amountAdded = parseFloat(addFormData.amountAdded) || 0;
    const amountWithdrawn = parseFloat(addFormData.amountWithdrawn) || 0;
    
    if (amountAdded <= 0 && amountWithdrawn <= 0) {
      errors.amountAdded = 'Either amount added or amount withdrawn must be greater than 0';
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEntry = async () => {
    if (!validateAddForm() || !traderId || !bankId) return;

    setIsSaving(true);
    try {
      await bankLedgerAPI.create(traderId, bankId, {
        date: addFormData.date,
        referenceType: addFormData.referenceType,
        amountAdded: parseFloat(addFormData.amountAdded) || 0,
        amountWithdrawn: parseFloat(addFormData.amountWithdrawn) || 0,
        referencePerson: addFormData.referencePerson.trim(),
      });
      setIsAddModalOpen(false);
      // Reset form
      setAddFormData({
        date: new Date().toISOString().split('T')[0],
        referenceType: 'Online',
        amountAdded: '',
        amountWithdrawn: '',
        referencePerson: '',
      });
      setAddFormErrors({});
      // Refresh data
      const ledgerData = await bankLedgerAPI.getAll(traderId, bankId);
      // Calculate total balance (running balance)
      let totalRunningBalance = 0;
      const entriesWithBalance = ledgerData.entries.map((entry: any) => {
        totalRunningBalance += (entry.amountAdded || 0) - (entry.amountWithdrawn || 0);
        return entry;
      });
      const updatedEntries = entriesWithBalance as BankLedgerEntryWithBalance[];
      setEntries(updatedEntries);
      // Reapply filter if active, otherwise show all entries
      if (dateFilter.fromDate || dateFilter.toDate) {
        const filtered = updatedEntries.filter((entry) => {
          const entryDate = entry.date;
          if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
          if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
          return true;
        });
        setFilteredEntries(filtered);
      } else {
        setFilteredEntries(updatedEntries);
      }
      setTotalBalance(ledgerData.totalBalance !== undefined ? ledgerData.totalBalance : totalRunningBalance);
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create entry. Please try again.');
    } finally {
      setIsSaving(false);
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

  if (!trader || !bank) {
    return (
      <div className="animate-fade-in">
        <Topbar
          title="Not Found"
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
            { label: 'Not Found' },
          ]}
        />
        <main className="p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">The requested bank ledger was not found.</p>
            <button
              onClick={() => navigate('/dashboard/persons/pakistani')}
              className="btn-primary mt-4"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Table column definitions
  const columns: Column<BankLedgerEntryWithBalance>[] = [
    { key: 'date', header: 'تاریخ' },
    {
      key: 'referenceType',
      header: 'حوالہ کی قسم',
      render: (row: BankLedgerEntryWithBalance) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            row.referenceType === 'Online'
              ? 'bg-accent/10 text-accent'
              : 'bg-warning/10 text-warning'
          }`}
        >
          {row.referenceType === 'Online' ? 'آن لائن' : 'نقد'}
        </span>
      ),
    },
    {
      key: 'amountAdded',
      header: 'جمع شدہ رقم',
      render: (row: BankLedgerEntryWithBalance) =>
        row.amountAdded > 0 ? (
          <span className="text-success font-medium">
            +{formatNumber(row.amountAdded)} PKR
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'amountWithdrawn',
      header: 'نکلوائی گئی رقم',
      render: (row: BankLedgerEntryWithBalance) =>
        row.amountWithdrawn > 0 ? (
          <span className="text-destructive font-medium">
            -{formatNumber(row.amountWithdrawn)} PKR
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'referencePerson',
      header: 'حوالہ شخص',
      render: (row: BankLedgerEntryWithBalance) => (row as any).referencePerson || '-',
    },
    {
      key: 'remainingAmount',
      header: 'باقی رقم',
      render: (row: BankLedgerEntryWithBalance) => {
        // Calculate: Amount Added - Amount Withdrawn = Remaining Amount (for this entry only)
        const remainingAmount = (row.amountAdded || 0) - (row.amountWithdrawn || 0);
        return <BalanceDisplay amount={remainingAmount} currency="PKR" />;
      },
    },
    {
      key: 'runningBalance',
      header: 'کل بقیہ',
      render: (row: BankLedgerEntryWithBalance & { runningBalance?: number }) => {
        // Show cumulative running balance (total balance up to this entry)
        const runningBalance = (row as any).runningBalance !== undefined 
          ? (row as any).runningBalance 
          : 0;
        return <BalanceDisplay amount={runningBalance} currency="PKR" />;
      },
    },
    {
      key: 'action',
      header: 'عمل',
      render: (row: BankLedgerEntryWithBalance) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <Edit className="w-3.5 h-3.5 mr-1" />
            Edit
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="btn-outline text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs py-1.5 px-3"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Delete
          </button>
        </div>
      ),
    },
  ];


  if (!trader || !bank) {
    return (
      <div className="animate-fade-in">
        <Topbar
          title="Loading..."
          breadcrumbs={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
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
        title={`${bank.name} - ${trader.name}`}
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Pakistani Hisaab Kitaab', path: '/dashboard/persons/pakistani' },
          { label: trader.name, path: `/dashboard/persons/pakistani/${traderId}` },
          { label: bank.name },
        ]}
      />

      <main className="p-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(`/dashboard/persons/pakistani/${traderId}`)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {trader.name}</span>
        </button>

        {/* Bank Info Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{bank.name}</h2>
              <p className="text-muted-foreground">{trader.name}</p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
            <p
              className={`text-2xl font-bold ${
                totalBalance >= 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {totalBalance >= 0 ? '+' : ''}
              {new Intl.NumberFormat('en-PK').format(totalBalance)} PKR
            </p>
          </div>
        </div>

        {/* Header with Add Button */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg flex-1">
            <p className="text-sm text-foreground">
              <strong>Remaining Amount Formula:</strong> Amount Added - Amount Withdrawn = Remaining Amount
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-accent flex items-center gap-2 px-6 py-3"
          >
            <Plus className="w-5 h-5" />
            Add New Entry
          </button>
        </div>

        {/* Date Filter Section */}
        <div className="mb-6 bg-card border border-border rounded-lg p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                From Date
              </label>
              <input
                type="date"
                value={dateFilter.fromDate}
                onChange={(e) => setDateFilter({ ...dateFilter, fromDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                To Date
              </label>
              <input
                type="date"
                value={dateFilter.toDate}
                onChange={(e) => setDateFilter({ ...dateFilter, toDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleFilter}
                className="btn-accent flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Filter
              </button>
              <button
                onClick={handleClearFilter}
                className="btn-outline"
              >
                Clear
              </button>
              <button
                onClick={handleDownloadPDF}
                className="btn-outline text-success hover:bg-success/10 hover:text-success flex items-center gap-2"
                disabled={filteredEntries.length === 0 && entries.length === 0}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
          {(dateFilter.fromDate || dateFilter.toDate) && (
            <div className="mt-3 text-sm text-muted-foreground">
              Showing {filteredEntries.length} of {entries.length} entries
            </div>
          )}
        </div>

        {/* Table */}
        {entries.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground mb-4">No ledger entries found.</p>
            <p className="text-sm text-muted-foreground">Click "Add New Entry" to create your first entry.</p>
          </div>
        ) : (
          <Table columns={columns} data={(dateFilter.fromDate || dateFilter.toDate) ? filteredEntries : entries} />
        )}
      </main>

      {/* Add New Entry Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddFormErrors({});
        }}
        title="Add New Entry - Bank Ledger"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              تاریخ <span className="text-destructive">*</span>
            </label>
            <input
              type="date"
              value={addFormData.date}
              onChange={(e) => {
                setAddFormData({ ...addFormData, date: e.target.value });
                setAddFormErrors({ ...addFormErrors, date: '' });
              }}
              className={`input-field ${addFormErrors.date ? 'border-destructive' : ''}`}
              required
            />
            {addFormErrors.date && (
              <p className="text-sm text-destructive mt-1">{addFormErrors.date}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              حوالہ کی قسم <span className="text-destructive">*</span>
            </label>
            <select
              value={addFormData.referenceType}
              onChange={(e) =>
                setAddFormData({ ...addFormData, referenceType: e.target.value as 'Online' | 'Cash' })
              }
              className="select-field"
            >
              <option value="Online">آن لائن</option>
              <option value="Cash">نقد</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              جمع شدہ رقم
            </label>
            <input
              type="number"
              step="0.01"
              value={addFormData.amountAdded}
              onChange={(e) => {
                setAddFormData({ ...addFormData, amountAdded: e.target.value });
                setAddFormErrors({ ...addFormErrors, amountAdded: '' });
              }}
              className={`input-field ${addFormErrors.amountAdded ? 'border-destructive' : ''}`}
              placeholder="0.00"
            />
            {addFormErrors.amountAdded && (
              <p className="text-sm text-destructive mt-1">{addFormErrors.amountAdded}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty if no amount was added
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              نکلوائی گئی رقم
            </label>
            <input
              type="number"
              step="0.01"
              value={addFormData.amountWithdrawn}
              onChange={(e) => {
                setAddFormData({ ...addFormData, amountWithdrawn: e.target.value });
                setAddFormErrors({ ...addFormErrors, amountWithdrawn: '' });
              }}
              className="input-field"
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty if no amount was withdrawn
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              حوالہ شخص
            </label>
            <input
              type="text"
              value={addFormData.referencePerson}
              onChange={(e) => {
                setAddFormData({ ...addFormData, referencePerson: e.target.value });
              }}
              className="input-field"
              placeholder="Enter reference person name"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={handleAddEntry}
              disabled={isSaving}
              className="btn-accent flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Entry'
              )}
            </button>
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setAddFormErrors({});
              }}
              disabled={isSaving}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Edit Ledger Entry"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              تاریخ
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              حوالہ کی قسم
            </label>
            <select
              value={formData.referenceType}
              onChange={(e) =>
                setFormData({ ...formData, referenceType: e.target.value as 'Online' | 'Cash' })
              }
              className="select-field"
            >
              <option value="Online">آن لائن</option>
              <option value="Cash">نقد</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              جمع شدہ رقم
            </label>
            <input
              type="number"
              value={formData.amountAdded}
              onChange={(e) => setFormData({ ...formData, amountAdded: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              نکلوائی گئی رقم
            </label>
            <input
              type="number"
              value={formData.amountWithdrawn}
              onChange={(e) => setFormData({ ...formData, amountWithdrawn: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              حوالہ شخص
            </label>
            <input
              type="text"
              value={formData.referencePerson}
              onChange={(e) => setFormData({ ...formData, referencePerson: e.target.value })}
              className="input-field"
              placeholder="Enter reference person name"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-accent flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
            <button
              onClick={() => setIsModalOpen(false)}
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

export default BankLedger;
