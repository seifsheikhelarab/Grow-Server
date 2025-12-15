// import logger from './logger.js';

// /** * Sends an SMS with a verification code using Twilio.
//  *
//  * @param {string} to - The recipient's phone number.
//  * @param {string} code - The verification code to be sent.
//  */
// export async function sendSMS(to: string, code: string): Promise<void> {
// 	if (!accountSid || !authToken || !fromPhoneNumber) {
// 		logger.warn('Twilio configuration is missing. SMS not sent.');
// 		logger.info(`Mock SMS to ${to}: Your verification code is ${code}`);
// 		return;
// 	}
// 	try {
// 		const client = twilio(accountSid, authToken);
// 		const message = await client.messages.create({
// 			body: `Your verification to Grow code is ${code}`,
// 			from: fromPhoneNumber,
// 			to: "+2" + to
// 		});
// 		logger.info(`SMS sent to ${to}: ${message.sid}`);
// 	} catch (err) {
// 		logger.error(`Error sending SMS: ${err}`);
// 		throw err;
// 	}
// }
