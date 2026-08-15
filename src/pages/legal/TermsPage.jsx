import React from 'react';

function TermsPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '80px auto 40px', padding: '20px' }}>
      <h1 style={{ color: 'var(--accent-cyan)', marginBottom: '20px' }}>Terms and Conditions</h1>
      <div style={{ lineHeight: '1.7', color: 'var(--text-primary)' }}>
        <p><strong>Last Updated:</strong> August 2026</p>
        
        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>1. Acceptance of Terms</h3>
        <p>By accessing and using beHonest, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>2. Description of Service</h3>
        <p>beHonest is a platform that facilitates the return of lost items by connecting finders with owners. We provide an AI-driven verification system and an escrow payment service to ensure secure transactions.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>3. User Responsibilities</h3>
        <p>You are responsible for any activity that occurs under your account. You agree to provide accurate and complete information when reporting or claiming an item. False claims, fraudulent activity, or attempts to misuse the escrow system will result in immediate account termination.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>4. Payments and Escrow</h3>
        <p>All payments made on the platform are held in a secure escrow account via Razorpay. Funds will only be released to the finder upon confirmation of the item's return by the owner. In the event of a dispute, beHonest administrators reserve the right to review the case and make a final determination regarding the release or refund of the funds.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>5. Limitation of Liability</h3>
        <p>beHonest acts solely as an intermediary platform. We do not guarantee the condition of returned items and are not liable for any damages, losses, or disputes arising from the physical meetup between users.</p>
      </div>
    </div>
  );
}

export default TermsPage;
