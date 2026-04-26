import { SALT_ROUNDS } from "../constants/hash";
import { attributesUser, User } from "../db_schema";
import UserType from "../db_schema/users/user_type";
import { RegisterSuperUserRequestDto, SuperUserRegisterDto, UserResponseDto, UsersWithDataResponseDto } from "../dtos";
import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";
import bcrypt from 'bcrypt'
import MailSendingService from "./mail.sending.service";

function generatePassword(length = 9) {
  if (length < 4) {
    throw new Error("Password length must be at least 4");
  }

  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const specials = "!@#$%^&*()_+[]{}|;:,.<>?";

  const getRandomChar = (str : string) =>
    str[Math.floor(Math.random() * str.length)];

  // Ensure at least one of each
  let passwordArray = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(specials),
  ];

  // Fill the rest randomly from all characters
  const allChars = upper + lower + numbers + specials;
  for (let i = passwordArray.length; i < length; i++) {
    passwordArray.push(getRandomChar(allChars));
  }

  // Shuffle the result so it's not predictable
  passwordArray = passwordArray.sort(() => Math.random() - 0.5);
  return passwordArray.join("");
}

export class UserService {
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;
  private readonly mailService : MailSendingService;
  private readonly userPageSideLimit = 25;

  constructor() {
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
    this.mailService = new MailSendingService();
  }

  public async get_users_intro(): Promise<UsersWithDataResponseDto> {
    const usersFromDb : User[] = await this.userRepository.get({
      order: [["email", "ASC"]],
    })
    const realUsersFromDb = usersFromDb.filter(value => value.user_type != UserType.ADMIN)
    const numberOfUsers = realUsersFromDb.length
    const numberOfBanUsers = realUsersFromDb.filter(value => value.ban).length
    const numberOfPaidUsers = realUsersFromDb.filter(value => value.subscribe).length
    const now = new Date();

    const numberOfNewMonthlyUsers = realUsersFromDb.filter(user => {
      const created = new Date(user.created_at);
      return (
        created.getMonth() === now.getMonth() &&
        created.getFullYear() === now.getFullYear()
      );
    }).length;
    const usersLimit = realUsersFromDb.slice(0, this.userPageSideLimit);
    const users = usersLimit.map(user => this.userMapper.userEntityToUserResponseDto(user))
    return {numberOfUsers, numberOfBanUsers, numberOfNewMonthlyUsers, numberOfPaidUsers, users} as UsersWithDataResponseDto
  }
  
  public async get_users_offset(offset : number) : Promise<UserResponseDto[]> {
    const realUsersFromDb : User[] = await this.userRepository.get({
      where : { [attributesUser.userType] : UserType.USER || UserType.SUPER_USER },
      offset : offset,
      limit : this.userPageSideLimit,
      order: [[attributesUser.email, "ASC"]],
    })
    const users = realUsersFromDb.map(user => this.userMapper.userEntityToUserResponseDto(user))
    return users
  }

  public async ban_user(userId : string, ban : boolean ) : Promise<UserResponseDto> {
    const userUpdated : User | null = await this.userRepository.update(userId , { ban })
    if(!userUpdated){
      throw new Error("USER_NOT_EXISTING")
    }
    const user = this.userMapper.userEntityToUserResponseDto(userUpdated)
    return user
  }

    public async registerSuperUser(request: RegisterSuperUserRequestDto): Promise<SuperUserRegisterDto> {
      const exinstingUser: User | null = await this.userRepository.getByEmail(request.email);
      if (exinstingUser) {
        throw new Error("EMAIL_ALREADY_EXISTS");
      }
      
      const password = generatePassword()
      const user: User = this.userMapper.registerRequestSuperUserDtoToUserEntity(request, password) as User;
      await this.mailService.sendPasswordToInvite(user, password)
      const salt: string = await bcrypt.genSalt(SALT_ROUNDS);
      const hashedPassword: string = await bcrypt.hash(password, salt);
  
      user.password = hashedPassword;
  
      const addedUser: User = await this.userRepository.add(user);
      return {
        user: this.userMapper.userEntityToUserResponseDto(addedUser),
      };
    }
}