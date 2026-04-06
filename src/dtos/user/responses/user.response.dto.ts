import UserType from "../../../db_schema/users/user_type";

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  ban: boolean;
  userType: UserType;
  createdAt: Date;
  updatedAt: Date;
}
