
function ContactPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '80px auto 40px', padding: '20px' }}>
      <h1 style={{ color: 'var(--accent-cyan)', marginBottom: '20px' }}>Contact Us</h1>
      <p style={{ marginBottom: '16px', lineHeight: '1.6' }}>
        We are here to help! If you have any questions, concerns, or need assistance with a claim or payment, please reach out to our support team.
      </p>
      
      <div style={{ background: 'rgba(255,255,255,0.7)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.05)', marginTop: '20px' }}>
        <h3 style={{ marginBottom: '16px' }}>Support Channels</h3>
        <p style={{ marginBottom: '8px' }}>
          <strong>Email:</strong> support.behonest@gmail.com
        </p>
        <p style={{ marginBottom: '8px' }}>
          <strong>Phone:</strong> +91-9850322232
        </p>
      </div>
      
      <p style={{ marginTop: '24px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        For disputes regarding escrow payments, please use the "Dispute" button directly from your Escrow Dashboard to ensure faster resolution.
      </p>
    </div>
  );
}

export default ContactPage;
