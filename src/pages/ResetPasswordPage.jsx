import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/ui/AuthLayout';
import InputField from '../components/ui/InputField';
import ButtonSpinner from '../components/ui/ButtonSpinner';
import styles from './AuthPages.module.css';

function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email] = useState(location.state?.email || '');

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If the user didn't come from the ForgotPassword page, redirect them back
    if (!location.state?.email) {
      navigate('/forgot-password');
    }
  }, [location, navigate]);

  const triggerError = (msg) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleOtpChange = (e) => {
    setOtp(e.target.value.replace(/\D/g, '')); // only allow digits
    setError('');
  };

  const handlePasswordChange = (e) => {
    setNewPassword(e.target.value);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) {
      triggerError('OTP must be exactly 6 digits.');
      return;
    }
    if (newPassword.length < 8) {
      triggerError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/user/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        // Automatically redirect to login after 3 seconds
        setTimeout(() => navigate('/login'), 3000);
      } else {
        triggerError(data.error || 'Failed to reset password');
      }
    } catch (err) {
      console.error(err);
      triggerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout title="Success!" subtitle="Your password has been successfully reset.">
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <p>You can now log in with your new password.</p>
          <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>Redirecting to login...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create New Password"
      subtitle={`Enter the 6-digit code sent to ${email} and your new password.`}
    >
      <form onSubmit={handleSubmit} className={styles.authForm}>
        {error && (
          <div className={`${styles.errorAlert} ${shake ? styles.shake : ''}`}>
            ⚠️ {error}
          </div>
        )}

        <InputField
          label="6-Digit Code"
          type="text"
          id="otp"
          placeholder="123456"
          value={otp}
          onChange={handleOtpChange}
          maxLength={6}
          required
        />

        <InputField
          label="New Password"
          type="password"
          id="newPassword"
          placeholder="Min. 8 characters"
          value={newPassword}
          onChange={handlePasswordChange}
          required
        />

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? <><ButtonSpinner /> Updating...</> : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
