import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  Truck,
  Package,
  Store,
  ArrowRight,
  Loader2,
  RefreshCw,
  Printer,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRuns, useAllRunItems } from '@/hooks/use-runs';
import { useAllRunConfirmations } from '@/hooks/use-run-confirmations';
import { supabase } from '@/api/supabaseClient';
import { filterBy, createOne, bulkDelete } from '@/api/supabase/helpers';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export default function RunnerHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: allRuns = [], isLoading: runsLoading, refetch: refetchRuns } = useRuns();
  const { data: allRunItems = [], isLoading: itemsLoading, refetch: refetchItems } = useAllRunItems();
  const { data: allConfirmations = [], isLoading: confirmationsLoading, refetch: refetchConfirmations } = useAllRunConfirmations();
  const [activeTab, setActiveTab] = useState('new');
  const [droppingOff, setDroppingOff] = useState(null); // runId being dropped off
  const [printingRun, setPrintingRun] = useState(null); // runId being printed

  const isLoading = userLoading || runsLoading || itemsLoading || confirmationsLoading;

  // My runs = assigned to me or unassigned
  const myRuns = useMemo(() => {
    if (!user || !allRuns.length) return [];
    return allRuns.filter(r => !r.runner_id || r.runner_id === user.id);
  }, [allRuns, user]);

  // Calculate run progress (defined before useMemos that use it)
  const getRunProgress = (runId, run) => {
    const items = allRunItems.filter((i) => i.run_id === runId);
    const runConfirmations = allConfirmations.filter((c) => c.run_id === runId);

    const uniqueStores = [...new Set(items.map((i) => i.store_id).filter(Boolean))];
    const confirmedStoreIds = new Set(runConfirmations.map((c) => c.store_id));
    const completedStores = uniqueStores.filter((sid) => confirmedStoreIds.has(sid)).length;

    const totalUnits = items.reduce((sum, i) => sum + (i.target_qty || 0), 0);
    const pickedUnits = items.reduce((sum, i) => sum + (i.picked_qty || 0), 0);

    const activeItems = items.filter(i => (i.target_qty || 0) > 0);
    const completedItems = activeItems.filter(i => (i.picked_qty || 0) >= i.target_qty).length;
    const totalItems = activeItems.length;

    return {
      totalStores: uniqueStores.length,
      completedStores,
      totalUnits,
      pickedUnits,
      completedItems,
      totalItems,
      percentage:
        uniqueStores.length > 0 ? Math.round((completedStores / uniqueStores.length) * 100) : 0,
      isComplete:
        run.status === 'completed' ||
        run.status === 'dropped_off' ||
        (completedStores === uniqueStores.length && uniqueStores.length > 0),
    };
  };

  // New tab: status 'active', no progress yet
  const newRuns = useMemo(() => {
    return [...myRuns.filter(r => r.status === 'active')]
      .filter(r => {
        const p = getRunProgress(r.id, r);
        return p.pickedUnits === 0 && p.completedStores === 0;
      })
      .sort((a, b) => (a.run_number || 0) - (b.run_number || 0));
  }, [myRuns, allRunItems, allConfirmations]);

  // In Progress tab: status 'active', with some progress
  const inProgressRuns = useMemo(() => {
    return [...myRuns.filter(r => r.status === 'active')]
      .filter(r => {
        const p = getRunProgress(r.id, r);
        return p.pickedUnits > 0 || p.completedStores > 0;
      })
      .sort((a, b) => (a.run_number || 0) - (b.run_number || 0));
  }, [myRuns, allRunItems, allConfirmations]);

  // Completed tab: status 'completed' or 'dropped_off', newest completed_at first
  const completedRuns = useMemo(() => {
    return [...myRuns.filter(r => r.status === 'completed' || r.status === 'dropped_off')]
      .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  }, [myRuns]);

  const displayRuns = activeTab === 'new' ? newRuns : activeTab === 'inprogress' ? inProgressRuns : completedRuns;

  const handleRefresh = () => {
    refetchRuns();
    refetchItems();
    refetchConfirmations();
  };

  async function loadRunItems(runId) {
    return filterBy('run_items', { run_id: runId });
  }

  async function enrichWithOrderNumber(items, runId) {
    try {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('barcode, order_id')
        .eq('run_id', runId);
      if (!orderItems || orderItems.length === 0) return items;
      const orderIds = [...new Set(orderItems.map((i) => i.order_id).filter(Boolean))];
      const { data: orders } = await supabase
        .from('orders')
        .select('id, platform_order_id')
        .in('id', orderIds);
      if (!orders) return items;
      const orderMap = Object.fromEntries(orders.map((o) => [o.id, o.platform_order_id]));
      const barcodeToOrderNumber = {};
      orderItems.forEach((oi) => {
        if (oi.order_id && orderMap[oi.order_id]) {
          barcodeToOrderNumber[oi.barcode] = orderMap[oi.order_id];
        }
      });
      return items.map((item) => ({ ...item, order_number: barcodeToOrderNumber[item.barcode] || '' }));
    } catch {
      return items;
    }
  }

  async function printRunLabels(run) {
    setPrintingRun(run.id);
    try {
      const rawItems = await loadRunItems(run.id);
      if (rawItems.length === 0) { toast.error('No items in this run'); return; }
      const items = await enrichWithOrderNumber(rawItems, run.id);
      const { printToZebra, generateZPL } = await import('@/components/admin/LabelPrinter');
      await printToZebra(generateZPL(items));
    } catch {
      toast.error('Failed to print labels');
    } finally {
      setPrintingRun(null);
    }
  }

  async function exportRunZPL(run) {
    setPrintingRun(run.id);
    try {
      const rawItems = await loadRunItems(run.id);
      if (rawItems.length === 0) { toast.error('No items in this run'); return; }
      const items = await enrichWithOrderNumber(rawItems, run.id);
      const { generateZPL, downloadZPLFile } = await import('@/components/admin/LabelPrinter');
      downloadZPLFile(generateZPL(items), `run_${run.run_number}_labels.zpl`);
    } catch {
      toast.error('Failed to export ZPL');
    } finally {
      setPrintingRun(null);
    }
  }

  const handleMarkDroppedOff = async (e, run) => {
    e.stopPropagation();
    setDroppingOff(run.id);
    try {
      const { error: updateError } = await supabase
        .from('runs')
        .update({ status: 'dropped_off', completed_at: new Date().toISOString() })
        .eq('id', run.id);
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['runs'] });
      toast.success('Run marked as dropped off');
    } catch (err) {
      console.error('Failed to mark run as dropped off:', err);
      toast.error(`Failed: ${err.message}`);
      setDroppingOff(null);
      return;
    }

    // Build per-store ledger entries from run items (best-effort, after status update)
    try {
      const runItems = allRunItems.filter(i => i.run_id === run.id);
      const storeMap = {};
      for (const item of runItems) {
        if (!item.store_id) continue;
        if (!storeMap[item.store_id]) {
          storeMap[item.store_id] = {
            store_id: item.store_id,
            store_name: item.store_name || '',
            pickup: 0,
            return: 0,
          };
        }
        const amount = (item.picked_qty || 0) * (item.cost_price || 0);
        if (item.type === 'pickup') storeMap[item.store_id].pickup += amount;
        else if (item.type === 'return') storeMap[item.store_id].return += amount;
      }

      // Delete any existing ledger entries for this run, then create one per store
      const existingEntries = await filterBy('ledger', { run_number: run.run_number });
      if (existingEntries.length > 0) {
        await bulkDelete('ledger', existingEntries.map(e => e.id));
      }

      const today = new Date().toISOString().split('T')[0];
      for (const s of Object.values(storeMap)) {
        const net = s.pickup - s.return;
        if (net === 0) continue;
        const hasPickup = s.pickup > 0;
        const hasReturn = s.return > 0;
        await createOne('ledger', {
          store_id: s.store_id,
          store_name: s.store_name,
          transaction_type: net > 0 ? 'debit' : 'credit',
          amount: Math.abs(net),
          date: today,
          notes: `Run #${run.run_number} - ${hasPickup ? 'pickups' : ''}${hasPickup && hasReturn ? ' & ' : ''}${hasReturn ? 'returns' : ''}`,
          run_number: run.run_number,
        });
      }
    } catch (err) {
      console.error('Failed to write ledger entries for run:', err);
    } finally {
      setDroppingOff(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-foreground">
          Hello, {user?.full_name?.split(' ')[0] || 'Runner'}!
        </h1>
        <p className="text-muted-foreground mt-1">Select a run to continue picking</p>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={handleRefresh} className="gap-2" aria-label="Refresh runs">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex bg-muted p-1 rounded-xl">
        {[
          { key: 'new', label: 'New', count: newRuns.length },
          { key: 'inprogress', label: 'In Progress', count: inProgressRuns.length },
          { key: 'completed', label: 'Completed', count: completedRuns.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
              activeTab === key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}{count > 0 ? ` (${count})` : ''}
          </button>
        ))}
      </div>

      {/* Runs List */}
      {displayRuns.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={activeTab === 'new' ? 'No New Runs' : activeTab === 'inprogress' ? 'No Runs In Progress' : 'No Completed Runs'}
          description={activeTab === 'completed' ? 'Completed runs will appear here' : 'Check back later for new runs'}
        />
      ) : (
        <motion.div
          className="space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {displayRuns.map((run) => {
            const progress = getRunProgress(run.id, run);
            const isComplete = progress.isComplete;
            const canMarkDroppedOff = run.status === 'active' || run.status === 'completed';

            return (
              <motion.div key={run.id} variants={item} className="space-y-2">
                {/* Card is clickable to navigate into the run */}
                <div
                  className="cursor-pointer"
                  onClick={() => navigate(createPageUrl(`RunnerPickStore?runId=${run.id}`))}
                >
                  <Card
                    className={`transition-all active:scale-[0.98] bg-card border-border ${
                      isComplete
                        ? 'border-success/30 bg-success/5'
                        : 'hover:border-primary/40'
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                              isComplete ? 'bg-success/10' : 'bg-primary/10'
                            }`}
                          >
                            <Truck
                              className={`w-7 h-7 ${
                                isComplete ? 'text-success' : 'text-primary'
                              }`}
                            />
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-foreground">
                              Run #{run.run_number}
                            </h2>
                            <p className="text-muted-foreground">{run.date}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-6 h-6 text-muted-foreground mt-2" />
                      </div>

                      {/* Progress */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Store className="w-5 h-5" />
                              <span className="font-medium">
                                {progress.completedStores} / {progress.totalStores} Stores
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Package className="w-4 h-4" />
                              <span className="font-medium">
                                {progress.pickedUnits} / {progress.totalUnits} Units Picked
                              </span>
                            </div>
                          </div>
                          {isComplete ? (
                            <StatusBadge status="completed" />
                          ) : (
                            <StatusBadge status="active" />
                          )}
                        </div>
                        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${
                              isComplete ? 'bg-success' : 'bg-primary'
                            }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress.percentage}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Package className="w-5 h-5" />
                          <span>
                            <span className={progress.completedItems === progress.totalItems && progress.totalItems > 0 ? 'text-success font-semibold' : ''}>
                              {progress.completedItems}
                            </span>
                            {' / '}
                            {progress.totalItems} items done
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Store className="w-5 h-5" />
                          <span>{run.total_stores || 0} stores</span>
                        </div>
                        {run.status === 'dropped_off' && (
                          <div className="ml-auto">
                            <StatusBadge status="dropped_off" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Buttons outside the clickable card to avoid event conflicts */}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant="outline"
                    onClick={() => printRunLabels(run)}
                    disabled={printingRun === run.id}
                  >
                    {printingRun === run.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Printer className="mr-2 h-4 w-4" />
                    )}
                    Print Labels
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => exportRunZPL(run)}
                    disabled={printingRun === run.id}
                    aria-label="Export ZPL"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canMarkDroppedOff && (
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleMarkDroppedOff({ stopPropagation: () => {} }, run)}
                      disabled={droppingOff === run.id}
                    >
                      {droppingOff === run.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Mark Dropped Off
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
