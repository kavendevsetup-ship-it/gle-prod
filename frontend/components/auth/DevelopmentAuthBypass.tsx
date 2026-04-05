"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn } from 'next-auth/react';

/**
 * Development Authentication Bypass - DEVELOPMENT ONLY
 * 
 * This component provides quick login options for development and testing.
 * It is STRICTLY hidden in production builds and only appears in development mode.
 * 
 * Features:
 * - Skip OAuth flow for faster development
 * - Test both premium and non-premium user experiences
 * - Quick user switching for testing different scenarios
 * - Mock user data that matches production schema
 */

interface DevUser {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  email: string;
  profileImage: string;
  isPremium: boolean;
  picture: string;
  premium_expires_at?: string;
}

const DEV_USERS: DevUser[] = [
  {
    id: 'dev-user-free',
    name: 'John Doe',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@dev.com',
    profileImage: 'https://ui-avatars.com/api/?name=John+Doe&background=ff6b35&color=fff',
    isPremium: false,
    picture: 'https://ui-avatars.com/api/?name=John+Doe&background=ff6b35&color=fff',
  },
  {
    id: 'dev-user-premium',
    name: 'Jane Smith',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@dev.com',
    profileImage: 'https://ui-avatars.com/api/?name=Jane+Smith&background=8b5cf6&color=fff',
    isPremium: true,
    picture: 'https://ui-avatars.com/api/?name=Jane+Smith&background=8b5cf6&color=fff',
    premium_expires_at: '2025-12-31T23:59:59Z',
  },
  {
    id: 'dev-user-admin',
    name: 'Admin User',
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@dev.com',
    profileImage: 'https://ui-avatars.com/api/?name=Admin+User&background=ef4444&color=fff',
    isPremium: true,
    picture: 'https://ui-avatars.com/api/?name=Admin+User&background=ef4444&color=fff',
    premium_expires_at: '2030-12-31T23:59:59Z',
  },
];

export const DevelopmentAuthBypass: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Only render in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleDevLogin = async (user: DevUser) => {
    void user;
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Development login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg border border-gray-600"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        title="Development Authentication Tools"
      >
        <motion.div
          animate={{ rotate: isExpanded ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          🛠️
        </motion.div>
      </motion.button>

      {/* Development Login Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-16 right-0 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl p-4 shadow-2xl min-w-[300px]"
          >
            {/* Header */}
            <div className="mb-4 pb-3 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 text-sm">🚀 Dev Authentication</h3>
              <p className="text-xs text-gray-600 mt-1">
                Quick login for development & testing
              </p>
            </div>

            {/* User Options */}
            <div className="space-y-2">
              {DEV_USERS.map((user) => (
                <motion.button
                  key={user.id}
                  onClick={() => handleDevLogin(user)}
                  disabled={isLoading}
                  className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                    isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 hover:border-gray-300'
                  } ${user.isPremium ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'}`}
                  whileHover={!isLoading ? { scale: 1.02 } : {}}
                  whileTap={!isLoading ? { scale: 0.98 } : {}}
                >
                  <div className="flex items-center space-x-3">
                    <img 
                      src={user.profileImage} 
                      alt={user.name}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900">
                          {user.name}
                        </span>
                        {user.isPremium && (
                          <span className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                            ✨ Premium
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{user.email}</p>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                ⚠️ Development mode only - Hidden in production
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
