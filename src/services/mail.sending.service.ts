import AzureBlobService from "./azure.blob.service";
import { MailjetService } from "./mailjet.service";
import jwt from "jsonwebtoken";
import { FRONTEND_URL_PROD, SECRET_KEY } from "../constants/env";
import { User } from "../db_schema";
import { UserRepository } from "../repositories";
import { DateService } from "./date.service";

class MailSendingService {
  private readonly mailjetService: MailjetService;
  private readonly azureBlobService: AzureBlobService;
  private readonly userRepository: UserRepository;
  private readonly dateService: DateService;

  constructor() {
    this.mailjetService = new MailjetService();
    this.azureBlobService = new AzureBlobService();
    this.userRepository = new UserRepository();
    this.dateService = new DateService();
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

  public async send2FAPassword(user: User,code : string): Promise<void> {
    if (!user) {
      throw new Error("EMAIL_NOT_FOUND");
    }

    const subject: string = "2FA Admin Request";
    let htmlBody = await this.azureBlobService.getFileAsString("templates", "2FA.html");

    htmlBody = htmlBody
      .replace(/\${userName}/g, `${user.first_name} ${user.last_name}` || "User")
      .replace(/\${otpCode}/g, code)
      .replace(/\${requestedAt}/g, this.dateService.formatDateToDDMMYYYY(new Date()))
      .replace(/\${year}/g, new Date().getFullYear().toString())
      .replace(/\${frontendUrl}/g, FRONTEND_URL_PROD);

    await this.mailjetService.sendEmail(user.email, subject, htmlBody);
  }

  public async sendPasswordToInvite(user: User,password : string): Promise<void> {
    if (!user) {
      throw new Error("EMAIL_NOT_FOUND");
    }

    const subject: string = "Invitation to join Wallet Analyser";
    let htmlBody = await this.azureBlobService.getFileAsString("templates", "send-password.html");

    htmlBody = htmlBody
      .replace(/\${userName}/g, `${user.first_name} ${user.last_name}` || "User")
      .replace(/\${password}/g, password)
      .replace(/\${requestedAt}/g, this.dateService.formatDateToDDMMYYYY(new Date()))
      .replace(/\${year}/g, new Date().getFullYear().toString())
      .replace(/\${frontendUrl}/g, FRONTEND_URL_PROD);

    await this.mailjetService.sendEmail(user.email, subject, htmlBody);
  }
}

export default MailSendingService;
