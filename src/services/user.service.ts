import { attributesUser, User } from "../db_schema";
import UserType from "../db_schema/users/user_type";
import { UserResponseDto, UsersWithDataResponseDto } from "../dtos";
import { UserMapper } from "../mappers";
import { UserRepository } from "../repositories";

export class UserService {
  private readonly userRepository: UserRepository;
  private readonly userMapper: UserMapper;
  private readonly userPageSideLimit = 25;

  constructor() {
    this.userRepository = new UserRepository();
    this.userMapper = new UserMapper();
  }

  public async get_users_intro(): Promise<UsersWithDataResponseDto> {
    const usersFromDb : User[] = await this.userRepository.get({
      order: [["email", "ASC"]],
    })
    const realUsersFromDb = usersFromDb.filter(value => value.user_type == UserType.USER)
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
      where : { [attributesUser.userType] : UserType.USER },
      offset : offset,
      limit : this.userPageSideLimit,
      order: [["email", "ASC"]],
    })
    const realUsers = realUsersFromDb.filter(value => value.user_type == UserType.USER)
    const users = realUsers.map(user => this.userMapper.userEntityToUserResponseDto(user))
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
}