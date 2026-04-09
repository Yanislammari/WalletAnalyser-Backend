import { LoginTicket, OAuth2Client, TokenPayload } from "google-auth-library";
import jwt from "jsonwebtoken";
import { UserRepository } from "../repositories";
import { OAUTH_CLIENT_ID, SECRET_KEY } from "../constants/env";
import { User } from "../db_schema";
import UserType from "../db_schema/users/user_type";
import { AuthResponseDto } from "../dtos";
import { UserMapper } from "../mappers";

export class GoogleOAuthService {
  private readonly googleOAuthClient: OAuth2Client;
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;

  constructor() {
    this.googleOAuthClient = new OAuth2Client(OAUTH_CLIENT_ID);
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
  }

  public async authWithGoogle(idToken: string): Promise<AuthResponseDto> {
    const ticket: LoginTicket = await this.googleOAuthClient.verifyIdToken({
      idToken: idToken,
      audience: OAUTH_CLIENT_ID,
    });

    const payload: TokenPayload | undefined = ticket.getPayload();
    if (!payload || !payload.email) {
      throw new Error("GOOGLE_AUTH_FAILED");
    }

    let user: User | null = await this.userRepository.getByEmail(payload.email);
    if (!user) {
      const newUser: User = {
        first_name: payload.given_name || "",
        last_name: payload.family_name || "",
        email: payload.email,
        password: null,
        google_id: payload.sub,
        google_picture_url: payload.picture || null,
        ban: false,
        user_type: UserType.USER,
        subscribe: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;

      user = await this.userRepository.add(newUser);
    }

    return {
      token: jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "7d" }),
      user: this.userMapper.userEntityToUserResponseDto(user),
    };
  }
}
