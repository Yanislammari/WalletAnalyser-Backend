export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginRequestAdmin2FaDto {
  code : string
  token : string
}
