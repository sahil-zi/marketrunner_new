import React, { useState, useRef } from 'react';
import { updateOne, filterBy, uploadFile } from '@/api/supabase/helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Camera, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EditPaymentDialog({ 
  confirmation, 
  isOpen, 
  onClose, 
  onSuccess 
}) {
  const [amount, setAmount] = useState(confirmation?.total_amount || '');
  const [notes, setNotes] = useState(confirmation?.notes || '');
  const [newReceipt, setNewReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

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

    setNewReceipt(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  async function handleSave() {
    if (!amount || parseFloat(amount) < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsSaving(true);
    try {
      const updatedData = {
        total_amount: parseFloat(amount),
        notes,
      };

      // Upload new receipt if provided
      if (newReceipt) {
        const { file_url } = await uploadFile('receipts', newReceipt);
        updatedData.receipt_image_url = file_url;
      }

      // Update confirmation
      await updateOne('run_confirmations', confirmation.id, updatedData);

      // Update corresponding ledger entry
      const ledgerEntries = await filterBy('ledger', {
        run_confirmation_id: confirmation.id
      });

      if (ledgerEntries.length > 0) {
        const oldAmount = confirmation.total_amount;
        const newAmount = parseFloat(amount);
        const difference = newAmount - oldAmount;

        if (difference !== 0) {
          // Update the original ledger entry
          await updateOne('ledger', ledgerEntries[0].id, {
            amount: newAmount,
            notes: `${ledgerEntries[0].notes} (Updated from $${oldAmount.toFixed(2)})`
          });
        }
      }

      toast.success('Payment updated successfully');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to update payment');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Store Payment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="amount">Payment Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label>Current Receipt</Label>
            {confirmation?.receipt_image_url && (
              <img 
                src={confirmation.receipt_image_url}
                alt="Current receipt"
                className="w-full h-32 object-cover rounded-lg mt-2"
              />
            )}
          </div>

          <div>
            <Label>Upload New Receipt (optional)</Label>
            <input 
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageSelect}
              ref={fileInputRef}
              className="hidden"
            />
            
            {receiptPreview ? (
              <div className="relative mt-2">
                <img 
                  src={receiptPreview}
                  alt="New receipt"
                  className="w-full h-32 object-cover rounded-lg"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setNewReceipt(null);
                    setReceiptPreview(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full h-24 border-dashed mt-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-center">
                  <Camera className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                  <span className="text-sm text-gray-600">Upload New Receipt</span>
                </div>
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this payment update..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Update Payment'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}