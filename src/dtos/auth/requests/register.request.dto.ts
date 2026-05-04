export interface RegisterRequestDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RegisterSuperUserRequestDto {
  email: string;
  firstName: string;
  lastName: string;
}
