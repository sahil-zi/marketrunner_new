import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { 
  DollarSign, 
  Search, 
  Plus, 
  Store as StoreIcon,
  TrendingUp,
  TrendingDown,
  Calendar,
  Receipt,
  Loader2,
  X,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export default function Financials() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [ledger, setLedger] = useState([]);
  const [stores, setStores] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState(null);
  const [filterDateTo, setFilterDateTo] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    store_id: '',
    transaction_type: 'credit',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [ledgerData, storesData, confirmationsData] = await Promise.all([
        base44.entities.Ledger.list('-created_date'),
        base44.entities.Store.list(),
        base44.entities.RunConfirmation.list('-created_date'),
      ]);
      setLedger(ledgerData);
      setStores(storesData);
      setConfirmations(confirmationsData);
    } catch (error) {
      toast.error('Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate store balances
  const storeBalances = React.useMemo(() => {
    const balances = {};
    
    stores.forEach(store => {
      balances[store.id] = {
        storeId: store.id,
        storeName: store.name,
        debits: 0,
        credits: 0,
        balance: 0,
      };
    });

    ledger.forEach(entry => {
      const storeId = entry.store_id;
      if (!balances[storeId]) {
        balances[storeId] = {
          storeId,
          storeName: entry.store_name || 'Unknown',
          debits: 0,
          credits: 0,
          balance: 0,
        };
      }
      
      if (entry.transaction_type === 'debit') {
        balances[storeId].debits += entry.amount || 0;
      } else {
        balances[storeId].credits += entry.amount || 0;
      }
      balances[storeId].balance = balances[storeId].credits - balances[storeId].debits;
    });

    return Object.values(balances).filter(b => b.debits > 0 || b.credits > 0);
  }, [ledger, stores]);

  // Total balance
  const totalBalance = storeBalances.reduce((sum, b) => sum + b.balance, 0);

  // Filter ledger entries
  const filteredLedger = React.useMemo(() => {
    const filtered = ledger.filter(entry => {
      const matchesStore = filterStore === 'all' || entry.store_id === filterStore;
      const matchesType = filterType === 'all' || entry.transaction_type === filterType;
      
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
    return filtered;
  }, [ledger, filterStore, filterType, filterDateFrom, filterDateTo]);

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage);
  const currentLedger = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredLedger.slice(startIndex, endIndex);
  }, [filteredLedger, currentPage, itemsPerPage]);

  // Add ledger entry
  async function addLedgerEntry() {
    if (!formData.store_id || !formData.amount) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const store = stores.find(s => s.id === formData.store_id);
      await base44.entities.Ledger.create({
        store_id: formData.store_id,
        store_name: store?.name || '',
        transaction_type: formData.transaction_type,
        amount: parseFloat(formData.amount),
        date: formData.date,
        notes: formData.notes,
      });
      
      toast.success('Transaction recorded');
      setShowAddDialog(false);
      setFormData({
        store_id: '',
        transaction_type: 'credit',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      loadData();
    } catch (error) {
      toast.error('Failed to add transaction');
    } finally {
      setIsSaving(false);
    }
  }

  const getConfirmation = (id) => confirmations.find(c => c.id === id);

  function exportToCSV() {
    const headers = ["Date", "Store", "Type", "Amount", "Run #", "Notes", "Receipt URL"];
    const rows = filteredLedger.map(entry => [
      entry.date,
      entry.store_name,
      entry.transaction_type,
      entry.amount?.toFixed(2),
      entry.run_number || '',
      (entry.notes || '').replace(/,/g, ';'),
      getConfirmation(entry.run_confirmation_id)?.receipt_image_url || '',
    ]);
    
    const csvContent = [headers, ...rows]
      .map(e => e.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `ledger_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported successfully');
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financials</h1>
          <p className="text-gray-500 mt-1">Track store balances and transactions</p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Summary Card */}
      <Card className={totalBalance >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                totalBalance >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <DollarSign className={`w-6 h-6 ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${totalBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  Total Balance
                </p>
                <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                  AED {Math.abs(totalBalance).toFixed(2)}
                </p>
              </div>
            </div>
            <div className="text-right">
              {totalBalance >= 0 ? (
                <Badge className="bg-green-100 text-green-700">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Stores owe you
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700">
                  <TrendingDown className="w-3 h-3 mr-1" />
                  You owe stores
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="balances" className="space-y-6">
        <TabsList>
          <TabsTrigger value="balances">Store Balances</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        {/* Store Balances */}
        <TabsContent value="balances" className="space-y-6">
          {/* Store Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={filterStore} onValueChange={setFilterStore}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stores</SelectItem>
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          ) : storeBalances.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <StoreIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No transactions recorded yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storeBalances
                .filter(store => filterStore === 'all' || store.storeId === filterStore)
                .map(store => (
                <Card key={store.storeId} className={
                  store.balance > 0 
                    ? 'border-green-200' 
                    : store.balance < 0 
                      ? 'border-red-200' 
                      : ''
                }>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                          <StoreIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{store.storeName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Debits:</span>
                        <span className="text-red-600 font-medium">AED {store.debits.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total Credits:</span>
                        <span className="text-green-600 font-medium">AED {store.credits.toFixed(2)}</span>
                      </div>
                      <hr className="my-2" />
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Balance:</span>
                        <span className={`text-lg font-bold ${
                          store.balance > 0 ? 'text-green-600' : store.balance < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          AED {Math.abs(store.balance).toFixed(2)}
                          {store.balance !== 0 && (
                            <span className="text-xs ml-1">
                              {store.balance > 0 ? '(owed to you)' : '(you owe)'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ledger View */}
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
                    {stores.map(store => (
                      <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
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
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal",
                        !filterDateFrom && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterDateFrom ? format(filterDateFrom, "PPP") : <span>From Date</span>}
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
                      variant={"outline"}
                      className={cn(
                        "w-full sm:w-[200px] justify-start text-left font-normal",
                        !filterDateTo && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {filterDateTo ? format(filterDateTo, "PPP") : <span>To Date</span>}
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

          {/* Export Button */}
          <div className="flex justify-end">
            <Button 
              onClick={exportToCSV}
              disabled={filteredLedger.length === 0}
              className="bg-gray-800 hover:bg-gray-900 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to CSV
            </Button>
          </div>

          {/* Ledger Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              ) : filteredLedger.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No transactions found</p>
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Run #</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Receipt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentLedger.map(entry => {
                        const confirmation = entry.run_confirmation_id 
                          ? getConfirmation(entry.run_confirmation_id)
                          : null;
                        
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{entry.store_name}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={
                                entry.transaction_type === 'credit'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }>
                                {entry.transaction_type === 'credit' ? (
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                {entry.transaction_type}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              entry.transaction_type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              AED {entry.amount?.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {entry.run_number ? `#${entry.run_number}` : '—'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {entry.notes || '—'}
                            </TableCell>
                            <TableCell>
                              {confirmation?.receipt_image_url ? (
                                <img
                                  src={confirmation.receipt_image_url}
                                  alt="Receipt"
                                  className="w-10 h-10 object-cover rounded cursor-pointer"
                                  onClick={() => window.open(confirmation.receipt_image_url, '_blank')}
                                />
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">Transactions per page:</span>
                      <Select
                        value={String(itemsPerPage)}
                        onValueChange={(value) => {
                          setItemsPerPage(Number(value));
                          setCurrentPage(1);
                        }}
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
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
                onValueChange={(v) => setFormData({ ...formData, store_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map(store => (
                    <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Transaction Type *</Label>
              <Select 
                value={formData.transaction_type} 
                onValueChange={(v) => setFormData({ ...formData, transaction_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (Payment to Store)</SelectItem>
                  <SelectItem value="debit">Debit (Charge from Store)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this transaction..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addLedgerEntry}
              disabled={isSaving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}