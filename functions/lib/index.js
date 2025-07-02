"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onReportSubmitted = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const fcm = admin.messaging();
exports.onReportSubmitted = functions
    .region("asia-south1")
    .firestore.document("reports/{reportId}")
    .onCreate(async (snapshot, context) => {
    const report = snapshot.data();
    if (!report) {
        functions.logger.log("No data associated with the event");
        return null;
    }
    const submittedByName = report.submittedByName || "A user";
    const ascName = report.ascName || "a location";
    const reportId = context.params.reportId;
    const submittedByRegion = report.submittedByRegion;
    const recipients = new Map();
    try {
        const adminSnapshot = await db
            .collection("users")
            .where("role", "==", "Admin")
            .get();
        adminSnapshot.forEach((doc) => {
            recipients.set(doc.id, doc.data());
        });
    }
    catch (e) {
        functions.logger.error("Failed to query for Admins", e);
    }
    if (submittedByRegion) {
        try {
            const rsmSnapshot = await db
                .collection("users")
                .where("role", "==", "RSM")
                .where("regions", "array-contains", submittedByRegion)
                .get();
            rsmSnapshot.forEach((doc) => {
                recipients.set(doc.id, doc.data());
            });
        }
        catch (e) {
            functions.logger.error("Failed to query for RSMs in region", submittedByRegion, e);
        }
    }
    else {
        functions.logger.log("Report is missing a region. Notifying Admins only.");
    }
    if (recipients.size === 0) {
        functions.logger.log("No recipients found (Admins or relevant RSMs).");
        return null;
    }
    const tokens = [];
    recipients.forEach((user, uid) => {
        if (uid === report.submittedBy) {
            return;
        }
        if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
            tokens.push(...user.fcmTokens);
        }
    });
    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
        functions.logger.log("No FCM tokens found for any recipients.");
        return null;
    }
    const message = {
        notification: {
            title: "New Report Submitted!",
            body: `${submittedByName} just submitted a report for ${ascName}. Tap to view.`,
        },
        webpush: {
            notification: {
                icon: "https://dailypulservs.vercel.app/icons/icon-192x192.png",
            },
            fcmOptions: {
                link: `https://dailypulservs.vercel.app/dashboard/reports?view=${reportId}`,
            },
        },
        tokens: uniqueTokens,
    };
    functions.logger.log(`Sending notification to ${uniqueTokens.length} tokens.`);
    const response = await fcm.sendEachForMulticast(message);
    if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                failedTokens.push(uniqueTokens[idx]);
                functions.logger.error(`Token failed: ${uniqueTokens[idx]}`, resp.error);
            }
        });
        functions.logger.log("List of tokens that caused failures: " + failedTokens);
    }
    return null;
});
//# sourceMappingURL=index.js.map