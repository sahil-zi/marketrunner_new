import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { Truck, Loader2, AlertCircle, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCurrentUser } from '@/hooks/use-current-user';

export default function RunnerLogin() {
  const [pin, setPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { data: user, isLoading: authLoading } = useCurrentUser();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate(createPageUrl('RunnerHome'));
    }
  }, [user, navigate]);

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
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  async function verifyPin(enteredPin) {
    setIsVerifying(true);
    setError('');

    try {
      // Redirect to the login page for email/password auth
      navigate('/Login');
    } catch (err) {
      setError('Invalid PIN. Please try again.');
      setPin('');
    } finally {
      setIsVerifying(false);
    }
  }

  const isDisabled = isVerifying || pin.length >= 4;

  // Show a centered spinner while checking auth status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/20 to-background flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <motion.div
        className="mb-8 text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-20 h-20 bg-card rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-border">
          <Truck className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">MarketRunner</h1>
        <p className="text-muted-foreground mt-2">Enter your PIN to continue</p>
      </motion.div>

      {/* PIN Display */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full max-w-sm mb-6"
      >
        <Card className="border-border bg-card">
          <CardContent className="p-6">
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map((i) => {
                const filled = i < pin.length;
                return (
                  <motion.div
                    key={i}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-colors ${
                      filled
                        ? 'bg-primary/20 border-primary text-primary'
                        : 'bg-muted border-border text-muted-foreground'
                    }`}
                    animate={
                      filled
                        ? { scale: [1, 1.15, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.2 }}
                  >
                    <AnimatePresence mode="wait">
                      {filled && (
                        <motion.span
                          key={`dot-${i}`}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          &#8226;
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {isVerifying && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* PIN Pad */}
      <motion.div
        className="grid grid-cols-3 gap-3 w-full max-w-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <Button
            key={digit}
            variant="secondary"
            onClick={() => handlePinInput(String(digit))}
            disabled={isDisabled}
            aria-label={`Digit ${digit}`}
            className="h-16 text-2xl font-bold bg-card hover:bg-muted text-foreground shadow-md border border-border"
          >
            {digit}
          </Button>
        ))}

        <Button
          variant="secondary"
          onClick={handleClear}
          disabled={isVerifying}
          aria-label="Clear PIN"
          className="h-16 text-lg font-medium bg-card hover:bg-muted text-muted-foreground shadow-md border border-border"
        >
          Clear
        </Button>

        <Button
          variant="secondary"
          onClick={() => handlePinInput('0')}
          disabled={isDisabled}
          aria-label="Digit 0"
          className="h-16 text-2xl font-bold bg-card hover:bg-muted text-foreground shadow-md border border-border"
        >
          0
        </Button>

        <Button
          variant="secondary"
          onClick={handleBackspace}
          disabled={isVerifying || pin.length === 0}
          aria-label="Backspace"
          className="h-16 text-lg font-medium bg-card hover:bg-muted text-muted-foreground shadow-md border border-border"
        >
          <Delete className="w-5 h-5" />
        </Button>
      </motion.div>

      {/* Alternative Login */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        <Button
          variant="ghost"
          onClick={() => navigate('/Login')}
          aria-label="Use email login instead"
          className="mt-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          Use email login instead
        </Button>
      </motion.div>
    </div>
  );
}
