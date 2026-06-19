/* ============================================================
   ClaimItemPage.jsx
   Route: /claim/:itemId  (protected — must be logged in)

   PURPOSE:
   When a student thinks a found item belongs to them, they
   come to this page to "claim" it. The AI asks them 5 questions
   about the item, compares their answers with the stored data,
   and generates a confidence score.

   FLOW:
   1. Load the item data from localStorage using the URL param
   2. Show the item's BLURRED image (no cheating!)
   3. Ask the 5 verification questions one by one
   4. On submit → run verifyOwnership() → show results
   ============================================================ */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BlurableImage from '../components/ui/BlurableImage';
import { getFoundItemById, CATEGORY_CONFIG } from '../utils/itemUtils';
import {
  VERIFICATION_QUESTIONS,  // The 5 questions to ask
  verifyOwnership,         // The scoring function
  saveClaim,               // Save the claim result
} from '../utils/verificationUtils';
import styles from './ClaimItemPage.module.css';

function ClaimItemPage() {
  const { itemId }  = useParams();  // Get the item ID from the URL (/claim/:itemId)
  const navigate    = useNavigate();
  const { session } = useAuth();

  // ── State ─────────────────────────────────────────────────
  const [item, setItem]       = useState(null);     // The found item being claimed
  const [loading, setLoading] = useState(true);     // Page loading state
  const [step, setStep]       = useState('quiz');   // 'quiz' | 'result'

  /*
    answers: stores the claimant's answer for each question.
    Structure: { brand: "", color: "", uniqueMarks: "", lossLocation: "", lossDate: "" }
    We initialize it dynamically from VERIFICATION_QUESTIONS.
  */
  const [answers, setAnswers] = useState(() => {
    const initial = {};
    VERIFICATION_QUESTIONS.forEach(q => { initial[q.id] = ''; });
    return initial;
  });

  const [currentQ, setCurrentQ] = useState(0);     // Which question is currently shown (0–4)
  const [verifying, setVerifying] = useState(false); // "Analyzing..." loading state
  const [result, setResult]     = useState(null);    // Verification result from verifyOwnership()
  const [error, setError]       = useState('');

  // ── Load the item on mount ────────────────────────────────
  useEffect(() => {
    const foundItem = getFoundItemById(itemId); // Look up in localStorage

    if (!foundItem) {
      // Item doesn't exist — redirect back
      setError('Item not found.');
      setLoading(false);
      return;
    }

    // Prevent the finder from claiming their OWN item
    if (foundItem.foundBy === session?.email) {
      setError('You cannot claim an item you reported yourself.');
      setLoading(false);
      return;
    }

    setItem(foundItem);
    setLoading(false);
  }, [itemId, session]);

  // ── Handle answer change ──────────────────────────────────
  // Updates the answer for the current question
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,              // Keep all other answers
      [questionId]: value,  // Update just this one
    }));
  };

  // ── Go to next question ───────────────────────────────────
  const goNext = () => {
    if (currentQ < VERIFICATION_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
    }
  };

  // ── Go to previous question ───────────────────────────────
  const goBack = () => {
    if (currentQ > 0) {
      setCurrentQ(currentQ - 1);
    }
  };

  // ── Submit all answers for verification ───────────────────
  const handleSubmit = async () => {
    // Check that at least 3 questions have answers
    const answeredCount = VERIFICATION_QUESTIONS.filter(
      q => answers[q.id].trim().length > 0
    ).length;

    if (answeredCount < 3) {
      setError('Please answer at least 3 questions for the AI to verify ownership.');
      return;
    }

    setError('');
    setVerifying(true);

    // Simulate AI processing time (makes it feel real)
    await new Promise(r => setTimeout(r, 2000));

    // Run the verification scoring
    const verificationResult = verifyOwnership(item, answers);

    // Save the claim to localStorage
    saveClaim({
      itemId:       item.id,
      itemTitle:    item.title,
      claimantEmail: session.email,
      claimantName: session.fullName,
      answers,                             // What the claimant wrote
      result: verificationResult,          // Score + verdict
    });

    setResult(verificationResult);
    setStep('result');
    setVerifying(false);
    window.scrollTo(0, 0);
  };

  // ── Loading state ─────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.centerMsg}>
        <div className={styles.spinner} />
        <p>Loading item...</p>
      </div>
    );
  }

  // ── Error state (item not found or self-claim) ─────────────
  if (error && !item) {
    return (
      <div className={styles.centerMsg}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h2>{error}</h2>
        <Link to="/found-items" className={styles.linkBtn}>← Back to Found Items</Link>
      </div>
    );
  }

  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
  const currentQuestion = VERIFICATION_QUESTIONS[currentQ];

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ════════════════ QUIZ STEP ════════════════ */}
      {step === 'quiz' && (
        <>
          {/* Top bar */}
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => navigate('/found-items')}>
              ← Back
            </button>
            <h1 className={styles.pageTitle}>🤖 AI Ownership Verification</h1>
          </div>

          {/* Two-column layout: item preview + questions */}
          <div className={styles.layout}>

            {/* ── LEFT: Item preview card ── */}
            <div className={styles.itemPreview}>
              <div className={styles.previewCard}>

                {/* Blurred image — claimant sees the public view */}
                <BlurableImage
                  imageSrc={item.imageData}
                  blurZones={item.blurZones}
                  alt={item.title}
                  blurStrength={14}
                />

                {/* Item info */}
                <div className={styles.previewInfo}>
                  <span className={styles.catPill}>{catConfig.icon} {catConfig.label}</span>
                  <h3 className={styles.previewTitle}>{item.title}</h3>
                  <p className={styles.previewMeta}>📍 {item.location}</p>
                </div>

                {/* Reminder */}
                <div className={styles.reminderBox}>
                  🔒 Sensitive areas are blurred. If this is really your item,
                  you should be able to answer the questions without seeing them.
                </div>
              </div>
            </div>

            {/* ── RIGHT: Questions form ── */}
            <div className={styles.questionsPanel}>

              <div className={styles.quizCard}>

                {/* Progress bar */}
                <div className={styles.progressSection}>
                  <p className={styles.progressLabel}>
                    Question {currentQ + 1} of {VERIFICATION_QUESTIONS.length}
                  </p>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${((currentQ + 1) / VERIFICATION_QUESTIONS.length) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className={styles.errorAlert}>⚠️ {error}</div>
                )}

                {/* Question dots — shows which questions have answers */}
                <div className={styles.questionDots}>
                  {VERIFICATION_QUESTIONS.map((q, i) => (
                    <button
                      key={q.id}
                      className={[
                        styles.dot,
                        i === currentQ ? styles.dotActive : '',
                        answers[q.id].trim() ? styles.dotFilled : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setCurrentQ(i)}
                      title={`Question ${i + 1}: ${q.label}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {/* The current question */}
                <div className={styles.questionBox}>
                  <span className={styles.qIcon}>{currentQuestion.icon}</span>
                  <label
                    htmlFor={`q-${currentQuestion.id}`}
                    className={styles.qLabel}
                  >
                    {currentQuestion.label}
                  </label>
                  <textarea
                    id={`q-${currentQuestion.id}`}
                    className={styles.qInput}
                    placeholder={currentQuestion.placeholder}
                    value={answers[currentQuestion.id]}
                    onChange={e => handleAnswerChange(currentQuestion.id, e.target.value)}
                    rows={3}
                    maxLength={300}
                  />
                  <span className={styles.charCount}>
                    {answers[currentQuestion.id].length}/300
                  </span>
                </div>

                {/* Navigation buttons */}
                <div className={styles.navBtns}>
                  {currentQ > 0 && (
                    <button className={styles.prevBtn} onClick={goBack}>
                      ← Previous
                    </button>
                  )}

                  {currentQ < VERIFICATION_QUESTIONS.length - 1 ? (
                    <button className={styles.nextBtn} onClick={goNext}>
                      Next →
                    </button>
                  ) : (
                    <button
                      className={styles.submitBtn}
                      onClick={handleSubmit}
                      disabled={verifying}
                    >
                      {verifying
                        ? <><span className={styles.spinner} /> AI is analyzing...</>
                        : '🤖 Submit for AI Verification'
                      }
                    </button>
                  )}
                </div>

                {/* Tip about skipping */}
                <p className={styles.skipNote}>
                  💡 You can skip questions, but answering more gives a higher confidence score.
                </p>

              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════ RESULT STEP ════════════════ */}
      {step === 'result' && result && (
        <VerificationResult
          result={result}
          item={item}
          catConfig={catConfig}
          onTryAgain={() => {
            setStep('quiz');
            setCurrentQ(0);
            setResult(null);
            // Reset answers
            const fresh = {};
            VERIFICATION_QUESTIONS.forEach(q => { fresh[q.id] = ''; });
            setAnswers(fresh);
          }}
          onGoBack={() => navigate('/found-items')}
        />
      )}

    </div>
  );
}

/* ============================================================
   VerificationResult Component
   Shows the AI verification score, animated gauge, 
   per-question breakdown, and the final verdict.
   ============================================================ */
function VerificationResult({ result, item, catConfig, onTryAgain, onGoBack }) {

  // ── Animated score counter (counts up from 0 to the score) ──
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let current = 0;
    const target = result.overallScore;
    const step = Math.max(1, Math.floor(target / 40)); // Speed of counting

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setDisplayScore(current);
    }, 30); // Update every 30ms

    return () => clearInterval(timer);
  }, [result.overallScore]);

  // ── Determine gauge color based on verdict ──
  const gaugeColor = {
    verified:     '#00ff88',  // Green
    needs_review: '#ffb347',  // Orange
    rejected:     '#ff4d6d',  // Red
  }[result.verdict];

  // ── Circumference math for the circular gauge (SVG) ──
  // The gauge is a circle drawn with SVG. We animate how much of it is filled.
  const radius      = 80;
  const circumference = 2 * Math.PI * radius;  // Total circle length
  const fillAmount  = circumference - (circumference * displayScore / 100); // How much to "unfill"

  return (
    <div className={styles.resultPage}>

      {/* Title */}
      <h1 className={styles.resultTitle}>🤖 AI Verification Result</h1>

      {/* Item reference */}
      <div className={styles.resultItemRef}>
        <span>{catConfig.icon}</span>
        <span><strong>{item.title}</strong> — {catConfig.label}</span>
      </div>

      {/* ── Score Gauge (circular progress) ── */}
      <div className={styles.gaugeSection}>
        <div className={styles.gaugeContainer}>
          <svg
            className={styles.gaugeSvg}
            viewBox="0 0 200 200"
            aria-label={`Confidence score: ${result.overallScore}%`}
          >
            {/* Background circle (grey track) */}
            <circle
              cx="100" cy="100" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="12"
            />
            {/* Foreground circle (colored fill) — animated via strokeDashoffset */}
            <circle
              cx="100" cy="100" r={radius}
              fill="none"
              stroke={gaugeColor}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={fillAmount}
              transform="rotate(-90 100 100)"
              style={{
                transition: 'stroke-dashoffset 0.5s ease',
                filter: `drop-shadow(0 0 8px ${gaugeColor}55)`,
              }}
            />
          </svg>
          {/* Score text in the center of the gauge */}
          <div className={styles.gaugeText}>
            <span className={styles.scoreNumber} style={{ color: gaugeColor }}>
              {displayScore}%
            </span>
            <span className={styles.scoreLabel}>Confidence</span>
          </div>
        </div>
      </div>

      {/* ── Verdict Banner ── */}
      <div
        className={`${styles.verdictBanner} ${styles[`verdict_${result.verdict}`]}`}
        role="alert"
      >
        <h2 className={styles.verdictTitle}>{result.verdictLabel}</h2>
        <p className={styles.verdictMsg}>{result.verdictMessage}</p>
      </div>

      {/* ── Per-question breakdown ── */}
      <div className={styles.breakdownSection}>
        <h3 className={styles.breakdownTitle}>📊 Score Breakdown</h3>
        <p className={styles.breakdownSubtitle}>
          Here's how each of your answers was scored by the AI:
        </p>

        <div className={styles.breakdownList}>
          {result.breakdown.map(b => {
            // Determine bar color based on raw score
            const barColor = b.rawScore >= 70 ? '#00ff88'
                           : b.rawScore >= 40 ? '#ffb347'
                           : '#ff4d6d';

            return (
              <div key={b.questionId} className={styles.breakdownItem}>
                {/* Question label */}
                <div className={styles.bqHeader}>
                  <span className={styles.bqIcon}>{b.icon}</span>
                  <span className={styles.bqLabel}>{b.questionLabel}</span>
                  <span className={styles.bqScore} style={{ color: barColor }}>
                    {b.earned}/{b.maxScore}
                  </span>
                </div>

                {/* Score bar */}
                <div className={styles.bqTrack}>
                  <div
                    className={styles.bqFill}
                    style={{
                      width: `${b.rawScore}%`,
                      background: barColor,
                    }}
                  />
                </div>

                {/* Raw score label */}
                <span className={styles.bqPercent} style={{ color: barColor }}>
                  {b.rawScore}% match
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className={styles.resultActions}>
        {result.verdict === 'rejected' && (
          <button className={styles.retryBtn} onClick={onTryAgain}>
            🔄 Try Again with Better Answers
          </button>
        )}
        <button className={styles.backToItemsBtn} onClick={onGoBack}>
          ← Back to Found Items
        </button>
      </div>

    </div>
  );
}

export default ClaimItemPage;
