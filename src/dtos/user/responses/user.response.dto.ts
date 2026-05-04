import UserType from "../../../db_schema/users/user_type";

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  googleId: string | null;
  googlePictureUrl: string | null;
  ban: boolean;
  subscribe : boolean;
  userType: UserType;
  activated: boolean;
  createdAt: Date;
  updatedAt: Date;
}


export interface UsersWithDataResponseDto {
  numberOfUsers : number,
  numberOfBanUsers : number,
  numberOfNewMonthlyUsers : number,
  numberOfPaidUsers : number,
  users : UserResponseDto[]
}