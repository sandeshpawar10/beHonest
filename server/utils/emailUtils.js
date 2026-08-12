const nodemailer = require('nodemailer');
const path = require('path');

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
        const mailOptions = {
            from: `"beHonest Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your beHonest Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 12px; background-color: #f9f9f9;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <img src="cid:behonestlogo" alt="beHonest Logo" style="height: 50px; width: auto;" />
                    </div>
                    <h2 style="color: #00d4ff; text-align: center; margin-bottom: 20px;">Welcome to beHonest!</h2>
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
            `,
            attachments: [{
                filename: 'logo.png',
                path: logoPath,
                cid: 'behonestlogo' // same cid value as in the html img src
            }]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("OTP email sent: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Error sending OTP email:", error);
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
                        <img src="cid:behonestlogo" alt="beHonest Logo" style="height: 50px; width: auto;" />
                    </div>
                    <h2 style="color: #00d4ff; text-align: center; margin-bottom: 20px;">Great News!</h2>
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
            `,
            attachments: [{
                filename: 'logo.png',
                path: logoPath,
                cid: 'behonestlogo' // same cid value as in the html img src
            }]
        };

        const info = await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error("Error sending escrow email", error);
        return false;
    }
};
