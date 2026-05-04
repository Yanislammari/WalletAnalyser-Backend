export interface PortfolioResponseDto {
  id: string;
  userId: string;
  name: string;
  displayCurrencyId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
