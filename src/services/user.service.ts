import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";

export class UserService {
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;

  constructor() {
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
  }

  public async get_users_pagination( offset : number ): Promise<AuthResponseDto> {
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
}