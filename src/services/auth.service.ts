import { SECRET_KEY } from "../constants/env";
import { SALT_ROUNDS } from "../constants/hash";
import { User } from "../db_schema";
import { AuthResponseDto, LoginRequestDto, RegisterRequestDto } from "../dtos";
import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { GoogleOAuthService } from "./google.oauth.service";
import TokenPayloadUser from "../config/token_payload";
import MailSendingService from "./mail.sending.service";

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;
  private readonly googleOAuthService: GoogleOAuthService;
  private readonly mailSendingService: MailSendingService;

  constructor() {
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
    this.googleOAuthService = new GoogleOAuthService();
    this.mailSendingService = new MailSendingService();
  }

  public async login(request: LoginRequestDto): Promise<AuthResponseDto> {  
    const user: User | null = await this.userRepository.getByEmail(request.email);
    if (!user) {
      throw new Error("INVALID_EMAIL_CREDENTIALS");
    }
    if (!user.password) {
      throw new Error("PASSWORD_NOT_SET");
    }
  
    const isPasswordValid: boolean = await bcrypt.compare(request.password, user.password);
    if (!isPasswordValid) {
      throw new Error("INVALID_PASSWORD_CREDENTIALS");
    }

    return {
      token: jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "7d" }),
      user: this.userMapper.userEntityToUserResponseDto(user)
    };
  }

  public async register(request: RegisterRequestDto): Promise<AuthResponseDto> {
    const exinstingUser: User | null = await this.userRepository.getByEmail(request.email);
    if (exinstingUser) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }

    const user: User = this.userMapper.registerRequestDtoToUserEntity(request) as User;
    const salt: string = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword: string = await bcrypt.hash(request.password, salt);
    
    user.password = hashedPassword;

    const addedUser: User = await this.userRepository.add(user);
    return {
      token: jwt.sign({ id: addedUser.id }, SECRET_KEY, { expiresIn: "7d"}),
      user: this.userMapper.userEntityToUserResponseDto(addedUser)
    };
  }

  public async authWithGoogle(idToken: string): Promise<AuthResponseDto> {
    try {
      const { token, user } = await this.googleOAuthService.authWithGoogle(idToken);

      return {
        token: token,
        user: user
      };
    }
    catch (error: any) {
      throw new Error("GOOGLE_AUTH_FAILED");
    }
  }

  public async sendResetPasswordEmail(email: string): Promise<void> {
    try {
      await this.mailSendingService.sendResetPasswordEmail(email);
    }
    catch (error: any) {
      console.log(error);
      if (error.message === "EMAIL_NOT_FOUND") {
        throw new Error("EMAIL_NOT_FOUND");
      }
      throw new Error("SEND_RESET_PASSWORD_EMAIL_FAILED");
    }
  }

  public async resetPassword(password: string, token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;

      const user: User | null = await this.userRepository.getById(decoded.id);
      if (!user) {
        throw new Error("INVALID_TOKEN");
      }

      const salt: string = await bcrypt.genSalt(SALT_ROUNDS);
      const hashedPassword: string = await bcrypt.hash(password, salt);

      user.password = hashedPassword;
      await this.userRepository.update(user.id, user);
    }
    catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw new Error("RESET_PASSWORD_FAILED");
    }
  }

  public async checkEmailAvailability(email: string): Promise<boolean> {
    const user: User | null = await this.userRepository.getByEmail(email);
    return user ? false : true;
  }
}
