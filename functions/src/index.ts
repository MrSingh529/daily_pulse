
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
    functions.logger.log("Report data received:", report);

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
      functions.logger.log(`Found ${adminSnapshot.size} admin(s).`);
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
        functions.logger.log(`Found ${rsmSnapshot.size} RSM(s) for region: ${submittedByRegion}.`);
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

    functions.logger.log(`Total unique recipients to notify: ${recipients.size}.`);

    if (recipients.size === 0) {
      functions.logger.log("No recipients found (Admins or relevant RSMs).");
      return null;
    }

    const tokens: string[] = [];
    recipients.forEach((user, uid) => {
      // Do not send notification to the user who submitted the report
      if (uid === report.submittedBy) {
        return;
      }
      if (user.fcmTokens && Array.isArray(user.fcmTokens)) {
        tokens.push(...user.fcmTokens);
      }
    });

    const uniqueTokens = [...new Set(tokens)];
    functions.logger.log(`Found ${uniqueTokens.length} unique FCM tokens to send to.`);

    if (uniqueTokens.length === 0) {
      functions.logger.log("No FCM tokens found for any recipients.");
      return null;
    }

    const message: admin.messaging.MulticastMessage = {
      data: {
        title: "New Report Submitted!",
        body: `${submittedByName} just submitted a report for ${ascName}. Tap to view.`,
        icon: "https://dailypulservs.vercel.app/icons/icon-192x192.png",
        url: `https://dailypulservs.vercel.app/dashboard/reports?view=${reportId}`,
      },
      tokens: uniqueTokens,
    };

    functions.logger.log("Sending multicast message...");
    functions.logger.log("Payload:", JSON.stringify(message.data));

    try {
        const response = await fcm.sendEachForMulticast(message);
        functions.logger.log(`FCM response received: ${response.successCount} successful, ${response.failureCount} failed.`);

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
    } catch(error) {
        functions.logger.error("Error sending FCM message:", error);
    }
    
    return null;
  });
