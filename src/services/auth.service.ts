import { SECRET_KEY } from "../constants/env";
import { SALT_ROUNDS } from "../constants/hash";
import { User } from "../db_schema";
import { store2FA } from "../config/store";
import { AuthResponseDto, FirstFaDto, LoginRequestDto, RegisterRequestDto, UserResponseDto } from "../dtos";
import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { GoogleOAuthService } from "./google.oauth.service";
import TokenPayloadUser from "../config/token_payload";
import MailSendingService from "./mail.sending.service";
import UserType from "../db_schema/users/user_type";
import { Token2FAPayload, Store2FAPayload } from "../config/2FA_token_payload";
import { de } from "zod/locales";


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

  hashedCode = (code : string) => {
    return crypto
      .createHmac("sha256", SECRET_KEY)
      .update(code)
      .digest("hex");
  }

  public async login2FaAdmin(code : string , token : string): Promise<AuthResponseDto> {
    const decoded = jwt.verify(token, SECRET_KEY) as Token2FAPayload;
    const hashedCode = this.hashedCode(code);
    const store = store2FA.get(decoded.attemptId) as Store2FAPayload;
    if(!store) {
      throw new Error("NO_STORE");
    }
    if(store.expires < Date.now()) {
      throw new Error("TIME_EXPIRE");
    }
    if(store.code != hashedCode){
      throw new Error("WRONG_CODE")
    }
    const user = await this.userRepository.getById(store.userId);
    if(!user ||user.user_type != UserType.ADMIN){
      throw new Error("WRONG_CODE")
    }
    store2FA.delete(decoded.attemptId);
    return {
      token: jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "7d" }),
      user: this.userMapper.userEntityToUserResponseDto(user),
    };
  }

  public async resendCode2FaAdmin(token : string): Promise<FirstFaDto> {
    const decoded = jwt.verify(token, SECRET_KEY) as Token2FAPayload;
    const store = store2FA.get(decoded.attemptId);
    if(!store){
      throw new Error("TIME_EXPIRE");
    }
    const user: User | null = await this.userRepository.getById(store?.userId);
    if (!user) {
      throw new Error("NO_USER");
    }
    store2FA.delete(decoded.attemptId)
    const code = crypto.randomInt(100000, 1000000).toString();
    this.mailSendingService.send2FAPassword(user, code);
    const hashedCode = this.hashedCode(code);
    const attemptId = `2fa:${crypto.randomUUID()}`;
    store2FA.set(attemptId, { code : hashedCode, userId : user.id , expires : Date.now() + 5 * 60 * 1000 } as Store2FAPayload);

    return {
      token: jwt.sign({ attemptId } as Token2FAPayload, SECRET_KEY, { expiresIn: "1d" }),
    };
  }

  public async loginAdmin(request: LoginRequestDto): Promise<FirstFaDto> {
    const user: User | null = await this.userRepository.getByEmail(request.email);
    if (!user) {
      throw new Error("INVALID_EMAIL_CREDENTIALS");
    }
    if (!user.password) {
      throw new Error("PASSWORD_NOT_SET");
    }

    if(user.user_type != UserType.ADMIN) {
      throw new Error("INVALID_PASSWORD_CREDENTIALS");
    }

    const isPasswordValid: boolean = await bcrypt.compare(request.password, user.password);
    if (!isPasswordValid) {
      throw new Error("INVALID_PASSWORD_CREDENTIALS");
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    this.mailSendingService.send2FAPassword(user, code);
    const hashedCode = this.hashedCode(code);
    const attemptId = `2fa:${crypto.randomUUID()}`;
    store2FA.set(attemptId, { code : hashedCode, userId : user.id , expires : Date.now() + 5 * 60 * 1000 } as Store2FAPayload);

    return {
      token: jwt.sign({ attemptId } as Token2FAPayload, SECRET_KEY, { expiresIn: "1d" }),
    };
  }

  public async login(request: LoginRequestDto): Promise<AuthResponseDto> {
    const user: User | null = await this.userRepository.getByEmail(request.email);
    if (!user) {
      throw new Error("INVALID_EMAIL_CREDENTIALS");
    }
    if (!user.password) {
      throw new Error("PASSWORD_NOT_SET");
    }
    if (user.ban == true) {
      throw new Error("USER_BANNED");
    }

    const isPasswordValid: boolean = await bcrypt.compare(request.password, user.password);
    if (!isPasswordValid) {
      throw new Error("INVALID_PASSWORD_CREDENTIALS");
    }

    return {
      token: jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "7d" }),
      user: this.userMapper.userEntityToUserResponseDto(user),
    };
  }

  public async registerAdmin(request : RegisterRequestDto) {
    const exinstingUser: User | null = await this.userRepository.getByEmail(request.email);
    if (exinstingUser) {
      return;
    }
    const user: User = this.userMapper.registerRequestDtoToUserEntity(request) as User;
    user.user_type = UserType.ADMIN;
    const salt: string = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword: string = await bcrypt.hash(request.password, salt);
    user.password = hashedPassword;

    await this.userRepository.add(user);
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
      token: jwt.sign({ id: addedUser.id }, SECRET_KEY, { expiresIn: "7d" }),
      user: this.userMapper.userEntityToUserResponseDto(addedUser),
    };
  }

  public async authWithGoogle(idToken: string): Promise<AuthResponseDto> {
    try {
      const { token, user } = await this.googleOAuthService.authWithGoogle(idToken);

      return {
        token: token,
        user: user,
      };
    } catch (error: any) {
      throw new Error("GOOGLE_AUTH_FAILED");
    }
  }

  public async sendResetPasswordEmail(email: string): Promise<void> {
    try {
      await this.mailSendingService.sendResetPasswordEmail(email);
    } catch (error: any) {
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
      await this.userRepository.update(user.id, { password: hashedPassword });
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw new Error("RESET_PASSWORD_FAILED");
    }
  }

  public async verifyToken(token: string): Promise<UserResponseDto> {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
      const user: User | null = await this.userRepository.getById(decoded.id);
      if (!user) {
        throw new Error("INVALID_TOKEN");
      }
      return this.userMapper.userEntityToUserResponseDto(user);
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw new Error("TOKEN_VERIFICATION_FAILED");
    }
  }

  public async verifyTokenAdmin(token: string): Promise<UserResponseDto> {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
      const user: User | null = await this.userRepository.getById(decoded.id);
      if (!user || user.user_type != UserType.ADMIN) {
        throw new Error("USER_NOT_FOUND");
      }
      return this.userMapper.userEntityToUserResponseDto(user)
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw new Error("TOKEN_VERIFICATION_FAILED");
    }
  }

  public async checkEmailAvailability(email: string): Promise<boolean> {
    const user: User | null = await this.userRepository.getByEmail(email);
    return user ? false : true;
  }

  public async sendActivateAccountEmail(email: string): Promise<void> {
    try {
      await this.mailSendingService.sendActivateAccountEmail(email);
    }
    catch (error: any) {
      console.log(error);
      if (error.message === "EMAIL_NOT_FOUND") {
        throw new Error("EMAIL_NOT_FOUND");
      }
      throw new Error("SEND_ACTIVATE_ACCOUNT_EMAIL_FAILED");
    }
  }

  public async activateAccount(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, SECRET_KEY) as TokenPayloadUser;
      const user: User | null = await this.userRepository.getById(decoded.id);
      if (!user) {
        throw new Error("INVALID_TOKEN");
      }

      await this.userRepository.activateUser(user.id);
    }
    catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("TOKEN_EXPIRED");
      }
      if (error.name === "JsonWebTokenError") {
        throw new Error("INVALID_TOKEN");
      }
      throw new Error("ACCOUNT_ACTIVATION_FAILED");
    }
  }
}
