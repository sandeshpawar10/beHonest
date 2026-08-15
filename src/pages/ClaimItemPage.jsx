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
import { CATEGORY_CONFIG } from '../utils/itemUtils';
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
  const [errorCount, setErrorCount] = useState(0); // Track consecutive API errors

  // Chat State
  const [chatHistory, setChatHistory] = useState([]);
  const [inputText, setInputText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [started, setStarted] = useState(false);
  const messagesEndRef = useRef(null);

  // Result State
  const [result, setResult] = useState(null);
  
  // Secret Guess State
  const [secretGuess, setSecretGuess] = useState('');
  
  // Proof Image State
  const [proofImageBase64, setProofImageBase64] = useState('');
  
  // Tentative Verdict from Chat
  const [tentativeVerdict, setTentativeVerdict] = useState(null);

  // ── Load the item on mount ────────────────────────────────
  useEffect(() => {
    //const foundItem = getFoundItemById(itemId);
    const fetchItems = async ()=>{
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/getFoundItemById/${itemId}`,{
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
          
          if (fetchedItem.status === 'claimed') {
            setError('This item has already been successfully claimed and verified.');
            setLoading(false);
            return;
          }

          if (fetchedItem.isFinder) {
            setError('You cannot claim an item you reported yourself.');
            setLoading(false);
            return;
          }

          if (!fetchedItem.isSameCollege) {
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
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/claim/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ itemId: item._id, chatHistory: [] })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start interview');
      
      const response = data.aiResponse;
      setChatHistory([{ role: 'ai', text: response.message }]);
      
      if (response.status !== 'continue') {
        setTimeout(() => {
          setTentativeVerdict({
            status: response.status,
            message: response.message,
            score: response.score || 0
          });
          setStep('proof');
          setVerifying(false);
        }, 2000);
      } else {
        setErrorCount(0);
        setVerifying(false);
      }
    } catch (err) {
      console.error(err);
      setError(`⚠️ Sorry for the inconvenience. The AI is currently experiencing heavy traffic. Please try again. (Error: ${err.message})`);
      setStarted(false);
      setVerifying(false);
    }
  };

  // ── Handle Sending a Message ──────────────────────────────
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMsg = { role: 'user', text: inputText };
    const newHistory = [...chatHistory, newMsg];
    setChatHistory(newHistory);
    setInputText('');
    setVerifying(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/claim/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          itemId: item._id, 
          chatHistory: newHistory,
          secretGuess: secretGuess
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify answer');
      
      const response = data.aiResponse;
      const finalHistory = [...newHistory, { role: 'ai', text: response.message }];
      setChatHistory(finalHistory);

      if (response.status !== 'continue') {
        // AI has finished the chat portion.
        setTimeout(() => {
          setTentativeVerdict({
            status: response.status,
            message: response.message,
            score: response.score || 0
          });
          setStep('proof');
          setVerifying(false);
        }, 2000); // Wait 2 seconds so user can read the final message before switching screens
      } else {
        setErrorCount(0); // Reset on success
        setVerifying(false);
      }
    } catch (err) {
      console.error(err);
      if (errorCount >= 1) {
        // This is the second consecutive error -> Restart the test
        setError(`⚠️ The AI servers are severely overloaded right now. We have restarted your interview to clear the session. Please try again.`);
        setStarted(false);
        setChatHistory([]);
        setErrorCount(0);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: `⚠️ Sorry for the inconvenience, but the AI is currently experiencing heavy traffic. Please try sending your last answer again.` }]);
        setErrorCount(prev => prev + 1);
      }
      setVerifying(false);
    }
  };

  // ── Handle Finalize Proof ────────────────────────────────
  const handleFinalizeProof = async (skipPhoto = false) => {
    setVerifying(true);
    setError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/claim/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          itemId: item._id, 
          chatHistory: chatHistory,
          secretGuess: secretGuess,
          tentativeVerdict: tentativeVerdict,
          proofImage: skipPhoto ? '' : proofImageBase64
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize claim');
      
      const claimData = data.claim;
      const finalStatus = claimData.verdict;
      
      let verdictLabel = "Review Required";
      if (finalStatus === "verified") verdictLabel = "✅ Verified Owner";
      else if (finalStatus === "rejected") verdictLabel = "❌ Claim Rejected";
      
      const verificationResult = {
        overallScore: claimData.score || 0,
        verdict: finalStatus,
        verdictLabel,
        verdictMessage: claimData.verdictMessage,
        claimId: claimData._id
      };

      setResult(verificationResult);
      setStep('result');
    } catch (err) {
      console.error(err);
      setError(`⚠️ Failed to finalize proof. ${err.message}`);
    } finally {
      setVerifying(false);
    }
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
                    <div className={styles.introRules}>
                      <p><strong>1.</strong> You will chat with our AI to prove ownership.</p>
                      <p><strong>2.</strong> You must answer specific questions about the item.</p>
                      <p><strong>3.</strong> The AI decides if you pass, fail, or need manual review.</p>
                    </div>
                    
                    <div style={{ marginBottom: '20px', textAlign: 'left', width: '100%', maxWidth: '300px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                        Secret Identifier (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="E.g., Serial number, unique mark..."
                        value={secretGuess}
                        onChange={(e) => setSecretGuess(e.target.value)}
                        className={styles.chatInput}
                        style={{ width: '100%', borderRadius: '8px', border: '1px solid #ccc' }}
                      />
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '4px' }}>
                        If the finder provided a secret identifier, you must guess it correctly here to be verified.
                      </p>
                    </div>

                    <button className={styles.startBtn} onClick={startInterrogation} disabled={verifying}>
                      {verifying ? <><span className="btnSpinner"></span> Starting AI session...</> : 'Start Verification Interview'}
                    </button>
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
                          {verifying ? <><span className="btnSpinner"></span></> : 'Send'}
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

      {/* ════════════════ PROOF UPLOAD STEP ════════════════ */}
      {step === 'proof' && (
        <div className={styles.topBar}>
           <h1 className={styles.pageTitle}>📸 Final Proof</h1>
        </div>
      )}
      {step === 'proof' && (
        <div className={styles.layout}>
          <div className={styles.previewCard} style={{ margin: '0 auto', maxWidth: '600px', textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>You completed the interview!</h2>
            <p style={{ color: '#4a4a68', marginBottom: '2rem' }}>
              Your chat performance was recorded. To boost your final score and complete the verification, please upload a supporting photo.
            </p>

            <div style={{ background: '#f8f9fa', padding: '2rem', borderRadius: '12px', marginBottom: '2rem' }}>
              <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600', color: '#333', fontSize: '1.1rem' }}>
                Upload Proof of Ownership (Optional)
              </label>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
                Upload a receipt, invoice, or an old photo of you with the item.
              </p>
              
              <input
                type="file"
                accept="image/*"
                id="proofUpload"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setProofImageBase64(reader.result);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    setProofImageBase64('');
                  }
                }}
              />
              <label htmlFor="proofUpload" style={{
                display: 'inline-block', padding: '12px 24px', background: '#00d2ff', 
                color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0, 210, 255, 0.2)'
              }}>
                Choose Photo
              </label>

              {proofImageBase64 && (
                <div style={{ marginTop: '20px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #ddd', maxWidth: '300px', margin: '20px auto 0' }}>
                  <img src={proofImageBase64} alt="Proof" style={{ width: '100%', display: 'block' }} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => handleFinalizeProof(true)}
                disabled={verifying}
                style={{ padding: '12px 24px', background: 'transparent', border: '2px solid #ccc', borderRadius: '8px', color: '#666', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Skip Photo
              </button>
              <button 
                onClick={() => handleFinalizeProof(false)}
                disabled={verifying || !proofImageBase64}
                style={{ padding: '12px 24px', background: proofImageBase64 ? '#00d2ff' : '#ccc', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: proofImageBase64 ? 'pointer' : 'not-allowed' }}
              >
                {verifying ? 'Verifying...' : 'Submit Final Proof'}
              </button>
            </div>
          </div>
        </div>
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
            onClick={() => navigate(`/reward/${item._id}`, { state: { claimId: result.claimId } })}
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
            onClick={() => navigate(`/reward/${item._id}`, { state: { claimId: result.claimId } })}
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
