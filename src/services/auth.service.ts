import { SECRET_KEY } from "../constants/env";
import { SALT_ROUNDS } from "../constants/hash";
import { User } from "../db_schema";
import { AuthResponseDto, RegisterRequestDto } from "../dtos";
import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export class AuthService {
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;

  constructor() {
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
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
}
