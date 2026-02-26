import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  DollarSign,
  Plus,
  Store as StoreIcon,
  TrendingUp,
  TrendingDown,
  Calendar,
  Receipt,
  Loader2,
  X,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import PageHeader from '@/components/admin/PageHeader';
import EmptyState from '@/components/admin/EmptyState';
import PaginationBar from '@/components/admin/PaginationBar';

import { useLedger, useCreateLedgerEntry, useCleanupDuplicateLedger } from '@/hooks/use-ledger';
import { listAll } from '@/api/supabase/helpers';
import { useStores } from '@/hooks/use-stores';
import { useAllRunConfirmations } from '@/hooks/use-run-confirmations';
import { usePagination } from '@/hooks/use-pagination';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const DEFAULT_FORM = {
  store_id: '',
  transaction_type: 'credit',
  amount: '',
  discount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export default function Financials() {
  // --- React Query data ---
  const { data: ledger = [], isLoading: ledgerLoading } = useLedger();
  const { data: stores = [] } = useStores();
  const { data: confirmations = [] } = useAllRunConfirmations();

  const isLoading = ledgerLoading;

  // --- UI state ---
  const [filterStore, setFilterStore] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState(null);
  const [filterDateTo, setFilterDateTo] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [isExporting, setIsExporting] = useState(false);

  // --- Mutations ---
  const createEntry = useCreateLedgerEntry();
  const cleanupDuplicates = useCleanupDuplicateLedger();

  // --- Derived: store balances ---
  const storeBalances = useMemo(() => {
    const balances = {};

    stores.forEach((store) => {
      balances[store.id] = {
        storeId: store.id,
        storeName: store.name,
        debits: 0,
        credits: 0,
        balance: 0,
      };
    });

    ledger.forEach((entry) => {
      const storeId = entry.store_id;
      if (!balances[storeId]) {
        balances[storeId] = {
          storeId,
          storeName: entry.store_name || 'Unknown',
          debits: 0,
          credits: 0,
          discounts: 0,
          balance: 0,
        };
      }

      const net = (entry.amount || 0) - (entry.discount || 0);
      if (entry.transaction_type === 'debit') {
        balances[storeId].debits += net;
      } else {
        balances[storeId].credits += net;
      }
      balances[storeId].discounts += entry.discount || 0;
      balances[storeId].balance =
        balances[storeId].credits - balances[storeId].debits;
    });

    return Object.values(balances).filter(
      (b) => b.debits > 0 || b.credits > 0
    );
  }, [ledger, stores]);

  const totalBalance = storeBalances.reduce((sum, b) => sum + b.balance, 0);

  // --- Derived: filtered ledger ---
  const filteredLedger = useMemo(() => {
    return ledger.filter((entry) => {
      const matchesStore =
        filterStore === 'all' || entry.store_id === filterStore;
      const matchesType =
        filterType === 'all' || entry.transaction_type === filterType;

      const entryDate = new Date(entry.date);
      const matchesDateFrom = !filterDateFrom || entryDate >= filterDateFrom;

      let matchesDateTo = true;
      if (filterDateTo) {
        const endOfToDate = new Date(filterDateTo);
        endOfToDate.setHours(23, 59, 59, 999);
        matchesDateTo = entryDate <= endOfToDate;
      }

      return matchesStore && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [ledger, filterStore, filterType, filterDateFrom, filterDateTo]);

  // --- Pagination ---
  const {
    currentPage,
    itemsPerPage,
    totalPages,
    paginatedItems: currentLedger,
    setPerPage,
    goToPage,
    totalItems,
  } = usePagination(filteredLedger, 50);

  // --- Helpers ---
  const getConfirmation = (id) => confirmations.find((c) => c.id === id);

  // --- Add entry ---
  function addLedgerEntry() {
    if (!formData.store_id || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const store = stores.find((s) => s.id === formData.store_id);

    createEntry.mutate(
      {
        store_id: formData.store_id,
        store_name: store?.name || '',
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount),
        discount: formData.discount ? parseFloat(formData.discount) : 0,
        date: formData.date,
        notes: formData.notes,
      },
      {
        onSuccess: () => {
          toast.success('Transaction recorded');
          setShowAddDialog(false);
          setFormData(DEFAULT_FORM);
        },
        onError: () => {
          toast.error('Failed to add transaction');
        },
      }
    );
  }

  // --- CSV export ---
  function exportToCSV() {
    const headers = [
      'Date',
      'Store',
      'Type',
      'Amount (AED)',
      'Discount (AED)',
      'Net (AED)',
      'Run #',
      'Notes',
      'Receipt URL',
    ];
    const rows = filteredLedger.map((entry) => {
      const net = (entry.amount || 0) - (entry.discount || 0);
      return [
        entry.date,
        entry.store_name,
        entry.transaction_type,
        (entry.amount || 0).toFixed(2),
        (entry.discount || 0).toFixed(2),
        net.toFixed(2),
        entry.run_number || '',
        (entry.notes || '').replace(/,/g, ';'),
        getConfirmation(entry.run_confirmation_id)?.receipt_image_url || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map((e) => e.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute(
      'download',
      `ledger_export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported successfully');
  }

  // --- Store report: item-level rows with ledger payment columns ---
  async function exportStoreReport() {
    setIsExporting(true);
    try {
      const [allRunItems, allRuns] = await Promise.all([
        listAll('run_items'),
        listAll('runs'),
      ]);

      // map run_id → run_number
      const runNumberMap = {};
      allRuns.forEach(r => { runNumberMap[r.id] = r.run_number; });

      // map run_number+store_id → ledger entry (from full ledger, not filtered)
      const ledgerMap = {};
      ledger.forEach(entry => {
        if (entry.run_number && entry.store_id) {
          ledgerMap[`${entry.run_number}-${entry.store_id}`] = entry;
        }
      });

      // Build set of run_number+store_id keys from filteredLedger (respects all active filters)
      const filteredKeys = new Set(
        filteredLedger
          .filter(e => e.run_number && e.store_id)
          .map(e => `${e.run_number}-${e.store_id}`)
      );

      // Apply all active filters via filteredLedger keys
      const items = allRunItems.filter(i => {
        const runNumber = runNumberMap[i.run_id];
        if (!runNumber || !i.store_id) return false;
        return filteredKeys.has(`${runNumber}-${i.store_id}`);
      });

      const headers = [
        'Date', 'Store', 'Run #', 'Type', 'Style', 'Size', 'Barcode',
        'Target Qty', 'Picked Qty', 'Unit Price (AED)', 'Item Total (AED)',
        'Transaction Type', 'Debit (AED)', 'Credit (AED)', 'Discount (AED)',
      ];

      const rows = items.map(item => {
        const runNumber = runNumberMap[item.run_id] || '';
        const ledgerEntry = runNumber
          ? ledgerMap[`${runNumber}-${item.store_id}`]
          : null;
        const net = ledgerEntry
          ? (ledgerEntry.amount || 0) - (ledgerEntry.discount || 0)
          : 0;
        const isDebit = ledgerEntry?.transaction_type === 'debit';

        return [
          ledgerEntry?.date || '',
          item.store_name || '',
          runNumber,
          item.type || '',
          (item.style_name || '').replace(/,/g, ';'),
          item.size || '',
          item.barcode || '',
          item.target_qty ?? '',
          item.picked_qty ?? '',
          (item.cost_price || 0).toFixed(2),
          ((item.picked_qty || 0) * (item.cost_price || 0)).toFixed(2),
          ledgerEntry?.transaction_type || '',
          isDebit ? net.toFixed(2) : '0.00',
          !isDebit && ledgerEntry ? net.toFixed(2) : '0.00',
          (ledgerEntry?.discount || 0).toFixed(2),
        ];
      });

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `store_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Item details exported');
    } catch (e) {
      toast.error('Export failed');
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  }

  // --- Filtered store balances for the balances tab ---
  const visibleStoreBalances = storeBalances.filter(
    (store) => filterStore === 'all' || store.storeId === filterStore
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Financials"
        subtitle="Track store balances and transactions"
      >
        <Button
          variant="outline"
          onClick={() =>
            cleanupDuplicates.mutate(undefined, {
              onSuccess: (count) =>
                count > 0
                  ? toast.success(`Removed ${count} duplicate ledger entries`)
                  : toast.info('No duplicate entries found'),
              onError: () => toast.error('Cleanup failed'),
            })
          }
          disabled={cleanupDuplicates.isPending}
        >
          {cleanupDuplicates.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Receipt className="w-4 h-4 mr-2" />
          )}
          Fix Duplicates
        </Button>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </PageHeader>

      {/* Summary Card */}
      <motion.div variants={fadeIn} initial="hidden" animate="show">
        <Card
          className={cn(
            'border',
            totalBalance >= 0
              ? 'bg-success/10 border-success/20'
              : 'bg-destructive/10 border-destructive/20'
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    totalBalance >= 0 ? 'bg-success/15' : 'bg-destructive/15'
                  )}
                >
                  <DollarSign
                    className={cn(
                      'w-6 h-6',
                      totalBalance >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      totalBalance >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  >
                    Total Balance
                  </p>
                  <p
                    className={cn(
                      'text-3xl font-bold',
                      totalBalance >= 0 ? 'text-success' : 'text-destructive'
                    )}
                  >
                    AED {Math.abs(totalBalance).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {totalBalance >= 0 ? (
                  <Badge className="bg-success/15 text-success border-0">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Stores owe you
                  </Badge>
                ) : (
                  <Badge className="bg-destructive/15 text-destructive border-0">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    You owe stores
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Tabs defaultValue="balances" className="space-y-6">
        <TabsList>
          <TabsTrigger value="balances">Store Balances</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        {/* Store Balances Tab */}
        <TabsContent value="balances" className="space-y-6">
          {/* Store filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : visibleStoreBalances.length === 0 ? (
            <Card>
              <CardContent className="p-0">
                <EmptyState
                  icon={StoreIcon}
                  title="No transactions recorded yet"
                  description="Add your first transaction to start tracking store balances."
                />
              </CardContent>
            </Card>
          ) : (
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {visibleStoreBalances.map((store) => (
                <motion.div key={store.storeId} variants={cardVariants}>
                  <Card
                    className={cn(
                      'bg-card border-border',
                      store.balance > 0
                        ? 'border-success/30'
                        : store.balance < 0
                          ? 'border-destructive/30'
                          : ''
                    )}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                            <StoreIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {store.storeName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Total Debits:
                          </span>
                          <span className="text-destructive font-medium">
                            AED {store.debits.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Total Credits:
                          </span>
                          <span className="text-success font-medium">
                            AED {store.credits.toFixed(2)}
                          </span>
                        </div>
                        <hr className="my-2 border-border" />
                        <div className="flex justify-between">
                          <span className="font-medium text-muted-foreground">
                            Balance:
                          </span>
                          <span
                            className={cn(
                              'text-lg font-bold',
                              store.balance > 0
                                ? 'text-success'
                                : store.balance < 0
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                            )}
                          >
                            AED {Math.abs(store.balance).toFixed(2)}
                            {store.balance !== 0 && (
                              <span className="text-xs ml-1">
                                {store.balance > 0
                                  ? '(owed to you)'
                                  : '(you owe)'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </TabsContent>

        {/* Ledger Tab */}
        <TabsContent value="ledger" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="debit">Debits</SelectItem>
                    <SelectItem value="credit">Credits</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full sm:w-[200px] justify-start text-left font-normal',
                        !filterDateFrom && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterDateFrom ? (
                        format(filterDateFrom, 'PPP')
                      ) : (
                        <span>From Date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={setFilterDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full sm:w-[200px] justify-start text-left font-normal',
                        !filterDateTo && 'text-muted-foreground'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterDateTo ? (
                        format(filterDateTo, 'PPP')
                      ) : (
                        <span>To Date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarUI
                      mode="single"
                      selected={filterDateTo}
                      onSelect={setFilterDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {(filterDateFrom || filterDateTo) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterDateFrom(null);
                      setFilterDateTo(null);
                    }}
                    className="w-full sm:w-fit"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Clear Dates
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Export */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={exportStoreReport}
              disabled={isExporting || filteredLedger.length === 0}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Item Details
            </Button>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={filteredLedger.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Ledger
            </Button>
          </div>

          {/* Ledger Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : filteredLedger.length === 0 ? (
                <EmptyState
                  icon={Receipt}
                  title="No transactions found"
                  description="Try adjusting your filters or add a new transaction."
                />
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead>Run #</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLedger.map((entry) => {
                        const confirmation = entry.run_confirmation_id
                          ? getConfirmation(entry.run_confirmation_id)
                          : null;

                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {entry.store_name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  'border-0',
                                  entry.transaction_type === 'credit'
                                    ? 'bg-success/15 text-success'
                                    : 'bg-destructive/15 text-destructive'
                                )}
                              >
                                {entry.transaction_type === 'credit' ? (
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                {entry.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-muted-foreground">
                              AED {(entry.amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-amber-500">
                              {entry.discount ? `AED ${entry.discount.toFixed(2)}` : '—'}
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-medium',
                                entry.transaction_type === 'credit'
                                  ? 'text-success'
                                  : 'text-destructive'
                              )}
                            >
                              AED {((entry.amount || 0) - (entry.discount || 0)).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {entry.run_number
                                ? `#${entry.run_number}`
                                : '\u2014'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {entry.notes || '\u2014'}
                            </TableCell>
                            <TableCell>
                              {confirmation?.receipt_image_url ? (
                                <button
                                  type="button"
                                  aria-label="View receipt"
                                  onClick={() =>
                                    window.open(
                                      confirmation.receipt_image_url,
                                      '_blank'
                                    )
                                  }
                                  className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                                >
                                  <img
                                    src={confirmation.receipt_image_url}
                                    alt="Receipt"
                                    className="w-10 h-10 object-cover rounded-lg bg-muted"
                                    loading="lazy"
                                  />
                                </button>
                              ) : (
                                '\u2014'
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <PaginationBar
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={goToPage}
                    onPerPageChange={setPerPage}
                    itemLabel="transactions"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="store">Store *</Label>
              <Select
                value={formData.store_id}
                onValueChange={(v) =>
                  setFormData({ ...formData, store_id: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Transaction Type *</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, transaction_type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">
                    Credit (Payment to Store)
                  </SelectItem>
                  <SelectItem value="debit">
                    Debit (Charge from Store)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount (AED) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="discount">Discount (AED)</Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  value={formData.discount}
                  onChange={(e) =>
                    setFormData({ ...formData, discount: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add notes about this transaction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={addLedgerEntry}
              disabled={createEntry.isPending}
            >
              {createEntry.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
