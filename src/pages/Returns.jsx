import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { 
  PackageX, 
  Search, 
  Filter, 
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function Returns() {
  const [returns, setReturns] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStore, setFilterStore] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewReturn, setViewReturn] = useState(null);
  const [processingReturn, setProcessingReturn] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [returnsData, storesData] = await Promise.all([
        base44.entities.Return.list('-created_date'),
        base44.entities.Store.list(),
      ]);
      setReturns(returnsData);
      setStores(storesData);
    } catch (error) {
      toast.error('Failed to load returns');
    } finally {
      setIsLoading(false);
    }
  }

  const filteredReturns = returns.filter(ret => {
    const matchesStore = filterStore === 'all' || ret.store_id === filterStore;
    const matchesStatus = filterStatus === 'all' || ret.status === filterStatus;
    const matchesSearch = 
      ret.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.style_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ret.store_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStore && matchesStatus && matchesSearch;
  });

  async function processReturn(returnId, status) {
    setProcessingReturn(returnId);
    try {
      const returnItem = returns.find(r => r.id === returnId);
      
      await base44.entities.Return.update(returnId, {
        status,
        processed_at: new Date().toISOString(),
      });

      // If approved, create a credit ledger entry
      if (status === 'processed' && returnItem.return_amount) {
        await base44.entities.Ledger.create({
          store_id: returnItem.store_id,
          store_name: returnItem.store_name,
          transaction_type: 'credit',
          amount: returnItem.return_amount,
          date: new Date().toISOString().split('T')[0],
          notes: `Return credit: ${returnItem.style_name} (${returnItem.quantity}x)`,
        });
      }

      toast.success(`Return ${status}`);
      loadData();
    } catch (error) {
      toast.error('Failed to process return');
    } finally {
      setProcessingReturn(null);
    }
  }

  const statusConfig = {
    pending: { color: 'bg-amber-100 text-amber-700', icon: Clock, label: 'Pending' },
    processed: { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Processed' },
    rejected: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Rejected' },
  };

  const reasonLabels = {
    damaged: 'Damaged',
    wrong_item: 'Wrong Item',
    customer_return: 'Customer Return',
    quality_issue: 'Quality Issue',
    other: 'Other',
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
        <p className="text-gray-500 mt-1">Manage product returns from stores</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by barcode, product, or store..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStore} onValueChange={setFilterStore}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <PackageX className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No returns found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReturns.map(ret => {
                  const status = statusConfig[ret.status] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  
                  return (
                    <TableRow key={ret.id}>
                      <TableCell>
                        {ret.created_date 
                          ? new Date(ret.created_date).toLocaleDateString()
                          : '—'
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{ret.store_name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{ret.style_name}</TableCell>
                      <TableCell>{ret.size || '—'}</TableCell>
                      <TableCell className="text-right">{ret.quantity}</TableCell>
                      <TableCell>{reasonLabels[ret.reason] || ret.reason}</TableCell>
                      <TableCell className="text-right font-medium">
                        ${ret.return_amount?.toFixed(2) || '0.00'}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewReturn(ret)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {ret.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => processReturn(ret.id, 'processed')}
                                disabled={processingReturn === ret.id}
                                className="text-green-600 hover:text-green-700"
                              >
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => processReturn(ret.id, 'rejected')}
                                disabled={processingReturn === ret.id}
                                className="text-red-600 hover:text-red-700"
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Return Dialog */}
      <Dialog open={!!viewReturn} onOpenChange={() => setViewReturn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Details</DialogTitle>
          </DialogHeader>
          {viewReturn && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Store</p>
                  <p className="font-medium">{viewReturn.store_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Product</p>
                  <p className="font-medium">{viewReturn.style_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Size</p>
                  <p className="font-medium">{viewReturn.size || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Quantity</p>
                  <p className="font-medium">{viewReturn.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="font-medium">{reasonLabels[viewReturn.reason]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-medium text-teal-600">
                    ${viewReturn.return_amount?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
              {viewReturn.notes && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-sm">{viewReturn.notes}</p>
                </div>
              )}
              {viewReturn.image_url && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Photo</p>
                  <img 
                    src={viewReturn.image_url}
                    alt="Return item"
                    className="w-full h-48 object-cover rounded-lg cursor-pointer"
                    onClick={() => window.open(viewReturn.image_url, '_blank')}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewReturn(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}