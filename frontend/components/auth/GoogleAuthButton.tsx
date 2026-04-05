"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { signIn } from 'next-auth/react';
import { TermsAcceptance } from './TermsAcceptance';

interface GoogleAuthButtonProps {
  className?: string;
  onError?: (error: string) => void;
  showTermsBelow?: boolean;
  showTermsOnly?: boolean;
  onTermsAccept?: (accepted: boolean) => void;
  termsAccepted?: boolean;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ 
  className = "", 
  onError,
  showTermsBelow = true,
  showTermsOnly = false,
  onTermsAccept,
  termsAccepted: externalTermsAccepted
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [internalTermsAccepted, setInternalTermsAccepted] = useState(false);

  // Use external terms state if provided, otherwise use internal
  const termsAccepted = externalTermsAccepted !== undefined ? externalTermsAccepted : internalTermsAccepted;
  const setTermsAccepted = onTermsAccept || setInternalTermsAccepted;

  const handleGoogleSignIn = () => {
    if (!termsAccepted) {
      onError?.('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }

    setIsLoading(true);
    signIn('google', { callbackUrl: '/dashboard' }).catch(() => {
      setIsLoading(false);
      onError?.('Failed to start Google Sign-In. Please try again.');
    });
  };

  if (showTermsOnly) {
    return (
      <div className="flex flex-col items-center">
        <div>
          <TermsAcceptance onAccept={setTermsAccepted} accepted={termsAccepted} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <motion.button 
        onClick={handleGoogleSignIn}
        disabled={isLoading || !termsAccepted}
        className={`bg-gradient-primary text-white px-4 sm:px-6 md:px-8 py-3 sm:py-4 rounded-xl font-semibold text-sm sm:text-base md:text-lg shadow-lg flex items-center justify-center gap-2 ${className} ${(isLoading || !termsAccepted) ? 'opacity-50 cursor-not-allowed' : ''}`}
        whileHover={!isLoading && termsAccepted ? { y: -5, boxShadow: "0 10px 25px -5px rgba(249, 115, 22, 0.4)" } : {}}
        whileTap={!isLoading && termsAccepted ? { y: 0, boxShadow: "0 5px 15px -5px rgba(249, 115, 22, 0.4)" } : {}}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 border-2 border-white border-t-transparent"></div>
            Signing in...
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" width="20" height="20" className="sm:w-6 sm:h-6 md:w-6 md:h-6" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Start Your Journey
          </>
        )}
      </motion.button>

      {(showTermsBelow || showTermsOnly) && (
        <div className={showTermsOnly ? "" : "mt-6"}>
          <TermsAcceptance onAccept={setTermsAccepted} accepted={termsAccepted} />
        </div>
      )}
    </div>
  );
};
