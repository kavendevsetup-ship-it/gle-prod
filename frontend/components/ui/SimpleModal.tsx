"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const SimpleModal: React.FC<SimpleModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children 
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management
  const setFocusToModal = useCallback(() => {
    if (modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
      
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        modalRef.current.focus();
      }
    }
  }, []);

  // Body scroll lock and focus management
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Lock body scroll
      document.body.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
      
      // Set focus to modal
      setTimeout(setFocusToModal, 100);
    } else {
      // Restore body scroll
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      
      // Restore focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }

    return () => {
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
    };
  }, [isOpen, setFocusToModal]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = Array.from(
          modalRef.current.querySelectorAll(
            'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])'
          )
        ) as HTMLElement[];
        
        if (focusableElements.length === 0) return;
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Backdrop click handler
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[99999] bg-black/55 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
          onClick={handleBackdropClick}
        >
          <div className="min-h-full flex items-center justify-center">
            <motion.div
              ref={modalRef}
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="relative w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-3xl border border-white/35 bg-white/80 shadow-2xl backdrop-blur-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby="modal-body"
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 z-10 border-b border-white/50 bg-white/75 px-5 sm:px-6 py-4 backdrop-blur-xl flex items-center justify-between">
                <h2
                  id="modal-title"
                  className="text-lg sm:text-xl font-bold text-gray-900 pr-3"
                >
                  {title}
                </h2>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100/80 transition-colors duration-200 flex items-center justify-center min-w-[40px] min-h-[40px]"
                  aria-label={`Close ${title}`}
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>

              <div
                id="modal-body"
                className="overflow-y-auto max-h-[calc(80vh-72px)] px-5 sm:px-6 py-5 sm:py-6"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain'
                }}
              >
                {children}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 