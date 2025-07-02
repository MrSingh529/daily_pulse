import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

export const onReportSubmitted = functions
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

    const recipients = new Map<string, any>();

    try {
      const adminSnapshot = await db
        .collection("users")
        .where("role", "==", "Admin")
        .get();
      adminSnapshot.forEach((doc) => {
        recipients.set(doc.id, doc.data());
      });
    } catch (e) {
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
      } catch (e) {
        functions.logger.error(
          "Failed to query for RSMs in region",
          submittedByRegion,
          e
        );
      }
    } else {
      functions.logger.log(
        "Report is missing a region. Notifying Admins only."
      );
    }

    if (recipients.size === 0) {
      functions.logger.log("No recipients found (Admins or relevant RSMs).");
      return null;
    }

    const tokens: string[] = [];
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

    const message: admin.messaging.MulticastMessage = {
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
      const failedTokens: string[] = [];
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
