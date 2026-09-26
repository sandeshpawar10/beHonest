// ── Helper: send email via Brevo HTTP API (Bypasses Render SMTP block) ──
async function sendEmail({ to, subject, html }) {
    try {
        console.log(`[EMAIL] Sending via Brevo to: ${to} | Subject: ${subject}`);
        
        // We use EMAIL_USER from environment variables as the verified sender email
        const senderEmail = process.env.EMAIL_USER || 'behonest.noreply@gmail.com';
        
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: "beHonest Support",
                    email: senderEmail
                },
                to: [
                    { email: to }
                ],
                subject: subject,
                htmlContent: html
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[EMAIL] Brevo API error:', errorData);
            return false;
        }

        const data = await response.json();
        console.log(`[EMAIL] Sent successfully! MessageId: ${data.messageId}`);
        return true;
    } catch (err) {
        console.error('[EMAIL] Send failed:', err.message);
        return false;
    }
}

// ── OTP Verification Email ──────────────────────────────────
exports.sendOTP = async function(email, otp) {
    return sendEmail({
        to: email,
        subject: 'Your beHonest Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Welcome to beHonest!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Thank you for registering. Please use the following 6-digit One-Time Password (OTP) to verify your email address:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #fff; background-color: #333; padding: 15px 25px; border-radius: 8px;">
                        ${otp}
                    </span>
                </div>
                <p style="font-size: 14px; color: #666; text-align: center;">
                    This code is valid for the next 5 minutes. Please do not share it with anyone.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    If you did not request this code, please ignore this email.
                </p>
            </div>
        `
    });
};

// ── Password Reset OTP Email ────────────────────────────────
exports.sendPasswordResetOTP = async function(email, otp) {
    return sendEmail({
        to: email,
        subject: 'Your beHonest Password Reset Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Password Reset Request</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">We received a request to reset your password. Please use the following 6-digit One-Time Password (OTP) to reset it:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #fff; background-color: #333; padding: 15px 25px; border-radius: 8px;">
                        ${otp}
                    </span>
                </div>
                <p style="font-size: 14px; color: #666; text-align: center;">
                    This code is valid for the next 10 minutes. Please do not share it with anyone.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    If you did not request a password reset, please ignore this email or contact support if you have concerns.
                </p>
            </div>
        `
    });
};

// ── Claim Notification Email (to Finder) ────────────────────
exports.sendClaimNotification = async function(email, itemTitle, rewardAmount) {
    return sendEmail({
        to: email,
        subject: `🎉 Great News! The owner has claimed the item ${itemTitle} you found`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Thank you for using the beHonest platform. The owner of ${itemTitle} has passed the verification interview and deposited a reward of ₹${rewardAmount}. They are waiting for you in the secure chat to arrange a meetup</p>
                <p style="font-size: 14px; color: #666; text-align: center;">
                    Please visit your Escrow Dashboard to chat with the owner and coordinate the return. Keep being awesome! Thanks for your honesty 😄🙌.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

// ── Dispute Email to Admin ──────────────────────────────────
exports.sendDisputeEmailToAdmin = async function(email, itemTitle, disputeReason, name) {
    return sendEmail({
        to: email,
        subject: `⚠️ A Dispute Has Been Raised Regarding ${itemTitle} by ${name}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Dispute Raised!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">A new dispute has been raised regarding ${itemTitle} on the beHonest platform. <b>Dispute Reason: ${disputeReason}</b>. Please review the dispute and take the necessary action.</p>
                <p style="font-size: 14px; color: #666; text-align: center;">
                    Please visit your Admin Dashboard to review the dispute.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

// ── Dispute Email to Other Party ────────────────────────────
exports.sendDisputeEmail = async function(email, itemTitle, disputeReason) {
    return sendEmail({
        to: email,
        subject: `⚠️ A Dispute Has Been Raised Regarding ${itemTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Dispute Raised!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Thank you for using the beHonest platform.A dispute has been raised regarding ${itemTitle} by the owner. The reason provided for the dispute is: <b>${disputeReason}</b>. Our team will review the dispute and the relevant information before taking further action. Please check your secure chat and cooperate with the verification process if required. We'll keep you updated once the dispute has been reviewed.</p>
                <p style="font-size: 14px; color: #666; text-align: center;">
                    Your dispute has been raised successfully. Our admin team will review it and update you once a decision has been made. 🔍
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

// ── Refund Email ────────────────────────────────────────────
exports.sendRefundEmail = async function(email, itemTitle, amount) {
    return sendEmail({
        to: email,
        subject: `↩️ Refund Initiated for ${itemTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Refund Initiated</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Your escrow deposit of <b>₹${amount}</b> for the item <b>${itemTitle}</b> has been initiated for refund.</p>
                
                <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #1565c0; font-size: 14px;"><b>⏳ Refund Timeline:</b></p>
                    <p style="margin: 5px 0 0 0; color: #1565c0; font-size: 15px;">The refund of <b>₹${amount}</b> may take <b>5-7 business days</b> to reflect in your account, depending on your bank and payment method.</p>
                </div>

                <p style="font-size: 14px; color: #666; text-align: center;">
                    If you don't see the refund after 7 business days, please contact our support team.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

// ── Reward Released Email (handover confirmed — payout in 2-3 days) ─────
exports.sendRewardReleasedEmail = async function(email, itemTitle, amount, upiId) {
    return sendEmail({
        to: email,
        subject: `🎉 Handover Confirmed! ₹${amount} will be transferred to you soon`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Handover Confirmed!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Both you and the owner have confirmed the handover for <b>${itemTitle}</b>. Thank you for being honest! 🙌</p>
                
                <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #856404; font-size: 14px;"><b>💰 Reward Details:</b></p>
                    <p style="margin: 5px 0 0 0; color: #856404; font-size: 15px;">Amount: <b>₹${amount}</b></p>
                    ${upiId ? `<p style="margin: 5px 0 0 0; color: #856404; font-size: 15px;">UPI ID: <b>${upiId}</b></p>` : ''}
                    <p style="margin: 10px 0 0 0; color: #856404; font-size: 15px;">⏳ <b>Expected transfer: within 2-3 business days</b></p>
                </div>

                <p style="font-size: 16px; color: #333;">The payment is being processed through our payment gateway. Once the settlement is complete, the reward will be transferred directly to your UPI ID. You'll receive another email when the money is sent.</p>
                <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
                    Keep being awesome! The world needs more honest people like you. 🏅
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

exports.sendAdminReviewAlert = async function(type, id) {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return;

    return sendEmail({
        to: adminEmail,
        subject: `[Action Required] New ${type} Pending Review`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Manual Review Required</h2>
                <p style="font-size: 16px; color: #333;">Hello Admin,</p>
                <p style="font-size: 16px; color: #333;">A new <b>${type}</b> (ID: ${id}) has been submitted and is waiting for your manual review.</p>
                <p style="font-size: 16px; color: #333;">Please log in to the Admin Portal to review the photos and chat history.</p>
                
                <div style="text-align: center; margin: 25px 0;">
                    <a href="${process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',')[0] : 'http://localhost:5173'}/admin" 
                       style="display: inline-block; padding: 12px 24px; background-color: #110eb98f; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                       Go to Admin Portal
                    </a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

exports.sendApprovalEmail = async function(email, type, itemTitle) {
    const isItem = type === "Item";
    
    return sendEmail({
        to: email,
        subject: isItem ? `Your Item ${itemTitle} has been Approved! 🎉` : `Your Claim for ${itemTitle} has been Verified! 🎉`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Great News!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Your ${isItem ? 'found item report' : 'item claim'} for <b>${itemTitle}</b> has been successfully reviewed and <b>approved</b> by our admin team.</p>
                ${isItem 
                    ? '<p style="font-size: 16px; color: #333;">Your item is now live on the platform! We will notify you when the owner claims it.</p>' 
                    : '<p style="font-size: 16px; color: #333;">You can now proceed to the platform to pay the escrow reward and arrange a meetup to get your item back!</p>'}
                <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
                    Thank you for keeping our campus honest!
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};

exports.sendRejectionEmail = async function(email, type, itemTitle, adminFeedback, isPermanentlyRejected) {
    const actionText = isPermanentlyRejected 
        ? "Unfortunately, this was your second attempt, so this submission has been permanently rejected."
        : "You have <b>one more chance</b> to log in to the platform, edit your submission to fix these issues, and resubmit it.";

    return sendEmail({
        to: email,
        subject: `Update on your ${type} Submission for ${itemTitle}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #d9534f; text-align: center; margin-bottom: 20px;">Action Required</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Our admin team has reviewed your ${type} submission for <b>${itemTitle}</b>, and unfortunately, it has been <b>rejected</b>.</p>
                
                <div style="background-color: #f2dede; padding: 15px; border-left: 4px solid #d9534f; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #a94442; font-size: 14px;"><b>Admin Feedback:</b></p>
                    <p style="margin: 10px 0 0 0; font-style: italic; color: #a94442; font-size: 15px;">"${adminFeedback}"</p>
                </div>

                <p style="font-size: 16px; color: #333;">${actionText}</p>
                <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
                    If you have any questions, please reply to this email.
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification.
                </p>
            </div>
        `
    });
};

// ── Payout Complete Email (to Finder) ────────────────────────
exports.sendPayoutCompleteEmail = async function(email, itemTitle, amount, upiId) {
    return sendEmail({
        to: email,
        subject: `💸 Your Reward of ₹${amount} Has Been Transferred!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                <div style="text-align: center; margin-bottom: 10px;">
                    <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                </div>
                
                <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Reward Transferred!</h2>
                <p style="font-size: 16px; color: #333;">Hello,</p>
                <p style="font-size: 16px; color: #333;">Great news! The admin has successfully processed your reward for returning <b>${itemTitle}</b>.</p>
                
                <div style="background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; color: #2e7d32; font-size: 14px;"><b>Transfer Details:</b></p>
                    <p style="margin: 5px 0 0 0; color: #2e7d32; font-size: 15px;">Amount: <b>₹${amount}</b></p>
                    <p style="margin: 5px 0 0 0; color: #2e7d32; font-size: 15px;">Sent to UPI: <b>${upiId}</b></p>
                </div>

                <p style="font-size: 16px; color: #333;">Please check your bank account or UPI app to confirm receipt. It may take a few minutes for the SMS notification from your bank to arrive.</p>
                <p style="font-size: 14px; color: #666; text-align: center; margin-top: 20px;">
                    Thank you again for your honesty! 🏅
                </p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #aaa; text-align: center;">
                    This is an automated notification. Please do not reply to this email.
                </p>
            </div>
        `
    });
};