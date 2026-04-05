"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { SimpleModal } from '../ui/SimpleModal';
import { TermsContent } from '../content/TermsContent';
import { PrivacyContent } from '../content/PrivacyContent';

interface TermsAcceptanceProps {
  onAccept: (accepted: boolean) => void;
  accepted: boolean;
}

export const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({ 
  onAccept, 
  accepted 
}) => {
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onAccept(e.target.checked);
  };

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center space-x-3"
      >
        <input
          type="checkbox"
          id="terms-checkbox"
          checked={accepted}
          onChange={handleCheckboxChange}
          className="h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded cursor-pointer"
        />
        <label 
          htmlFor="terms-checkbox" 
          className="text-sm sm:text-base text-gray-700 leading-relaxed cursor-pointer select-none"
        >
          I agree to the{' '}
          <button
            type="button"
            onClick={() => setShowTermsModal(true)}
            className="text-orange-600 hover:text-orange-700 underline font-medium transition-colors"
          >
            Terms & Conditions
          </button>
          {' '}and{' '}
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="text-orange-600 hover:text-orange-700 underline font-medium transition-colors"
          >
            Privacy Policy
          </button>
        </label>
      </motion.div>

      {/* Terms & Conditions Modal */}
      <SimpleModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Terms & Conditions"
      >
        <TermsContent />
      </SimpleModal>

      {/* Privacy Policy Modal */}
      <SimpleModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Privacy Policy"
      >
        <PrivacyContent />
      </SimpleModal>
    </>
  );
};
