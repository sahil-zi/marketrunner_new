import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Store as StoreIcon,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/admin/StatusBadge';
import EmptyState from '@/components/admin/EmptyState';
import { useRunById, useRunItems } from '@/hooks/use-runs';
import { useRunConfirmations } from '@/hooks/use-run-confirmations';
import { useStores } from '@/hooks/use-stores';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

export default function RunnerPickStore() {
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('runId');

  const { data: run, isLoading: runLoading } = useRunById(runId);
  const { data: runItems = [], isLoading: itemsLoading } = useRunItems(runId);
  const { data: confirmations = [], isLoading: confirmationsLoading } = useRunConfirmations(runId);
  const { data: stores = [], isLoading: storesLoading } = useStores();

  const isLoading = runLoading || itemsLoading || confirmationsLoading || storesLoading;

  // Group items by store
  const storeGroups = useMemo(() => {
    const groups = {};

    runItems.forEach((item) => {
      const storeId = item.store_id || 'unknown';
      if (!groups[storeId]) {
        const store = stores.find((s) => s.id === storeId);
        groups[storeId] = {
          storeId,
          storeName: item.store_name || store?.name || 'Unknown Store',
          location: store?.location || '',
          items: [],
          totalTarget: 0,
          totalPicked: 0,
          uniqueStyles: new Set(),
        };
      }
      groups[storeId].items.push(item);
      groups[storeId].totalTarget += item.target_qty || 0;
      groups[storeId].totalPicked += item.picked_qty || 0;
      groups[storeId].uniqueStyles.add(item.style_name);
    });

    return Object.values(groups).map((g) => ({
      ...g,
      stylesCount: g.uniqueStyles.size,
      isConfirmed: confirmations.some((c) => c.store_id === g.storeId),
    }));
  }, [runItems, stores, confirmations]);

  // Sort: incomplete first, then completed
  const sortedStores = useMemo(() => {
    return [...storeGroups].sort((a, b) => {
      if (a.isConfirmed !== b.isConfirmed) {
        return a.isConfirmed ? 1 : -1;
      }
      return a.storeName.localeCompare(b.storeName);
    });
  }, [storeGroups]);

  const completedCount = storeGroups.filter((s) => s.isConfirmed).length;
  const totalCount = storeGroups.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-4">
        <EmptyState
          icon={StoreIcon}
          title="Run not found"
          description="This run may have been removed or does not exist."
          action={
            <Link to={createPageUrl('RunnerHome')}>
              <Button>Back to Runs</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* Sticky Header */}
      <div className="bg-card border-b border-border px-4 py-4 sticky top-[60px] z-40">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('RunnerHome')}>
            <Button variant="ghost" size="icon" className="shrink-0" aria-label="Back to runs">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">Run #{run.run_number}</h1>
            <p className="text-muted-foreground text-sm">
              {completedCount} / {totalCount} stores completed
            </p>
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
          <motion.div
            className="bg-primary h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Store List */}
      {sortedStores.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={StoreIcon}
            title="No Stores"
            description="No stores have been assigned to this run yet."
          />
        </div>
      ) : (
        <motion.div
          className="p-4 space-y-4"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {sortedStores.map((store) => {
            const storeProgress =
              store.totalTarget > 0
                ? Math.round((store.totalPicked / store.totalTarget) * 100)
                : 0;

            return (
              <motion.div key={store.storeId} variants={item}>
                <Link
                  to={createPageUrl(
                    `RunnerPicking?runId=${runId}&storeId=${store.storeId}`
                  )}
                >
                  <Card
                    className={`transition-all active:scale-[0.98] bg-card border-border ${
                      store.isConfirmed
                        ? 'border-success/30 bg-success/5 opacity-75'
                        : 'hover:border-primary/40'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                              store.isConfirmed ? 'bg-success/10' : 'bg-muted'
                            }`}
                          >
                            <StoreIcon
                              className={`w-7 h-7 ${
                                store.isConfirmed
                                  ? 'text-success'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-foreground">
                              {store.storeName}
                            </h3>
                            {store.location && (
                              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                {store.location}
                              </p>
                            )}
                          </div>
                        </div>

                        {store.isConfirmed ? (
                          <StatusBadge status="completed" />
                        ) : (
                          <ArrowRight className="w-6 h-6 text-muted-foreground mt-2" />
                        )}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          <span className="font-medium">
                            {store.totalPicked} / {store.totalTarget}
                          </span>
                        </div>
                        <div className="text-sm">
                          {store.stylesCount} styles
                        </div>
                      </div>

                      {/* Progress Bar */}
                      {!store.isConfirmed && (
                        <div className="w-full bg-muted rounded-full h-2 mt-4 overflow-hidden">
                          <motion.div
                            className="bg-primary h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${storeProgress}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
