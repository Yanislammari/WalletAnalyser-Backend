import UserType from "../../../db_schema/users/user_type";

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  googleId: string | null;
  googlePictureUrl: string | null;
  ban: boolean;
  userType: UserType;
  activated: boolean;
  createdAt: Date;
  updatedAt: Date;
}
