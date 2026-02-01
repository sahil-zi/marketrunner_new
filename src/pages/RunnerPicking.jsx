import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { 
  ArrowLeft, 
  Store as StoreIcon,
  Minus,
  Plus,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  X,
  Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function RunnerPicking() {
  const [run, setRun] = useState(null);
  const [runItems, setRunItems] = useState([]);
  const [store, setStore] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showConfirmZero, setShowConfirmZero] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [viewImage, setViewImage] = useState(null);
  const holdTimer = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const urlParams = new URLSearchParams(window.location.search);
  const runId = urlParams.get('runId');
  const storeId = urlParams.get('storeId');

  useEffect(() => {
    if (runId && storeId) {
      loadData();
    }
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, [runId, storeId]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [runsData, itemsData, storesData] = await Promise.all([
        base44.entities.Run.list(),
        base44.entities.RunItem.filter({ run_id: runId }),
        base44.entities.Store.list(),
      ]);

      const foundRun = runsData.find(r => r.id === runId);
      const foundStore = storesData.find(s => s.id === storeId);
      const storeItems = itemsData.filter(i => i.store_id === storeId);

      setRun(foundRun);
      setStore(foundStore);
      setRunItems(storeItems);
    } catch (error) {
      console.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  const styleGroups = React.useMemo(() => {
    const groups = {};
    
    runItems.forEach(item => {
      const styleName = item.style_name || 'Unknown';
      const key = `${styleName}-${item.type}`;
      if (!groups[key]) {
        groups[key] = {
          styleName,
          type: item.type,
          imageUrl: item.image_url,
          items: [],
        };
      }
      groups[key].items.push(item);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'pickup' ? -1 : 1;
      return a.styleName.localeCompare(b.styleName);
    });
  }, [runItems]);

  async function updatePickedQty(item, delta) {
    const newQty = Math.max(0, Math.min((item.picked_qty || 0) + delta, item.target_qty + 10));
    
    try {
      await base44.entities.RunItem.update(item.id, { picked_qty: newQty });
      setRunItems(prev => 
        prev.map(i => i.id === item.id ? { ...i, picked_qty: newQty } : i)
      );
    } catch (error) {
      toast.error('Failed to update');
    }
  }

  const startHold = (item) => {
    setShowConfirmZero(item);
    setHoldProgress(0);
    holdTimer.current = setInterval(() => {
      setHoldProgress(prev => {
        if (prev >= 100) {
          clearInterval(holdTimer.current);
          confirmZero(item);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const cancelHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
    }
    setHoldProgress(0);
    setShowConfirmZero(null);
  };

  const confirmZero = async (item) => {
    try {
      await base44.entities.RunItem.update(item.id, { 
        picked_qty: 0, 
        status: 'not_found' 
      });
      setRunItems(prev => 
        prev.map(i => i.id === item.id ? { ...i, picked_qty: 0, status: 'not_found' } : i)
      );
      toast.success('Marked as unavailable');
    } catch (error) {
      toast.error('Failed to update');
    }
    setShowConfirmZero(null);
    setHoldProgress(0);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Only JPEG and PNG images are allowed');
      return;
    }

    setReceiptImage(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  async function completeStore() {
    if (!receiptImage) {
      toast.error('Please upload a receipt photo');
      return;
    }

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: receiptImage });

      const pickupAmount = runItems
        .filter(item => item.type === 'pickup')
        .reduce((sum, item) => sum + ((item.picked_qty || 0) * (item.cost_price || 0)), 0);

      const returnAmount = runItems
        .filter(item => item.type === 'return')
        .reduce((sum, item) => sum + ((item.picked_qty || 0) * (item.cost_price || 0)), 0);
      
      const netAmount = pickupAmount - returnAmount;

      await base44.entities.RunConfirmation.create({
        run_id: runId,
        store_id: storeId,
        store_name: store?.name || '',
        confirmed_at: new Date().toISOString(),
        receipt_image_url: file_url,
        total_amount: netAmount,
        notes,
      });

      if (netAmount !== 0) {
        await base44.entities.Ledger.create({
          store_id: storeId,
          store_name: store?.name || '',
          transaction_type: netAmount > 0 ? 'debit' : 'credit',
          amount: Math.abs(netAmount),
          date: new Date().toISOString().split('T')[0],
          notes: `Run #${run.run_number} - ${pickupAmount > 0 ? 'pickups' : ''}${pickupAmount > 0 && returnAmount > 0 ? ' & ' : ''}${returnAmount > 0 ? 'returns' : ''}`,
          run_number: run.run_number,
        });
      }

      for (const item of runItems) {
        const newStatus = item.picked_qty > 0 ? (item.type === 'return' ? 'returned' : 'picked') : 'not_found';
        await base44.entities.RunItem.update(item.id, { status: newStatus });
        
        if (item.type === 'pickup') {
          const relatedOrderItems = await base44.entities.OrderItem.filter({ 
            barcode: item.barcode,
            run_id: runId 
          });
          for (const orderItem of relatedOrderItems) {
            await base44.entities.OrderItem.update(orderItem.id, { status: newStatus });
          }

          if (item.picked_qty > 0) {
            const products = await base44.entities.ProductCatalog.filter({ barcode: item.barcode });
            if (products.length > 0) {
              const product = products[0];
              const newInventory = Math.max(0, (product.inventory || 0) - item.picked_qty);
              await base44.entities.ProductCatalog.update(product.id, { inventory: newInventory });
            }
          }
        } else if (item.type === 'return' && item.original_return_id) {
          const returnStatus = item.picked_qty > 0 ? 'processed' : 'rejected';
          await base44.entities.Return.update(item.original_return_id, { 
            status: returnStatus,
            processed_at: new Date().toISOString(),
          });
          
          if (item.picked_qty > 0) {
            const products = await base44.entities.ProductCatalog.filter({ barcode: item.barcode });
            if (products.length > 0) {
              const product = products[0];
              const newInventory = (product.inventory || 0) + item.picked_qty;
              await base44.entities.ProductCatalog.update(product.id, { inventory: newInventory });
            }
          }
        }
      }

      toast.success(`Store confirmed - Net: $${netAmount.toFixed(2)}`);
      navigate(createPageUrl(`RunnerPickStore?runId=${runId}`));
    } catch (error) {
      toast.error('Failed to complete store');
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  }

  const totalTarget = runItems.reduce((sum, i) => sum + (i.target_qty || 0), 0);
  const totalPicked = runItems.reduce((sum, i) => sum + (i.picked_qty || 0), 0);
  const progress = totalTarget > 0 ? Math.round((totalPicked / totalTarget) * 100) : 0;

  const unpickedItems = runItems.filter(i => i.target_qty > 0 && (i.picked_qty || 0) === 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pb-32">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-[60px] z-40">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl(`RunnerPickStore?runId=${runId}`)}>
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <StoreIcon className="w-5 h-5 text-teal-600" />
              <h1 className="text-xl font-bold text-gray-900">{store?.name || 'Store'}</h1>
            </div>
            <p className="text-gray-500 text-sm">
              {totalPicked} / {totalTarget} items handled
            </p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
          <div 
            className="bg-teal-600 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items by Style */}
      <div className="p-4 space-y-6">
        {styleGroups.map(group => (
          <Card key={`${group.styleName}-${group.type}`} className="overflow-hidden">
            {/* Style Header */}
            <div className={`p-4 flex gap-4 ${group.type === 'return' ? 'bg-purple-50' : 'bg-gray-50'}`}>
              {group.imageUrl ? (
                <img 
                  src={group.imageUrl}
                  alt={group.styleName}
                  className="w-24 h-24 object-cover rounded-xl cursor-pointer"
                  onClick={() => setViewImage(group.imageUrl)}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-24 h-24 bg-gray-200 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-gray-400" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">{group.styleName}</h3>
                  {group.type === 'return' && (
                    <Badge className="bg-purple-100 text-purple-700">Return</Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {group.items.length} size{group.items.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* Size Items */}
            <CardContent className="p-0 divide-y">
              {group.items.map(item => {
                const isComplete = item.picked_qty >= item.target_qty;
                const isPartial = item.picked_qty > 0 && item.picked_qty < item.target_qty;
                const isZero = item.target_qty > 0 && (item.picked_qty || 0) === 0;

                return (
                  <div 
                    key={item.id}
                    className={`p-4 flex items-center justify-between ${
                      isComplete ? 'bg-green-50' : isZero ? 'bg-red-50' : ''
                    }`}
                  >
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        Size {item.size || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.type === 'return' ? 'Return' : 'Need'}: <span className="font-bold text-gray-700">{item.target_qty}</span>
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-12 h-12 rounded-xl"
                        onClick={() => {
                          if ((item.picked_qty || 0) === 1 && item.target_qty > 0) {
                            startHold(item);
                          } else {
                            updatePickedQty(item, -1);
                          }
                        }}
                        disabled={isSaving || (item.picked_qty || 0) === 0}
                      >
                        <Minus className="w-6 h-6" />
                      </Button>
                      
                      <span className={`text-3xl font-bold w-12 text-center ${
                        isComplete ? 'text-green-600' : isZero ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {item.picked_qty || 0}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="w-12 h-12 rounded-xl"
                        onClick={() => updatePickedQty(item, 1)}
                        disabled={isSaving}
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg">
        <Button 
          onClick={() => {
            const isPartial = runItems.some(i => i.picked_qty > 0 && i.picked_qty < i.target_qty);
            if (isPartial) {
              const confirmMsg = "Some items are partially picked. Do you want to continue?";
              if (!window.confirm(confirmMsg)) return;
            }
            setShowComplete(true);
          }}
          className="w-full h-14 text-lg font-bold bg-teal-600 hover:bg-teal-700"
        >
          <CheckCircle2 className="w-6 h-6 mr-2" />
          Finish Store
        </Button>
      </div>

      {/* Confirm Zero Dialog */}
      <Dialog open={!!showConfirmZero} onOpenChange={cancelHold}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-6 h-6" />
              Confirm Unavailable
            </DialogTitle>
            <DialogDescription>
              This item was NOT {showConfirmZero?.type === 'return' ? 'returned' : 'found'} at the store.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-center text-gray-600 mb-4">
              <strong>{showConfirmZero?.style_name}</strong><br />
              Size: {showConfirmZero?.size}
            </p>
            <div className="relative">
              <Button 
                className="w-full h-16 bg-amber-500 hover:bg-amber-600"
                onMouseDown={() => startHold(showConfirmZero)}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={() => startHold(showConfirmZero)}
                onTouchEnd={cancelHold}
              >
                HOLD TO CONFIRM
              </Button>
              <div 
                className="absolute bottom-0 left-0 h-1 bg-amber-700 transition-all duration-100"
                style={{ width: `${holdProgress}%` }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Store Dialog */}
      <Dialog open={showComplete} onOpenChange={setShowComplete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Store</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Warnings */}
            {unpickedItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium text-amber-800 mb-2">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  {unpickedItems.length} items not handled:
                </p>
                <ul className="text-sm text-amber-700 space-y-1">
                  {unpickedItems.slice(0, 5).map(item => (
                    <li key={item.id}>• {item.style_name} - Size {item.size} ({item.type})</li>
                  ))}
                  {unpickedItems.length > 5 && (
                    <li>• ...and {unpickedItems.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Items Handled:</span>
                <span className="font-bold">{totalPicked} / {totalTarget}</span>
              </div>
            </div>

            {/* Receipt Upload */}
            <div>
              <p className="font-medium text-gray-700 mb-2">Upload Receipt Photo *</p>
              <input 
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleImageSelect}
                ref={fileInputRef}
                className="hidden"
              />
              
              {receiptPreview ? (
                <div className="relative">
                  <img 
                    src={receiptPreview}
                    alt="Receipt"
                    className="w-full h-48 object-cover rounded-xl"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setReceiptImage(null);
                      setReceiptPreview(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-center">
                    <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <span className="text-gray-600">Take Photo or Upload</span>
                  </div>
                </Button>
              )}
            </div>

            {/* Notes */}
            <div>
              <p className="font-medium text-gray-700 mb-2">Notes (optional)</p>
              <Textarea
                placeholder="Add any notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplete(false)}>
              Cancel
            </Button>
            <Button 
              onClick={completeStore}
              disabled={isUploading || !receiptImage}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirm & Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Product Image</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img 
              src={viewImage}
              alt="Product"
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}