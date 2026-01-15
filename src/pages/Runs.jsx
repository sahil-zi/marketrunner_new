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
  Eye
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

export default function Runs() {
  const [runs, setRuns] = useState([]);
  const [pendingItems, setPendingItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [assignDialog, setAssignDialog] = useState(null);
  const [selectedRunner, setSelectedRunner] = useState('');
  const [selectedOrderItems, setSelectedOrderItems] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [runsData, orderItemsData, productsData, storesData, usersData] = await Promise.all([
        base44.entities.Run.list('-created_date'),
        base44.entities.OrderItem.filter({ status: 'pending' }),
        base44.entities.ProductCatalog.list(),
        base44.entities.Store.list(),
        base44.entities.User.list(),
      ]);
      setRuns(runsData);
      setPendingItems(orderItemsData);
      setProducts(productsData);
      setStores(storesData);
      setUsers(usersData);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate pending items summary
  const pendingStats = React.useMemo(() => {
    const productMap = new Map(products.map(p => [p.barcode, p]));
    const storeItems = {};
    let totalQty = 0;
    const uniqueStyles = new Set();

    pendingItems.forEach(item => {
      const product = productMap.get(item.barcode);
      if (product) {
        const storeId = product.store_id || 'unknown';
        if (!storeItems[storeId]) storeItems[storeId] = 0;
        storeItems[storeId] += item.quantity || 1;
        totalQty += item.quantity || 1;
        uniqueStyles.add(product.style_name);
      }
    });

    return {
      totalItems: totalQty,
      uniqueStyles: uniqueStyles.size,
      storeCount: Object.keys(storeItems).length,
    };
  }, [pendingItems, products]);

  // Generate new run
  async function generateRun() {
    const itemsToUse = selectedOrderItems.length > 0 ? selectedOrderItems : pendingItems;
    
    if (itemsToUse.length === 0) {
      toast.error('No order items selected');
      return;
    }

    setIsGenerating(true);
    try {
      const productMap = new Map(products.map(p => [p.barcode, p]));
      const storeMap = new Map(stores.map(s => [s.id, s.name]));

      // Aggregate items by barcode
      const aggregatedItems = {};
      itemsToUse.forEach(item => {
        if (!aggregatedItems[item.barcode]) {
          aggregatedItems[item.barcode] = {
            barcode: item.barcode,
            totalQty: 0,
            orderItemIds: [],
          };
        }
        aggregatedItems[item.barcode].totalQty += item.quantity || 1;
        aggregatedItems[item.barcode].orderItemIds.push(item.id);
      });

      // Get next run number
      const maxRunNumber = runs.reduce((max, r) => Math.max(max, r.run_number || 0), 0);
      const runNumber = maxRunNumber + 1;

      // Calculate stats
      const uniqueStyles = new Set();
      const uniqueStores = new Set();
      let totalItems = 0;

      Object.values(aggregatedItems).forEach(item => {
        const product = productMap.get(item.barcode);
        if (product) {
          uniqueStyles.add(product.style_name);
          if (product.store_id) uniqueStores.add(product.store_id);
        }
        totalItems += item.totalQty;
      });

      // Create run
      const run = await base44.entities.Run.create({
        run_number: runNumber,
        date: new Date().toISOString().split('T')[0],
        status: 'draft',
        total_styles: uniqueStyles.size,
        total_items: totalItems,
        total_stores: uniqueStores.size,
      });

      // Create run items
      const runItems = Object.values(aggregatedItems).map(item => {
        const product = productMap.get(item.barcode);
        return {
          run_id: run.id,
          barcode: item.barcode,
          style_name: product?.style_name || '',
          size: product?.size || '',
          color: product?.color || '',
          image_url: product?.image_url || '',
          cost_price: product?.cost_price || 0,
          store_id: product?.store_id || '',
          store_name: product?.store_id ? storeMap.get(product.store_id) || '' : '',
          target_qty: item.totalQty,
          picked_qty: 0,
          status: 'pending',
        };
      });

      await base44.entities.RunItem.bulkCreate(runItems);

      // Update order items to assigned
      for (const item of Object.values(aggregatedItems)) {
        for (const orderItemId of item.orderItemIds) {
          await base44.entities.OrderItem.update(orderItemId, {
            status: 'assigned_to_run',
            run_id: run.id,
          });
        }
      }

      toast.success(`Run #${runNumber} created with ${totalItems} items from ${uniqueStyles.size} styles`);
      setShowGenerateDialog(false);
      setSelectedOrderItems([]);
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

  const statusConfig = {
    draft: { icon: Clock, color: 'bg-gray-100 text-gray-700', label: 'Draft' },
    active: { icon: Truck, color: 'bg-amber-100 text-amber-700', label: 'Active' },
    completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Completed' },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Runs</h1>
          <p className="text-gray-500 mt-1">Consolidate orders for pickup runs</p>
        </div>
        <Button 
          onClick={() => setShowGenerateDialog(true)}
          disabled={pendingItems.length === 0}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate New Run
        </Button>
      </div>

      {/* Pending Summary */}
      {pendingItems.length > 0 && (
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
            {pendingItems.length > 0 && (
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
          {runs.map(run => {
            const status = statusConfig[run.status] || statusConfig.draft;
            const StatusIcon = status.icon;

            return (
              <Card key={run.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
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
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      {run.status === 'draft' && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setAssignDialog(run)}
                          >
                            {run.runner_id ? 'Reassign' : 'Assign Runner'}
                          </Button>
                          <Button
                            onClick={() => activateRun(run.id)}
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Activate
                          </Button>
                        </>
                      )}
                      <Link to={createPageUrl(`RunDetails?id=${run.id}`)}>
                        <Button variant="outline">
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

      {/* Generate Run Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Generate New Run</DialogTitle>
            <DialogDescription>
              Select the order items to include in this run. Leave unselected to use all pending items.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <OrderSelector
              orderItems={pendingItems}
              products={products}
              stores={stores}
              selectedItems={selectedOrderItems}
              onSelectionChange={setSelectedOrderItems}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowGenerateDialog(false);
              setSelectedOrderItems([]);
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
                `Generate Run (${selectedOrderItems.length || pendingItems.length} items)`
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
    </div>
  );
}