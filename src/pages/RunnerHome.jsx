import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  Truck, 
  Clock, 
  CheckCircle2, 
  Package,
  Store,
  ArrowRight,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


export default function RunnerHome() {
  const [user, setUser] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runItems, setRunItems] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Subscribe to runs updates for real-time notifications
    const unsubscribe = base44.entities.Run.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const run = event.data;
        if (run.status === 'active' && (!run.runner_id || run.runner_id === user?.id)) {
          loadData();
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  async function loadData() {
    setIsLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      const [runsData, runItemsData, confirmationsData] = await Promise.all([
        base44.entities.Run.filter({ status: 'active' }),
        base44.entities.RunItem.list(),
        base44.entities.RunConfirmation.list(),
      ]);

      // Filter runs for this runner or unassigned
      const myRuns = runsData.filter(
        r => !r.runner_id || r.runner_id === currentUser.id
      );

      setRuns(myRuns);
      setRunItems(runItemsData);
      setConfirmations(confirmationsData);
    } catch (error) {
      console.error('Failed to load runs');
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate run progress
  const getRunProgress = (runId) => {
    const items = runItems.filter(i => i.run_id === runId);
    const runConfirmations = confirmations.filter(c => c.run_id === runId);
    
    const uniqueStores = [...new Set(items.map(i => i.store_id))];
    const confirmedStores = runConfirmations.map(c => c.store_id);
    
    return {
      totalStores: uniqueStores.length,
      completedStores: confirmedStores.length,
      percentage: uniqueStores.length > 0 
        ? Math.round((confirmedStores.length / uniqueStores.length) * 100) 
        : 0,
    };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome */}
      <div className="text-center py-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Hello, {user?.full_name?.split(' ')[0] || 'Runner'}! 👋
        </h1>
        <p className="text-gray-500 mt-1">Select a run to continue picking</p>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          onClick={loadData}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Active Runs */}
      {runs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Truck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Active Runs</h3>
            <p className="text-gray-500">Check back later for new runs</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map(run => {
            const progress = getRunProgress(run.id);
            const isComplete = progress.completedStores === progress.totalStores && progress.totalStores > 0;

            return (
              <Link 
                key={run.id}
                to={createPageUrl(`RunnerPickStore?runId=${run.id}`)}
              >
                <Card className={`transition-all active:scale-[0.98] ${
                  isComplete ? 'border-green-300 bg-green-50' : 'hover:border-teal-300'
                }`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                          isComplete ? 'bg-green-100' : 'bg-teal-100'
                        }`}>
                          <Truck className={`w-7 h-7 ${
                            isComplete ? 'text-green-600' : 'text-teal-600'
                          }`} />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">
                            Run #{run.run_number}
                          </h2>
                          <p className="text-gray-500">{run.date}</p>
                        </div>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 mt-2" />
                    </div>

                    {/* Progress */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Store className="w-5 h-5" />
                          <span className="font-medium">
                            {progress.completedStores} / {progress.totalStores} Stores
                          </span>
                        </div>
                        {isComplete ? (
                          <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 text-sm px-3 py-1">
                            <Clock className="w-4 h-4 mr-1" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${isComplete ? 'bg-green-500' : 'bg-teal-600'}`}
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Package className="w-5 h-5" />
                        <span>{run.total_items || 0} items</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Store className="w-5 h-5" />
                        <span>{run.total_stores || 0} stores</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}