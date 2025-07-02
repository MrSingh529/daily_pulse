'use server';
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

export const onReportSubmitted = functions
  .region("asia-south1")
  .firestore.document("reports/{reportId}")
  .onCreate(async (snapshot, context) => {
    functions.logger.log("Function triggered for reportId:", context.params.reportId);
    
    const report = snapshot.data();

    if (!report) {
      functions.logger.warn("No data associated with the event. Exiting function.");
      return null;
    }
    functions.logger.log("Report data received:", { report });


    const submittedByName = report.submittedByName || "A user";
    const ascName = report.ascName || "a location";
    const reportId = context.params.reportId;
    const submittedByRegion = report.submittedByRegion;

    const recipients = new Map<string, any>();

    // Get all Admins
    try {
      const adminSnapshot = await db
        .collection("users")
        .where("role", "==", "Admin")
        .get();
      adminSnapshot.forEach((doc) => {
        recipients.set(doc.id, doc.data());
      });
      functions.logger.log(`Found ${adminSnapshot.size} admin(s).`);
    } catch (e) {
      functions.logger.error("Failed to query for Admins", e);
    }
    
    // Get all RSMs in the report's region
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
            functions.logger.log(`Found ${rsmSnapshot.size} RSM(s) for region: ${submittedByRegion}.`);
        } catch (e) {
            functions.logger.error("Failed to query for RSMs in region", submittedByRegion, e);
        }
    } else {
        functions.logger.log("Report is missing a region. Notifying Admins only.");
    }

    if (recipients.size === 0) {
        functions.logger.warn("No recipients found (Admins or relevant RSMs). Exiting function.");
        return null;
    }
    functions.logger.log(`Total unique recipients to notify: ${recipients.size}.`);


    // Collect all tokens, excluding the user who submitted the report
    const tokens: string[] = [];
    recipients.forEach((user, uid) => {
      // Do not send notification to the person who submitted the report
      if (uid === report.submittedBy) {
        functions.logger.log(`Skipping recipient ${uid} because they are the submitter.`);
        return;
      }
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        tokens.push(...user.fcmTokens);
      }
    });

    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      functions.logger.warn("No FCM tokens found for any recipients after filtering. Exiting function.");
      return null;
    }
    functions.logger.log(`Found ${uniqueTokens.length} unique FCM tokens to send to.`, { tokens: uniqueTokens });
    
    const message: admin.messaging.MulticastMessage = {
      notification: {
        title: "New Report Submitted!",
        body: `${submittedByName} just submitted a report for ${ascName}.`,
      },
      // Data payload for the service worker to handle for background notifications
      data: {
        title: "New Report Submitted!",
        body: `${submittedByName} just submitted a report for ${ascName}. Tap to view.`,
        icon: "https://dailypulservs.vercel.app/icons/icon-192x192.png",
        link: `https://dailypulservs.vercel.app/dashboard/reports?view=${reportId}`,
      },
      webpush: {
        fcmOptions: {
          link: `https://dailypulservs.vercel.app/dashboard/reports?view=${reportId}`,
        },
      },
      tokens: uniqueTokens,
    };

    functions.logger.log("Sending multicast message...", { message });

    const response = await fcm.sendEachForMulticast(message);

    functions.logger.log(`FCM response received: ${response.successCount} successful, ${response.failureCount} failed.`);

    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(uniqueTokens[idx]);
          functions.logger.error(`Token failed: ${uniqueTokens[idx]}`, { errorInfo: resp.error });
        }
      });
      functions.logger.error("List of tokens that caused failures:", { failedTokens });
    }
    
    return null;
  });