import { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import Table, { Column } from '@/components/Table';
import Modal from '@/components/Modal';
import BalanceDisplay from '@/components/BalanceDisplay';
import { calculateSaudiBalance, formatNumber, SaudiEntry } from '@/data/dummyData';
import { saudiAPI } from '@/lib/api';
import { Edit, Plus, Loader2, Trash2, Search, Download, Calendar } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadUrduFont, setUrduFont, setEnglishFont, containsUrdu } from '@/utils/pdfFonts';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Saudi Hisaab Kitaab page
 * Displays transactions with SAR balance calculations
 */

// Extend SaudiEntry to include running balance for display
interface SaudiEntryWithBalance extends SaudiEntry {
  runningBalance?: number;
}

const Saudi = () => {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<SaudiEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<SaudiEntry[]>([]);
  // State for entries with calculated running balances
  const [entriesWithBalance, setEntriesWithBalance] = useState<SaudiEntryWithBalance[]>([]);
  const [filteredEntriesWithBalance, setFilteredEntriesWithBalance] = useState<SaudiEntryWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SaudiEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    fromDate: '',
    toDate: '',
  });

  // Form state for edit modal
  const [formData, setFormData] = useState({
    pkrAmount: '',
    riyalRate: '',
    submittedSar: '',
    reference2: '',
  });

  // Form state for add modal
  const [addFormData, setAddFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    refNo: '',
    pkrAmount: '',
    riyalRate: '',
    submittedSar: '',
    reference2: '',
  });

  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Fetch entries from API
  const fetchEntries = async () => {
    try {
      setIsLoading(true);
      const data = await saudiAPI.getAll();
      setEntries(data);
      setFilteredEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
      // Fallback to empty array on error
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
    // The useEffect will handle updating filteredEntriesWithBalance
  };

  // Clear filter
  const handleClearFilter = () => {
    setDateFilter({ fromDate: '', toDate: '' });
    setFilteredEntries(entries);
    // Reverse for display: newest first
    setFilteredEntriesWithBalance([...entriesWithBalance].reverse());
  };

  /**
   * Calculate running balances for entries
   * 
   * IMPORTANT: Running balance is ALWAYS calculated in chronological order (date ascending),
   * regardless of how the table is displayed/sorted.
   * 
   * Formula for each entry:
   *   Riyal Amount = PKR Amount ÷ Riyal Rate
   *   Net Change = Riyal Amount - Submitted SAR
   *   Running Balance = Previous Running Balance + Net Change
   * 
   * The TOTAL balance (last chronological entry) will always equal:
   *   Total = Σ(PKR/Rate) - Σ(Submitted SAR)
   * 
   * This total is independent of sorting/display order.
   */
  const calculateRunningBalances = (data: SaudiEntry[]): SaudiEntryWithBalance[] => {
    if (data.length === 0) return [];

    // 1. ALWAYS sort by date ascending (chronological order) for calculation
    // This ensures running balance represents historical accumulation
    const sortedData = [...data].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;

      // Secondary sort by time if dates are equal
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return 0;
    });

    let cumulativeBalance = 0;

    // 2. Calculate running balance chronologically
    const result = sortedData.map((entry, index) => {
      // Calculate Riyal Amount = PKR ÷ Rate
      const riyalAmount = (entry as any).riyalAmount !== undefined
        ? (entry as any).riyalAmount
        : (entry.riyalRate > 0 ? entry.pkrAmount / entry.riyalRate : 0);

      // Net change for this entry = Riyal Amount - Submitted SAR
      const netChange = riyalAmount - entry.submittedSar;

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
        const riyalAmount = (entry as any).riyalAmount !== undefined
          ? (entry as any).riyalAmount
          : (entry.riyalRate > 0 ? entry.pkrAmount / entry.riyalRate : 0);
        return sum + (riyalAmount - entry.submittedSar);
      }, 0);

      const lastBalance = result[result.length - 1].runningBalance || 0;
      const diff = Math.abs(lastBalance - expectedTotal);

      if (diff > 0.01) { // Allow small floating point difference
        console.warn('[Saudi] Running balance mismatch:', {
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
        // Reverse for display: newest first
        setFilteredEntriesWithBalance([...filtered].reverse());
      } else {
        // Reverse for display: newest first
        setFilteredEntriesWithBalance([...calculated].reverse());
      }
    } else {
      setEntriesWithBalance([]);
      setFilteredEntriesWithBalance([]);
    }
  }, [entries, dateFilter.fromDate, dateFilter.toDate]);

  // Update filter logic to also update filteredEntriesWithBalance
  useEffect(() => {
    if (!dateFilter.fromDate && !dateFilter.toDate) {
      // Reverse for display: newest first
      setFilteredEntriesWithBalance([...entriesWithBalance].reverse());
    } else {
      const filtered = entriesWithBalance.filter((entry) => {
        const entryDate = entry.date;
        if (dateFilter.fromDate && entryDate < dateFilter.fromDate) return false;
        if (dateFilter.toDate && entryDate > dateFilter.toDate) return false;
        return true;
      });
      // Reverse for display: newest first
      setFilteredEntriesWithBalance([...filtered].reverse());
    }
  }, [entriesWithBalance, dateFilter]);


  // Generate and download PDF
  const handleDownloadPDF = async () => {
    try {
      const dataToExport = filteredEntries.length > 0 ? filteredEntries : entries;

      if (dataToExport.length === 0) {
        alert('No data to export');
        return;
      }

      // Create new PDF document
      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Load Urdu font for proper rendering - MUST complete before table generation
      try {
        await loadUrduFont(doc);
        // Verify font is available
        const fonts = (doc as any).getFontList?.() || {};
        if (fonts['NotoSansArabic']) {
          console.log('Urdu font ready for PDF generation');
        } else {
          console.warn('Urdu font not found in font list, will use default');
        }
      } catch (error) {
        console.error('Could not load Urdu font, continuing with default:', error);
      }

      // Calculate totals
      const totalPKR = dataToExport.reduce((sum, entry) => sum + (entry.pkrAmount || 0), 0);
      const totalRiyal = dataToExport.reduce((sum, entry) => {
        const riyalAmount = (entry as any).riyalAmount !== undefined
          ? (entry as any).riyalAmount
          : (entry.riyalRate > 0 ? entry.pkrAmount / entry.riyalRate : 0);
        return sum + riyalAmount;
      }, 0);
      const totalSubmittedSAR = dataToExport.reduce((sum, entry) => sum + (entry.submittedSar || 0), 0);

      // Header (English)
      doc.setFontSize(18);
      setEnglishFont(doc);
      doc.setFont('helvetica', 'bold');
      doc.text('SAUDI HISAAB KITAAB REPORT', 14, 15);

      // Report info (English)
      doc.setFontSize(10);
      setEnglishFont(doc);
      doc.setFont('helvetica', 'normal');
      const dateRange = dateFilter.fromDate && dateFilter.toDate
        ? `${dateFilter.fromDate} to ${dateFilter.toDate}`
        : 'All Entries';
      doc.text(`Date Range: ${dateRange}`, 14, 22);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);
      doc.text(`Total Entries: ${dataToExport.length}`, 14, 32);

      // Prepare table data
      const tableData = dataToExport.map(entry => {
        const riyalAmount = (entry as any).riyalAmount !== undefined
          ? (entry as any).riyalAmount
          : (entry.riyalRate > 0 ? entry.pkrAmount / entry.riyalRate : 0);
        const balance = entry.balance !== undefined
          ? entry.balance
          : (riyalAmount - entry.submittedSar);

        return [
          entry.date,
          entry.refNo || '-',
          formatNumber(entry.pkrAmount) + ' PKR',
          formatNumber(riyalAmount) + ' SAR',
          formatNumber(entry.submittedSar) + ' SAR',
          entry.reference2 || '-',
          formatNumber(balance) + ' SAR',
          entry.riyalRate.toFixed(2)
        ];
      });

      // Add summary totals row
      tableData.push([
        '',
        'TOTALS',
        formatNumber(totalPKR) + ' PKR',
        formatNumber(totalRiyal) + ' SAR',
        formatNumber(totalSubmittedSAR) + ' SAR',
        '',
        formatNumber(totalRiyal - totalSubmittedSAR) + ' SAR',
        ''
      ]);

      // Create table with proper formatting
      autoTable(doc, {
        startY: 38,
        head: [['Date', 'Name', 'PKR Order', 'Riyal Order', 'Total Riyal', 'Reference', 'Balance', 'Riyal Rate']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138], // Dark blue
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 14,
          halign: 'center',
          valign: 'middle',
          cellPadding: 4,
          font: 'NotoSansArabic' // Urdu headers
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
          0: { halign: 'center', font: 'NotoSansArabic' }, // تاریخ (Date)
          1: { halign: 'center', font: 'helvetica' }, // نام (Name) - may contain English
          2: { halign: 'right', font: 'helvetica' },  // روپے آرڈر (PKR Order) - numbers
          3: { halign: 'right', font: 'helvetica' },  // ریال آرڈر (Riyal Order) - numbers
          4: { halign: 'right', font: 'helvetica' },  // جمع ریال (Total Riyal) - numbers
          5: { halign: 'center', font: 'NotoSansArabic' }, // حوالہ (Reference)
          6: { halign: 'right', font: 'helvetica' },  // بیلنس (Balance) - numbers
          7: { halign: 'right', font: 'helvetica' }   // ریال ریٹ (Riyal Rate) - numbers
        },
        styles: {
          overflow: 'linebreak',
          cellPadding: 3,
          lineWidth: 0.5,
          lineColor: [0, 0, 0],
          textColor: [0, 0, 0],
          fontSize: 9,
          font: 'NotoSansArabic' // Default font for Urdu
        },
        margin: { top: 38, left: 10, right: 10 },
        didParseCell: function (data: any) {
          // Check if font is available
          const fonts = (doc as any).getFontList?.() || {};
          const hasUrduFont = fonts['NotoSansArabic'] || fonts['NotoSansArabic-normal'];

          // Set font based on content and availability
          const cellText = String(data.cell.text || '');
          const isUrduText = containsUrdu(cellText);
          const isUrduColumn = [0, 5].includes(data.column.index);
          const isNumericColumn = [2, 3, 4, 6, 7].includes(data.column.index);

          if (isNumericColumn || (!isUrduText && !isUrduColumn)) {
            // Use helvetica for numbers and non-Urdu text
            data.cell.styles.font = 'helvetica';
          } else if (hasUrduFont && (isUrduText || isUrduColumn)) {
            // Use Urdu font if available and needed
            data.cell.styles.font = hasUrduFont ? 'NotoSansArabic' : 'helvetica';
          }

          // Make totals row bold
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
            data.cell.styles.textColor = [0, 0, 0];
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
      const fileName = `Saudi_Hisaab_Kitaab_${dateFilter.fromDate || 'all'}_${dateFilter.toDate || 'all'}_${new Date().toISOString().split('T')[0]}.pdf`;

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

  const handleEdit = (entry: SaudiEntry) => {
    setSelectedEntry(entry);
    setFormData({
      pkrAmount: entry.pkrAmount.toString(),
      riyalRate: entry.riyalRate.toString(),
      submittedSar: entry.submittedSar.toString(),
      reference2: entry.reference2,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      await saudiAPI.update(selectedEntry.id, {
        pkrAmount: parseFloat(formData.pkrAmount),
        riyalRate: parseFloat(formData.riyalRate),
        submittedSar: parseFloat(formData.submittedSar),
        reference2: formData.reference2.trim(),
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

  const handleDelete = async (entry: SaudiEntry) => {
    if (!window.confirm(`Are you sure you want to delete this entry?\n\nRef No: ${entry.refNo}\nDate: ${entry.date}\n\nThis action cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      await saudiAPI.delete(entry.id);
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

    if (!addFormData.date) errors.date = 'Date is required';
    if (!addFormData.time) errors.time = 'Time is required';
    if (!addFormData.refNo.trim()) errors.refNo = 'Reference number is required';

    // PKR, Rate, and Submitted Riyal can all be 0 or empty (completely optional)
    // Only validate if negative
    if (addFormData.pkrAmount !== '' && parseFloat(addFormData.pkrAmount) < 0) {
      errors.pkrAmount = 'PKR amount cannot be negative';
    }
    if (addFormData.riyalRate !== '' && parseFloat(addFormData.riyalRate) < 0) {
      errors.riyalRate = 'Riyal rate cannot be negative';
    }
    if (addFormData.submittedSar !== '' && parseFloat(addFormData.submittedSar) < 0) {
      errors.submittedSar = 'Submitted Riyal cannot be negative';
    }

    setAddFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddEntry = async () => {
    if (!validateAddForm()) return;

    setIsSaving(true);
    try {
      await saudiAPI.create({
        date: addFormData.date,
        time: addFormData.time,
        refNo: addFormData.refNo.trim().toUpperCase(),
        pkrAmount: addFormData.pkrAmount === '' ? 0 : parseFloat(addFormData.pkrAmount),
        riyalRate: addFormData.riyalRate === '' ? 0 : parseFloat(addFormData.riyalRate),
        submittedSar: addFormData.submittedSar === '' ? 0 : parseFloat(addFormData.submittedSar),
        reference2: addFormData.reference2.trim(),
      });
      setIsAddModalOpen(false);
      // Reset form
      setAddFormData({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        refNo: '',
        pkrAmount: '',
        riyalRate: '',
        submittedSar: '',
        reference2: '',
      });
      setAddFormErrors({});
      fetchEntries(); // Refresh table
    } catch (error: any) {
      console.error('Error creating entry:', error);
      const errorMessage = error?.message || 'Failed to create entry. Please try again.';

      // Check if error contains validation messages
      if (errorMessage.includes('already exists') || errorMessage.includes('refNo')) {
        setAddFormErrors({ refNo: 'This reference number already exists. Please use a different one.' });
      } else if (errorMessage.includes('uppercase') || errorMessage.includes('Reference number')) {
        setAddFormErrors({ refNo: 'Reference number should be uppercase letters only' });
      } else if (errorMessage.includes('PKR amount') || errorMessage.includes('pkrAmount')) {
        setAddFormErrors({ pkrAmount: errorMessage });
      } else if (errorMessage.includes('Riyal rate') || errorMessage.includes('riyalRate')) {
        setAddFormErrors({ riyalRate: errorMessage });
      } else if (errorMessage.includes('Submitted SAR') || errorMessage.includes('submittedSar')) {
        setAddFormErrors({ submittedSar: errorMessage });
      } else if (errorMessage.includes('Date') || errorMessage.includes('date')) {
        setAddFormErrors({ date: errorMessage });
      } else if (errorMessage.includes('Time') || errorMessage.includes('time')) {
        setAddFormErrors({ time: errorMessage });
      } else {
        // Show general error in alert, but also try to extract field-specific errors
        const errors: Record<string, string> = {};
        if (errorMessage.includes('refNo')) errors.refNo = errorMessage;
        if (errorMessage.includes('pkrAmount')) errors.pkrAmount = errorMessage;
        if (errorMessage.includes('riyalRate')) errors.riyalRate = errorMessage;
        if (errorMessage.includes('submittedSar')) errors.submittedSar = errorMessage;
        if (errorMessage.includes('date')) errors.date = errorMessage;
        if (errorMessage.includes('time')) errors.time = errorMessage;

        if (Object.keys(errors).length > 0) {
          setAddFormErrors(errors);
        } else {
          alert(errorMessage);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Table column definitions
  const columns: Column<SaudiEntryWithBalance>[] = [
    { key: 'date', header: 'تاریخ' },
    { key: 'refNo', header: 'نام' },
    {
      key: 'pkrAmount',
      header: 'روپے آرڈر',
      render: (row: SaudiEntryWithBalance) => formatNumber(row.pkrAmount) + ' PKR',
    },
    {
      key: 'riyalAmount',
      header: 'ریال آرڈر',
      render: (row: SaudiEntryWithBalance) => {
        // Use stored riyalAmount from backend, or calculate if not available (for backward compatibility)
        const riyalAmount = (row as any).riyalAmount !== undefined
          ? (row as any).riyalAmount
          : (row.riyalRate > 0 ? row.pkrAmount / row.riyalRate : 0);
        return formatNumber(riyalAmount) + ' SAR';
      },
    },
    {
      key: 'submittedSar',
      header: 'جمع ریال',
      render: (row: SaudiEntry) => formatNumber(row.submittedSar) + ' SAR',
    },
    { key: 'reference2', header: 'حوالہ' },
    {
      key: 'balance',
      header: 'بیلنس',
      render: (row: SaudiEntryWithBalance & { balance?: number; riyalAmount?: number }) => {
        // Use backend-calculated balance if available, otherwise calculate client-side
        let balance = row.balance;
        if (balance === undefined) {
          // Calculate: RIYAL AMOUNT - SUBMITTED SAR = Balance
          const riyalAmount = row.riyalAmount !== undefined
            ? row.riyalAmount
            : (row.riyalRate > 0 ? row.pkrAmount / row.riyalRate : 0);
          balance = riyalAmount - row.submittedSar;
        }
        return <BalanceDisplay amount={balance} currency="SAR" />;
      },
    },
    {
      key: 'runningBalance',
      header: 'کل بقایا',
      render: (row: SaudiEntryWithBalance) => {
        return <BalanceDisplay amount={row.runningBalance || 0} currency="SAR" />;
      },
    },
    {
      key: 'riyalRate',
      header: 'ریال ریٹ',
      render: (row: SaudiEntry) => formatNumber(row.riyalRate),
    },
    {
      key: 'action',
      header: 'عمل',
      render: (row: SaudiEntry) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="btn-primary text-xs py-1.5 px-3"
          >
            <Edit className="w-3.5 h-3.5 mr-1" />
            {t('common.edit')}
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="btn-outline text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs py-1.5 px-3"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            {t('common.delete')}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in">
      <Topbar
        title="Saudi Hisaab Kitaab"
        breadcrumbs={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Persons', path: '/dashboard' },
          { label: 'Saudi Hisaab Kitaab' },
        ]}
      />

      <main className="p-6">
        {/* Header with Add Button */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="p-4 bg-accent/10 border border-accent/20 rounded-lg flex-1">
            <p className="text-sm text-foreground">
              <strong>Balance Formula:</strong> RIYAL AMOUNT - SUBMITTED SAR = Balance
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Where: RIYAL AMOUNT = PKR AMOUNT ÷ RIYAL RATE
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

        {/* Summary Totals Section */}
        {(filteredEntries.length > 0 || entries.length > 0) && (
          <div className="mb-6 bg-card border border-border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Summary Totals {dateFilter.fromDate || dateFilter.toDate ? '(Filtered)' : '(All Entries)'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Total PKR Amount */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Total PKR Amount</p>
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(
                    (filteredEntries.length > 0 ? filteredEntries : entries).reduce((sum, entry) => sum + (entry.pkrAmount || 0), 0)
                  )} PKR
                </p>
              </div>

              {/* Total Riyal Amount */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Total Riyal Amount</p>
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(
                    (filteredEntries.length > 0 ? filteredEntries : entries).reduce((sum, entry) => {
                      const riyalAmount = (entry as any).riyalAmount !== undefined
                        ? (entry as any).riyalAmount
                        : (entry.riyalRate > 0 ? entry.pkrAmount / entry.riyalRate : 0);
                      return sum + riyalAmount;
                    }, 0)
                  )} SAR
                </p>
              </div>

              {/* Total Submitted SAR */}
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-sm text-muted-foreground mb-1">Total Submitted SAR</p>
                <p className="text-xl font-bold text-foreground">
                  {formatNumber(
                    (filteredEntries.length > 0 ? filteredEntries : entries).reduce((sum, entry) => sum + (entry.submittedSar || 0), 0)
                  )} SAR
                </p>
              </div>
            </div>
          </div>
        )}

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
        title="Add New Entry - Saudi Hisaab Kitaab"
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

            {/* Time */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                وقت <span className="text-destructive">*</span>
              </label>
              <input
                type="time"
                value={addFormData.time}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, time: e.target.value });
                  setAddFormErrors({ ...addFormErrors, time: '' });
                }}
                className={`input-field ${addFormErrors.time ? 'border-destructive' : ''}`}
                required
              />
              {addFormErrors.time && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.time}</p>
              )}
            </div>

            {/* Ref No */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                نام <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={addFormData.refNo}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, refNo: e.target.value.toUpperCase() });
                  setAddFormErrors({ ...addFormErrors, refNo: '' });
                }}
                className={`input-field ${addFormErrors.refNo ? 'border-destructive' : ''}`}
                placeholder="SAU-001"
                required
              />
              {addFormErrors.refNo && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.refNo}</p>
              )}
            </div>

            {/* PKR Amount */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                آرڈر رقم (PKR) <span className="text-xs text-muted-foreground">(0 allowed)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addFormData.pkrAmount}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, pkrAmount: e.target.value });
                  setAddFormErrors({ ...addFormErrors, pkrAmount: '' });
                }}
                className={`input-field ${addFormErrors.pkrAmount ? 'border-destructive' : ''}`}
                placeholder="0"
              />
              {addFormErrors.pkrAmount && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.pkrAmount}</p>
              )}
            </div>

            {/* Riyal Rate */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                ریال ریٹ <span className="text-xs text-muted-foreground">(0 allowed)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addFormData.riyalRate}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, riyalRate: e.target.value });
                  setAddFormErrors({ ...addFormErrors, riyalRate: '' });
                }}
                className={`input-field ${addFormErrors.riyalRate ? 'border-destructive' : ''}`}
                placeholder="0"
              />
              {addFormErrors.riyalRate && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.riyalRate}</p>
              )}
            </div>

            {/* Riyal Amount (Auto-calculated) */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                ریال رقم <span className="text-xs text-muted-foreground">(Auto-calculated)</span>
              </label>
              <input
                type="text"
                value={
                  addFormData.pkrAmount && addFormData.riyalRate &&
                    parseFloat(addFormData.pkrAmount) > 0 && parseFloat(addFormData.riyalRate) > 0
                    ? formatNumber(parseFloat(addFormData.pkrAmount) / parseFloat(addFormData.riyalRate)) + ' SAR'
                    : '0.00 SAR'
                }
                className="input-field bg-muted cursor-not-allowed"
                readOnly
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">
                Calculated: PKR Amount ÷ Riyal Rate (when both &gt; 0)
              </p>
            </div>

            {/* Submitted SAR */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                جمع شدہ ریال <span className="text-xs text-muted-foreground">(0 allowed)</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={addFormData.submittedSar}
                onChange={(e) => {
                  setAddFormData({ ...addFormData, submittedSar: e.target.value });
                  setAddFormErrors({ ...addFormErrors, submittedSar: '' });
                }}
                className={`input-field ${addFormErrors.submittedSar ? 'border-destructive' : ''}`}
                placeholder="0"
              />
              {addFormErrors.submittedSar && (
                <p className="text-sm text-destructive mt-1">{addFormErrors.submittedSar}</p>
              )}
            </div>

            {/* Reference 2 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                حوالہ
              </label>
              <input
                type="text"
                value={addFormData.reference2}
                onChange={(e) => setAddFormData({ ...addFormData, reference2: e.target.value })}
                className="input-field"
                placeholder="Monthly Transfer"
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
        title={`Edit Entry - ${selectedEntry?.refNo}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              آرڈر رقم (PKR)
            </label>
            <input
              type="number"
              value={formData.pkrAmount}
              onChange={(e) => setFormData({ ...formData, pkrAmount: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ریال ریٹ
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.riyalRate}
              onChange={(e) => setFormData({ ...formData, riyalRate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              ریال رقم <span className="text-xs text-muted-foreground">(Auto-calculated)</span>
            </label>
            <input
              type="text"
              value={
                formData.pkrAmount && formData.riyalRate && parseFloat(formData.riyalRate) > 0
                  ? formatNumber(parseFloat(formData.pkrAmount) / parseFloat(formData.riyalRate)) + ' SAR'
                  : '0.00 SAR'
              }
              className="input-field bg-muted cursor-not-allowed"
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground mt-1">
              Calculated: PKR Amount ÷ Riyal Rate
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              جمع شدہ ریال
            </label>
            <input
              type="number"
              value={formData.submittedSar}
              onChange={(e) => setFormData({ ...formData, submittedSar: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              حوالہ
            </label>
            <input
              type="text"
              value={formData.reference2}
              onChange={(e) => setFormData({ ...formData, reference2: e.target.value })}
              className="input-field"
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

export default Saudi;
