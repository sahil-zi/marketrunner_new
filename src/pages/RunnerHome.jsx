import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  Truck,
  Package,
  Store,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRuns, useAllRunItems, useUpdateRun } from '@/hooks/use-runs';
import { useAllRunConfirmations } from '@/hooks/use-run-confirmations';
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
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: allRuns = [], isLoading: runsLoading, refetch: refetchRuns } = useRuns();
  const { data: allRunItems = [], isLoading: itemsLoading, refetch: refetchItems } = useAllRunItems();
  const { data: allConfirmations = [], isLoading: confirmationsLoading, refetch: refetchConfirmations } = useAllRunConfirmations();
  const updateRun = useUpdateRun();
  const [activeTab, setActiveTab] = useState('active');

  const isLoading = userLoading || runsLoading || itemsLoading || confirmationsLoading;

  // My runs = assigned to me or unassigned
  const myRuns = useMemo(() => {
    if (!user || !allRuns.length) return [];
    return allRuns.filter(r => !r.runner_id || r.runner_id === user.id);
  }, [allRuns, user]);

  // Active tab: status 'active', sorted FIFO (lowest run_number first)
  const activeRuns = useMemo(() => {
    return [...myRuns.filter(r => r.status === 'active')]
      .sort((a, b) => (a.run_number || 0) - (b.run_number || 0));
  }, [myRuns]);

  // Completed tab: status 'completed' or 'dropped_off', newest completed_at first
  const completedRuns = useMemo(() => {
    return [...myRuns.filter(r => r.status === 'completed' || r.status === 'dropped_off')]
      .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0));
  }, [myRuns]);

  const displayRuns = activeTab === 'active' ? activeRuns : completedRuns;

  // Calculate run progress
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

  const handleRefresh = () => {
    refetchRuns();
    refetchItems();
    refetchConfirmations();
  };

  const handleMarkDroppedOff = async (e, run) => {
    e.stopPropagation();
    try {
      await updateRun.mutateAsync({
        id: run.id,
        data: { status: 'dropped_off', completed_at: new Date().toISOString() },
      });

      toast.success('Run marked as dropped off');
    } catch (err) {
      console.error('Failed to mark run as dropped off:', err);
      toast.error('Failed to update run');
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
        <button
          onClick={() => setActiveTab('active')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'active'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Active{activeRuns.length > 0 ? ` (${activeRuns.length})` : ''}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'completed'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Completed{completedRuns.length > 0 ? ` (${completedRuns.length})` : ''}
        </button>
      </div>

      {/* Runs List */}
      {displayRuns.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={activeTab === 'active' ? 'No Active Runs' : 'No Completed Runs'}
          description={activeTab === 'active' ? 'Check back later for new runs' : 'Completed runs will appear here'}
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
            const canMarkDroppedOff = isComplete && run.status !== 'dropped_off';

            return (
              <motion.div key={run.id} variants={item}>
                {/* Use div + navigate so the Mark Dropped Off button's stopPropagation works reliably */}
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

                      {/* Stats & Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-6">
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
                        </div>
                        {canMarkDroppedOff && (
                          <Button
                            size="sm"
                            onClick={(e) => handleMarkDroppedOff(e, run)}
                            disabled={updateRun.isPending}
                          >
                            Mark Dropped Off
                          </Button>
                        )}
                        {run.status === 'dropped_off' && (
                          <StatusBadge status="dropped_off" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
