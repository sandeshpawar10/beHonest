/* ============================================================
   InputField.jsx — Reusable Form Input Component
   Features: icon support, validation states, password toggle
   Props:
     label        - Label text above the input
     id           - Input element ID (also used by label's htmlFor)
     type         - Input type (text, email, password, etc.)
     value        - Controlled value (from useState)
     onChange     - Change handler
     placeholder  - Placeholder text
     error        - Error message string (shows error state)
     success      - Boolean for success state styling
     icon         - Left-side icon (emoji or string)
     hint         - Small hint text below the input
     showToggle   - If true, adds a password visibility toggle button
     ...rest      - Any additional props forwarded to <input>
   ============================================================ */

import { useState } from 'react';
import styles from './InputField.module.css';

function InputField({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  success,
  icon,
  hint,
  showToggle = false,
  ...rest  // Forward extra props (maxLength, autoComplete, required, etc.)
}) {

  // Track whether password is currently visible (for toggle button)
  const [isVisible, setIsVisible] = useState(false);

  // Determine the actual input type
  // If toggle is enabled and isVisible = true → show as 'text'
  const inputType = showToggle
    ? (isVisible ? 'text' : 'password')
    : type;

  // Build className based on validation state
  const inputClass = [
    styles.input,
    icon ? styles.hasIconLeft : '',       // Extra left padding if icon present
    showToggle ? styles.hasIconRight : '', // Extra right padding if toggle present
    error ? styles.error : '',             // Red border on error
    success && !error ? styles.success : '', // Green border on success
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.group}>

      {/* Label */}
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}

      {/* Input wrapper (for icon positioning) */}
      <div className={styles.wrapper}>

        {/* Left icon (emoji/symbol) */}
        {icon && (
          <span className={styles.iconLeft} aria-hidden="true">
            {icon}
          </span>
        )}

        {/* The actual input field */}
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={inputClass}
          aria-invalid={!!error}             /* Accessibility: marks field as invalid */
          aria-describedby={
            error ? `${id}-error` :
            hint  ? `${id}-hint`  : undefined
          }
          {...rest} // Spread any extra props
        />

        {/* Password toggle button (eye icon) */}
        {showToggle && (
          <button
            type="button"
            className={styles.toggleBtn}
            onClick={() => setIsVisible(v => !v)} /* Toggle visibility state */
            aria-label={isVisible ? 'Hide password' : 'Show password'}
            title={isVisible ? 'Hide password' : 'Show password'}
          >
            {isVisible ? '🙈' : '👁️'}
          </button>
        )}

      </div>

      {/* Error message (shown when error prop is provided) */}
      {error && (
        <p id={`${id}-error`} className={styles.errorText} role="alert">
          ⚠️ {error}
        </p>
      )}

      {/* Hint text (shown only when no error) */}
      {hint && !error && (
        <p id={`${id}-hint`} className={styles.hint}>
          ℹ️ {hint}
        </p>
      )}

    </div>
  );
}

export default InputField;
