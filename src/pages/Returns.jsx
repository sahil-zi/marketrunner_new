import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createOne, updateOne, filterBy, listAll, bulkInsert } from '@/api/supabase/helpers';
import {
  PackageX,
  Search,
  Loader2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import CSVUploader from '@/components/admin/CSVUploader';
import PageHeader from '@/components/admin/PageHeader';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { useReturns, useUpdateReturn } from '@/hooks/use-returns';
import { useStores } from '@/hooks/use-stores';
import { usePagination } from '@/hooks/use-pagination';

const reasonLabels = {
  damaged: 'Damaged',
  wrong_item: 'Wrong Item',
  customer_return: 'Customer Return',
  quality_issue: 'Quality Issue',
  other: 'Other',
};

export default function Returns() {
  const queryClient = useQueryClient();

  // React Query data
  const { data: returns = [], isLoading } = useReturns();
  const { data: stores = [] } = useStores();
  const updateReturn = useUpdateReturn();

  // UI state
  const [filterStore, setFilterStore] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewReturn, setViewReturn] = useState(null);
  const [processingReturn, setProcessingReturn] = useState(null);

  const filteredReturns = useMemo(() => {
    return returns.filter((ret) => {
      const matchesStore = filterStore === 'all' || ret.store_id === filterStore;
      const matchesStatus = filterStatus === 'all' || ret.status === filterStatus;
      const matchesSearch =
        !searchQuery ||
        ret.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.style_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ret.store_name?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStore && matchesStatus && matchesSearch;
    });
  }, [returns, filterStore, filterStatus, searchQuery]);

  const {
    paginatedItems: currentReturns,
    currentPage,
    totalPages,
    itemsPerPage,
    setPerPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
  } = usePagination(filteredReturns);

  async function processReturn(returnId, status) {
    setProcessingReturn(returnId);
    try {
      const returnItem = returns.find((r) => r.id === returnId);

      await updateReturn.mutateAsync({
        id: returnId,
        data: {
          status,
          processed_at: new Date().toISOString(),
        },
      });

      // If approved, create a credit ledger entry and update inventory
      if (status === 'processed') {
        if (returnItem.return_amount) {
          await createOne('ledger', {
            store_id: returnItem.store_id,
            store_name: returnItem.store_name,
            transaction_type: 'credit',
            amount: returnItem.return_amount,
            date: new Date().toISOString().split('T')[0],
            notes: `Return credit: ${returnItem.style_name} (${returnItem.quantity}x)`,
          });
        }

        // Update inventory
        const products = await filterBy('product_catalog', {
          barcode: returnItem.barcode,
        });
        if (products.length > 0) {
          const product = products[0];
          const newInventory = (product.inventory || 0) + returnItem.quantity;
          await updateOne('product_catalog', product.id, {
            inventory: newInventory,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast.success(`Return ${status}`);
    } catch (error) {
      toast.error('Failed to process return');
    } finally {
      setProcessingReturn(null);
    }
  }

  async function validateReturns(rows) {
    const errors = [];
    const warnings = [];
    const existingStores = new Map(
      stores.map((s) => [s.name.toLowerCase(), s.id])
    );

    rows.forEach((row) => {
      if (!row.Barcode?.trim()) {
        errors.push({ row: row._rowNum, message: 'Missing barcode' });
      }
      if (!row.Quantity || isNaN(parseInt(row.Quantity))) {
        errors.push({ row: row._rowNum, message: 'Missing or invalid quantity' });
      }
      if (!row.Reason?.trim()) {
        errors.push({ row: row._rowNum, message: 'Missing return reason' });
      }
      if (!row.StoreName?.trim()) {
        errors.push({ row: row._rowNum, message: 'Missing store name' });
      }
      if (row.ReturnAmount && isNaN(parseFloat(row.ReturnAmount))) {
        errors.push({ row: row._rowNum, message: 'Invalid return amount' });
      }
      if (row.StoreName && !existingStores.has(row.StoreName.toLowerCase())) {
        warnings.push({
          row: row._rowNum,
          message: `New store will be created: ${row.StoreName}`,
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      hasDuplicates: false,
      stats: {
        'Total Rows': rows.length,
        'Valid Returns': rows.length - errors.length,
      },
    };
  }

  async function importReturns(rows) {
    const existingStores = new Map(
      stores.map((s) => [s.name.toLowerCase(), s.id])
    );
    const newStoreNames = [
      ...new Set(
        rows
          .map((r) => r.StoreName?.trim())
          .filter((name) => name && !existingStores.has(name.toLowerCase()))
      ),
    ];

    if (newStoreNames.length > 0) {
      const createdStores = await bulkInsert('stores',
        newStoreNames.map((name) => ({ name }))
      );
      createdStores.forEach((store) => {
        existingStores.set(store.name.toLowerCase(), store.id);
      });
    }

    const returnsToCreate = [];
    const productsToUpdateInventory = [];

    for (const row of rows) {
      const storeId = existingStores.get(row.StoreName?.trim()?.toLowerCase());
      if (!storeId) {
        console.warn(`Store not found for row: ${JSON.stringify(row)}`);
        continue;
      }

      const returnData = {
        store_id: storeId,
        store_name: row.StoreName?.trim() || '',
        barcode: row.Barcode?.trim(),
        style_name: row.Style?.trim(),
        size: row.Size?.trim(),
        quantity: parseInt(row.Quantity) || 0,
        reason: row.Reason?.trim(),
        return_amount: parseFloat(row.ReturnAmount) || 0,
        image_url: row.ImageUrl?.trim(),
        notes: row.Notes?.trim(),
        status: 'processed',
        processed_at: new Date().toISOString(),
      };
      returnsToCreate.push(returnData);

      productsToUpdateInventory.push({
        barcode: row.Barcode?.trim(),
        quantity: parseInt(row.Quantity) || 0,
      });
    }

    if (returnsToCreate.length > 0) {
      await bulkInsert('returns', returnsToCreate);

      // Update inventory
      const productCatalog = await listAll('product_catalog');
      const productMap = new Map(productCatalog.map((p) => [p.barcode, p]));

      for (const item of productsToUpdateInventory) {
        const product = productMap.get(item.barcode);
        if (product) {
          const newInventory = (product.inventory || 0) + item.quantity;
          await updateOne('product_catalog', product.id, {
            inventory: newInventory,
          });
        }
      }

      // Create ledger entries for returns
      for (const returnItem of returnsToCreate) {
        if (returnItem.return_amount) {
          await createOne('ledger', {
            store_id: returnItem.store_id,
            store_name: returnItem.store_name,
            transaction_type: 'credit',
            amount: returnItem.return_amount,
            date: new Date().toISOString().split('T')[0],
            notes: `Return credit: ${returnItem.style_name || returnItem.barcode} (${returnItem.quantity}x)`,
          });
        }
      }

      toast.success(`Imported ${returnsToCreate.length} returns`);
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    } else {
      toast.info('No new returns to import');
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Returns"
        subtitle="Manage product returns from stores"
      />

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Returns</TabsTrigger>
          <TabsTrigger value="upload">Upload CSV</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          {/* Filter card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by barcode, product, or store..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="assigned_to_run">Assigned to Run</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Returns table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : filteredReturns.length === 0 ? (
                <EmptyState
                  icon={PackageX}
                  title="No returns found"
                  description="Try adjusting your search or filter criteria."
                />
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-32">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentReturns.map((ret) => (
                        <TableRow key={ret.id}>
                          <TableCell className="text-muted-foreground">
                            {ret.created_date
                              ? new Date(ret.created_date).toLocaleDateString()
                              : '\u2014'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{ret.store_name}</Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {ret.style_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {ret.size || '\u2014'}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {ret.quantity}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {reasonLabels[ret.reason] || ret.reason}
                          </TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            AED {ret.return_amount?.toFixed(2) || '0.00'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={ret.status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="View return details"
                                onClick={() => setViewReturn(ret)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {ret.status === 'pending' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-success"
                                    onClick={() =>
                                      processReturn(ret.id, 'processed')
                                    }
                                    disabled={processingReturn === ret.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    onClick={() =>
                                      processReturn(ret.id, 'rejected')
                                    }
                                    disabled={processingReturn === ret.id}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        Returns per page:
                      </span>
                      <Select
                        value={String(itemsPerPage)}
                        onValueChange={(value) => setPerPage(Number(value))}
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
                        onClick={prevPage}
                        disabled={!hasPrevPage}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={nextPage}
                        disabled={!hasNextPage}
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

        <TabsContent value="upload">
          <CSVUploader
            title="Upload Returns CSV"
            description="Import returns from a CSV file. Required columns: Barcode, Quantity, Reason, StoreName. Optional: Style, Size, ReturnAmount, ImageUrl, Notes"
            expectedColumns={['Barcode', 'Quantity', 'Reason', 'StoreName']}
            onValidate={validateReturns}
            onConfirm={importReturns}
          />
        </TabsContent>
      </Tabs>

      {/* View Return Dialog */}
      <Dialog open={!!viewReturn} onOpenChange={() => setViewReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
          </DialogHeader>
          {viewReturn && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Store</p>
                  <p className="font-medium text-foreground">
                    {viewReturn.store_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium text-foreground">
                    {viewReturn.style_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Size</p>
                  <p className="font-medium text-foreground">
                    {viewReturn.size || '\u2014'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium text-foreground">
                    {viewReturn.quantity}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Reason</p>
                  <p className="font-medium text-foreground">
                    {reasonLabels[viewReturn.reason]}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-primary">
                    AED {viewReturn.return_amount?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Barcode</p>
                  <p className="font-medium text-foreground">
                    {viewReturn.barcode}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge status={viewReturn.status} />
                </div>
              </div>
              {viewReturn.notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{viewReturn.notes}</p>
                </div>
              )}
              {viewReturn.image_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Photo</p>
                  <img
                    src={viewReturn.image_url}
                    alt="Return item"
                    className="w-full h-48 object-cover rounded-lg cursor-pointer"
                    onClick={() => window.open(viewReturn.image_url, '_blank')}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReturn(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
