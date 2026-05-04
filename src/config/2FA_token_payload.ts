export interface Token2FAPayload {
  attemptId: string
}

export interface Store2FAPayload {
  code : string
  userId : string
  expires : number
}
