import React from 'react';

export const PrivacyContent: React.FC = () => {
  return (
    <div className="space-y-8 text-gray-700 leading-relaxed">
      {/* Last Updated */}
      <div className="text-center py-4 border-b border-gray-200 mb-8">
        <p className="text-gray-600 font-medium text-sm">
          Last updated: January 1, 2025
        </p>
      </div>
      
      {/* Privacy Sections */}
      <div className="space-y-8">
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">1</span>
            Information We Collect
          </h3>
          <p className="text-gray-700 pl-9">
            We collect information you provide directly to us, such as when you create an account, subscribe to our services, or contact us. This includes your name, email address, and payment information when applicable.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">2</span>
            How We Use Your Information
          </h3>
          <p className="text-gray-700 pl-9">
            We use the information we collect to provide, maintain, and improve our services, process transactions, send you important service announcements, and communicate with you about your account.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">3</span>
            Information Sharing
          </h3>
          <p className="text-gray-700 pl-9">
            We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this Privacy Policy or as required by law.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">4</span>
            Google OAuth Authentication
          </h3>
          <p className="text-gray-700 pl-9">
            We use Google OAuth for secure authentication. We only access your basic profile information (name and email address) as permitted by Google's privacy policies. We do not access any other Google services or data.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">5</span>
            Data Security
          </h3>
          <p className="text-gray-700 pl-9">
            We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. All data transmission is encrypted using industry-standard protocols.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">6</span>
            Cookies and Tracking
          </h3>
          <p className="text-gray-700 pl-9">
            We use cookies and similar technologies to enhance your experience on our platform, remember your preferences, and analyze usage patterns. You can control cookie settings through your browser preferences.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">7</span>
            Data Retention
          </h3>
          <p className="text-gray-700 pl-9">
            We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, comply with legal obligations, resolve disputes, and enforce our agreements.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">8</span>
            Your Rights
          </h3>
          <p className="text-gray-700 pl-9">
            You have the right to access, update, or delete your personal information. You may also opt out of certain communications and request data portability where applicable under local privacy laws.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">9</span>
            Changes to Privacy Policy
          </h3>
          <p className="text-gray-700 pl-9">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
          </p>
        </section>
        
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center">
            <span className="bg-orange-100 text-orange-700 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">10</span>
            Contact Us
          </h3>
          <p className="text-gray-700 pl-9 mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-200 ml-9">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Email:</span>
                <a 
                  href="mailto:privacy@grandleagueexpert.com" 
                  className="text-orange-600 hover:text-orange-700 underline font-medium"
                >
                  privacy@grandleagueexpert.com
                </a>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Website:</span>
                <a 
                  href="https://www.grandleagueexpert.com" 
                  className="text-orange-600 hover:text-orange-700 underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  www.grandleagueexpert.com
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}; 