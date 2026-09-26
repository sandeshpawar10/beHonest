const fs = require('fs');

const lines = fs.readFileSync('src/pages/EscrowPage.jsx', 'utf8').split('\n');

const newLines = lines.slice(0, 719);
newLines.push("                      {escrow.payoutStatus === 'completed' ? (activeTab === 'finder' ? \? Your reward of ?\ has been transferred to your UPI ID. Check your bank app!\ : \? Reward of ?\ was successfully sent to the finder.\) : escrow.ownerConfirmed && escrow.finderConfirmed ? (activeTab === 'finder' ? \? Both parties confirmed! Your reward of ?\ will be transferred to your UPI within 2-3 business days. You'll be notified when the payment is sent.\ : \? Both parties confirmed the exchange. The finder's reward of ?\ is being processed.\) : activeTab === 'finder' ? \? ?\ will be transferred to your UPI within 2-3 business days. Thank you for being honest!\ : \? Reward of ?\ was released to the finder.\}");
newLines.push(...lines.slice(725));

fs.writeFileSync('src/pages/EscrowPage.jsx', newLines.join('\n'));
