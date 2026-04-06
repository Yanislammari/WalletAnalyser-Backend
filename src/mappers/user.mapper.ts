import { RegisterRequestDto } from "../dtos/auth/requests/register.request.dto";
import { UserResponseDto } from "../dtos/user/responses/user.response.dto";
import { User } from "../db_schema";
import UserType from "../db_schema/users/user_type";

export class UserMapper {
  public userEntityToUserResponseDto(entity: User): UserResponseDto {
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.first_name,
      lastName: entity.last_name,
      ban: entity.ban,
      userType: entity.user_type,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt
    };
  }

  public registerRequestDtoToUserEntity(dto: RegisterRequestDto): Partial<User> {
    return {
      email: dto.email,
      password: dto.password,
      first_name: dto.firstName,
      last_name: dto.lastName,
      ban: false,
      user_type: UserType.USER,
      subscribe: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}
