import React from 'react';

function RefundPolicyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '80px auto 40px', padding: '20px' }}>
      <h1 style={{ color: 'var(--accent-cyan)', marginBottom: '20px' }}>Refund & Cancellation Policy</h1>
      
      <div style={{ lineHeight: '1.7', color: 'var(--text-primary)' }}>
        <p>At beHonest, we strive to ensure that all transactions are fair and secure. Our escrow system is designed to protect both the owner and the finder.</p>
        
        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>1. Escrow Refunds</h3>
        <p>If you (the owner) deposit a reward into escrow but the finder fails to return the item, or the item returned is incorrect, you may cancel the transaction and request a full refund from your Escrow Dashboard.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>2. Disputes</h3>
        <p>If a finder claims to have returned the item but the owner disputes this, the funds will be frozen in escrow. Our support team will investigate the chat logs and evidence provided by both parties. If the dispute is resolved in favor of the owner, a 100% refund will be issued.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>3. Processing Time</h3>
        <p>Approved refunds are processed immediately on our end. However, depending on your bank or payment provider, it may take <strong>5 to 7 business days</strong> for the funds to reflect in your original payment method.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>4. Non-Refundable Scenarios</h3>
        <p>Once you (the owner) click the "Release Reward" button, the funds are instantly transferred to the finder. This action is final and irreversible. We cannot issue refunds for rewards that have already been released.</p>
        
        <p style={{ marginTop: '24px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
          For any payment-related issues, please contact us at support@behonest.app.
        </p>
      </div>
    </div>
  );
}

export default RefundPolicyPage;
