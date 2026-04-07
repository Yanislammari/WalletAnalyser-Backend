import AzureBlobService from "./azure.blob.service";
import { MailjetService } from "./mailjet.service";
import jwt from "jsonwebtoken";
import { FRONTEND_URL_PROD, SECRET_KEY } from "../constants/env";
import { User } from "../db_schema";
import { UserRepository } from "../repositories";

class MailSendingService {
  private readonly mailjetService: MailjetService;
  private readonly azureBlobService: AzureBlobService;
  private readonly userRepository: UserRepository;

  constructor() {
    this.mailjetService = new MailjetService();
    this.azureBlobService = new AzureBlobService();
    this.userRepository = new UserRepository();
  }

  public async sendResetPasswordEmail(email: string): Promise<void> {
    const user: User | null = await this.userRepository.getByEmail(email);
    if (!user) {
      throw new Error("EMAIL_NOT_FOUND");
    }

    const token: string = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });
    const resetLink: string = `${FRONTEND_URL_PROD}/reset-password?token=${token}`;
    const subject: string = "Password Reset Request";
    let htmlBody = await this.azureBlobService.getFileAsString("templates", "reset-password.html");

    htmlBody = htmlBody
      .replace(/\${userName}/g, `${user.first_name} ${user.last_name}` || "User")
      .replace(/\${resetLink}/g, resetLink)
      .replace(/\${frontendUrl}/g, FRONTEND_URL_PROD)
      .replace(/\${year}/g, new Date().getFullYear().toString());

    await this.mailjetService.sendEmail(user.email, subject, htmlBody);
  }
}

export default MailSendingService;
