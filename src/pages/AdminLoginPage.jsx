import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AdminLoginPage.module.css';

function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      const data = await response.json();
      
      setLoading(false);

      if (response.ok) {
        navigate('/admin', { replace: true });
      } else {
        setError(data.message || 'Login failed');
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch (err) {
      setLoading(false);
      setError('Failed to connect to the server.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div className={styles.page}>
      <div className={`${styles.card} ${shake ? styles.shake : ''}`}>
        <div className={styles.header}>
          <span className={styles.icon}>🛡️</span>
          <h1 className={styles.heading}>beHonest Admin Portal</h1>
        </div>
        <p className={styles.subtitle}>Sign in to manage the platform.</p>

        {error && (
          <div className={styles.alert} role="alert">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className={styles.form} noValidate>
          <div className={styles.inputGroup}>
            <label htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="admin@behonest.com"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password"
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? <><span className={styles.spinner}></span> Authenticating...</> : 'Login as Admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AdminLoginPage;
