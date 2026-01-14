import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Store as StoreIcon,
  CheckCircle2,
  Clock,
  Package,
  ArrowRight,
  Loader2,
  MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';


export default function RunnerPickStore() {
  const [run, setRun] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('runId');

  useEffect(() => {
    if (runId) {
      loadData();
    }
  }, [runId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [runsData, itemsData, confirmationsData, storesData] = await Promise.all([
        base44.entities.Run.list(),
        base44.entities.RunItem.filter({ run_id: runId }),
        base44.entities.RunConfirmation.filter({ run_id: runId }),
        base44.entities.Store.list(),
      ]);

      const foundRun = runsData.find(r => r.id === runId);
      setRun(foundRun);
      setRunItems(itemsData);
      setConfirmations(confirmationsData);
      setStores(storesData);
    } catch (error) {
      console.error('Failed to load run');
    } finally {
      setIsLoading(false);
    }
  }

  // Group items by store
  const storeGroups = React.useMemo(() => {
    const groups = {};
    
    runItems.forEach(item => {
      const storeId = item.store_id || 'unknown';
      if (!groups[storeId]) {
        const store = stores.find(s => s.id === storeId);
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

    return Object.values(groups).map(g => ({
      ...g,
      stylesCount: g.uniqueStyles.size,
      isConfirmed: confirmations.some(c => c.store_id === g.storeId),
    }));
  }, [runItems, stores, confirmations]);

  // Sort: incomplete first, then completed
  const sortedStores = [...storeGroups].sort((a, b) => {
    if (a.isConfirmed !== b.isConfirmed) {
      return a.isConfirmed ? 1 : -1;
    }
    return a.storeName.localeCompare(b.storeName);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="p-4 text-center py-16">
        <StoreIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">Run not found</p>
        <Link to={createPageUrl('RunnerHome')}>
          <Button>Back to Runs</Button>
        </Link>
      </div>
    );
  }

  const completedCount = storeGroups.filter(s => s.isConfirmed).length;
  const totalCount = storeGroups.length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-[60px] z-40">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('RunnerHome')}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Run #{run.run_number}</h1>
            <p className="text-gray-500 text-sm">
              {completedCount} / {totalCount} stores completed
            </p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
          <div 
            className="bg-teal-600 h-full transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Store List */}
      <div className="p-4 space-y-4">
        {sortedStores.map(store => {
          const storeProgress = store.totalTarget > 0 
            ? Math.round((store.totalPicked / store.totalTarget) * 100)
            : 0;

          return (
            <Link
              key={store.storeId}
              to={createPageUrl(`RunnerPicking?runId=${runId}&storeId=${store.storeId}`)}
            >
              <Card className={`transition-all active:scale-[0.98] ${
                store.isConfirmed 
                  ? 'border-green-300 bg-green-50 opacity-75' 
                  : 'hover:border-teal-300'
              }`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                        store.isConfirmed ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <StoreIcon className={`w-7 h-7 ${
                          store.isConfirmed ? 'text-green-600' : 'text-gray-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {store.storeName}
                        </h3>
                        {store.location && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            {store.location}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {store.isConfirmed ? (
                      <Badge className="bg-green-100 text-green-700 text-base px-3 py-1.5">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Done
                      </Badge>
                    ) : (
                      <ArrowRight className="w-6 h-6 text-gray-400 mt-2" />
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-gray-600">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      <span className="font-medium">
                        {store.totalPicked} / {store.totalTarget}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {store.stylesCount} styles
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {!store.isConfirmed && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
                      <div 
                        className="bg-teal-600 h-full transition-all duration-300"
                        style={{ width: `${storeProgress}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}