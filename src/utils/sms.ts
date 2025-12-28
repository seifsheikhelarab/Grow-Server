import logger from "./logger.js";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config({ quiet: true });

/** * Sends an SMS with a verification code using Twilio.
 *
 * @param {string} to - The recipient's phone number.
 * @param {string} code - The verification code to be sent.
 */
export async function sendSMS(to: string, code: string): Promise<void> {
    try {
        const response = await axios.post(process.env.SMS_URL as string, {
            recipient: "2" + to,
            sender_id: process.env.SMS_SENDER_ID as string,
            type: "plain",
            message: `Your Grow verification code is ${code}`
        }, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + process.env.SMS_TOKEN as string
            }
        });
        logger.info(response.data);
    } catch (err) {
        logger.error(err);
    }
}
