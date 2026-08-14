import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/ui/AuthLayout';
import InputField from '../components/ui/InputField';
import { isValidEmailFormat } from '../utils/authUtils';
import styles from './AuthPages.module.css';

function ForgotPasswordPage() {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [shake, setShake] = useState(false);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
    setEmailErr('');
  };

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setEmailErr('College email is required.');
      return;
    }
    if (!isValidEmailFormat(email)) {
      setEmailErr('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/user/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Send email as state so Reset page knows which email to reset
        navigate('/reset-password', { state: { email: email.toLowerCase() } });
      } else {
        triggerError(data.error || 'Failed to request password reset');
      }
    } catch (err) {
      console.error(err);
      triggerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your registered college email to receive a 6-digit reset code."
    >
      <form onSubmit={handleSubmit} className={styles.authForm}>
        {error && (
          <div className={`${styles.errorAlert} ${shake ? styles.shake : ''}`}>
            ⚠️ {error}
          </div>
        )}

        <InputField
          label="College Email"
          type="email"
          id="email"
          placeholder="your.name@college.edu"
          value={email}
          onChange={handleEmailChange}
          error={emailErr}
          required
        />

        <button 
          type="submit" 
          className={styles.submitBtn} 
          disabled={loading}
        >
          {loading ? 'Sending Code...' : 'Send Reset Code'}
        </button>

        <p className={styles.authSwitchText}>
          Remembered your password?{' '}
          <Link to="/login" className={styles.authSwitchLink}>
            Back to Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
