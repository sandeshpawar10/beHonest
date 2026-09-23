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
import { Bot, Lock, Camera, ImageIcon, BarChart3, Coins, RefreshCw, AlertTriangle, CheckCircle, ArrowLeft, Send, Upload, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BlurableImage from '../components/ui/BlurableImage';
import ButtonSpinner from '../components/ui/ButtonSpinner';
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [activeImgIndex, setActiveImgIndex] = useState(0); // Track consecutive API errors

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

  // ── Helper to check if proof is mandatory ─────────────────
  const isProofMandatory = () => {
    if (!item) return false;
    const cat = item.category?.toLowerCase() || '';
    const title = item.title?.toLowerCase() || '';
    const desc = item.description?.toLowerCase() || '';
    const mandatoryKeywords = ['phone', 'tablet', 'laptop', 'ipad', 'headphones', 'earbuds', 'airpods', 'macbook', 'watch'];
    return mandatoryKeywords.some(kw => cat.includes(kw) || title.includes(kw) || desc.includes(kw));
  };

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
      setError(`Sorry for the inconvenience. The AI is currently experiencing heavy traffic. Please try again. (Error: ${err.message})`);
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
          if (response.status === 'reject') {
            setResult({
              verdict: response.status,
              overallScore: response.score || 0,
              feedback: response.message
            });
            setStep('result');
          } else {
            setStep('proof');
          }
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
        setError(`The AI servers are severely overloaded right now. We have restarted your interview to clear the session. Please try again.`);
        setStarted(false);
        setChatHistory([]);
        setErrorCount(0);
      } else {
        setChatHistory(prev => [...prev, { role: 'ai', text: `Sorry for the inconvenience, but the AI is currently experiencing heavy traffic. Please try sending your last answer again.` }]);
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
      
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      setError(`Failed to finalize proof. ${err.message}`);
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
        <AlertTriangle size={48} style={{ color: '#ff4d6d' }} />
        <h2>{error}</h2>
        <Link to="/found-items" className={styles.linkBtn}><ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Back to Found Items</Link>
      </div>
    );
  }

  const catConfig = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;

  if (isSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', padding: '40px', maxWidth: '600px', margin: '40px auto' }}>
          <CheckCircle size={64} style={{ color: 'var(--accent-cyan, #00d2ff)', margin: '0 auto 20px' }} />
          <h2>Proof Submitted Successfully!</h2>
          <p style={{ margin: '20px 0', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Your claim and answers have been sent to our admin team for manual review. 
            You will receive an email notification once you are verified as the owner.
          </p>
          <button className={styles.submitBtn} onClick={() => navigate('/found-items')}>
            Return to Found Items
          </button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ════════════════ QUIZ STEP (CHAT UI) ════════════════ */}
      {step === 'quiz' && (
        <>
          <div className={styles.topBar}>
            <button className={styles.backBtn} onClick={() => navigate('/found-items')}>
              <ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Back
            </button>
            <h1 className={styles.pageTitle}><Bot size={28} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> AI Ownership Interview</h1>
          </div>

          <div className={styles.layout}>
            {/* ── LEFT: Item preview card ── */}
            <div className={styles.itemPreview}>
              <div className={styles.previewCard} style={{ position: 'relative' }}>
                <BlurableImage
                  imageSrc={item.images && item.images.length > 0 ? item.images[activeImgIndex || 0] : ''}
                  blurZones={item.blurZones}
                  alt={item.shortTitle}
                  blurStrength={14}
                />
                
                {item.images && item.images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveImgIndex(i => (i === 0 ? item.images.length - 1 : i - 1)); }}
                      style={{
                        position: 'absolute', top: '50%', left: '8px', transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%',
                        width: '28px', height: '28px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      ◀
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setActiveImgIndex(i => (i === item.images.length - 1 ? 0 : i + 1)); }}
                      style={{
                        position: 'absolute', top: '50%', right: '8px', transform: 'translateY(-50%)',
                        background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%',
                        width: '28px', height: '28px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      ▶
                    </button>
                  </>
                )}
                
                <div className={styles.previewInfo}>
                  <h3 className={styles.previewTitle}>{item.shortTitle}</h3>
                </div>
                <div className={styles.reminderBox}>
                  <Lock size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Sensitive areas are blurred. If this is really your item,
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
                      {verifying ? <><ButtonSpinner /> Starting AI session...</> : 'Start Verification Interview'}
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
                          {verifying ? <ButtonSpinner /> : <><Send size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Send</>}
                        </button>
                      </form>
                    </div>
                  </>
                )}

              </div>
              
              {/* Error message */}
              {error && (
                <div className={styles.errorAlert} style={{ marginTop: '16px' }}>
                  <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {error}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════════════ PROOF UPLOAD STEP ════════════════ */}
      {step === 'proof' && (
        <>
          <div className={styles.topBar}>
            <h1 className={styles.pageTitle}><Camera size={24} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Final Proof</h1>
          </div>
          <div className={styles.proofContainer}>
            <div className={styles.proofCard}>
              <h2 className={styles.proofHeading}>You completed the interview!</h2>
              <p className={styles.proofSubtext}>
                Your chat performance was recorded. To boost your final score, upload supporting proof.
              </p>

              <div className={styles.proofUploadSection}>
                <label className={styles.proofLabel}>
                  <Upload size={18} /> Upload Proof of Ownership {isProofMandatory() ? <span className={styles.mandatory}>(Required)</span> : '(Optional)'}
                </label>
                <p className={styles.proofHint}>
                  {isProofMandatory() 
                    ? 'For high-value items, you MUST upload a receipt, invoice, or an old photo with the item.'
                    : 'Upload a receipt, invoice, or an old photo of you with the item.'}
                </p>
                
                <div className={styles.proofUploadBtns}>
                  <label className={styles.proofCameraBtn} htmlFor="proof-camera">
                    <Camera size={16} /> Take Photo
                  </label>
                  <label className={styles.proofGalleryBtn} htmlFor="proof-gallery">
                    <ImageIcon size={16} /> Choose from Gallery
                  </label>
                </div>
                
                <input
                  id="proof-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setProofImageBase64(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <input
                  id="proof-gallery"
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setProofImageBase64(reader.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />

                {proofImageBase64 && (
                  <div className={styles.proofPreview}>
                    <img src={proofImageBase64} alt="Proof" className={styles.proofPreviewImg} />
                    <button className={styles.proofRemoveBtn} onClick={() => setProofImageBase64('')}>
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <div className={styles.errorAlert}>
                  <AlertTriangle size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {error}
                </div>
              )}

              <div className={styles.proofActions}>
                {!isProofMandatory() && (
                  <button 
                    className={styles.proofSkipBtn}
                    onClick={() => handleFinalizeProof(true)}
                    disabled={verifying}
                  >
                    Skip Photo
                  </button>
                )}
                <button 
                  className={styles.proofSubmitBtn}
                  onClick={() => handleFinalizeProof(false)}
                  disabled={verifying || !proofImageBase64}
                >
                  {verifying ? <><ButtonSpinner /> Verifying...</> : <><CheckCircle size={16} /> Submit Final Proof</>}
                </button>
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
      <h1 className={styles.resultTitle}><Bot size={28} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> AI Verification Result</h1>

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
        <h3 className={styles.breakdownTitle}><BarChart3 size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> AI Analysis Complete</h3>
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
            <Coins size={18} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Proceed to Escrow
          </button>
        )}

        {result.verdict === 'rejected' && (
          <button className={styles.retryBtn} onClick={onTryAgain}>
            <RefreshCw size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Try Interview Again
          </button>
        )}

        {result.verdict === 'needs_review' && (
          <>
            <div style={{ 
              background: 'rgba(255, 179, 71, 0.1)', 
              border: '1px solid rgba(255, 179, 71, 0.3)', 
              borderRadius: '12px', 
              padding: '20px', 
              textAlign: 'center',
              marginBottom: '16px',
              maxWidth: '400px',
              width: '100%'
            }}>
              <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ffb347', marginBottom: '8px' }}>
                <Clock size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Your claim is under review
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                Your answers were not sufficient for automatic verification. You can try the interview again with better answers, or wait for a manual review.
              </p>
            </div>
            <button className={styles.retryBtn} onClick={onTryAgain}>
              <RefreshCw size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Try Interview Again
            </button>
          </>
        )}

        <button className={styles.backToItemsBtn} onClick={onGoBack}>
          <ArrowLeft size={16} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> Back to Found Items
        </button>
      </div>
    </div>
  );
}

export default ClaimItemPage;
