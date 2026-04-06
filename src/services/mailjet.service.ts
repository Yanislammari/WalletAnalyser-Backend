import Mailjet from "node-mailjet";
import { MJ_API_KEY, MJ_API_SECRET, MJ_SENDER } from "../constants/env";

export class MailjetService {
  private readonly mailjetClient: Mailjet;

  constructor() {
    this.mailjetClient = new Mailjet({
      apiKey: MJ_API_KEY,
      apiSecret: MJ_API_SECRET
    });
  }

  public async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    try {
      await this.mailjetClient.post("send", { version: "v3.1" }).request({
        Messages: [
          {
            From: {
              Email: MJ_SENDER,
              Name: "WalletAnalyser"
            },
            To: [
              {
                Email: to,
              }
            ],
            Subject: subject,
            HTMLPart: htmlBody
          }
        ]
      });
    }
    catch (error) {
      throw new Error("EMAIL_SENDING_FAILED");
    }
  }
}
