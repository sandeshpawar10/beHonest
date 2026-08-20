const nodemailer = require('nodemailer');
const path = require('path');
const dns = require('dns');

// CRITICAL: Force ALL DNS lookups to prefer IPv4
// Render free tier has no IPv6 connectivity
dns.setDefaultResultOrder('ipv4first');

const logoPath = path.join(__dirname, '../../public/logo.png');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

exports.sendOTP = async function(email, otp) {
    try {
        console.log(`[EMAIL DEBUG] Attempting to send OTP to: ${email}`);
        console.log(`[EMAIL DEBUG] EMAIL_USER is set: ${!!process.env.EMAIL_USER}`);
        console.log(`[EMAIL DEBUG] EMAIL_PASS is set: ${!!process.env.EMAIL_PASS}`);
        console.log(`[EMAIL DEBUG] EMAIL_PASS length: ${(process.env.EMAIL_PASS || '').length}`);
        
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[EMAIL DEBUG] OTP sent successfully! MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("[EMAIL DEBUG] FULL ERROR OBJECT:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error("[EMAIL DEBUG] Error name:", error.name);
        console.error("[EMAIL DEBUG] Error code:", error.code);
        console.error("[EMAIL DEBUG] Error message:", error.message);
        return false;
    }
};

exports.sendPasswordResetOTP = async function(email, otp) {
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending Password Reset OTP email:", error);
        return false;
    }
};

exports.sendClaimNotification = async function(email, itemTitle, rewardAmount) {
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending escrow email", error);
        return false;
    }
};

exports.sendDisputeEmailToAdmin = async function(email, itemTitle, disputeReason, name){
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
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
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending escrow email", error);
        return false;
    }
}

exports.sendDisputeEmail = async function(email, itemTitle, disputeReason){
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `⚠️ A Dispute Has Been Raised Regarding ${itemTitle}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                    </div>
                    
                    <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Dispute Raised!</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Thank you for using the beHonest platform.A dispute has been raised regarding ${itemTitle} by the owner. The reason provided for the dispute is: <b>${disputeReason}</b>. Our team will review the dispute and the relevant information before taking further action. Please check your secure chat and cooperate with the verification process if required. We’ll keep you updated once the dispute has been reviewed.</p>
                    <p style="font-size: 14px; color: #666; text-align: center;">
                        Your dispute has been raised successfully. Our admin team will review it and update you once a decision has been made. 🔍
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #aaa; text-align: center;">
                        This is an automated notification. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending escrow email", error);
        return false;
    }
}

exports.sendRefundEmail = async function(email, itemTitle, amount) {
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `💸 Refund Processed for ${itemTitle}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                    </div>
                    
                    <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Refund Successful</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Your escrow deposit of ₹${amount} for the item <b>${itemTitle}</b> has been successfully refunded.</p>
                    <p style="font-size: 14px; color: #666; text-align: center;">
                        The amount should reflect in your account shortly depending on your payment provider. If you have any issues, please contact our support team.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #aaa; text-align: center;">
                        This is an automated notification. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending refund email", error);
        return false;
    }
}

exports.sendRewardReleasedEmail = async function(email, itemTitle, amount) {
    try {
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `🎉 Reward Released! You've received ₹${amount}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="https://behonest-xi.vercel.app/logo.png" alt="beHonest Logo" style="height: 80px; width: auto;" />
                    </div>
                    
                    <h2 style="color: #110eb98f; text-align: center; margin-bottom: 20px;">Money Sent!</h2>
                    <p style="font-size: 16px; color: #333;">Hello,</p>
                    <p style="font-size: 16px; color: #333;">Both you and the owner have confirmed the handover for <b>${itemTitle}</b>.</p>
                    <p style="font-size: 16px; color: #333;">The escrow reward of <b>₹${amount}</b> has been officially released to your account!</p>
                    <p style="font-size: 14px; color: #666; text-align: center;">
                        Thank you for your honesty and for making the campus a better place. The money should reflect in your registered payment method shortly.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                    <p style="font-size: 12px; color: #aaa; text-align: center;">
                        This is an automated notification. Please do not reply to this email.
                    </p>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending reward released email", error);
        return false;
    }
}
