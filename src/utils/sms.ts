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
        const response = await axios.post(
            `https://sandbox.1msg.io/${process.env.SMS_CHANNEL}/sendMessage`,
            {
                token: process.env.SMS_TOKEN,
                phone: "2" + to,
                body: `Your Grow verification code is ${code}`
            }
        );
        logger.info(response.data);
    } catch (err) {
        logger.error(err);
    }
}
