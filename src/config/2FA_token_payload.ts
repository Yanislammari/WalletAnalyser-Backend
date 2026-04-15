export interface Token2FAPayload {
  attemptId: string
  userId : string
}

export interface Store2FAPayload {
  code : string
  userId : string
  expires : number
}
