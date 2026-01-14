import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Truck, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RunnerLogin() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const user = await base44.auth.me();
      if (user) {
        navigate(createPageUrl('RunnerHome'));
      }
    } catch (e) {
      // Not logged in, stay on login page
    }
  }

  const handlePinInput = (digit) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError('');
      
      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  async function verifyPin(enteredPin) {
    setIsLoading(true);
    setError('');
    
    try {
      // In a real implementation, this would verify against backend
      // For now, redirect to login flow
      base44.auth.redirectToLogin(createPageUrl('RunnerHome'));
    } catch (error) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-500 to-teal-600 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Truck className="w-10 h-10 text-teal-600" />
        </div>
        <h1 className="text-3xl font-bold text-white">MarketRunner</h1>
        <p className="text-teal-100 mt-2">Enter your PIN to continue</p>
      </div>

      {/* PIN Display */}
      <Card className="w-full max-w-sm mb-6">
        <CardContent className="p-6">
          <div className="flex justify-center gap-4 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  i < pin.length
                    ? 'bg-teal-50 border-teal-500 text-teal-600'
                    : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {i < pin.length ? '•' : ''}
              </div>
            ))}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIN Pad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-sm">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            variant="secondary"
            onClick={() => handlePinInput(String(digit))}
            disabled={isLoading || pin.length >= 4}
            className="h-16 text-2xl font-bold bg-white hover:bg-gray-100 text-gray-800 shadow-md"
          >
            {digit}
          </Button>
        ))}
        <Button
          variant="secondary"
          onClick={handleClear}
          disabled={isLoading}
          className="h-16 text-lg font-medium bg-white hover:bg-gray-100 text-gray-600 shadow-md"
        >
          Clear
        </Button>
        <Button
          variant="secondary"
          onClick={() => handlePinInput('0')}
          disabled={isLoading || pin.length >= 4}
          className="h-16 text-2xl font-bold bg-white hover:bg-gray-100 text-gray-800 shadow-md"
        >
          0
        </Button>
        <Button
          variant="secondary"
          onClick={handleBackspace}
          disabled={isLoading || pin.length === 0}
          className="h-16 text-lg font-medium bg-white hover:bg-gray-100 text-gray-600 shadow-md"
        >
          ←
        </Button>
      </div>

      {/* Alternative Login */}
      <Button
        variant="ghost"
        onClick={() => base44.auth.redirectToLogin(createPageUrl('RunnerHome'))}
        className="mt-8 text-white hover:bg-white/10"
      >
        Use email login instead
      </Button>
    </div>
  );
}