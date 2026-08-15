import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer style={{
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(0,0,0,0.05)',
      padding: '40px 20px',
      marginTop: 'auto',
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: '24px',
        marginBottom: '20px'
      }}>
        <Link to="/about" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>About Us</Link>
        <Link to="/contact" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Contact Us</Link>
        <Link to="/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Terms & Conditions</Link>
        <Link to="/refund-policy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: '500' }}>Refund & Cancellation</Link>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
        © {new Date().getFullYear()} beHonest. All rights reserved.
      </p>
    </footer>
  );
}

export default Footer;
