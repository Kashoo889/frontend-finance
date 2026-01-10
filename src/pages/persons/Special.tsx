import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import Table, { Column } from '@/components/Table';
import Modal from '@/components/Modal';
import BalanceDisplay from '@/components/BalanceDisplay';
import { calculateSpecialBalance, formatNumber, SpecialEntry } from '@/data/dummyData';
import { specialAPI } from '@/lib/api';
import { Edit, Plus, Loader2, Trash2, Search, Download, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Special Hisaab Kitaab page
 * Displays user transactions with balance type dropdown
 */

// Extend SpecialEntry to include running balance for display
interface SpecialEntryWithBalance extends SpecialEntry {
  runningBalance?: number;
}

const Special = () => {
  const [entries, setEntries] = useState<SpecialEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<SpecialEntry[]>([]);
  // State for entries with calculated running balances
  const [entriesWithBalance, setEntriesWithBalance] = useState<SpecialEntryWithBalance[]>([]);
  const [filteredEntriesWithBalance, setFilteredEntriesWithBalance] = useState<SpecialEntryWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SpecialEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    fromDate: '',
    toDate: '',
  });

  // Form state for edit modal
  const [formData, setFormData] = useState({
    userName: '',
    balanceType: 'Online' as 'Online' | 'Cash',
    nameRupees: '',
    submittedRupees: '',
    referencePerson: '',
  });

  // Form state for add modal
  const [addFormData, setAddFormData] = useState({
    userName: '',
    date: new Date().toISOString().split('T')[0],
    balanceType: 'Online' as 'Online' | 'Cash',
    nameRupees: '',
    submittedRupees: '',
    referencePerson: '',
  });

  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Fetch entries from API
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const data = await specialAPI.getAll();
      setEntries(data);
      setFilteredEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
      setEntries([]);
      setFilteredEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter entries by date range
  const handleFilter = () => {
    if (!dateFilter.fromDate && !dateFilter.toDate) {
      setFilteredEntries(entries);
      return;
    }

    const filtered = entries.filter((entry) => {
      const entryDate = entry.date;
      if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
      if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
      return true;
    });

    setFilteredEntries(filtered);
  };

  // Clear filter
  const handleClearFilter = () => {
    setDateFilter({ fromDate: '', toDate: '' });
    setFilteredEntries(entries);
    // Display in chronological order (Oldest First)
    setFilteredEntriesWithBalance([...entriesWithBalance]);
  };

  /**
   * Calculate running balances for entries
   * 
   * IMPORTANT: Running balance is ALWAYS calculated in chronological order (oldest → newest),
   * regardless of how the table is displayed/sorted.
   * 
   * Formula for each entry:
   *   Net Change = Name Rupees - Submitted Rupees
   *   Running Balance = Previous Running Balance + Net Change
   * 
   * The TOTAL balance (last chronological entry) will always equal:
   *   Total = Σ(Name Rupees) - Σ(Submitted Rupees)
   * 
   * This total is independent of sorting/display order.
   */
  const calculateRunningBalances = (data: SpecialEntry[]): SpecialEntryWithBalance[] => {
    if (data.length === 0) return [];

    // 1. ALWAYS sort by date ascending (chronological order) for calculation
    const sortedData = [...data].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    let cumulativeBalance = 0;

    // 2. Calculate running balance chronologically
    const result = sortedData.map((entry) => {
      // Net change for this entry = Name Rupees - Submitted Rupees
      const netChange = (entry.nameRupees || 0) - (entry.submittedRupees || 0);

      // Accumulate balance
      cumulativeBalance += netChange;

      return {
        ...entry,
        runningBalance: cumulativeBalance
      };
    });

    // Validation: Verify last entry's balance equals expected total
    if (result.length > 0 && process.env.NODE_ENV === 'development') {
      const expectedTotal = data.reduce((sum, entry) => {
        return sum + ((entry.nameRupees || 0) - (entry.submittedRupees || 0));
      }, 0);

      const lastBalance = result[result.length - 1].runningBalance || 0;
      const diff = Math.abs(lastBalance - expectedTotal);

      if (diff > 0.01) {
        console.warn('[Special] Running balance mismatch:', {
          lastRunningBalance: lastBalance,
          expectedTotal: expectedTotal,
          difference: diff
        });
      }
    }

    return result;
  };

  // Recalculate running balances whenever entries change
  useEffect(() => {
    if (entries.length > 0) {
      const calculated = calculateRunningBalances(entries);
      setEntriesWithBalance(calculated);

      // Apply current filter to the calculated entries
      if (dateFilter.fromDate || dateFilter.toDate) {
        const filtered = calculated.filter((entry) => {
          const entryDate = entry.date;
          if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
          if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
          return true;
        });
        // Display in chronological order (Oldest First)
        setFilteredEntriesWithBalance([...filtered]);
      } else {
        // Display in chronological order (Oldest First)
        setFilteredEntriesWithBalance([...calculated]);
      }
    } else {
      setEntriesWithBalance([]);
      setFilteredEntriesWithBalance([]);
    }
  }, [entries, dateFilter.fromDate, dateFilter.toDate]);

  // Update filter logic to also update filteredEntriesWithBalance
  useEffect(() => {
    if (!dateFilter.fromDate && !dateFilter.toDate) {
      // Display in chronological order (Oldest First)
      setFilteredEntriesWithBalance([...entriesWithBalance]);
    } else {
      const filtered = entriesWithBalance.filter((entry) => {
        const entryDate = entry.date;
        if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
        if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
        return true;
      });
      // Display in chronological order (Oldest First)
      setFilteredEntriesWithBalance([...filtered]);
    }
  }, [entriesWithBalance, dateFilter]);

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
      const totalNameRupees = dataToExport.reduce((sum, entry) => sum + (entry.nameRupees || 0), 0);
      const totalSubmittedRupees = dataToExport.reduce((sum, entry) => sum + (entry.submittedRupees || 0), 0);
      const totalBalance = dataToExport.reduce((sum, entry) => {
        const balance = entry.balance !== undefined
          ? entry.balance
          : (entry.nameRupees - entry.submittedRupees);
        return sum + balance;
      }, 0);

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('SPECIAL HISAAB KITAAB REPORT', 14, 15);

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
        const balance = entry.balance !== undefined
          ? entry.balance
          : (entry.nameRupees - entry.submittedRupees);

        return [
          entry.date,
          entry.userName || '-',
          entry.balanceType, // Use English directly: 'Online' or 'Cash'
          formatNumber(entry.nameRupees) + ' PKR',
          formatNumber(entry.submittedRupees) + ' PKR',
          (entry as any).referencePerson || '-',
          formatNumber(balance) + ' PKR'
        ];
      });

      // Add summary totals row
      tableData.push([
        '',
        'TOTALS',
        '',
        formatNumber(totalNameRupees) + ' PKR',
        formatNumber(totalSubmittedRupees) + ' PKR',
        '',
        formatNumber(totalBalance) + ' PKR'
      ]);

      // Create table
      autoTable(doc, {
        startY: 38,
        head: [['Date', 'Name', 'Online or Cash', 'Rupees Received', 'Rupees Submitted', 'Reference Person', 'Balance']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138], // Dark blue
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 11,
          halign: 'center',
          valign: 'middle',
          cellPadding: 4
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [0, 0, 0],
          halign: 'center',
          valign: 'middle',
          cellPadding: 3
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        columnStyles: {
          0: { halign: 'center' }, // Date
          1: { halign: 'center' }, // Name
          2: { halign: 'center' }, // Online or Cash
          3: { halign: 'right' },  // Rupees Received
          4: { halign: 'right' },  // Rupees Submitted
          5: { halign: 'center' }, // Reference Person
          6: { halign: 'right' }   // Balance
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 3,
          lineWidth: 0.5,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          fontSize: 9
        },
        margin: { top: 38, left: 10, right: 10 },
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
      const fileName = `Special_Hisaab_Kitaab_${dateFilter.fromDate || 'all'}_${dateFilter.toDate || 'all'}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Save PDF
      doc.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleEdit = (entry: SpecialEntry) => {
    setSelectedEntry(entry);
    setFormData({
      userName: entry.userName,
      balanceType: entry.balanceType,
      nameRupees: entry.nameRupees.toString(),
      submittedRupees: entry.submittedRupees.toString(),
      referencePerson: (entry as any).referencePerson || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      await specialAPI.update(selectedEntry.id, {
        userName: formData.userName.trim(),
        balanceType: formData.balanceType,
        nameRupees: parseFloat(formData.nameRupees),
        submittedRupees: parseFloat(formData.submittedRupees),
        referencePerson: formData.referencePerson.trim(),
      });
      setIsModalOpen(false);
      setSelectedEntry(null);
      fetchEntries(); // Refresh table
    } catch (error: any) {
      console.error('Error updating entry:', error);
      const errorMessage = error?.message || 'Failed to update entry. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entry: SpecialEntry) => {
    if (!window.confirm(`Are you sure you want to delete this entry?\n\nUser: ${entry.userName}\nDate: ${entry.date}\n\nThis action cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await specialAPI.delete(entry.id);
      fetchEntries(); // Refresh table
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

    if (!addFormData.userName.trim()) errors.userName = 'User name is required';
    if (!addFormData.date) errors.date = 'Date is required';
    // Allow nameRupees to be empty or 0 - no validation needed
    if (addFormData.submittedRupees && parseFloat(addFormData.submittedRupees) < 0) {
      errors.submittedRupees = 'Submitted rupees must be 0 or greater';
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEntry = async () => {
    if (!validateAddForm()) return;

    setIsSaving(true);
    try {
      await specialAPI.create({
        userName: addFormData.userName.trim(),
        date: addFormData.date,
        balanceType: addFormData.balanceType,
        nameRupees: addFormData.nameRupees ? parseFloat(addFormData.nameRupees) || 0 : 0,
        submittedRupees: addFormData.submittedRupees ? parseFloat(addFormData.submittedRupees) || 0 : 0,
        referencePerson: addFormData.referencePerson.trim(),
      });
      setIsAddModalOpen(false);
      // Reset form
      setAddFormData({
        userName: '',
        date: new Date().toISOString().split('T')[0],
        balanceType: 'Online',
        nameRupees: '',
        submittedRupees: '',
        referencePerson: '',
      });
      setAddFormErrors({});
      fetchEntries(); // Refresh table
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create entry. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Table column definitions
  const columns: Column<SpecialEntryWithBalance>[] = [
    { key: 'date', header: 'تاریخ' },
    { key: 'userName', header: 'نام' },
    {
      key: 'balanceType',
      header: 'آن لائن یا نقد',
      render: (row: SpecialEntryWithBalance) => (
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${row.balanceType === 'Online'
            ? 'bg-accent/10 text-accent'
            : 'bg-warning/10 text-warning'
            }`}
        >
          {row.balanceType === 'Online' ? 'آن لائن' : 'نقد'}
        </span>
      ),
    },
    {
      key: 'nameRupees',
      header: 'روپے موصول',
      render: (row: SpecialEntryWithBalance) => formatNumber(row.nameRupees) + ' PKR',
    },
    {
      key: 'submittedRupees',
      header: 'روپیہ جمع کرایا',
      render: (row: SpecialEntryWithBalance) => formatNumber(row.submittedRupees) + ' PKR',
    },
    {
      key: 'referencePerson',
      header: 'حوالہ شخص',
      render: (row: SpecialEntryWithBalance) => (row as any).referencePerson || '-',
    },
    {
      key: 'balance',
      header: 'بقیہ رقم',
      render: (row: SpecialEntryWithBalance & { balance?: number }) => {
        // Use backend-calculated balance if available, otherwise calculate client-side
        const balance = row.balance !== undefined
          ? row.balance
          : calculateSpecialBalance(row.nameRupees, row.submittedRupees);
        return <BalanceDisplay amount={balance} currency="PKR" />;
      },
    },
    {
      key: 'runningBalance',
      header: 'کل بقایا',
      render: (row: SpecialEntryWithBalance) => {
        return <BalanceDisplay amount={row.runningBalance || 0} currency="PKR" />;
      },
    },
    {
      key: 'action',
      header: 'عمل',
      render: (row: SpecialEntryWithBalance) => (
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

  return (
    <div className="animate-fade-in">
      <Topbar
        title="Special Hisaab Kitaab"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Persons', path: '/dashboard' },
          { label: 'Special Hisaab Kitaab' },
        ]}
      />

      <main className="p-6">
        {/* Header with Add Button */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg flex-1">
            <p className="text-sm text-foreground">
              <strong>Balance Formula:</strong> Name Rupees - Submitted Rupees
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
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <Table columns={columns} data={filteredEntriesWithBalance} />
        )}
      </main>

      {/* Add New Entry Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setAddFormErrors({});
        }}
        title="Add New Entry - Special Hisaab Kitaab"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                نام <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={addFormData.userName}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, userName: e.target.value });
                  setAddFormErrors({ ...addFormErrors, userName: '' });
                }}
                className={`input-field ${addFormErrors.userName ? 'border-destructive' : ''}`}
                placeholder="Ahmed Khan"
                required
              />
              {addFormErrors.userName && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.userName}</p>
              )}
            </div>

            {/* Date */}
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

            {/* Balance Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                آن لائن یا نقد <span className="text-destructive">*</span>
              </label>
              <select
                value={addFormData.balanceType}
                onChange={(e) =>
                  setAddFormData({ ...addFormData, balanceType: e.target.value as 'Online' | 'Cash' })
                }
                className="select-field"
              >
                <option value="Online">آن لائن</option>
                <option value="Cash">نقد</option>
              </select>
            </div>

            {/* Name Rupees */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                روپے موصول
              </label>
              <input
                type="number"
                step="0.01"
                value={addFormData.nameRupees}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, nameRupees: e.target.value });
                  setAddFormErrors({ ...addFormErrors, nameRupees: '' });
                }}
                className={`input-field ${addFormErrors.nameRupees ? 'border-destructive' : ''}`}
                placeholder="150000 (optional)"
              />
              {addFormErrors.nameRupees && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.nameRupees}</p>
              )}
            </div>

            {/* Submitted Rupees */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                روپیہ جمع کرایا <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={addFormData.submittedRupees}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, submittedRupees: e.target.value });
                  setAddFormErrors({ ...addFormErrors, submittedRupees: '' });
                }}
                className={`input-field ${addFormErrors.submittedRupees ? 'border-destructive' : ''}`}
                placeholder="120000"
                required
              />
              {addFormErrors.submittedRupees && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.submittedRupees}</p>
              )}
            </div>

            {/* Reference Person */}
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
        title={`Edit Entry - ${selectedEntry?.userName}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              نام
            </label>
            <input
              type="text"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              آن لائن یا نقد
            </label>
            <select
              value={formData.balanceType}
              onChange={(e) =>
                setFormData({ ...formData, balanceType: e.target.value as 'Online' | 'Cash' })
              }
              className="select-field"
            >
              <option value="Online">آن لائن</option>
              <option value="Cash">نقد</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              روپے موصول
            </label>
            <input
              type="number"
              value={formData.nameRupees}
              onChange={(e) => setFormData({ ...formData, nameRupees: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              روپیہ جمع کرایا
            </label>
            <input
              type="number"
              value={formData.submittedRupees}
              onChange={(e) => setFormData({ ...formData, submittedRupees: e.target.value })}
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

export default Special;
