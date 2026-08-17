function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: '800px', margin: '80px auto 40px', padding: '20px' }}>
      <h1 style={{ color: 'var(--accent-cyan)', marginBottom: '20px' }}>Privacy Policy</h1>
      <div style={{ lineHeight: '1.7', color: 'var(--text-primary)' }}>
        <p><strong>Last Updated:</strong> August 2026</p>
        
        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>1. Information We Collect</h3>
        <p>We collect information you provide directly to us, such as when you create or modify your account, report a lost item, claim an item, or communicate with other users. This includes your college email address, name, chat history, and uploaded images.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>2. How We Use Your Information</h3>
        <p>We use the information we collect to operate, maintain, and improve our services. Specifically, your data is used by our AI verification system to establish ownership of lost items, process escrow payments, and facilitate anonymous communication between finders and owners.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>3. Privacy and Anonymity</h3>
        <p>Your privacy is our priority. We automatically blur sensitive information in uploaded images using our AI and client-side processing. Your true identity and email address are kept hidden from other users during the initial chat and verification stages, only being revealed when a secure meeting is arranged.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>4. Data Security</h3>
        <p>We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Payment information is securely processed by Razorpay and is not stored on our servers.</p>

        <h3 style={{ marginTop: '24px', marginBottom: '12px' }}>5. Contact Us</h3>
        <p>If you have any questions or concerns about this Privacy Policy, please contact us at privacy@behonest.com.</p>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
