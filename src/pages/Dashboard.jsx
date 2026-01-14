import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Package, 
  ShoppingCart, 
  Truck, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function StatCard({ title, value, icon: Icon, trend, color, isLoading }) {
  const colorClasses = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
  };

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {isLoading ? (
              <div className="h-8 w-24 mt-2 bg-gray-200 animate-pulse rounded" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">{trend}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentRunCard({ run }) {
  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    active: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  };

  const statusIcons = {
    draft: Clock,
    active: Truck,
    completed: CheckCircle2,
  };

  const StatusIcon = statusIcons[run.status] || Clock;

  return (
    <Link 
      to={createPageUrl(`RunDetails?id=${run.id}`)}
      className="block"
    >
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-teal-200 hover:shadow-sm transition-all">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
            <Truck className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Run #{run.run_number}</p>
            <p className="text-sm text-gray-500">{run.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={statusColors[run.status]}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {run.status}
          </Badge>
          <ArrowRight className="w-5 h-5 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalProducts: 0,
    pendingOrders: 0,
    activeRuns: 0,
    storeBalance: 0,
  });
  const [recentRuns, setRecentRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      const [products, orderItems, runs, ledger] = await Promise.all([
        base44.entities.ProductCatalog.list(),
        base44.entities.OrderItem.filter({ status: 'pending' }),
        base44.entities.Run.list('-created_date', 10),
        base44.entities.Ledger.list(),
      ]);

      // Calculate store balances
      let totalBalance = 0;
      ledger.forEach(entry => {
        if (entry.transaction_type === 'debit') {
          totalBalance -= entry.amount;
        } else {
          totalBalance += entry.amount;
        }
      });

      const activeRuns = runs.filter(r => r.status === 'active').length;

      setStats({
        totalProducts: products.length,
        pendingOrders: orderItems.length,
        activeRuns,
        storeBalance: totalBalance,
      });

      setRecentRuns(runs.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your fulfillment operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Products"
          value={stats.totalProducts.toLocaleString()}
          icon={Package}
          color="teal"
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Orders"
          value={stats.pendingOrders.toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Runs"
          value={stats.activeRuns.toLocaleString()}
          icon={Truck}
          color="amber"
          isLoading={isLoading}
        />
        <StatCard
          title="Store Balance"
          value={`$${Math.abs(stats.storeBalance).toFixed(2)}`}
          icon={DollarSign}
          color={stats.storeBalance >= 0 ? 'green' : 'amber'}
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to={createPageUrl('Inventory')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
              <Package className="w-6 h-6 text-teal-600" />
              <span>Upload Products</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Orders')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              <span>Import Orders</span>
            </Button>
          </Link>
          <Link to={createPageUrl('Runs')}>
            <Button variant="outline" className="w-full h-auto py-4 flex flex-col items-center gap-2">
              <Truck className="w-6 h-6 text-amber-600" />
              <span>Generate Run</span>
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Runs */}
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
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl animate-pulse">
                <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 w-24 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded mt-2" />
                </div>
              </div>
            ))
          ) : recentRuns.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No runs created yet</p>
              <Link to={createPageUrl('Runs')}>
                <Button className="mt-4 bg-teal-600 hover:bg-teal-700">
                  Create First Run
                </Button>
              </Link>
            </div>
          ) : (
            recentRuns.map(run => (
              <RecentRunCard key={run.id} run={run} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}