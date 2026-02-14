import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useProducts } from '@/hooks/use-products';
import { usePendingOrderItems } from '@/hooks/use-orders';
import { useRuns } from '@/hooks/use-runs';
import { useLedger } from '@/hooks/use-ledger';
import { motion } from 'framer-motion';
import {
  Package,
  ShoppingCart,
  Truck,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

function StatCard({ title, value, icon: Icon, color, isLoading }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden hover:-translate-y-1 transition-transform">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {isLoading ? (
                <div className="h-8 w-24 mt-2 bg-muted animate-pulse rounded" />
              ) : (
                <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
              )}
            </div>
            <div className={`p-3 rounded-xl ${colorMap[color]}`}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecentRunCard({ run, index }) {
  const statusColors = {
    draft: 'bg-muted text-muted-foreground',
    active: 'bg-warning/10 text-warning',
    completed: 'bg-success/10 text-success',
  };

  const statusIcons = { draft: Clock, active: Truck, completed: CheckCircle2 };
  const StatusIcon = statusIcons[run.status] || Clock;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
    >
      <Link to={createPageUrl(`RunDetails?id=${run.id}`)} className="block">
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-glow-sm transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Run #{run.run_number}</p>
              <p className="text-sm text-muted-foreground">{run.date}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={statusColors[run.status]}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {run.status}
            </Badge>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: pendingOrderItems = [], isLoading: ordersLoading } = usePendingOrderItems();
  const { data: runs = [], isLoading: runsLoading } = useRuns('-created_date');
  const { data: ledger = [], isLoading: ledgerLoading } = useLedger();

  const isLoading = productsLoading || ordersLoading || runsLoading || ledgerLoading;

  const stats = React.useMemo(() => {
    let totalBalance = 0;
    ledger.forEach(entry => {
      if (entry.transaction_type === 'debit') {
        totalBalance -= entry.amount;
      } else {
        totalBalance += entry.amount;
      }
    });

    const activeRuns = runs.filter(r => r.status === 'active' || r.status === 'completed').length;

    return {
      totalProducts: products.length,
      pendingOrders: pendingOrderItems.length,
      activeRuns,
      storeBalance: totalBalance,
    };
  }, [products, pendingOrderItems, runs, ledger]);

  const recentRuns = runs.slice(0, 5);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your fulfillment operations</p>
      </div>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <StatCard title="Total Products" value={stats.totalProducts.toLocaleString()} icon={Package} color="primary" isLoading={isLoading} />
        <StatCard title="Pending Orders" value={stats.pendingOrders.toLocaleString()} icon={ShoppingCart} color="info" isLoading={isLoading} />
        <StatCard title="Active Runs" value={stats.activeRuns.toLocaleString()} icon={Truck} color="warning" isLoading={isLoading} />
        <StatCard title="Store Balance" value={`د.إ ${Math.abs(stats.storeBalance).toFixed(2)}`} icon={DollarSign} color={stats.storeBalance >= 0 ? 'success' : 'warning'} isLoading={isLoading} />
      </motion.div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to={createPageUrl('Inventory')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition-transform">
              <Package className="w-6 h-6 text-primary" />
              <span>Upload Products</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Orders')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition-transform">
              <ShoppingCart className="w-6 h-6 text-info" />
              <span>Import Orders</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Runs')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2 hover:-translate-y-1 transition-transform">
              <Truck className="w-6 h-6 text-warning" />
              <span>Generate Run</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Recent Runs</CardTitle>
          <Link to={createPageUrl('Runs')}>
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-muted rounded-xl animate-pulse">
                <div className="w-12 h-12 bg-secondary rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 w-24 bg-secondary rounded" />
                  <div className="h-4 w-32 bg-secondary rounded mt-2" />
                </div>
              </div>
            ))
          ) : recentRuns.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No runs created yet</p>
              <Link to={createPageUrl('Runs')}>
                <Button className="mt-4">Create First Run</Button>
              </Link>
            </div>
          ) : (
            recentRuns.map((run, index) => (
              <RecentRunCard key={run.id} run={run} index={index} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
