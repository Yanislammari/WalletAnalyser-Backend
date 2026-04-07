import { UserResponseDto } from "../../user/responses/user.response.dto";

export interface AuthResponseDto {
  token: string;
  user: UserResponseDto;
}
