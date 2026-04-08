"use client";

import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, Users, TrendingUp, Award } from 'lucide-react';
import { GoogleAuthButton } from '../auth';
import { TermsAcceptance } from '../auth/TermsAcceptance';
import { DevelopmentAuthBypass } from '../auth/DevelopmentAuthBypass';

// Enhanced animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3
    }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }
  }
};

export const LandingPage: React.FC = () => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 300], [0, -50]);
  const y2 = useTransform(scrollY, [0, 300], [0, -25]);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden pt-8">
      {/* Enhanced Multi-layer Background without heavy blur */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-red-50 to-pink-50" />
        <div className="absolute inset-0 bg-gradient-to-tr from-orange-100/30 via-transparent to-red-100/30" />
        
        {/* Floating gradient orbs - no heavy backdrop blur */}
        <motion.div 
          className="absolute top-20 right-16 w-64 h-64 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full filter blur-3xl"
          style={{ y: y1 }}
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute bottom-32 left-20 w-48 h-48 bg-gradient-to-br from-pink-400/25 to-purple-400/20 rounded-full filter blur-2xl"
          style={{ y: y2 }}
          animate={{ scale: [1, 0.8, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/3 w-32 h-32 bg-gradient-to-br from-blue-400/15 to-cyan-400/15 rounded-full filter blur-xl"
          animate={{ scale: [1, 1.3, 1], x: [-10, 10, -10], y: [-5, 5, -5] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Minimal floating particles with enhanced effects */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <motion.div
          className="absolute top-1/4 left-1/4 w-2 h-2 bg-orange-400/40 rounded-full"
          animate={{ 
            y: [-20, 20, -20], 
            opacity: [0.2, 0.6, 0.2],
            scale: [1, 1.2, 1]
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-3/4 right-1/4 w-3 h-3 bg-red-400/30 rounded-full"
          animate={{ 
            y: [20, -20, 20], 
            opacity: [0.1, 0.5, 0.1],
            x: [-5, 5, -5]
          }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-pink-400/50 rounded-full"
          animate={{ 
            y: [-15, 15, -15], 
            opacity: [0.3, 0.8, 0.3],
            rotate: [0, 360, 0]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/3 w-2.5 h-2.5 bg-blue-400/25 rounded-full"
          animate={{ 
            x: [-10, 10, -10], 
            opacity: [0.2, 0.4, 0.2],
            scale: [0.8, 1.2, 0.8]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        
        {/* Additional modern particles */}
        <motion.div
          className="absolute top-3/4 left-1/4 w-1 h-1 bg-purple-400/60 rounded-full"
          animate={{ 
            y: [-25, 25, -25], 
            x: [0, 15, 0],
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.5, 1]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />
        <motion.div
          className="absolute top-1/6 right-1/6 w-2 h-2 bg-green-400/35 rounded-full"
          animate={{ 
            x: [-12, 12, -12], 
            y: [-8, 8, -8],
            opacity: [0.2, 0.6, 0.2],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        />
      </div>

      {/* Enhanced Hero Section */}
      <section className="relative min-h-screen flex items-center">
        <motion.div 
          className="container mx-auto px-6 sm:px-8 lg:px-12 py-20 relative"
          initial="hidden"
          animate={isVisible ? "visible" : "hidden"}
          variants={staggerContainer}
        >
          <div className="text-center relative max-w-6xl mx-auto">
            {/* Enhanced Logo Section with glass morphism */}
            <motion.div 
              className="flex justify-center mb-8 sm:mb-12"
              variants={scaleIn}
            >
              <div className="relative">
                <motion.div
                  className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl shadow-2xl flex items-center justify-center float-animation relative overflow-hidden"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />
                  <img 
                    src="/logo.jpg" 
                    alt="Grand League Expert" 
                    className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-2xl object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <span className="text-white font-bold text-2xl sm:text-3xl lg:text-4xl hidden">🏏</span>
                </motion.div>
                <motion.div
                  className="absolute -top-2 -right-2 w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center shadow-lg sparkle-enhanced"
                >
                  <Sparkles size={16} className="sm:w-5 sm:h-5 text-white" />
                </motion.div>
              </div>
            </motion.div>

            {/* Enhanced Title with better mobile scaling */}
            {/* Enhanced Title with animated gradient text */}
            <motion.h1 
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-4 sm:mb-6 leading-tight"
              variants={fadeInUp}
            >
              <span className="text-gray-900 block sm:inline">Grand League</span>
              <br className="hidden sm:block" />
              <span className="animated-gradient-text block sm:inline">Expert</span>
            </motion.h1>            {/* Enhanced Subtitle with glass background */}
            <motion.div
              className="relative mb-8 sm:mb-12"
              variants={fadeInUp}
            >
              <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg" />
              <p className="relative text-lg sm:text-xl md:text-2xl lg:text-3xl text-gray-700 py-6 px-8 max-w-5xl mx-auto leading-relaxed">
                KAIRO Intelligence System is a proprietary framework combining data analytics, real-time insights, and pattern intelligence to deliver high-probability fantasy outcomes.
              </p>
            </motion.div>

            {/* Enhanced Feature highlights with glass cards */}
            <motion.div 
              className="flex flex-wrap justify-center gap-4 sm:gap-6 lg:gap-8 mb-10 sm:mb-16 px-4 sm:px-0"
              variants={staggerContainer}
            >
              {[
                { icon: TrendingUp, text: "AI Analytics", fullText: "AI-Powered Analytics", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200/30" },
                { icon: Users, text: "Community", fullText: "Expert Community", color: "text-green-600", bg: "bg-green-500/10", border: "border-green-200/30" },
                { icon: Award, text: "Results", fullText: "Proven Results", color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-200/30" }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  className={`relative ${feature.bg} backdrop-blur-sm border ${feature.border} px-4 py-3 sm:px-6 sm:py-4 rounded-2xl flex items-center gap-3 shadow-lg`}
                  variants={fadeInUp}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <feature.icon size={20} className={`${feature.color} sm:w-6 sm:h-6`} />
                  <span className="text-sm sm:text-base font-semibold text-gray-700">
                    <span className="sm:hidden">{feature.text}</span>
                    <span className="hidden sm:inline">{feature.fullText}</span>
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Enhanced CTA Section with proper terms integration */}
            <motion.div 
              className="space-y-6 sm:space-y-8 px-4 sm:px-0"
              variants={staggerContainer}
            >
              {/* Terms Acceptance with enhanced styling */}
              <motion.div 
                className="flex items-center justify-center"
                variants={fadeInUp}
              >
                <div className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start space-x-4 text-sm md:text-base text-gray-700 max-w-md">
                    {/* <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" /> */}
                    <TermsAcceptance 
                      onAccept={setTermsAccepted}
                      accepted={termsAccepted}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Google Auth Button */}
              <motion.div 
                variants={fadeInUp} 
                className="flex justify-center"
              >
                <GoogleAuthButton 
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center gap-3 group min-h-[56px] text-lg border border-white/20 backdrop-blur-sm"
                  showTermsOnly={false}
                  showTermsBelow={false}
                  onTermsAccept={setTermsAccepted}
                  termsAccepted={termsAccepted}
                />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Enhanced Social Section - Clean and Minimalist */}
      <motion.section 
        className="relative py-16 sm:py-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        variants={staggerContainer}
      >
        
        
        <motion.div 
          className="relative container mx-auto px-6 sm:px-8"
          variants={fadeInUp}
        >
          <motion.div 
            className="flex justify-center gap-6 sm:gap-8 lg:gap-10"
            variants={staggerContainer}
          >
            {[
              { 
                name: 'YouTube', 
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                ),
                color: 'bg-red-500/80 hover:bg-red-500',
                url: 'https://www.youtube.com/channel/UC9KZVDcy9Q9CbFPcWHUFptA'
              },
              { 
                name: 'Facebook', 
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                ),
                color: 'bg-blue-600/80 hover:bg-blue-600',
                url: 'https://www.facebook.com/p/Grand-League-Expert-61551622325790/'
              },
              { 
                name: 'Instagram', 
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                ),
                color: 'bg-gradient-to-br from-purple-500/80 to-pink-500/80 hover:from-purple-500 hover:to-pink-500',
                url: 'https://www.instagram.com/grandleagueexpert/?locale=kk-KZ&hl=af'
              },
              { 
                name: 'Twitter', 
                icon: (
                  <svg viewBox="0 0 24 24" className="w-8 h-8 sm:w-10 sm:h-10" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                ),
                color: 'bg-slate-800/80 hover:bg-slate-800',
                url: '#'
              }
            ].map((social, index) => (
              <motion.a
                key={social.name}
                href={social.url}
                className="group relative"
                variants={fadeInUp}
                whileHover={{ y: -6, scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Modern glass morphism social icon */}
                <div className={`w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 ${social.color} backdrop-blur-xl border border-white/30 rounded-2xl shadow-xl flex items-center justify-center text-white cursor-pointer transition-all duration-300 group-hover:shadow-2xl`}>
                  {social.icon}
                </div>
                
                {/* Minimal hover tooltip */}
                <motion.div
                  className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-gray-900/90 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-[5]"
                  initial={{ opacity: 0, y: 4 }}
                  whileHover={{ opacity: 1, y: 0 }}
                >
                  {social.name}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900/90"></div>
                </motion.div>
              </motion.a>
            ))}
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Enhanced Floating Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <motion.div
          className="absolute top-1/4 left-1/4 w-2 h-2 bg-orange-400/40 rounded-full"
          animate={{ y: [-20, 20, -20], opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-3/4 right-1/4 w-3 h-3 bg-red-400/30 rounded-full"
          animate={{ y: [20, -20, 20], opacity: [0.1, 0.5, 0.1] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute top-1/2 right-1/3 w-1 h-1 bg-pink-400/50 rounded-full"
          animate={{ y: [-15, 15, -15], opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-blue-400/20 rounded-full"
          animate={{ x: [-10, 10, -10], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
      </div>

      {/* Development Authentication Bypass - Only in development */}
      <DevelopmentAuthBypass />
    </div>
  );
};