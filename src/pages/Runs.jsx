import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Truck, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Loader2,
  Package,
  Store,
  Play,
  Eye,
  Printer,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import OrderSelector from '@/components/admin/OrderSelector';
import LabelPrinter from '@/components/admin/LabelPrinter';

export default function Runs() {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [runs, setRuns] = useState([]);
  const [pendingOrderItems, setPendingOrderItems] = useState([]);
  const [pendingReturnItems, setPendingReturnItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(null);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [selectedPickupItems, setSelectedPickupItems] = useState([]);
  const [selectedReturnItems, setSelectedReturnItems] = useState([]);
  const [runItemsCache, setRunItemsCache] = useState({});
  const [selectedRuns, setSelectedRuns] = useState([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [runsData, pendingOrderItemsData, pendingReturnItemsData, productsData, storesData, usersData] = await Promise.all([
        base44.entities.Run.list('-created_date'),
        base44.entities.OrderItem.filter({ status: 'pending' }),
        base44.entities.Return.filter({ status: 'pending' }),
        base44.entities.ProductCatalog.list(),
        base44.entities.Store.list(),
        base44.entities.User.list(),
      ]);
      setRuns(runsData);
      setPendingOrderItems(pendingOrderItemsData);
      setPendingReturnItems(pendingReturnItemsData);
      setProducts(productsData);
      setStores(storesData);
      setUsers(usersData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  // Load run items for a specific run
  async function loadRunItems(runId) {
    if (runItemsCache[runId]) return runItemsCache[runId];
    
    const items = await base44.entities.RunItem.filter({ run_id: runId });
    setRunItemsCache(prev => ({ ...prev, [runId]: items }));
    return items;
  }

  // Calculate pending items summary
  const pendingStats = React.useMemo(() => {
    const productMap = new Map(products.map(p => [p.barcode, p]));
    const storeItems = {};
    let totalQty = 0;
    const uniqueStyles = new Set();

    pendingOrderItems.forEach(item => {
      const product = productMap.get(item.barcode);
      if (product) {
        const storeId = product.store_id || 'unknown';
        if (!storeItems[storeId]) storeItems[storeId] = 0;
        storeItems[storeId] += item.quantity || 1;
        totalQty += item.quantity || 1;
        uniqueStyles.add(product.style_name);
      }
    });

    pendingReturnItems.forEach(item => {
      const storeId = item.store_id || 'unknown';
      if (!storeItems[storeId]) storeItems[storeId] = 0;
      totalQty += item.quantity || 1;
      uniqueStyles.add(item.style_name);
    });

    return {
      totalItems: totalQty,
      uniqueStyles: uniqueStyles.size,
      storeCount: Object.keys(storeItems).length,
      pickups: pendingOrderItems.length,
      returns: pendingReturnItems.length,
    };
  }, [pendingOrderItems, pendingReturnItems, products]);

  // Generate new run
  async function generateRun() {
    const pickupItemsToUse = selectedPickupItems.length > 0 ? selectedPickupItems : pendingOrderItems;
    const returnItemsToUse = selectedReturnItems.length > 0 ? selectedReturnItems : pendingReturnItems;
    
    if (pickupItemsToUse.length === 0 && returnItemsToUse.length === 0) {
      toast.error('No items selected');
      return;
    }

    setIsGenerating(true);
    try {
      const productMap = new Map(products.map(p => [p.barcode, p]));
      const storeMap = new Map(stores.map(s => [s.id, s.name]));

      // Aggregate pickup items by barcode and store
      const aggregatedPickupItems = {};
      pickupItemsToUse.forEach(item => {
        const product = productMap.get(item.barcode);
        const storeId = product?.store_id || 'unknown';
        const key = `${storeId}-${item.barcode}`;
        if (!aggregatedPickupItems[key]) {
          aggregatedPickupItems[key] = {
            barcode: item.barcode,
            totalQty: 0,
            orderItemIds: [],
            store_id: storeId,
          };
        }
        aggregatedPickupItems[key].totalQty += item.quantity || 1;
        aggregatedPickupItems[key].orderItemIds.push(item.id);
      });

      // Aggregate return items by barcode and store
      const aggregatedReturnItems = {};
      returnItemsToUse.forEach(item => {
        const key = `${item.store_id}-${item.barcode}`;
        if (!aggregatedReturnItems[key]) {
          aggregatedReturnItems[key] = {
            barcode: item.barcode,
            totalQty: 0,
            returnItemIds: [],
            store_id: item.store_id,
            store_name: item.store_name,
            style_name: item.style_name,
          };
        }
        aggregatedReturnItems[key].totalQty += item.quantity || 1;
        aggregatedReturnItems[key].returnItemIds.push(item.id);
      });

      // Get next run number
      const maxRunNumber = runs.reduce((max, r) => Math.max(max, r.run_number || 0), 0);
      const runNumber = maxRunNumber + 1;

      // Calculate stats
      const uniqueStyles = new Set();
      const uniqueStores = new Set();
      let totalPickupItems = 0;
      let totalReturnItems = 0;

      Object.values(aggregatedPickupItems).forEach(item => {
        const product = productMap.get(item.barcode);
        if (product) {
          uniqueStyles.add(product.style_name);
          if (product.store_id) uniqueStores.add(product.store_id);
        }
        totalPickupItems += item.totalQty;
      });

      Object.values(aggregatedReturnItems).forEach(item => {
        uniqueStyles.add(item.style_name);
        if (item.store_id) uniqueStores.add(item.store_id);
        totalReturnItems += item.totalQty;
      });

      // Create run
      const run = await base44.entities.Run.create({
        run_number: runNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        total_styles: uniqueStyles.size,
        total_items: totalPickupItems + totalReturnItems,
        total_stores: uniqueStores.size,
        has_returns: totalReturnItems > 0,
      });

      const runItemsToCreate = [];

      // Create run items for pickups
      for (const item of Object.values(aggregatedPickupItems)) {
        const product = productMap.get(item.barcode);
        runItemsToCreate.push({
          run_id: run.id,
          barcode: item.barcode,
          style_name: product?.style_name || '',
          size: product?.size || '',
          color: product?.color || '',
          image_url: product?.image_url || '',
          cost_price: product?.cost_price || 0,
          store_id: item.store_id,
          store_name: item.store_id ? storeMap.get(item.store_id) || '' : '',
          target_qty: item.totalQty,
          picked_qty: 0,
          status: 'pending',
          type: 'pickup',
        });

        for (const orderItemId of item.orderItemIds) {
          await base44.entities.OrderItem.update(orderItemId, {
            status: 'assigned_to_run',
            run_id: run.id,
          });
        }
      }

      // Create run items for returns
      for (const item of Object.values(aggregatedReturnItems)) {
        const product = productMap.get(item.barcode);
        runItemsToCreate.push({
          run_id: run.id,
          barcode: item.barcode,
          style_name: item.style_name || product?.style_name || '',
          size: product?.size || '',
          color: product?.color || '',
          image_url: product?.image_url || '',
          cost_price: product?.cost_price || 0,
          store_id: item.store_id,
          store_name: item.store_name || storeMap.get(item.store_id) || '',
          target_qty: item.totalQty,
          picked_qty: 0,
          status: 'pending',
          type: 'return',
          original_return_id: item.returnItemIds[0],
        });

        for (const returnItemId of item.returnItemIds) {
          await base44.entities.Return.update(returnItemId, {
            status: 'assigned_to_run',
            run_id: run.id,
            run_number: runNumber,
          });
        }
      }

      await base44.entities.RunItem.bulkCreate(runItemsToCreate);

      toast.success(`Run #${runNumber} created with ${totalPickupItems} pickups and ${totalReturnItems} returns`);
      setShowGenerateDialog(false);
      setSelectedPickupItems([]);
      setSelectedReturnItems([]);
      loadData();
    } catch (error) {
      toast.error('Failed to generate run');
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  }

  // Assign runner to run
  async function assignRunner(runId) {
    if (!selectedRunner) {
      toast.error('Please select a runner');
      return;
    }

    try {
      const runner = users.find(u => u.id === selectedRunner);
      await base44.entities.Run.update(runId, {
        runner_id: selectedRunner,
        runner_name: runner?.full_name || runner?.email || '',
      });
      toast.success('Runner assigned');
      setAssignDialog(null);
      setSelectedRunner('');
      loadData();
    } catch (error) {
      toast.error('Failed to assign runner');
    }
  }

  // Activate run
  async function activateRun(runId) {
    try {
      await base44.entities.Run.update(runId, { status: 'active' });
      toast.success('Run activated');
      loadData();
    } catch (error) {
      toast.error('Failed to activate run');
    }
  }

  // Print labels for a run
  async function printRunLabels(runId) {
    const items = await loadRunItems(runId);
    if (items.length === 0) {
      toast.error('No items in this run');
      return;
    }
    
    // Use the LabelPrinter component logic
    const { printToZebra, generateZPL } = await import('@/components/admin/LabelPrinter');
    const zpl = generateZPL(items);
    await printToZebra(zpl);
  }

  // Cancel runs
  async function cancelRuns() {
    setIsCancelling(true);
    try {
      const { data } = await base44.functions.invoke('cancelRuns', { runIds: selectedRuns });
      
      const completed = data.results.filter(r => r.status === 'completed').length;
      const cancelled = data.results.filter(r => r.status === 'cancelled').length;
      
      if (completed > 0 && cancelled > 0) {
        toast.success(`${completed} run(s) completed with picked items, ${cancelled} fully cancelled`);
      } else if (completed > 0) {
        toast.success(`${completed} run(s) completed with picked items`);
      } else {
        toast.success(`${cancelled} run(s) cancelled`);
      }
      
      setShowCancelDialog(false);
      setSelectedRuns([]);
      loadData();
    } catch (error) {
      toast.error('Failed to cancel runs');
      console.error(error);
    } finally {
      setIsCancelling(false);
    }
  }

  // Toggle run selection
  function toggleRunSelection(runId) {
    setSelectedRuns(prev => 
      prev.includes(runId) ? prev.filter(id => id !== runId) : [...prev, runId]
    );
  }

  const statusConfig = {
    draft: { icon: Clock, color: 'bg-gray-100 text-gray-700', label: 'Draft' },
    active: { icon: Truck, color: 'bg-amber-100 text-amber-700', label: 'Active' },
    completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Completed' },
    dropped_off: { icon: CheckCircle2, color: 'bg-teal-100 text-teal-700', label: 'Dropped Off' },
  };

  const hasPendingItems = pendingOrderItems.length > 0 || pendingReturnItems.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Runs</h1>
          <p className="text-gray-500 mt-1">Consolidate orders & returns for pickup runs</p>
        </div>
        <div className="flex gap-2">
          {selectedRuns.length > 0 && (
            <Button 
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              className="text-red-600 hover:text-red-700 border-red-200"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel {selectedRuns.length} Run{selectedRuns.length !== 1 ? 's' : ''}
            </Button>
          )}
          <Button 
            onClick={() => setShowGenerateDialog(true)}
            disabled={!hasPendingItems}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate New Run
          </Button>
        </div>
      </div>

      {/* Pending Summary */}
      {hasPendingItems && (
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-teal-900">Pending Items Ready for Consolidation</p>
                  <p className="text-sm text-teal-700">
                    {pendingStats.totalItems} items • {pendingStats.uniqueStyles} styles • {pendingStats.storeCount} stores
                    {pendingStats.returns > 0 && ` • ${pendingStats.returns} returns`}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowGenerateDialog(true)}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Generate Run
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Runs Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No runs created yet</p>
            {hasPendingItems && (
              <Button 
                onClick={() => setShowGenerateDialog(true)}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Generate First Run
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {runs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(run => {
            const status = statusConfig[run.status] || statusConfig.draft;
            const StatusIcon = status.icon;

            return (
              <Card key={run.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleRunSelection(run.id)}
                        className="shrink-0"
                      >
                        {selectedRuns.includes(run.id) ? (
                          <CheckSquare className="w-5 h-5 text-teal-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </Button>
                      <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center">
                        <Truck className="w-7 h-7 text-gray-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-bold text-gray-900">Run #{run.run_number}</h3>
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                          {run.has_returns && (
                            <Badge className="bg-purple-100 text-purple-700">Has Returns</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{run.date}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Package className="w-4 h-4" />
                            {run.total_items || 0} items
                          </span>
                          <span className="flex items-center gap-1">
                            <Store className="w-4 h-4" />
                            {run.total_stores || 0} stores
                          </span>
                          {run.runner_name && (
                            <span className="text-teal-600 font-medium">
                              → {run.runner_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printRunLabels(run.id)}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print Labels
                      </Button>
                      {run.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAssignDialog(run)}
                          >
                            {run.runner_id ? 'Reassign' : 'Assign Runner'}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => activateRun(run.id)}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </Button>
                        </>
                      )}
                      <Link to={createPageUrl(`RunDetails?id=${run.id}`)}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700">Runs per page:</span>
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
            Page {currentPage} of {Math.ceil(runs.length / itemsPerPage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(runs.length / itemsPerPage)))}
            disabled={currentPage === Math.ceil(runs.length / itemsPerPage)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Generate Run Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate New Run</DialogTitle>
            <DialogDescription>
              Select items to include in this run. Leave unselected to use all pending items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-6">
            {pendingOrderItems.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900">Pickup Items ({pendingOrderItems.length})</h3>
                <OrderSelector
                  orderItems={pendingOrderItems}
                  products={products}
                  stores={stores}
                  selectedItems={selectedPickupItems}
                  onSelectionChange={setSelectedPickupItems}
                />
              </>
            )}
            {pendingReturnItems.length > 0 && (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mt-6">Return Items ({pendingReturnItems.length})</h3>
                <OrderSelector
                  orderItems={pendingReturnItems}
                  products={products}
                  stores={stores}
                  selectedItems={selectedReturnItems}
                  onSelectionChange={setSelectedReturnItems}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowGenerateDialog(false);
              setSelectedPickupItems([]);
              setSelectedReturnItems([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={generateRun}
              disabled={isGenerating}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                `Generate Run (${(selectedPickupItems.length || pendingOrderItems.length) + (selectedReturnItems.length || pendingReturnItems.length)} items)`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Runner Dialog */}
      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Runner to Run #{assignDialog?.run_number}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRunner} onValueChange={setSelectedRunner}>
              <SelectTrigger>
                <SelectValue placeholder="Select a runner" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => assignRunner(assignDialog.id)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Runs Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {selectedRuns.length} Run{selectedRuns.length !== 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription>
              Runs with picked items will be marked as completed. Unpicked items will revert to pending status.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={cancelRuns}
              disabled={isCancelling}
              className="bg-red-600 hover:bg-red-700"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}