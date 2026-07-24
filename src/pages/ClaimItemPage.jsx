/* ============================================================
   ClaimItemPage.jsx
   Route: /claim/:itemId  (protected — must be logged in)

   PURPOSE:
   When a student thinks a found item belongs to them, they
   come to this page to "claim" it. The AI conducts a conversational
   interview to verify ownership.
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BlurableImage from '../components/ui/BlurableImage';
import { getFoundItemById, CATEGORY_CONFIG } from '../utils/itemUtils';
import { saveClaim } from '../utils/verificationUtils';
import { runInteractiveInterrogation } from '../utils/geminiService';
import styles from './ClaimItemPage.module.css';

function ClaimItemPage() {
  const { itemId }  = useParams();
  const navigate    = useNavigate();
  const { session } = useAuth();

  // ── State ─────────────────────────────────────────────────
  const [item, setItem]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState('quiz'); // 'quiz' (chat) | 'result'
  const [error, setError]     = useState('');

  // Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef(null);

  // Result State
  const [result, setResult] = useState(null);

  // ── Load the item on mount ────────────────────────────────
  useEffect(() => {
    //const foundItem = getFoundItemById(itemId);
    const fetchItems = async ()=>{
        try {
          const response = await fetch(`http://localhost:8000/api/item/getFoundItemById/${itemId}`,{
            method: 'GET',
            credentials: 'include'
          })
          if(!response.ok){
            setError("Could not fetch item from the server.")
            setLoading(false)
            return
          }
          const data = await response.json();
          const fetchedItem = data.items || data;
          
          if (!fetchedItem) {
            setError('Item not found.');
            setLoading(false);
            return;
          }

          const finderEmail = fetchedItem.reportedBy?.email || fetchedItem.foundBy || '';
          if (finderEmail && session?.email && finderEmail.toLowerCase() === session.email.toLowerCase()) {
            setError('You cannot claim an item you reported yourself.');
            setLoading(false);
            return;
          }

          const finderDomain = finderEmail ? finderEmail.split('@')[1] : null;
          const userDomain = session?.email ? session.email.split('@')[1] : null;
          if (finderDomain && userDomain && finderDomain.toLowerCase() !== userDomain.toLowerCase()) {
            setError('You can only claim items reported by students from your own college domain.');
            setLoading(false);
            return;
          }

          setItem(fetchedItem);
        }
        catch (error) {
          console.error("Error occurred during fetching items:", error);
          setError("A network error occurred");
        }
        finally{
          setLoading(false);
        }
    }
    fetchItems();
  }, [itemId, session]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, verifying]);

  // ── Start Interrogation ───────────────────────────────────
  const startInterrogation = async () => {
    setStarted(true);
    setVerifying(true);
    setError('');

    try {
      const response = await runInteractiveInterrogation(item, []);
      setChatHistory([{ role: 'ai', text: response.message }]);
      setVerifying(false);
    } catch (err) {
      console.error(err);
      setError(`Failed to connect to the security AI: ${err.message || 'Unknown error'}`);
      setStarted(false);
      setVerifying(false);
    }
  };

  // ── Send Message ──────────────────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || verifying) return;

    const userMessage = inputText.trim();
    setInputText('');

    const newHistory = [...chatHistory, { role: 'user', text: userMessage }];
    setChatHistory(newHistory);
    setVerifying(true);

    try {
      const response = await runInteractiveInterrogation(item, newHistory);
      
      const finalHistory = [...newHistory, { role: 'ai', text: response.message }];
      setChatHistory(finalHistory);

      if (response.status !== 'continue') {
        // AI has reached a verdict
        setTimeout(() => {
          handleVerdict(response, finalHistory);
        }, 2000); // Wait 2 seconds so user can read the final message before switching screens
      } else {
        setVerifying(false);
      }
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'ai', text: `Sorry, I encountered an error: ${err.message || 'Unknown error'}` }]);
      setVerifying(false);
    }
  };

  // ── Handle Verdict ────────────────────────────────────────
  const handleVerdict = (response, finalHistory) => {
    let verdictLabel = '';
    let finalVerdict = response.status;
    
    if (finalVerdict === 'verified') {
      verdictLabel = '✅ Verified Owner';
    } else if (finalVerdict === 'needs_review') {
      verdictLabel = '🔍 Needs Review';
    } else {
      verdictLabel = '❌ Verification Failed';
      finalVerdict = 'rejected';
    }

    const verificationResult = {
      overallScore: response.score || 0,
      verdict: finalVerdict,
      verdictLabel,
      verdictMessage: response.message
    };

    saveClaim({
      itemId:       item.id,
      itemTitle:    item.title,
      claimantEmail: session.email,
      claimantName: session.fullName,
      answers: finalHistory, // Save the chat history as the answers
      result: verificationResult,
    });

    setResult(verificationResult);
    setStep('result');
    setVerifying(false);
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

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ════════════════ QUIZ STEP (CHAT UI) ════════════════ */}
      {step === 'quiz' && (
        <>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => navigate('/found-items')}>
              ← Back
            </button>
            <h1 className={styles.pageTitle}>🤖 AI Ownership Interview</h1>
          </div>

          <div className={styles.layout}>
            {/* ── LEFT: Item preview card ── */}
            <div className={styles.itemPreview}>
              <div className={styles.previewCard}>
                <BlurableImage
                  imageSrc={item.images && item.images.length > 0 ? item.images[0] : ''}
                  blurZones={item.blurZones}
                  alt={item.shortTitle}
                  blurStrength={14}
                />
                <div className={styles.previewInfo}>
                  <h3 className={styles.previewTitle}>{item.shortTitle}</h3>
                </div>
                <div className={styles.reminderBox}>
                  🔒 Sensitive areas are blurred. If this is really your item,
                  you should be able to answer the AI's questions.
                </div>
              </div>
            </div>

            {/* ── RIGHT: Interactive Chat ── */}
            <div className={styles.questionsPanel}>
              <div className={styles.chatContainer}>
                
                {!started ? (
                  <div className={styles.startBtnBox}>
                    {verifying ? (
                      <div className={styles.centerMsg}>
                        <div className={styles.spinner} />
                        <p>Initializing AI Interview...</p>
                      </div>
                    ) : (
                      <button className={styles.startBtn} onClick={startInterrogation}>
                        Start Verification Interview
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className={styles.chatHistory}>
                      <div className={styles.msgRow + ' ' + styles.ai}>
                        <div className={styles.msgBubble}>
                          <em>Connection established with AI Security Guard.</em>
                        </div>
                      </div>

                      {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`${styles.msgRow} ${styles[msg.role]}`}>
                          <div className={styles.msgBubble}>{msg.text}</div>
                        </div>
                      ))}

                      {verifying && (
                        <div className={`${styles.msgRow} ${styles.ai}`}>
                          <div className={styles.msgBubble}>
                            <div className={styles.typingIndicator}>
                              <div className={styles.chatDot}></div>
                              <div className={styles.chatDot}></div>
                              <div className={styles.chatDot}></div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div className={styles.chatInputArea}>
                      <form className={styles.chatInputForm} onSubmit={handleSendMessage}>
                        <input
                          type="text"
                          className={styles.chatInput}
                          placeholder="Type your answer..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          disabled={verifying}
                          autoFocus
                        />
                        <button 
                          type="submit" 
                          className={styles.sendBtn}
                          disabled={verifying || !inputText.trim()}
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </>
                )}

              </div>
              
              {/* Error message */}
              {error && (
                <div className={styles.errorAlert} style={{ marginTop: '16px' }}>
                  ⚠️ {error}
                </div>
              )}
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
            setResult(null);
            setChatHistory([]);
            setStarted(false);
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
  const navigate = useNavigate();

  // ── Animated score counter (counts up from 0 to the score) ──
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let current = 0;
    const target = result.overallScore;
    const step = Math.max(1, Math.floor(target / 40));

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      setDisplayScore(current);
    }, 30);

    return () => clearInterval(timer);
  }, [result.overallScore]);

  // ── Determine gauge color based on verdict ──
  const gaugeColor = {
    verified:     '#00ff88',
    needs_review: '#ffb347',
    rejected:     '#ff4d6d',
  }[result.verdict];

  const radius      = 80;
  const circumference = 2 * Math.PI * radius;
  const fillAmount  = circumference - (circumference * displayScore / 100);

  return (
    <div className={styles.resultPage}>
      <h1 className={styles.resultTitle}>🤖 AI Verification Result</h1>

      <div className={styles.resultItemRef}>
        <span>{catConfig.icon}</span>
        <span><strong>{item.shortTitle}</strong> — {catConfig.label}</span>
      </div>

      <div className={styles.gaugeSection}>
        <div className={styles.gaugeContainer}>
          <svg
            className={styles.gaugeSvg}
            viewBox="0 0 200 200"
            aria-label={`Confidence score: ${result.overallScore}%`}
          >
            <circle
              cx="100" cy="100" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="12"
            />
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
          <div className={styles.gaugeText}>
            <span className={styles.scoreNumber} style={{ color: gaugeColor }}>
              {displayScore}%
            </span>
            <span className={styles.scoreLabel}>Confidence</span>
          </div>
        </div>
      </div>

      {/* <div
        className={`${styles.verdictBanner} ${styles[`verdict_${result.verdict}`]}`}
        role="alert"
      >
        <h2 className={styles.verdictTitle}>{result.verdictLabel}</h2>
        <p className={styles.verdictMsg}>{result.verdictMessage}</p>
      </div> */}

      <div className={styles.breakdownSection}>
        <h3 className={styles.breakdownTitle}>📊 AI Analysis Complete</h3>
        <p className={styles.breakdownSubtitle}>
          The AI has processed your interview answers against the hidden item identifiers.
        </p>
      </div>

      <div className={styles.resultActions}>
        {result.verdict === 'verified' && (
          <button
            className={styles.rewardBtn}
            onClick={() => navigate(`/reward/${item._id}`)}
          >
            💰 Proceed to Escrow
          </button>
        )}

        {result.verdict === 'rejected' && (
          <button className={styles.retryBtn} onClick={onTryAgain}>
            🔄 Try Interview Again
          </button>
        )}

        {result.verdict === 'needs_review' && (
          <button
            className={styles.rewardBtn}
            onClick={() => navigate(`/reward/${item._id}`)}
          >
            💰 Proceed to Escrow (Pending Review)
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
