const claimModel = require("../models/claimModel");
const itemModel = require("../models/foundItemModel");
const { ACTIVE_CLAIM_STATUSES } = require("../constants/claimStatuses");

const CLAIM_NOT_PERMITTED = "Claim is not permitted.";
const ACTIVE_CLAIM_EXISTS = "An active claim already exists for this item.";

// Email addresses are user data, so this deliberately does not throw for
// malformed values. A missing/invalid domain must never match another one.
function normalizeCollegeDomain(email) {
    if (typeof email !== "string") return null;

    const normalized = email.trim().toLowerCase();
    if (!normalized || /\s/.test(normalized)) return null;
    const atIndex = normalized.indexOf("@");
    if (atIndex <= 0 || atIndex !== normalized.lastIndexOf("@")) return null;

    const domain = normalized.slice(atIndex + 1);
    if (!domain || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
        return null;
    }

    // Keep the comparison conservative: only compare ordinary DNS-like
    // domains and never compare an empty or malformed value.
    const labels = domain.split(".");
    if (domain.length > 253 || labels.length < 2 ||
        !labels.every((label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return null;
    return domain;
}

function sameCollegeDomain(claimantEmail, reporterEmail) {
    const claimantDomain = normalizeCollegeDomain(claimantEmail);
    const reporterDomain = normalizeCollegeDomain(reporterEmail);
    return Boolean(claimantDomain && reporterDomain && claimantDomain === reporterDomain);
}

function idsMatch(left, right) {
    if (left === null || left === undefined || right === null || right === undefined) return false;
    return String(left) === String(right);
}

function authorizationFailure(status, error) {
    return { ok: false, status, error };
}

/**
 * All claim entry points use this check. Keep the duplicate lookup here in
 * addition to the database unique index: it gives callers a useful response
 * before expensive work, while the index closes concurrent request races.
 */
async function authorizeClaim({ itemId, user }) {
    if (!user?._id) return authorizationFailure(401, "Please sign in to continue.");
    if (user.isEmailVerified !== true) return authorizationFailure(403, CLAIM_NOT_PERMITTED);
    const item = await itemModel.findById(itemId).populate("reportedBy", "email");
    if (!item) return authorizationFailure(404, "Item not found.");

    const claimantId = user?._id;
    const reporter = item.reportedBy;
    const reporterId = reporter?._id || reporter;

    if (idsMatch(reporterId, claimantId)) {
        return authorizationFailure(403, CLAIM_NOT_PERMITTED);
    }

    if (!sameCollegeDomain(user?.email, reporter?.email)) {
        return authorizationFailure(403, CLAIM_NOT_PERMITTED);
    }

    if (item.status !== "found") {
        return authorizationFailure(400, "Item is not available for claiming.");
    }

    const existingClaim = await claimModel.findOne({
        itemId: item._id,
        claimantId,
        verdict: { $in: ACTIVE_CLAIM_STATUSES }
    });
    if (existingClaim) {
        return authorizationFailure(409, ACTIVE_CLAIM_EXISTS);
    }

    return { ok: true, item };
}

// Structural validation only: browser-provided text is not an authenticated
// interview record. A server-owned interview session is a separate requirement.
function hasInterviewContent(chatHistory) {
    if (!Array.isArray(chatHistory)) return false;

    const hasQuestion = chatHistory.some((message) =>
        message?.role === "ai" && typeof message.text === "string" && message.text.trim().length > 0
    );
    const hasAnswer = chatHistory.some((message) =>
        message?.role === "user" && typeof message.text === "string" && message.text.trim().length > 0
    );
    return hasQuestion && hasAnswer;
}

module.exports = {
    ACTIVE_CLAIM_STATUSES,
    ACTIVE_CLAIM_EXISTS,
    CLAIM_NOT_PERMITTED,
    authorizeClaim,
    hasInterviewContent,
    normalizeCollegeDomain,
    sameCollegeDomain
};
